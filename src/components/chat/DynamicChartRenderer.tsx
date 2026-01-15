import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis, AreaChart, Area,
  RadialBarChart, RadialBar, ComposedChart,
  CartesianGrid, ReferenceLine
} from "recharts";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, BarChart3, TrendingUp, PieChartIcon, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Flexible chart data types
export interface ChartDataPoint {
  label?: string;
  value?: number;
  x?: number;
  y?: number;
  z?: number;
  category?: string;
  date?: string;
  extra?: string;
  color?: string;
  name?: string;
  [key: string]: any;
}

export interface DynamicChart {
  type: string;
  title: string;
  data: ChartDataPoint[];
  config?: {
    xAxis?: string;
    yAxis?: string;
    colors?: string[];
    showLegend?: boolean;
    stacked?: boolean;
    unit?: string;
    comparison?: { label: string; value: number }[];
  };
}

// Brand colors that work well together
const CHART_PALETTE = [
  "#D6006C", // Primary pink
  "#892EFF", // Purple
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
];

const SEVERITY_COLORS = {
  mild: "#fbbf24",
  moderate: "#f97316", 
  severe: "#ef4444",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur border border-border rounded-lg px-3 py-2 shadow-lg">
      {label && <p className="text-xs font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          <span style={{ color: p.color || p.fill }} className="font-medium">
            {p.name || p.dataKey}: 
          </span>{" "}
          {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export function DynamicChartRenderer({ chart }: { chart?: DynamicChart | null }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (!chart || !chart.data || chart.data.length === 0) return null;

  const colors = chart.config?.colors || CHART_PALETTE;
  const height = 220;

  const getIcon = () => {
    switch (chart.type) {
      case 'line_chart':
      case 'area_chart':
      case 'timeline':
        return <TrendingUp className="w-4 h-4 text-primary" />;
      case 'pie_chart':
      case 'donut_chart':
        return <PieChartIcon className="w-4 h-4 text-primary" />;
      case 'scatter_plot':
        return <Activity className="w-4 h-4 text-primary" />;
      default:
        return <BarChart3 className="w-4 h-4 text-primary" />;
    }
  };

  const renderChart = () => {
    switch (chart.type) {
      // ==================== BAR CHARTS ====================
      case "bar_chart":
      case "horizontal_bar":
      case "symptom_frequency":
      case "trigger_frequency":
      case "location_chart": {
        const isHorizontal = chart.type === "horizontal_bar" || chart.data.some(d => (d.label?.length || 0) > 12);
        
        if (isHorizontal) {
          return (
            <ResponsiveContainer width="100%" height={Math.max(height, chart.data.length * 36)}>
              <BarChart data={chart.data} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis 
                  dataKey="label" 
                  type="category" 
                  width={100} 
                  tick={{ fontSize: 11 }} 
                  axisLine={false} 
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {chart.data.map((entry, i) => (
                    <Cell key={i} fill={entry.color || colors[i % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
        }
        
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chart.data} margin={{ left: 0, right: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10 }} 
                axisLine={false} 
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {chart.data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      // ==================== STACKED BAR ====================
      case "stacked_bar": {
        const keys = Object.keys(chart.data[0] || {}).filter(k => k !== 'label' && k !== 'name' && k !== 'date');
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chart.data} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {keys.map((key, i) => (
                <Bar key={key} dataKey={key} stackId="a" fill={colors[i % colors.length]} radius={i === keys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }

      // ==================== PIE / DONUT CHARTS ====================
      case "pie_chart":
      case "donut_chart":
      case "severity_breakdown": {
        const isDonut = chart.type === "donut_chart";
        const total = chart.data.reduce((sum, d) => sum + (d.value || 0), 0);
        const innerRadius = isDonut ? 50 : 0;
        
        return (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={height}>
              <PieChart>
                <Pie
                  data={chart.data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={80}
                  paddingAngle={chart.data.length > 1 ? 2 : 0}
                >
                  {chart.data.map((entry, i) => (
                    <Cell 
                      key={i} 
                      fill={entry.color || (SEVERITY_COLORS as any)[entry.label?.toLowerCase()] || colors[i % colors.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {chart.data.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ background: item.color || (SEVERITY_COLORS as any)[item.label?.toLowerCase()] || colors[i % colors.length] }} 
                    />
                    <span className="truncate max-w-[100px]">{item.label}</span>
                  </div>
                  <span className="font-medium tabular-nums">
                    {item.value} <span className="text-muted-foreground text-xs">({total > 0 ? Math.round((item.value! / total) * 100) : 0}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // ==================== LINE CHARTS ====================
      case "line_chart":
      case "timeline":
      case "trend": {
        const keys = Object.keys(chart.data[0] || {}).filter(k => k !== 'label' && k !== 'date' && k !== 'name' && typeof chart.data[0][k] === 'number');
        
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chart.data} margin={{ left: 0, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {keys.map((key, i) => (
                <Line 
                  key={key}
                  type="monotone" 
                  dataKey={key} 
                  stroke={colors[i % colors.length]} 
                  strokeWidth={2.5} 
                  dot={{ fill: colors[i % colors.length], strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }

      // ==================== AREA CHARTS ====================
      case "area_chart":
      case "stacked_area": {
        const keys = Object.keys(chart.data[0] || {}).filter(k => k !== 'label' && k !== 'date' && typeof chart.data[0][k] === 'number');
        
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chart.data} margin={{ left: 0, right: 10, top: 10 }}>
              <defs>
                {keys.map((key, i) => (
                  <linearGradient key={key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {keys.map((key, i) => (
                <Area 
                  key={key}
                  type="monotone" 
                  dataKey={key} 
                  stroke={colors[i % colors.length]} 
                  strokeWidth={2}
                  fill={`url(#gradient-${i})`}
                  stackId={chart.type === "stacked_area" ? "1" : undefined}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      // ==================== SCATTER PLOT ====================
      case "scatter_plot":
      case "correlation": {
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="x" 
                type="number" 
                name={chart.config?.xAxis || "X"} 
                tick={{ fontSize: 10 }} 
                axisLine={false}
                label={{ value: chart.config?.xAxis, position: 'bottom', fontSize: 11 }}
              />
              <YAxis 
                dataKey="y" 
                type="number" 
                name={chart.config?.yAxis || "Y"} 
                tick={{ fontSize: 10 }} 
                axisLine={false} 
                width={35}
                label={{ value: chart.config?.yAxis, angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <ZAxis dataKey="z" range={[50, 400]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter 
                data={chart.data} 
                fill={colors[0]}
              >
                {chart.data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || colors[i % colors.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      // ==================== HISTOGRAM ====================
      case "histogram":
      case "distribution": {
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chart.data} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]}>
                {chart.data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || colors[0]} fillOpacity={0.5 + (i / chart.data.length) * 0.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      // ==================== RADIAL / GAUGE ====================
      case "gauge":
      case "radial_bar":
      case "progress": {
        const maxValue = Math.max(...chart.data.map(d => d.value || 0), 100);
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="30%" 
              outerRadius="90%" 
              data={chart.data.map((d, i) => ({ ...d, fill: d.color || colors[i % colors.length] }))}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                background={{ fill: 'hsl(var(--muted))' }}
                dataKey="value"
                cornerRadius={10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                iconType="circle" 
                layout="horizontal" 
                verticalAlign="bottom" 
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value, entry: any) => (
                  <span className="text-foreground">{entry.payload.label}: {entry.payload.value}</span>
                )}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        );
      }

      // ==================== COMPARISON CARDS ====================
      case "comparison":
      case "versus":
      case "stat_comparison": {
        return (
          <div className="grid grid-cols-2 gap-3">
            {chart.data.map((item, i) => (
              <div 
                key={i} 
                className={cn(
                  "p-4 rounded-xl text-center relative overflow-hidden",
                  i === 0 ? "bg-muted/50" : "bg-primary/10"
                )}
              >
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{ background: `linear-gradient(135deg, ${colors[i]} 0%, transparent 60%)` }}
                />
                <div className="relative">
                  <div className="text-3xl font-bold">{item.value?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                  {item.extra && (
                    <div className={cn(
                      "text-xs mt-2 font-medium px-2 py-0.5 rounded-full inline-block",
                      item.extra.includes('+') || item.extra.includes('more') || item.extra.includes('increase') 
                        ? "bg-red-500/10 text-red-600" 
                        : item.extra.includes('-') || item.extra.includes('less') || item.extra.includes('decrease')
                        ? "bg-green-500/10 text-green-600" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {item.extra}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // ==================== HEATMAP (simplified) ====================
      case "heatmap":
      case "calendar_heatmap": {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const maxVal = Math.max(...chart.data.map(d => d.value || 0));
        
        return (
          <div className="space-y-1">
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => (
                <div key={day} className="text-[10px] text-muted-foreground text-center py-1">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {chart.data.map((item, i) => {
                const intensity = maxVal > 0 ? (item.value || 0) / maxVal : 0;
                return (
                  <div 
                    key={i}
                    className="aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium"
                    style={{ 
                      background: `rgba(214, 0, 108, ${0.1 + intensity * 0.8})`,
                      color: intensity > 0.5 ? 'white' : 'inherit'
                    }}
                    title={`${item.label}: ${item.value}`}
                  >
                    {item.value || ''}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // ==================== PATTERN SUMMARY ====================
      case "pattern_summary":
      case "insights":
      case "key_stats": {
        return (
          <div className="space-y-2">
            {chart.data.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-sm">{item.value}</span>
                  {item.extra && <span className="text-muted-foreground text-xs ml-1">{item.extra}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // ==================== COMBINED CHART ====================
      case "combined":
      case "bar_line": {
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={chart.data} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} maxBarSize={30} />
              {chart.data[0]?.trend !== undefined && (
                <Line type="monotone" dataKey="trend" stroke={colors[1]} strokeWidth={2} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );
      }

      // ==================== FALLBACK ====================
      default:
        return (
          <div className="space-y-2">
            {chart.data.slice(0, 8).map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                <span className="text-sm">{item.label || item.name}</span>
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
        className="w-full justify-between h-10 px-3 bg-gradient-to-r from-primary/5 to-purple-500/5 hover:from-primary/10 hover:to-purple-500/10 border border-border/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-sm font-medium">{chart.title || "View Chart"}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>
      
      {isExpanded && (
        <div className="mt-2 p-4 bg-card/50 rounded-xl border border-border/50 animate-in slide-in-from-top-2 duration-200">
          {renderChart()}
        </div>
      )}
    </div>
  );
}
