import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import Header from "@/components/layout/Header";
import PromptInput from "@/components/benchmark/PromptInput";
import ModelSelector from "@/components/benchmark/ModelSelector";
import JudgeSelector from "@/components/benchmark/JudgeSelector";
import ResultsTable, { BenchmarkResult } from "@/components/benchmark/ResultsTable";
import ThemeCoherenceChart from "@/components/benchmark/ThemeCoherenceChart";
import ScoreRadar from "@/components/benchmark/ScoreRadar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveRun } from "@/lib/benchmarkStore";

const DEFAULT_MODELS = [
  "openrouter/openai/gpt-4o-mini",
  "openrouter/z-ai/glm-4.7-flash",
  "openrouter/moonshotai/kimi-k2.5",
];

const Index = () => {
  const [prompt, setPrompt] = useState(
    "Write a short story about a lighthouse keeper who discovers a message in a bottle that seems to be from their future self."
  );
  const [selectedModels, setSelectedModels] = useState<string[]>([
    ...DEFAULT_MODELS,
  ]);
  const [judgeModel, setJudgeModel] = useState("openrouter/openai/gpt-4o-mini");
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const resp = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          models: selectedModels,
          judgeModel,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

      const nextResults: BenchmarkResult[] = Array.isArray(data?.results)
        ? data.results
        : [];
      setResults(nextResults);

      // Persist run locally so Leaderboard can aggregate.
      saveRun({
        id: `${Date.now()}`,
        createdAt: Date.now(),
        prompt,
        judgeModel,
        models: selectedModels,
        results: nextResults,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setResults([]);
    setPrompt("");
    setSelectedModels([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Creative Writing Benchmark
          </h1>
          <p className="text-muted-foreground">
            Compare theme coherence and creative quality across language models.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Configuration Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium">
                  Benchmark Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <PromptInput value={prompt} onChange={setPrompt} />
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <ModelSelector
                    selectedModels={selectedModels}
                    onChange={setSelectedModels}
                  />
                  <JudgeSelector value={judgeModel} onChange={setJudgeModel} />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="benchmark"
                    size="lg"
                    onClick={handleRunBenchmark}
                    disabled={isRunning || selectedModels.length === 0 || !prompt}
                    className="flex-1 sm:flex-none"
                  >
                    {isRunning ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Run Benchmark
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Table */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Results</h2>
              <ResultsTable results={results} isLoading={isRunning} />
            </div>
          </div>

          {/* Sidebar Charts */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <ThemeCoherenceChart results={results} />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <ScoreRadar results={results} />
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {results.length > 0 && (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Best Theme Score</span>
                      <span className="font-mono text-sm score-excellent">
                        {Math.max(...results.map((r) => r.themeCoherence)).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Theme Score</span>
                      <span className="font-mono text-sm">
                        {(
                          results.reduce((sum, r) => sum + r.themeCoherence, 0) /
                          results.length
                        ).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Models Tested</span>
                      <span className="font-mono text-sm">{results.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Fastest Response</span>
                      <span className="font-mono text-sm">
                        {Math.min(...results.map((r) => r.latency))}ms
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
