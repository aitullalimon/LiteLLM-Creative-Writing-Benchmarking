import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    Legend,
    Tooltip,
  } from "recharts";
  import { BenchmarkResult } from "./ResultsTable";
  
  interface ScoreRadarProps {
    results: BenchmarkResult[];
  }
  
  const COLORS = [
    "hsl(172 60% 45%)",
    "hsl(200 70% 50%)",
    "hsl(280 60% 55%)",
    "hsl(45 70% 50%)",
    "hsl(0 60% 55%)",
    "hsl(120 50% 45%)",
    "hsl(320 60% 50%)",
    "hsl(30 70% 50%)",
  ];
  
  const ScoreRadar = ({ results }: ScoreRadarProps) => {
    if (results.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
          <span className="text-sm text-muted-foreground">No data to display</span>
        </div>
      );
    }
  
    const radarData = [
      { metric: "Theme", fullMark: 10 },
      { metric: "Creativity", fullMark: 10 },
      { metric: "Fluency", fullMark: 10 },
      { metric: "Engagement", fullMark: 10 },
    ].map((item) => {
      const dataPoint: Record<string, string | number> = { metric: item.metric };
      results.forEach((result) => {
        switch (item.metric) {
          case "Theme":
            dataPoint[result.modelName] = result.themeCoherence;
            break;
          case "Creativity":
            dataPoint[result.modelName] = result.creativity;
            break;
          case "Fluency":
            dataPoint[result.modelName] = result.fluency;
            break;
          case "Engagement":
            dataPoint[result.modelName] = result.engagement;
            break;
        }
      });
      return dataPoint;
    });
  
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Multi-metric Comparison</h3>
          <span className="text-xs text-muted-foreground">All dimensions</span>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(220 15% 18%)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: "hsl(220 10% 85%)", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={{ fill: "hsl(220 10% 55%)", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220 18% 10%)",
                  border: "1px solid hsl(220 15% 18%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {results.slice(0, 4).map((result, index) => (
                <Radar
                  key={result.id}
                  name={result.modelName}
                  dataKey={result.modelName}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                iconType="circle"
                iconSize={8}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };
  
  export default ScoreRadar;
  