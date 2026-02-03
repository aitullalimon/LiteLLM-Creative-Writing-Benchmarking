import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function chat(baseUrl, apiKey, payload) {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const headers = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/benchmark", async (req, res) => {
  try {
    const baseUrl = must("LITELLM_BASE_URL");
    const apiKey = process.env.LITELLM_API_KEY;

    const prompt = String(req.body?.prompt ?? "").trim();
    const models = Array.isArray(req.body?.models) ? req.body.models.map(String) : [];
    const judgeModel = String(req.body?.judgeModel ?? "").trim();

    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    if (!models.length) return res.status(400).json({ error: "models[] is required" });
    if (!judgeModel) return res.status(400).json({ error: "judgeModel is required" });

    const results = [];

    for (const model of models) {
      const writer = await chat(baseUrl, apiKey, {
        model,
        messages: [
          { role: "system", content: "You are a creative writing assistant. Write a high-quality response." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      });

      const output = writer?.choices?.[0]?.message?.content ?? "";

      const judge = await chat(baseUrl, apiKey, {
        model: judgeModel,
        messages: [
          { role: "system", content: "Return JSON only." },
          {
            role: "user",
            content:
              `Return ONLY JSON keys: themeCoherence, creativity, fluency, engagement, totalScore.\n` +
              `totalScore = sum (0-40).\n\nPROMPT:\n${prompt}\n\nMODEL:\n${model}\n\nOUTPUT:\n${output}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      });

      let scores = {};
      const judgeText = judge?.choices?.[0]?.message?.content ?? "{}";
      try {
        scores = JSON.parse(judgeText);
      } catch {
        scores = {};
      }

      const themeCoherence = Number(scores.themeCoherence ?? 0);
      const creativity = Number(scores.creativity ?? 0);
      const fluency = Number(scores.fluency ?? 0);
      const engagement = Number(scores.engagement ?? 0);
      const totalScore = Number(scores.totalScore ?? (themeCoherence + creativity + fluency + engagement));

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
  } catch (e) {
    res.status(500).json({ error: e?.message || "server error" });
  }
});

// Serve built Vite files
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`App running on ${port}`));