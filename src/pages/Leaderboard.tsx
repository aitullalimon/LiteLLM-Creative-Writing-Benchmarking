import { useMemo, useState } from "react";
import { ArrowUpDown, Filter, Download, Info } from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeLeaderboard, loadRuns } from "@/lib/benchmarkStore";

interface LeaderboardEntry {
  rank: number;
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
}

const LEADERBOARD_DATA: LeaderboardEntry[] = [
  {
    rank: 1,
    modelName: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    themeCoherence: 9.24,
    creativity: 8.92,
    fluency: 9.15,
    engagement: 8.67,
    totalScore: 35.98,
    avgLatency: 1189,
    benchmarkCount: 1247,
    lastUpdated: "2h ago",
  },
  {
    rank: 2,
    modelName: "GPT-4o",
    provider: "OpenAI",
    themeCoherence: 8.89,
    creativity: 9.21,
    fluency: 8.98,
    engagement: 8.85,
    totalScore: 35.93,
    avgLatency: 923,
    benchmarkCount: 2341,
    lastUpdated: "1h ago",
  },
  {
    rank: 3,
    modelName: "Claude 3 Opus",
    provider: "Anthropic",
    themeCoherence: 9.01,
    creativity: 8.78,
    fluency: 9.02,
    engagement: 8.52,
    totalScore: 35.33,
    avgLatency: 2156,
    benchmarkCount: 892,
    lastUpdated: "4h ago",
  },
  {
    rank: 4,
    modelName: "Gemini 1.5 Pro",
    provider: "Google",
    themeCoherence: 8.45,
    creativity: 8.34,
    fluency: 8.76,
    engagement: 8.21,
    totalScore: 33.76,
    avgLatency: 1067,
    benchmarkCount: 1456,
    lastUpdated: "30m ago",
  },
  {
    rank: 5,
    modelName: "GPT-4 Turbo",
    provider: "OpenAI",
    themeCoherence: 8.32,
    creativity: 8.89,
    fluency: 8.54,
    engagement: 8.12,
    totalScore: 33.87,
    avgLatency: 1234,
    benchmarkCount: 1823,
    lastUpdated: "3h ago",
  },
  {
    rank: 6,
    modelName: "Mistral Large",
    provider: "Mistral",
    themeCoherence: 8.12,
    creativity: 8.23,
    fluency: 8.45,
    engagement: 7.98,
    totalScore: 32.78,
    avgLatency: 756,
    benchmarkCount: 678,
    lastUpdated: "6h ago",
  },
  {
    rank: 7,
    modelName: "Llama 3.1 70B",
    provider: "Meta",
    themeCoherence: 7.89,
    creativity: 8.12,
    fluency: 8.34,
    engagement: 7.76,
    totalScore: 32.11,
    avgLatency: 834,
    benchmarkCount: 1123,
    lastUpdated: "2h ago",
  },
  {
    rank: 8,
    modelName: "Command R+",
    provider: "Cohere",
    themeCoherence: 7.67,
    creativity: 7.89,
    fluency: 8.12,
    engagement: 7.54,
    totalScore: 31.22,
    avgLatency: 945,
    benchmarkCount: 456,
    lastUpdated: "8h ago",
  },
];

function useLocalLeaderboard(): LeaderboardEntry[] | null {
  return useMemo(() => {
    try {
      const runs = loadRuns();
      if (!runs.length) return null;
      const rows = computeLeaderboard(runs);
      return rows.map((r, i) => ({
        rank: i + 1,
        modelName: r.modelName,
        provider: r.provider,
        themeCoherence: r.themeCoherence,
        creativity: r.creativity,
        fluency: r.fluency,
        engagement: r.engagement,
        totalScore: r.totalScore,
        avgLatency: r.avgLatency,
        benchmarkCount: r.benchmarkCount,
        lastUpdated: r.lastUpdated,
      }));
    } catch {
      return null;
    }
  }, []);
}

const getScoreColor = (score: number, max: number = 10) => {
  const percentage = (score / max) * 100;
  if (percentage >= 80) return "score-excellent";
  if (percentage >= 60) return "score-good";
  if (percentage >= 40) return "score-average";
  return "score-poor";
};

const getProviderBadgeVariant = (provider: string) => {
  switch (provider) {
    case "OpenAI":
      return "secondary";
    case "Anthropic":
      return "default";
    case "Google":
      return "outline";
    default:
      return "secondary";
  }
};

