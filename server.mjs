import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

console.log("✅ Booting server.mjs...");
console.log("PORT =", process.env.PORT);
console.log("LITELLM_BASE_URL =", process.env.LITELLM_BASE_URL ? "SET" : "MISSING");
console.log("LITELLM_API_KEY =", process.env.LITELLM_API_KEY ? "SET" : "MISSING");

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

// Normalize base so we can call /v1/* reliably
const BASE_V1 = RAW_BASE.endsWith("/v1") ? RAW_BASE : `${RAW_BASE}/v1`;

async function fetchJson(url, { method = "GET", headers = {}, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
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

async function callLiteLLMChatCompletions(payload) {
  const url = `${BASE_V1}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (LITELLM_API_KEY) headers.Authorization = `Bearer ${LITELLM_API_KEY}`;

  const out = await fetchJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!out.ok) {
    const msg =
      out.json?.error?.message ||
      out.json?.message ||
      out.json?.detail ||
      out.raw ||
      `LiteLLM HTTP ${out.status}`;
    throw new Error(String(msg));
  }

  return out.json;
}

// Basic health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Debug LiteLLM connectivity
app.get("/api/debug/litellm", async (_req, res) => {
  try {
    const healthUrl = RAW_BASE.endsWith("/health") ? RAW_BASE : `${RAW_BASE}/health`;
    const h = await fetchJson(healthUrl);
    const models = await fetchJson(`${BASE_V1}/models`, {
      headers: LITELLM_API_KEY ? { Authorization: `Bearer ${LITELLM_API_KEY}` } : {},
    });

    res.json({
      base: RAW_BASE,
      baseV1: BASE_V1,
      health: { ok: h.ok, status: h.status, json: h.json },
      models: { ok: models.ok, status: models.status, json: models.json },
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "debug failed" });
  }
});

// So opening in browser doesn't show Not Found
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

    for (const model of models) {
      const writerResp = await callLiteLLMChatCompletions({
        model,
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are a creative writing assistant." },
          { role: "user", content: prompt },
        ],
      });

      const output = writerResp?.choices?.[0]?.message?.content || "";

      const judgeResp = await callLiteLLMChatCompletions({
        model: judgeModel,
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
${model}

OUTPUT:
${output}
            `.trim(),
          },
        ],
      });

      let scores = {};
      const judgeText = judgeResp?.choices?.[0]?.message?.content || "{}";
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
        modelName: model.split("/").pop(),
        provider: model.split("/")[0],
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
    console.error("❌ /api/benchmark error:", err);
    res.status(502).json({ error: err?.message || "LiteLLM call failed" });
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