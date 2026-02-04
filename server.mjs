import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "2mb" }));

// ======================
// Config
// ======================
const MOCK_MODE = String(process.env.MOCK_MODE || "").toLowerCase() === "true";

function needEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// In MOCK_MODE we don't require provider envs
const RAW_BASE = MOCK_MODE
  ? ""
  : needEnv("LITELLM_BASE_URL").trim().replace(/\/$/, "");
const API_KEY = MOCK_MODE ? "" : (process.env.LITELLM_API_KEY || "").trim();

// Normalize base to include /v1
const BASE_V1 =
  MOCK_MODE ? "" : RAW_BASE.endsWith("/v1") ? RAW_BASE : `${RAW_BASE}/v1`;

console.log("✅ Booting server.mjs...");
console.log("PORT =", process.env.PORT || "10000");
console.log("MOCK_MODE =", MOCK_MODE);
console.log("LITELLM_BASE_URL =", RAW_BASE ? "SET" : "MISSING/NOT_USED");
console.log("LITELLM_API_KEY =", API_KEY ? "SET" : "MISSING/NOT_USED");

// ======================
// Helpers
// ======================
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mockCreativeText(prompt, model) {
  const seeds = [
    "The sea kept its secrets until the lantern blinked twice.",
    "He found the bottle wedged between rocks like a misplaced memory.",
    "The message was written in his handwriting—older, calmer, afraid.",
    "Some futures arrive quietly, disguised as coincidence.",
  ];
  return `MODEL: ${model}\n\n${seeds[randInt(0, seeds.length - 1)]}\n\nPrompt: ${prompt}\n\nAnd that was the moment everything changed.`;
}

function mockJudgeJson() {
  const themeCoherence = randInt(6, 10);
  const creativity = randInt(6, 10);
  const fluency = randInt(6, 10);
  const engagement = randInt(6, 10);
  const totalScore = themeCoherence + creativity + fluency + engagement;
  return { themeCoherence, creativity, fluency, engagement, totalScore };
}

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

function isOpenRouterBase(base) {
  return typeof base === "string" && base.includes("openrouter.ai");
}

async function callChatCompletions(payload) {
  // ======================
  // MOCK MODE
  // ======================
  if (MOCK_MODE) {
    const wantsJson =
      payload?.response_format?.type === "json_object" ||
      (payload?.messages || []).some(
        (m) =>
          typeof m?.content === "string" &&
          m.content.toLowerCase().includes("return json")
      );

    if (wantsJson) {
      return {
        choices: [{ message: { content: JSON.stringify(mockJudgeJson()) } }],
      };
    }

    const prompt =
      payload?.messages?.find((m) => m.role === "user")?.content || "";
    const model = payload?.model || "mock/model";
    return {
      choices: [{ message: { content: mockCreativeText(prompt, model) } }],
    };
  }

  // ======================
  // REAL MODE (LiteLLM/OpenRouter/OpenAI compatible)
  // ======================
  const url = `${BASE_V1}/chat/completions`;

  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  // OpenRouter recommended headers (optional but good)
  if (isOpenRouterBase(RAW_BASE)) {
    if (process.env.OPENROUTER_SITE_URL)
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_APP_NAME)
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME;
  }

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
      `Provider HTTP ${out.status}`;
    throw new Error(String(msg));
  }

  return out.json;
}

// ======================
// Routes
// ======================
app.get("/health", (_req, res) => res.json({ ok: true, mock: MOCK_MODE }));

// Debug provider connectivity (optional)
app.get("/api/debug/provider", async (_req, res) => {
  if (MOCK_MODE) {
    return res.json({
      mock: true,
      message: "MOCK_MODE enabled. No external provider calls.",
    });
  }

  try {
    // Many providers expose /v1/models (OpenRouter/OpenAI compatible)
    const models = await fetchJson(`${BASE_V1}/models`, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    });

    res.json({
      mock: false,
      base: RAW_BASE,
      baseV1: BASE_V1,
      models: { ok: models.ok, status: models.status, json: models.json },
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "debug failed" });
  }
});

// Make GET not show "Not Found"
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
        modelName: String(model).split("/").pop(),
        provider: String(model).split("/")[0] || "unknown",
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
    res.status(502).json({ error: err?.message || "Provider call failed" });
  }
});

// ======================
// Serve Vite dist
// ======================
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