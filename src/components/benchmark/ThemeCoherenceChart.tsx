import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Cell,
    Tooltip,
  } from "recharts";
  import { BenchmarkResult } from "./ResultsTable";
  
  interface ThemeCoherenceChartProps {
    results: BenchmarkResult[];
  }
  
  const ThemeCoherenceChart = ({ results }: ThemeCoherenceChartProps) => {
    const sortedData = [...results]
      .sort((a, b) => b.themeCoherence - a.themeCoherence)
      .map((result) => ({
        name: result.modelName,
        score: result.themeCoherence,
        provider: result.provider,
      }));
  
    const getBarColor = (score: number) => {
      if (score >= 8) return "hsl(172 60% 45%)";
      if (score >= 6) return "hsl(172 40% 55%)";
      if (score >= 4) return "hsl(45 70% 50%)";
      return "hsl(0 60% 55%)";
    };
  
    if (results.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
          <span className="text-sm text-muted-foreground">No data to display</span>
        </div>
      );
    }
  
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Theme Coherence Scores</h3>
          <span className="text-xs text-muted-foreground font-mono">0-10 scale</span>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
                stroke="hsl(220 15% 18%)"
              />
              <XAxis
                type="number"
                domain={[0, 10]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(220 10% 55%)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(220 10% 85%)", fontSize: 12 }}
                width={120}
              />
              <Tooltip
                cursor={{ fill: "hsl(220 15% 15%)" }}
                contentStyle={{
                  backgroundColor: "hsl(220 18% 10%)",
                  border: "1px solid hsl(220 15% 18%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [value.toFixed(2), "Theme Score"]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };
  
  export default ThemeCoherenceChart;
  