const Leaderboard = () => {
  const [sortBy, setSortBy] = useState<string>("themeCoherence");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const localData = useLocalLeaderboard();
  const data = localData ?? LEADERBOARD_DATA;

  const filteredData = data.filter(
    (entry) => filterProvider === "all" || entry.provider === filterProvider
  );

  const sortedData = [...filteredData].sort((a, b) => {
    switch (sortBy) {
      case "themeCoherence":
        return b.themeCoherence - a.themeCoherence;
      case "totalScore":
        return b.totalScore - a.totalScore;
      case "latency":
        return a.avgLatency - b.avgLatency;
      case "benchmarks":
        return b.benchmarkCount - a.benchmarkCount;
      default:
        return 0;
    }
  });

  const topThemeModel = [...data].sort(
    (a, b) => b.themeCoherence - a.themeCoherence
  )[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Model Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Aggregated benchmark results across all creative writing evaluations.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Theme Score</p>
                  <p className="text-2xl font-semibold font-mono score-excellent">
                    {topThemeModel.themeCoherence.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{topThemeModel.modelName}</p>
                  <p className="text-xs text-muted-foreground">{topThemeModel.provider}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Models Tracked</p>
                <p className="text-2xl font-semibold font-mono">
                  {data.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Active models</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Benchmarks</p>
                <p className="text-2xl font-semibold font-mono">
                  {data.reduce((sum, e) => sum + e.benchmarkCount, 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Evaluations run</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Avg Theme Score</p>
                <p className="text-2xl font-semibold font-mono">
                  {(
                    data.reduce((sum, e) => sum + e.themeCoherence, 0) /
                    data.length
                  ).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Across all models</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                Rankings
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px] text-xs">
                      Rankings are based on aggregated scores from all benchmark runs.
                      Theme coherence is the primary ranking metric.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterProvider} onValueChange={setFilterProvider}>
                    <SelectTrigger className="w-[140px] h-9 bg-muted/30 border-muted">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      <SelectItem value="OpenAI">OpenAI</SelectItem>
                      <SelectItem value="Anthropic">Anthropic</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="Meta">Meta</SelectItem>
                      <SelectItem value="Mistral">Mistral</SelectItem>
                      <SelectItem value="Cohere">Cohere</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px] h-9 bg-muted/30 border-muted">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="themeCoherence">Theme Coherence</SelectItem>
                      <SelectItem value="totalScore">Total Score</SelectItem>
                      <SelectItem value="latency">Latency (fastest)</SelectItem>
                      <SelectItem value="benchmarks">Benchmark Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center">
                        <span>Theme</span>
                        <span className="text-xs text-muted-foreground font-normal">Primary</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center hidden md:table-cell">Creativity</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Fluency</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Engagement</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Latency</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Runs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((entry, index) => (
                    <TableRow
                      key={entry.modelName}
                      className={cn(
                        "border-border/30 transition-colors",
                        index === 0 && sortBy === "themeCoherence" && "bg-accent/30"
                      )}
                    >
                      <TableCell className="text-center">
                        <span className="font-mono text-muted-foreground">
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{entry.modelName}</span>
                          <Badge
                            variant={getProviderBadgeVariant(entry.provider)}
                            className="w-fit text-xs font-normal"
                          >
                            {entry.provider}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "font-mono font-semibold text-lg",
                            getScoreColor(entry.themeCoherence)
                          )}
                        >
                          {entry.themeCoherence.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <span
                          className={cn("font-mono", getScoreColor(entry.creativity))}
                        >
                          {entry.creativity.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <span
                          className={cn("font-mono", getScoreColor(entry.fluency))}
                        >
                          {entry.fluency.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        <span
                          className={cn("font-mono", getScoreColor(entry.engagement))}
                        >
                          {entry.engagement.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            getScoreColor(entry.totalScore, 40)
                          )}
                        >
                          {entry.totalScore.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <span className="font-mono text-muted-foreground text-sm">
                          {entry.avgLatency}ms
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        <span className="font-mono text-muted-foreground text-sm">
                          {entry.benchmarkCount.toLocaleString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Last updated: 2 minutes ago</span>
              <span>Judge model: GPT-4o</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Leaderboard;
