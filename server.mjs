import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "2mb" }));

function needEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const RAW_BASE = needEnv("LITELLM_BASE_URL").trim().replace(/\/$/, "");
const LITELLM_API_KEY = (process.env.LITELLM_API_KEY || "").trim();

// Optional OpenRouter identification headers (recommended)
const OPENROUTER_SITE_URL = (process.env.OPENROUTER_SITE_URL || "").trim();
const OPENROUTER_APP_NAME = (process.env.OPENROUTER_APP_NAME || "").trim();

// Normalize base so we can call /v1/* reliably
const BASE_V1 = RAW_BASE.endsWith("/v1") ? RAW_BASE : `${RAW_BASE}/v1`;

console.log("✅ Booting server.mjs...");
console.log("PORT =", process.env.PORT);
console.log("LITELLM_BASE_URL =", RAW_BASE);
console.log("LITELLM_API_KEY =", LITELLM_API_KEY ? "SET" : "MISSING");
console.log("OPENROUTER_SITE_URL =", OPENROUTER_SITE_URL || "(not set)");
console.log("OPENROUTER_APP_NAME =", OPENROUTER_APP_NAME || "(not set)");

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (LITELLM_API_KEY) headers.Authorization = `Bearer ${LITELLM_API_KEY}`;

  // OpenRouter recommended headers (safe even if not OpenRouter)
  if (OPENROUTER_SITE_URL) headers["HTTP-Referer"] = OPENROUTER_SITE_URL;
  if (OPENROUTER_APP_NAME) headers["X-Title"] = OPENROUTER_APP_NAME;

  return headers;
}

async function fetchJson(url, { method = "GET", headers = {}, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await res.text();

    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    return { ok: res.ok, status: res.status, json, raw: text };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeModelId(input) {
  let m = String(input || "").trim();
  if (!m) return m;

  // Remove UI junk
  m = m.replace(/\(Recommended\)/gi, "").replace(/Recommended/gi, "").trim();
  m = m.replace(/…/g, "").trim();

  // If UI sends openrouter/<provider>/<model>, OpenRouter expects <provider>/<model>
  if (m.toLowerCase().startsWith("openrouter/")) m = m.slice("openrouter/".length);

  // Handle truncated label like "GPT-4o Mi"
  const compact = m.replace(/\./g, "").trim().toLowerCase();
  if (compact === "gpt-4o mi" || compact === "gpt-4o mini") return "openai/gpt-4o-mini";

  // Map UI labels to real ids
  const MODEL_ALIAS = {
    "GPT-4o Mini": "openai/gpt-4o-mini",
    "GLM 4.7 Flash": "z-ai/glm-4.7-flash",
    "Kimi K2.5": "moonshotai/kimi-k2.5",
  };

  if (MODEL_ALIAS[m]) return MODEL_ALIAS[m];

  return m;
}

async function callChatCompletions(payload) {
  const url = `${BASE_V1}/chat/completions`;
  const out = await fetchJson(url, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!out.ok) {
    const msg =
      out.json?.error?.message ||
      out.json?.message ||
      out.json?.detail ||
      out.raw ||
      `HTTP ${out.status}`;

    // Make OpenRouter credit errors obvious in logs
    console.error("❌ Provider error:", msg);
    throw new Error(String(msg));
  }

  return out.json;
}

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Debug endpoint (to verify key + models quickly)
app.get("/api/debug/litellm", async (_req, res) => {
  const models = await fetchJson(`${BASE_V1}/models`, { headers: buildHeaders() });
  res.json({
    base: RAW_BASE,
    baseV1: BASE_V1,
    hasKey: !!LITELLM_API_KEY,
    modelsOk: models.ok,
    modelsStatus: models.status,
    // keep it small
    modelsSample: Array.isArray(models.json?.data) ? models.json.data.slice(0, 5) : models.json,
  });
});

// Friendly GET
app.get("/api/benchmark", (_req, res) => {
  res.json({ ok: true, hint: "Use POST /api/benchmark with JSON body." });
});

app.post("/api/benchmark", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const models = Array.isArray(req.body?.models) ? req.body.models : [];
    const judgeModel = String(req.body?.judgeModel || "").trim();

    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    if (!models.length) return res.status(400).json({ error: "models[] is required" });
    if (!judgeModel) return res.status(400).json({ error: "judgeModel is required" });

    const results = [];
    const judgeId = normalizeModelId(judgeModel);

    for (const modelRaw of models) {
      const modelId = normalizeModelId(modelRaw);

      // 1) Generate
      const writerResp = await callChatCompletions({
        model: modelId,
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are a creative writing assistant." },
          { role: "user", content: prompt },
        ],
      });

      const output = writerResp?.choices?.[0]?.message?.content || "";

      // 2) Judge
      const judgeResp = await callChatCompletions({
        model: judgeId,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return JSON only." },
          {
            role: "user",
            content: `
Return ONLY JSON keys: themeCoherence, creativity, fluency, engagement, totalScore.
Scores 0-10, totalScore = sum (0-40).

PROMPT:
${prompt}

MODEL:
${modelId}

OUTPUT:
${output}
            `.trim(),
          },
        ],
      });

      const judgeText = judgeResp?.choices?.[0]?.message?.content || "{}";
      let scores = {};
      try {
        scores = JSON.parse(judgeText);
      } catch {
        scores = {};
      }

      const themeCoherence = Number(scores.themeCoherence || 0);
      const creativity = Number(scores.creativity || 0);
      const fluency = Number(scores.fluency || 0);
      const engagement = Number(scores.engagement || 0);
      const totalScore =
        Number(scores.totalScore) || themeCoherence + creativity + fluency + engagement;

      results.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        modelName: String(modelRaw),
        provider: modelId.split("/")[0],
        themeCoherence,
        creativity,
        fluency,
        engagement,
        totalScore,
        latency: 0,
      });
    }

    res.json({ results });
  } catch (err) {
    // If OpenRouter has no credits, the error will show here clearly
    res.status(502).json({
      error: err?.message || "Provider call failed",
      hint:
        "If you see 'Insufficient credits' then the OpenRouter key has no credits. Use a funded key.",
    });
  }
});

// Serve Vite dist
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.includes(".") || req.path.startsWith("/assets/")) return next();
  res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`✅ Server listening on port ${port}`));