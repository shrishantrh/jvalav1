import { Cloud, Database, Search, Brain, Heart, Activity, MapPin, FileText, Check, BarChart3, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ToolKind =
  | 'weather'
  | 'reading_logs'
  | 'reading_memories'
  | 'analyzing_patterns'
  | 'researching_web'
  | 'wearable_data'
  | 'location'
  | 'symptom_history'
  | 'medication_check'
  | 'building_chart'
  | 'thinking';

export const TOOL_LABELS: Record<ToolKind, string> = {
  weather: 'Checked weather',
  reading_logs: 'Read your logs',
  reading_memories: 'Recalled memory',
  analyzing_patterns: 'Analyzed patterns',
  researching_web: 'Researched evidence',
  wearable_data: 'Read wearable data',
  location: 'Used location',
  symptom_history: 'Pulled symptom history',
  medication_check: 'Checked medications',
  building_chart: 'Built chart',
  thinking: 'Reasoned',
};

const TOOL_META: Record<ToolKind, { icon: typeof Cloud; verb: string }> = {
  weather:           { icon: Cloud,     verb: 'Checking weather' },
  reading_logs:      { icon: Database,  verb: 'Reading your logs' },
  reading_memories:  { icon: Brain,     verb: 'Recalling memory' },
  analyzing_patterns:{ icon: Activity,  verb: 'Analyzing patterns' },
  researching_web:   { icon: Search,    verb: 'Researching evidence' },
  wearable_data:     { icon: Heart,     verb: 'Reading wearable data' },
  location:          { icon: MapPin,    verb: 'Using location' },
  symptom_history:   { icon: FileText,  verb: 'Pulling symptom history' },
  medication_check:  { icon: Pill,      verb: 'Checking medications' },
  building_chart:    { icon: BarChart3, verb: 'Building chart' },
  thinking:          { icon: Brain,     verb: 'Thinking' },
};

export interface ToolActivity {
  id: string;
  kind: ToolKind;
  label: string;
  status: 'running' | 'done' | 'error';
  resultSummary?: string;
}

/* ============================================================
   LIVE INDICATOR — shimmer text under typing bubble.
   Reveals each predicted activity progressively (one every ~2.2s)
   then keeps them all on-screen until the response arrives.
   No border, no spinner — just a small stack of shimmering lines.
   ============================================================ */
export function LiveActivityIndicator({ activities }: { activities: ToolActivity[] }) {
  const [revealed, setRevealed] = useState(1);
  useEffect(() => {
    setRevealed(1);
    if (activities.length <= 1) return;
    const t = setInterval(() => {
      setRevealed((n) => (n < activities.length ? n + 1 : n));
    }, 2200);
    return () => clearInterval(t);
  }, [activities.length]);

  if (activities.length === 0) return null;
  const visible = activities.slice(0, revealed);

  return (
    <div className="flex flex-col gap-1 px-1 text-[11px] font-medium">
      {visible.map((a, i) => {
        const meta = TOOL_META[a.kind];
        const Icon = meta.icon;
        const isCurrent = i === visible.length - 1 && revealed < activities.length;
        const isFinalActive = i === visible.length - 1 && revealed === activities.length;
        const shimmer = isCurrent || isFinalActive;
        return (
          <div key={a.id} className="flex items-center gap-1.5">
            <Icon
              className={cn(
                "w-3 h-3 shrink-0",
                shimmer ? "text-primary/70" : "text-primary/50"
              )}
            />
            {shimmer ? (
              <span
                className="bg-clip-text text-transparent animate-shimmer-text"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--primary)) 45%, hsl(var(--muted-foreground)) 90%)',
                  backgroundSize: '200% 100%',
                }}
              >
                {a.label}
              </span>
            ) : (
              <span className="text-muted-foreground/80">{a.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   TIMELINE TAG — small clickable tag under assistant message.
   Click → popover shows ordered timeline of actions taken.
   ============================================================ */
export function ToolTimelineTag({ activities }: { activities: ToolActivity[] }) {
  if (!activities || activities.length === 0) return null;
  const count = activities.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground/80 hover:text-primary transition-colors"
          aria-label="View actions taken"
        >
          <Check className="w-2.5 h-2.5" />
          <span>{count} action{count > 1 ? 's' : ''}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 p-2.5 rounded-xl border-border/50 bg-card/95 backdrop-blur-xl shadow-xl"
      >
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
          What I did
        </p>
        <ol className="space-y-1.5">
          {activities.map((a, i) => {
            const meta = TOOL_META[a.kind];
            const Icon = meta.icon;
            return (
              <li key={a.id} className="flex items-start gap-2">
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-primary" />
                  </div>
                  {i < activities.length - 1 && (
                    <div className="w-px flex-1 min-h-[10px] bg-border/60 mt-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                    <Icon className="w-2.5 h-2.5 text-primary/70 shrink-0" />
                    <span className="truncate">{a.label}</span>
                  </div>
                  {a.resultSummary && a.resultSummary !== a.label && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {a.resultSummary}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </PopoverContent>
    </Popover>
  );
}

/* ============================================================
   PREDICTION — heuristic, with SPECIFIC context labels
   (e.g. "Reading last 30 days of flares" instead of "Reading logs")
   ============================================================ */
export function predictToolActivities(userMessage: string): ToolActivity[] {
  const text = userMessage.toLowerCase();
  const out: ToolActivity[] = [];
  const id = () => Math.random().toString(36).slice(2, 9);
  const push = (kind: ToolKind, label: string) =>
    out.push({ id: id(), kind, label, status: 'running' });

  // detect time window for specificity
  const days = /(\d+)\s*(?:day|d)\b/.exec(text)?.[1];
  const window =
    /\b30\b/.test(text) || days === '30' ? 'last 30 days' :
    /\b7\b|\bweek\b/.test(text) || days === '7' ? 'last 7 days' :
    /\bmonth\b/.test(text) ? 'this month' :
    /\btoday\b/.test(text) ? 'today' :
    /\byesterday\b/.test(text) ? 'yesterday' :
    days ? `last ${days} days` : null;

  if (/\b(weather|temp|temperature|humid|pressure|rain|forecast|aqi|air quality|pollen)\b/.test(text)) {
    push('weather', 'Checking weather');
  }
  if (/\b(chart|graph|plot|visualiz|trend line|timeline|breakdown)\b/.test(text)) {
    push('reading_logs', window ? `Reading flares from ${window}` : 'Reading your flare logs');
    push('analyzing_patterns', 'Calculating severity & trend');
    push('building_chart', 'Building chart');
  } else if (/\b(pattern|trend|compared|vs|correlation|why|cause|spike|cluster)\b/.test(text)) {
    push('reading_logs', window ? `Reading logs from ${window}` : 'Reading your logs');
    push('analyzing_patterns', 'Analyzing patterns');
  } else if (/\b(flare|symptom|severity|log)\b/.test(text)) {
    push('reading_logs', window ? `Reading flares from ${window}` : 'Reading recent flares');
  }

  if (/\b(research|study|studies|article|evidence|paper|clinical|what is|explain)\b/.test(text)) {
    push('researching_web', 'Searching medical literature');
  }
  if (/\b(heart rate|hr|hrv|sleep|steps|wearable|fitbit|apple health|oura)\b/.test(text)) {
    push('wearable_data', 'Reading wearable data');
  }
  if (/\b(med|medication|drug|dose|interact|side effect|prescrib|insulin)\b/.test(text)) {
    push('medication_check', 'Checking your medications');
  }
  if (/\b(history|past|previous|recurrence|recur|happened before|usually)\b/.test(text)) {
    push('symptom_history', 'Pulling symptom history');
  }
  if (/\b(remember|told you|mentioned|i said|earlier|before|always)\b/.test(text)) {
    push('reading_memories', 'Recalling what you told me');
  }

  if (out.length === 0) {
    push('thinking', 'Thinking');
  }
  return out;
}

export function completeActivities(
  activities: ToolActivity[],
  summaries?: Partial<Record<ToolKind, string>>
): ToolActivity[] {
  return activities.map(a => ({
    ...a,
    status: 'done' as const,
    resultSummary: summaries?.[a.kind] ?? defaultSummary(a),
  }));
}

function defaultSummary(a: ToolActivity): string {
  return TOOL_LABELS[a.kind];
}

export function buildActivitiesFromKinds(
  kinds: ToolKind[],
  status: ToolActivity['status'] = 'done',
  summaries?: Partial<Record<ToolKind, string>>,
  customLabels?: Partial<Record<ToolKind, string>>
): ToolActivity[] {
  const seen = new Set<ToolKind>();
  return kinds
    .filter((kind) => {
      if (seen.has(kind)) return false;
      seen.add(kind);
      return true;
    })
    .map((kind) => ({
      id: `${kind}-${Math.random().toString(36).slice(2, 9)}`,
      kind,
      label: customLabels?.[kind] ?? TOOL_LABELS[kind],
      status,
      resultSummary: status === 'done' ? (summaries?.[kind] ?? TOOL_LABELS[kind]) : undefined,
    }));
}

/* Legacy export kept so existing imports don't break — now renders the
   minimal live indicator instead of the old chip row. */
export function ToolActivityChips({ activities }: { activities: ToolActivity[] }) {
  const running = activities.filter(a => a.status === 'running');
  if (running.length > 0) return <LiveActivityIndicator activities={running} />;
  return null;
}
