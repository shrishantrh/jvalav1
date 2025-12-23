import { WifiOff, Cloud } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[60] py-1.5 px-4",
      "bg-severity-moderate text-white text-center text-xs font-medium",
      "flex items-center justify-center gap-2",
      "animate-in slide-in-from-top-2 duration-300"
    )}>
      <WifiOff className="w-3.5 h-3.5" />
      <span>You're offline. Changes will sync when connected.</span>
    </div>
  );
}

export function SyncIndicator({ isSyncing }: { isSyncing: boolean }) {
  if (!isSyncing) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Cloud className="w-3.5 h-3.5 animate-pulse" />
      <span>Syncing...</span>
    </div>
  );
}
