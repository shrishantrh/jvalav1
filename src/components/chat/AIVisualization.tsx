import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Tooltip } from "recharts";

export type AIVisualization = {
  type: string;
  title: string;
  data: any[];
  config?: any;
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--severity-mild))",
  "hsl(var(--severity-moderate))",
  "hsl(var(--severity-severe))",
];

export function AIVisualizationRenderer({ viz }: { viz?: AIVisualization | null }) {
  if (!viz || !viz.data || viz.data.length === 0) return null;

  const height = 180;

  switch (viz.type) {
    case "bar_chart":
    case "symptom_frequency":
    case "trigger_frequency":
      return (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={viz.data} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "pie_chart":
    case "severity_breakdown":
      return (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
          <ResponsiveContainer width="100%" height={height}>
            <RePieChart>
              <Pie
                data={viz.data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={60}
                label={({ label, percent }: any) => `${label} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {viz.data.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      );

    case "line_chart":
    case "timeline":
      return (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={viz.data}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case "pattern_summary":
      return (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
          <h4 className="text-xs font-medium">{viz.title}</h4>
          {viz.data.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span>{item.label}</span>
              <span className="font-medium">
                {item.value}
                {item.extra ? ` ${item.extra}` : ""}
              </span>
            </div>
          ))}
        </div>
      );

    default:
      return (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
          <h4 className="text-xs font-medium mb-2">{viz.title}</h4>
          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
            {JSON.stringify(viz.data.slice(0, 5), null, 2)}
          </div>
        </div>
      );
  }
}
