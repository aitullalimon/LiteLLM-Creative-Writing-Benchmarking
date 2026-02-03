/**
 * Render-compatible Node server for:
 * - Serving Vite build (dist/)
 * - Providing /api/benchmark endpoint
 * - Connecting to LiteLLM proxy
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// --------------------------------------------------
// Setup
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// Environment helpers (SAFE: no silent crash)
// --------------------------------------------------
function getEnv(name, optional = false) {
  const value = process.env[name];
  if (!value && !optional) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const LITELLM_BASE_URL = getEnv("LITELLM_BASE_URL");
const LITELLM_API_KEY = process.env.LITELLM_API_KEY; // optional (depends on proxy config)

// --------------------------------------------------
// LiteLLM chat helper
// --------------------------------------------------
async function callLiteLLM(payload) {
  const url = `${LITELLM_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`;

  const headers = {
    "Content-Type": "application/json",
  };

  if (LITELLM_API_KEY) {
    headers.Authorization = `Bearer ${LITELLM_API_KEY}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error?.message || `LiteLLM HTTP ${res.status}`);
  }

  return json;
}

// --------------------------------------------------
// Health check (Render requirement)
// --------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// --------------------------------------------------
// Benchmark API
// --------------------------------------------------
app.post("/api/benchmark", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const models = Array.isArray(req.body?.models) ? req.body.models : [];
    const judgeModel = String(req.body?.judgeModel || "").trim();

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }
    if (!models.length) {
      return res.status(400).json({ error: "models[] is required" });
    }
    if (!judgeModel) {
      return res.status(400).json({ error: "judgeModel is required" });
    }

    const results = [];

    for (const model of models) {
      // 1️⃣ Writer model
      const writerResp = await callLiteLLM({
        model,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: "You are a creative writing assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const output =
        writerResp?.choices?.[0]?.message?.content || "";

      // 2️⃣ Judge model
      const judgeResp = await callLiteLLM({
        model: judgeModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a strict evaluator. Return JSON only.",
          },
          {
            role: "user",
            content: `
Return ONLY JSON with these numeric fields (0–10):
themeCoherence
creativity
fluency
engagement
totalScore (sum, 0–40)

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
      try {
        scores = JSON.parse(
          judgeResp?.choices?.[0]?.message?.content || "{}"
        );
      } catch {
        scores = {};
      }

      const themeCoherence = Number(scores.themeCoherence || 0);
      const creativity = Number(scores.creativity || 0);
      const fluency = Number(scores.fluency || 0);
      const engagement = Number(scores.engagement || 0);
      const totalScore =
        Number(scores.totalScore) ||
        themeCoherence + creativity + fluency + engagement;

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
    console.error("❌ Benchmark error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// Serve Vite build (dist) — SAFE on Render (no "*")
// --------------------------------------------------
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// If someone hits /api/... and it's not defined, return JSON (avoids SPA fallback confusion)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// SPA fallback WITHOUT using "*" or "/*"
app.use((req, res, next) => {
  // only handle GET requests for pages
  if (req.method !== "GET") return next();

  // ignore requests that look like real files (assets)
  if (req.path.includes(".") || req.path.startsWith("/assets/")) return next();

  res.sendFile(path.join(distPath, "index.html"));
});

// --------------------------------------------------
// Start server
// --------------------------------------------------
app.get("/*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });