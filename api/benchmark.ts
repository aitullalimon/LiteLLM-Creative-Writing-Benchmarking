import type { VercelRequest, VercelResponse } from "@vercel/node";

type JudgeScores = {
  themeCoherence: number;
  creativity: number;
  fluency: number;
  engagement: number;
  totalScore: number;
};

type BenchmarkResult = {
  id: string;
  modelName: string;
  provider: string;
  themeCoherence: number;
  creativity: number;
  fluency: number;
  engagement: number;
  totalScore: number;
  latency: number;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function safeNumber(x: unknown, fallback: number): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function litellmChat(params: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<{ text: string; raw: any }>
{
  const url = `${params.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (params.apiKey) headers["authorization"] = `Bearer ${params.apiKey}`;

  const body: any = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
  };

  // Many OpenAI-compatible gateways (including LiteLLM) support this.
  if (params.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = raw?.error?.message || raw?.message || `HTTP ${resp.status}`;
    throw new Error(`LiteLLM error: ${msg}`);
  }

  const text = raw?.choices?.[0]?.message?.content ?? "";
  return { text, raw };
}

function providerFromModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("openai")) return "OpenAI";
  if (m.includes("anthropic") || m.includes("claude")) return "Anthropic";
  if (m.includes("google") || m.includes("gemini")) return "Google";
  if (m.includes("meta") || m.includes("llama")) return "Meta";
  if (m.includes("openrouter")) return "OpenRouter";
  return "LLM";
}

function displayNameFromModel(model: string): string {
  // Prefer last segment for OpenRouter-style names.
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

function buildJudgePrompt(args: {
  prompt: string;
  candidateModel: string;
  candidateOutput: string;
}) {
  return `You are an impartial evaluator for creative writing outputs.\n\n` +
    `TASK: Score the candidate output against the user's prompt on four criteria from 0 to 10 (decimals allowed):\n` +
    `1) themeCoherence: How well it matches and sustains the prompt's theme\n` +
    `2) creativity: Originality, interesting ideas, freshness\n` +
    `3) fluency: Clarity, grammar, readability\n` +
    `4) engagement: How compelling it is to read\n\n` +
    `Return ONLY valid JSON with these keys: themeCoherence, creativity, fluency, engagement, totalScore.\n` +
    `totalScore MUST equal the sum of the four scores (0-40).\n\n` +
    `USER PROMPT:\n${args.prompt}\n\n` +
    `CANDIDATE MODEL: ${args.candidateModel}\n\n` +
    `CANDIDATE OUTPUT:\n${args.candidateOutput}`;
}

async function runOne(args: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  prompt: string;
  judgeModel: string;
}): Promise<BenchmarkResult> {
  const started = Date.now();

  const writer = await litellmChat({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    model: args.model,
    messages: [
      {
        role: "system",
        content:
          "You are a creative writing assistant. Write a high-quality response to the user's prompt.",
      },
      { role: "user", content: args.prompt },
    ],
    temperature: 0.8,
  });

  const judge = await litellmChat({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    model: args.judgeModel,
    messages: [
      {
        role: "system",
        content:
          "You are a strict grader. Output JSON only and follow the requested schema exactly.",
      },
      {
        role: "user",
        content: buildJudgePrompt({
          prompt: args.prompt,
          candidateModel: args.model,
          candidateOutput: writer.text,
        }),
      },
    ],
    temperature: 0,
    responseFormatJson: true,
  });

  // Parse judge JSON safely.
  let scores: Partial<JudgeScores> = {};
  try {
    scores = JSON.parse(judge.text);
  } catch {
    // Fallback: try to extract JSON block.
    const m = judge.text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        scores = JSON.parse(m[0]);
      } catch {
        scores = {};
      }
    }
  }

  const themeCoherence = clamp(safeNumber(scores.themeCoherence, 0), 0, 10);
  const creativity = clamp(safeNumber(scores.creativity, 0), 0, 10);
  const fluency = clamp(safeNumber(scores.fluency, 0), 0, 10);
  const engagement = clamp(safeNumber(scores.engagement, 0), 0, 10);
  const totalScore = clamp(
    safeNumber(scores.totalScore, themeCoherence + creativity + fluency + engagement),
    0,
    40
  );

  const latency = Date.now() - started;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    modelName: displayNameFromModel(args.model),
    provider: providerFromModel(args.model),
    themeCoherence,
    creativity,
    fluency,
    engagement,
    totalScore,
    latency,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const baseUrl = env("LITELLM_BASE_URL");
    const apiKey = process.env.LITELLM_API_KEY;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = String(body?.prompt ?? "").trim();
    const models = Array.isArray(body?.models) ? body.models.map(String) : [];
    const judgeModel = String(body?.judgeModel ?? "").trim();

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    if (!models.length) {
      res.status(400).json({ error: "models[] is required" });
      return;
    }
    if (!judgeModel) {
      res.status(400).json({ error: "judgeModel is required" });
      return;
    }

    // Run up to 3 models concurrently to keep serverless stable.
    const concurrency = 3;
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < models.length; i += concurrency) {
      const chunk = models.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((model) =>
          runOne({ baseUrl, apiKey, model, prompt, judgeModel })
        )
      );
      results.push(...chunkResults);
    }

    res.status(200).json({ results });
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || "Server error",
    });
  }
}
