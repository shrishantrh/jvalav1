import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Tooltip, LabelList } from "recharts";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AIVisualization = {
  type: string;
  title: string;
  data: any[];
  config?: any;
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--severity-moderate))",
  "hsl(var(--severity-mild))",
  "hsl(var(--severity-severe))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
];

export function AIVisualizationRenderer({ viz, autoExpand = false }: { viz?: AIVisualization | null; autoExpand?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  
  if (!viz || !viz.data || viz.data.length === 0) return null;

  const height = 200;

  const renderChart = () => {
    switch (viz.type) {
      case "bar_chart":
      case "symptom_frequency":
      case "trigger_frequency":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={viz.data} layout="vertical" margin={{ left: 10, right: 30 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis 
                dataKey="label" 
                type="category" 
                width={100} 
                tick={{ fontSize: 11 }} 
                axisLine={false} 
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" fontSize={11} fill="hsl(var(--muted-foreground))" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie_chart":
      case "severity_breakdown":
        const total = viz.data.reduce((sum, d) => sum + (d.value || 0), 0);
        return (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={height}>
              <RePieChart>
                <Pie
                  data={viz.data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {viz.data.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
              </RePieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {viz.data.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} 
                    />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-medium">
                    {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case "line_chart":
      case "timeline":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={viz.data} margin={{ left: 0, right: 10 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2.5} 
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "comparison":
        return (
          <div className="grid grid-cols-2 gap-4">
            {viz.data.map((item: any, i: number) => (
              <div 
                key={i} 
                className={cn(
                  "p-4 rounded-lg text-center",
                  i === 0 ? "bg-muted/50" : "bg-primary/10"
                )}
              >
                <div className="text-2xl font-bold">{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                {item.extra && (
                  <div className={cn(
                    "text-xs mt-2 font-medium",
                    item.extra.includes('+') ? "text-red-500" : 
                    item.extra.includes('-') ? "text-green-500" : "text-muted-foreground"
                  )}>
                    {item.extra}
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case "pattern_summary":
        return (
          <div className="space-y-3">
            {viz.data.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">{item.label}</span>
                <span className="font-medium text-sm">
                  {item.value}
                  {item.extra && <span className="text-muted-foreground ml-1">{item.extra}</span>}
                </span>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            {viz.data.slice(0, 5).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm">{item.label}</span>
                <span className="font-medium text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between h-9 px-3 bg-muted/40 hover:bg-muted/60"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">{viz.title || "View Data"}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>
      
      {isExpanded && (
        <div className="mt-2 p-4 bg-muted/20 rounded-lg border border-border/50 animate-in slide-in-from-top-2 duration-200">
          {renderChart()}
        </div>
      )}
    </div>
  );
}
