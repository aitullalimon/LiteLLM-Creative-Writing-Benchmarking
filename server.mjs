// server.mjs (FULL UPDATED CODE)

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

function getEnv(name, optional = false) {
  const v = process.env[name];
  if (!v && !optional) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const LITELLM_BASE_URL = getEnv("LITELLM_BASE_URL");
const LITELLM_API_KEY = process.env.LITELLM_API_KEY; // optional

async function callLiteLLM(payload) {
  const url = `${LITELLM_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (LITELLM_API_KEY) headers.Authorization = `Bearer ${LITELLM_API_KEY}`;

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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/benchmark", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const models = Array.isArray(req.body?.models) ? req.body.models : [];
    const judgeModelUI = String(req.body?.judgeModel || "").trim();

    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    if (!models.length) return res.status(400).json({ error: "models[] is required" });
    if (!judgeModelUI) return res.status(400).json({ error: "judgeModel is required" });

    // ✅ FIX: Map UI names -> LiteLLM provider/model IDs
    const MODEL_MAP = {
      // Writers
      "GPT-4o Mini": "openai/gpt-4o-mini",
      "GLM 4.7 Flash": "zhipu/glm-4.7",
      "Kimi K2.5": "moonshot/kimi-k2",

      // Judge (if UI uses same name)
      "GPT-4o Mini (Recommended)": "openai/gpt-4o-mini",
      "GPT-4o Mini (Recommended) ": "openai/gpt-4o-mini", // safety for trailing space
      "GPT-4o Mini — Recommended": "openai/gpt-4o-mini",
    };

    const judgeModel = MODEL_MAP[judgeModelUI] || judgeModelUI; // allow already-correct values

    const results = [];

    for (const uiModel of models) {
      const model = MODEL_MAP[uiModel] || uiModel; // allow already-correct values

      if (!model.includes("/")) {
        console.error("❌ Unknown model from UI:", uiModel);
        results.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          modelName: uiModel,
          provider: "unknown",
          themeCoherence: 0,
          creativity: 0,
          fluency: 0,
          engagement: 0,
          totalScore: 0,
          latency: 0,
          error: `Unknown model: ${uiModel}`,
        });
        continue;
      }

      const started = Date.now();

      const writerResp = await callLiteLLM({
        model,
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are a creative writing assistant." },
          { role: "user", content: prompt },
        ],
      });

      const output = writerResp?.choices?.[0]?.message?.content || "";

      const judgeResp = await callLiteLLM({
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
        latency: Date.now() - started,
      });
    }

    res.json({ results });
  } catch (err) {
    console.error("❌ /api/benchmark error:", err);
    res.status(500).json({ error: err?.message || "server error" });
  }
});

// Serve dist safely (no "*" routes)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.includes(".") || req.path.startsWith("/assets/")) return next();
  res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});