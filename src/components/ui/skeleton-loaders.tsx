import { cn } from '@/lib/utils';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-3 animate-pulse", className)}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

export function SkeletonChat({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      {/* Assistant message */}
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2 max-w-[80%]">
          <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
      {/* User message */}
      <div className="flex items-start gap-2 justify-end">
        <div className="flex-1 space-y-2 max-w-[70%]">
          <div className="h-10 rounded-2xl bg-primary/20 animate-pulse ml-auto" />
        </div>
      </div>
      {/* Quick actions */}
      <div className="flex gap-2 pt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 w-20 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonInsights({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="h-24 rounded-xl border bg-card p-4 animate-pulse">
            <div className="h-4 w-16 rounded bg-muted mb-2" />
            <div className="h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="h-48 rounded-xl border bg-card p-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-muted mb-4" />
        <div className="h-32 w-full rounded bg-muted" />
      </div>
    </div>
  );
}

export function SkeletonProfile({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>
      {/* Fields */}
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function PulsingDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
    </span>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}
