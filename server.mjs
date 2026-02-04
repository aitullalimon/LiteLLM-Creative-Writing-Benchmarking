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

const RAW_BASE = (process.env.LITELLM_BASE_URL || "").trim().replace(/\/$/, "");
const LITELLM_API_KEY = (process.env.LITELLM_API_KEY || "").trim();

const OPENROUTER_SITE_URL = (process.env.OPENROUTER_SITE_URL || "").trim();
const OPENROUTER_APP_NAME = (process.env.OPENROUTER_APP_NAME || "").trim();

const MOCK_MODE = String(process.env.MOCK_MODE || "").trim().toLowerCase() === "true";

const BASE_V1 = RAW_BASE
  ? RAW_BASE.endsWith("/v1")
    ? RAW_BASE
    : `${RAW_BASE}/v1`
  : "";

console.log("✅ Booting server.mjs...");
console.log("PORT =", process.env.PORT);
console.log("LITELLM_BASE_URL =", RAW_BASE || "(not set)");
console.log("LITELLM_API_KEY =", LITELLM_API_KEY ? "SET" : "MISSING");
console.log("OPENROUTER_SITE_URL =", OPENROUTER_SITE_URL || "(not set)");
console.log("OPENROUTER_APP_NAME =", OPENROUTER_APP_NAME || "(not set)");
console.log("MOCK_MODE =", MOCK_MODE);

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };

  if (LITELLM_API_KEY) headers.Authorization = `Bearer ${LITELLM_API_KEY}`;

  // OpenRouter recommended headers (safe to include)
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

  m = m.replace(/\(Recommended\)/gi, "").replace(/Recommended/gi, "").trim();
  m = m.replace(/…/g, "").trim();

  if (m.toLowerCase().startsWith("openrouter/")) m = m.slice("openrouter/".length);

  const MODEL_ALIAS = {
    "GPT-4o Mini": "openai/gpt-4o-mini",
    "GLM 4.7 Flash": "z-ai/glm-4.7-flash",
    "Kimi K2.5": "moonshotai/kimi-k2.5",
    "GPT-4o Mi": "openai/gpt-4o-mini",
  };

  if (MODEL_ALIAS[m]) return MODEL_ALIAS[m];

  return m;
}

function safeModelLabel(raw, id) {
  const s = String(raw || "").trim();
  if (s) return s;
  return id;
}

// ---- MOCK HELPERS (for demo visuals) ----
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function mockScores(prompt, modelId) {
  const seed = hashSeed(`${prompt}||${modelId}`);
  const themeCoherence = clamp(5 + (seed % 6), 0, 10);          // 5..10
  const creativity = clamp(4 + ((seed * 3) % 7), 0, 10);        // 4..10
  const fluency = clamp(6 + ((seed * 7) % 5), 0, 10);           // 6..10
  const engagement = clamp(4 + ((seed * 11) % 7), 0, 10);       // 4..10
  const totalScore = themeCoherence + creativity + fluency + engagement; // 0..40-ish
  const latency = 400 + (seed % 1200);

  return { themeCoherence, creativity, fluency, engagement, totalScore, latency };
}

async function callChatCompletions(payload) {
  if (!BASE_V1) throw new Error("LITELLM_BASE_URL is not set");

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
    throw new Error(String(msg));
  }

  return out.json;
}

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Debug (quick check)
app.get("/api/debug/litellm", async (_req, res) => {
  if (MOCK_MODE) {
    return res.json({
      mockMode: true,
      hasKey: !!LITELLM_API_KEY,
      base: RAW_BASE,
      baseV1: BASE_V1,
      note: "MOCK_MODE=true so /api/benchmark returns demo results (no provider call).",
    });
  }

  try {
    const models = await fetchJson(`${BASE_V1}/models`, { headers: buildHeaders() });
    res.json({
      mockMode: false,
      hasKey: !!LITELLM_API_KEY,
      base: RAW_BASE,
      baseV1: BASE_V1,
      modelsOk: models.ok,
      modelsStatus: models.status,
      modelsSample: Array.isArray(models.json?.data) ? models.json.data.slice(0, 5) : models.json,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "debug failed" });
  }
});

// Friendly GET
app.get("/api/benchmark", (_req, res) => {
  res.json({ ok: true, hint: "Use POST /api/benchmark with JSON body." });
});

app.post("/api/benchmark", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  const models = Array.isArray(req.body?.models) ? req.body.models : [];
  const judgeModel = String(req.body?.judgeModel || "").trim();

  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (!models.length) return res.status(400).json({ error: "models[] is required" });
  if (!judgeModel) return res.status(400).json({ error: "judgeModel is required" });

  // ✅ MOCK MODE: Return results immediately so UI charts render
  if (MOCK_MODE) {
    const results = models.map((raw) => {
      const modelId = normalizeModelId(raw);
      const s = mockScores(prompt, modelId);
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        modelName: safeModelLabel(raw, modelId),
        provider: modelId.split("/")[0] || "mock",
        themeCoherence: s.themeCoherence,
        creativity: s.creativity,
        fluency: s.fluency,
        engagement: s.engagement,
        totalScore: s.totalScore,
        latency: s.latency,
        mock: true,
      };
    });

    return res.json({ results, mockMode: true });
  }

  // REAL MODE
  try {
    const results = [];
    const judgeId = normalizeModelId(judgeModel);

    for (const raw of models) {
      const modelId = normalizeModelId(raw);

      // (1) Generate
      const writerResp = await callChatCompletions({
        model: modelId,
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are a creative writing assistant." },
          { role: "user", content: prompt },
        ],
      });

      const output = writerResp?.choices?.[0]?.message?.content || "";

      // (2) Judge
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
        modelName: safeModelLabel(raw, modelId),
        provider: modelId.split("/")[0],
        themeCoherence,
        creativity,
        fluency,
        engagement,
        totalScore,
        latency: 0,
        mock: false,
      });
    }

    res.json({ results, mockMode: false });
  } catch (err) {
    res.status(502).json({
      error: err?.message || "Provider call failed",
      hint:
        "If you see 'Insufficient credits', enable MOCK_MODE=true for demo visuals until billing is active.",
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