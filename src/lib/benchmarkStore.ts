export type StoredBenchmarkRun = {
  id: string;
  createdAt: number;
  prompt: string;
  judgeModel: string;
  models: string[];
  results: Array<{
    modelName: string;
    provider: string;
    themeCoherence: number;
    creativity: number;
    fluency: number;
    engagement: number;
    totalScore: number;
    latency: number;
  }>;
};

const KEY = "cwb:runs:v1";

export function loadRuns(): StoredBenchmarkRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRun(run: StoredBenchmarkRun) {
  const existing = loadRuns();
  const next = [run, ...existing].slice(0, 200); // cap to keep storage small
  localStorage.setItem(KEY, JSON.stringify(next));
}

export type LeaderboardRow = {
  modelName: string;
  provider: string;
  themeCoherence: number;
  creativity: number;
  fluency: number;
  engagement: number;
  totalScore: number;
  avgLatency: number;
  benchmarkCount: number;
  lastUpdated: string;
};

function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function computeLeaderboard(runs: StoredBenchmarkRun[]): LeaderboardRow[] {
  const byModel = new Map<
    string,
    {
      modelName: string;
      provider: string;
      n: number;
      sums: { theme: number; creativity: number; fluency: number; engagement: number; total: number; latency: number };
      lastTs: number;
    }
  >();

  for (const run of runs) {
    for (const r of run.results) {
      const key = `${r.provider}::${r.modelName}`;
      const cur = byModel.get(key);
      if (!cur) {
        byModel.set(key, {
          modelName: r.modelName,
          provider: r.provider,
          n: 1,
          sums: {
            theme: r.themeCoherence,
            creativity: r.creativity,
            fluency: r.fluency,
            engagement: r.engagement,
            total: r.totalScore,
            latency: r.latency,
          },
          lastTs: run.createdAt,
        });
      } else {
        cur.n += 1;
        cur.sums.theme += r.themeCoherence;
        cur.sums.creativity += r.creativity;
        cur.sums.fluency += r.fluency;
        cur.sums.engagement += r.engagement;
        cur.sums.total += r.totalScore;
        cur.sums.latency += r.latency;
        cur.lastTs = Math.max(cur.lastTs, run.createdAt);
      }
    }
  }

  return Array.from(byModel.values())
    .map((x) => ({
      modelName: x.modelName,
      provider: x.provider,
      themeCoherence: x.sums.theme / x.n,
      creativity: x.sums.creativity / x.n,
      fluency: x.sums.fluency / x.n,
      engagement: x.sums.engagement / x.n,
      totalScore: x.sums.total / x.n,
      avgLatency: x.sums.latency / x.n,
      benchmarkCount: x.n,
      lastUpdated: fmtAgo(x.lastTs),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}
