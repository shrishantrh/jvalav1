import { Cloud, Database, Search, Brain, Heart, Activity, MapPin, FileText, Sparkles, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

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
  | 'thinking';

export interface ToolActivity {
  id: string;
  kind: ToolKind;
  /** human label, e.g. "Checking weather for San Francisco" */
  label: string;
  /** 'running' while in progress, 'done' once complete, 'error' on failure */
  status: 'running' | 'done' | 'error';
  /** terse result summary shown when done, e.g. "72°F, light rain" */
  resultSummary?: string;
}

const TOOL_META: Record<ToolKind, { icon: typeof Cloud; color: string }> = {
  weather:           { icon: Cloud,    color: 'sky' },
  reading_logs:      { icon: Database, color: 'violet' },
  reading_memories:  { icon: Brain,    color: 'purple' },
  analyzing_patterns:{ icon: Activity, color: 'pink' },
  researching_web:   { icon: Search,   color: 'blue' },
  wearable_data:     { icon: Heart,    color: 'rose' },
  location:          { icon: MapPin,   color: 'amber' },
  symptom_history:   { icon: FileText, color: 'indigo' },
  medication_check:  { icon: FileText, color: 'emerald' },
  thinking:          { icon: Sparkles, color: 'primary' },
};

export function ToolActivityChips({ activities }: { activities: ToolActivity[] }) {
  if (activities.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {activities.map(a => <ToolChip key={a.id} activity={a} />)}
    </div>
  );
}

function ToolChip({ activity }: { activity: ToolActivity }) {
  const meta = TOOL_META[activity.kind];
  const Icon = meta.icon;
  const isRunning = activity.status === 'running';
  const isDone = activity.status === 'done';

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
        "border backdrop-blur-sm",
        isRunning && "bg-primary/8 border-primary/25 text-primary animate-pulse",
        isDone && "bg-muted/60 border-border text-muted-foreground",
        activity.status === 'error' && "bg-destructive/10 border-destructive/30 text-destructive",
      )}
    >
      {isRunning ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      ) : isDone ? (
        <Check className="w-3 h-3 shrink-0 text-emerald-600" />
      ) : (
        <Icon className="w-3 h-3 shrink-0" />
      )}
      <span>
        {isDone && activity.resultSummary ? activity.resultSummary : activity.label}
      </span>
    </div>
  );
}

/**
 * Heuristic: parse a user message and predict which tools the AI is likely
 * to invoke. Used to show transparent "fetching weather…" chips immediately
 * while the model streams. Not a replacement for real telemetry — just a UX
 * affordance so the user can see what's happening.
 */
export function predictToolActivities(userMessage: string): ToolActivity[] {
  const text = userMessage.toLowerCase();
  const out: ToolActivity[] = [];
  const id = () => Math.random().toString(36).slice(2, 9);

  // weather signals
  if (/\b(weather|temp|temperature|humid|pressure|rain|cold|hot|forecast|aqi|air quality|pollen)\b/.test(text)) {
    out.push({ id: id(), kind: 'weather', label: 'Checking weather', status: 'running' });
  }
  // pattern / trend / chart / week
  if (/\b(pattern|trend|chart|graph|this week|last week|month|compared|vs|correlation|why|cause)\b/.test(text)) {
    out.push({ id: id(), kind: 'reading_logs', label: 'Reading your logs', status: 'running' });
    out.push({ id: id(), kind: 'analyzing_patterns', label: 'Analyzing patterns', status: 'running' });
  }
  // research / explain / what is
  if (/\b(research|study|studies|article|evidence|paper|clinical|what is|explain)\b/.test(text)) {
    out.push({ id: id(), kind: 'researching_web', label: 'Researching evidence', status: 'running' });
  }
  // wearable / heart / sleep / steps
  if (/\b(heart rate|hr|hrv|sleep|steps|activity|wearable|fitbit|apple health|oura)\b/.test(text)) {
    out.push({ id: id(), kind: 'wearable_data', label: 'Reading wearable data', status: 'running' });
  }
  // medications
  if (/\b(med|medication|drug|dose|interact|side effect|prescrib)\b/.test(text)) {
    out.push({ id: id(), kind: 'medication_check', label: 'Checking medications', status: 'running' });
  }
  // symptoms history
  if (/\b(history|past|previous|recurrence|recur|happened before|usually)\b/.test(text)) {
    out.push({ id: id(), kind: 'symptom_history', label: 'Pulling symptom history', status: 'running' });
  }
  // memory recall
  if (/\b(remember|told you|mentioned|i said|earlier|before|always)\b/.test(text)) {
    out.push({ id: id(), kind: 'reading_memories', label: 'Recalling what you told me', status: 'running' });
  }

  // Fallback — almost every reply involves at least these
  if (out.length === 0) {
    out.push({ id: id(), kind: 'thinking', label: 'Thinking', status: 'running' });
  }
  return out;
}

/**
 * Mark all running activities as done after a delay.
 * Returns the updated list for reactive state.
 */
export function completeActivities(activities: ToolActivity[], summaries?: Partial<Record<ToolKind, string>>): ToolActivity[] {
  return activities.map(a => ({
    ...a,
    status: 'done' as const,
    resultSummary: summaries?.[a.kind] ?? defaultSummary(a),
  }));
}

function defaultSummary(a: ToolActivity): string {
  switch (a.kind) {
    case 'weather':            return 'Weather attached';
    case 'reading_logs':       return 'Logs reviewed';
    case 'reading_memories':   return 'Memory checked';
    case 'analyzing_patterns': return 'Patterns analyzed';
    case 'researching_web':    return 'Sources cited';
    case 'wearable_data':      return 'Wearable synced';
    case 'location':           return 'Location attached';
    case 'symptom_history':    return 'History reviewed';
    case 'medication_check':   return 'Meds reviewed';
    case 'thinking':           return 'Done thinking';
  }
}
