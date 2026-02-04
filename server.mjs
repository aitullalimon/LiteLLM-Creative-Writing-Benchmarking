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
const API_KEY = (process.env.LITELLM_API_KEY || "").trim();

// OpenRouter is already /api/v1, so DO NOT append /v1 again if it's there
const BASE_V1 =
  RAW_BASE.endsWith("/v1") ? RAW_BASE : RAW_BASE.endsWith("/api/v1") ? RAW_BASE : `${RAW_BASE}/v1`;

console.log("✅ Booting server.mjs...");
console.log("PORT =", process.env.PORT);
console.log("LITELLM_BASE_URL =", RAW_BASE);
console.log("BASE_V1 =", BASE_V1);
console.log("LITELLM_API_KEY =", API_KEY ? "SET" : "MISSING");

/**
 * ✅ UI LABEL -> REAL OPENROUTER MODEL ID
 * You can override these in Render env if client wants different models.
 */
const MODEL_MAP = {
  // UI label => OpenRouter model id
  "GPT-4o Mini": process.env.MODEL_GPT4O_MINI || "openai/gpt-4o-mini",
  "GPT-4o Mi": process.env.MODEL_GPT4O_MINI || "openai/gpt-4o-mini", // sometimes truncated in UI
  "GLM 4.7 Flash": process.env.MODEL_GLM_47_FLASH || "google/gemini-1.5-flash",
  "Kimi K2.5": process.env.MODEL_KIMI_K25 || "anthropic/claude-3.5-sonnet",

  // judge dropdown label mapping (if UI shows recommended)
  "GPT-4o Mini (Recommended)": process.env.MODEL_GPT4O_MINI || "openai/gpt-4o-mini",
};

function normalizeModelId(input) {
  const s = String(input || "").trim();
  if (!s) return "";

  // If already looks like openrouter id "provider/model", keep it
  if (s.includes("/")) return s;

  // Try exact match
  if (MODEL_MAP[s]) return MODEL_MAP[s];

  // Try loose match (handles UI truncation like "GPT-4o Mi...")
  const lower = s.toLowerCase();
  if (lower.includes("gpt") && lower.includes("mini")) return MODEL_MAP["GPT-4o Mini"];
  if (lower.includes("glm")) return MODEL_MAP["GLM 4.7 Flash"];
  if (lower.includes("kimi")) return MODEL_MAP["Kimi K2.5"];

  return ""; // unknown -> will error clearly
}

async function fetchJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, raw: text };
}

async function callChatCompletions(payload) {
  const url = `${BASE_V1}/chat/completions`;

  const headers = {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    // These headers are optional but recommended by OpenRouter
    ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
    ...(process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {}),
  };

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
      `HTTP ${out.status}`;
    throw new Error(`OpenRouter error: ${msg}`);
  }

  return out.json;
}

/** Health */
app.get("/health", (_req, res) => res.json({ ok: true }));

/** Debug (open in browser) */
app.get("/api/debug/provider", async (_req, res) => {
  const models = await fetchJson(`${BASE_V1}/models`, {
    headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
  });

  res.json({
    base: RAW_BASE,
    baseV1: BASE_V1,
    hasKey: Boolean(API_KEY),
    modelMap: MODEL_MAP,
    modelsOk: models.ok,
    modelsStatus: models.status,
    modelsSample:
      Array.isArray(models.json?.data) ? models.json.data.slice(0, 20).map((m) => m.id) : models.json,
  });
});

/** Hint for GET */
app.get("/api/benchmark", (_req, res) => {
  res.json({ ok: true, hint: "Use POST /api/benchmark with JSON body." });
});

/** Benchmark */
app.post("/api/benchmark", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const modelsIn = Array.isArray(req.body?.models) ? req.body.models : [];
    const judgeIn = String(req.body?.judgeModel || "").trim();

    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    if (!modelsIn.length) return res.status(400).json({ error: "models[] is required" });
    if (!judgeIn) return res.status(400).json({ error: "judgeModel is required" });

    const models = modelsIn.map(normalizeModelId).filter(Boolean);
    const judgeModel = normalizeModelId(judgeIn);

    if (!models.length) {
      return res.status(400).json({
        error: "No valid models after mapping. Fix MODEL_MAP or UI values.",
        received: modelsIn,
        mapped: models,
        modelMap: MODEL_MAP,
      });
    }
    if (!judgeModel) {
      return res.status(400).json({
        error: "Judge model not valid after mapping. Fix MODEL_MAP or UI value.",
        received: judgeIn,
        modelMap: MODEL_MAP,
      });
    }

    const results = [];

    for (const model of models) {
      const t0 = Date.now();

      const writerResp = await callChatCompletions({
        model,
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are a creative writing assistant." },
          { role: "user", content: prompt },
        ],
      });

      const output = writerResp?.choices?.[0]?.message?.content || "";

      const judgeResp = await callChatCompletions({
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
        latency: Date.now() - t0,
      });
    }

    res.json({ results });
  } catch (err) {
    console.error("❌ /api/benchmark error:", err);
    res.status(502).json({ error: err?.message || "Provider call failed" });
  }
});

/** Serve Vite dist */
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

/** SPA fallback */
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.includes(".") || req.path.startsWith("/assets/")) return next();
  res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`✅ Server listening on port ${port}`));