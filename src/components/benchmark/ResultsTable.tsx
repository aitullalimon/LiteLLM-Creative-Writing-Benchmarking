import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { cn } from "@/lib/utils";
  import { Trophy, Medal, Award } from "lucide-react";
  
  export interface BenchmarkResult {
    id: string;
    modelName: string;
    provider: string;
    themeCoherence: number;
    creativity: number;
    fluency: number;
    engagement: number;
    totalScore: number;
    latency: number;
  }
  
  interface ResultsTableProps {
    results: BenchmarkResult[];
    isLoading?: boolean;
  }
  
  const getScoreColor = (score: number, max: number = 10) => {
    const percentage = (score / max) * 100;
    if (percentage >= 80) return "score-excellent";
    if (percentage >= 60) return "score-good";
    if (percentage >= 40) return "score-average";
    return "score-poor";
  };
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-4 w-4 text-chart-excellent" />;
      case 2:
        return <Medal className="h-4 w-4 text-muted-foreground" />;
      case 3:
        return <Award className="h-4 w-4 text-chart-average" />;
      default:
        return <span className="text-xs text-muted-foreground font-mono">#{rank}</span>;
    }
  };
  
  const ResultsTable = ({ results, isLoading }: ResultsTableProps) => {
    const sortedResults = [...results].sort((a, b) => b.totalScore - a.totalScore);
  
    if (isLoading) {
      return (
        <div className="rounded-lg border border-border/50 bg-card/50 p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Running benchmark...</span>
          </div>
        </div>
      );
    }
  
    if (results.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 p-8">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="text-sm">No results yet</span>
            <span className="text-xs">Run a benchmark to see results</span>
          </div>
        </div>
      );
    }
  
    return (
      <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-center">
                <div className="flex flex-col items-center">
                  <span>Theme</span>
                  <span className="text-xs text-muted-foreground font-normal">Coherence</span>
                </div>
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell">Creativity</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Fluency</TableHead>
              <TableHead className="text-center hidden md:table-cell">Engagement</TableHead>
              <TableHead className="text-center">
                <div className="flex flex-col items-center">
                  <span>Total</span>
                  <span className="text-xs text-muted-foreground font-normal">/40</span>
                </div>
              </TableHead>
              <TableHead className="text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedResults.map((result, index) => (
              <TableRow
                key={result.id}
                className={cn(
                  "border-border/30 transition-colors",
                  index === 0 && "bg-accent/30"
                )}
              >
                <TableCell className="text-center">
                  {getRankIcon(index + 1)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{result.modelName}</span>
                    <span className="text-xs text-muted-foreground">{result.provider}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn("font-mono font-semibold text-lg", getScoreColor(result.themeCoherence))}>
                    {result.themeCoherence.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  <span className={cn("font-mono", getScoreColor(result.creativity))}>
                    {result.creativity.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  <span className={cn("font-mono", getScoreColor(result.fluency))}>
                    {result.fluency.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center hidden md:table-cell">
                  <span className={cn("font-mono", getScoreColor(result.engagement))}>
                    {result.engagement.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn("font-mono font-semibold", getScoreColor(result.totalScore, 40))}>
                    {result.totalScore.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-muted-foreground text-sm">
                    {result.latency.toFixed(0)}ms
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  export default ResultsTable;
  