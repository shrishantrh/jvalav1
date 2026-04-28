/**
 * Hard-block update modal. Renders nothing when not needed.
 * Cannot be dismissed — only escape is "Update Now" → App Store.
 */
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle } from 'lucide-react';
import { useAppUpdatePrompt } from '@/hooks/useAppUpdatePrompt';
import { openAppStoreForUpdate, getInstalledVersion } from '@/lib/appVersion';

export const AppUpdateGate = () => {
  const { tier, manifest } = useAppUpdatePrompt();

  if (tier !== 'hard' || !manifest) return null;

  return (
    <Dialog open={true} onOpenChange={() => { /* not dismissable */ }}>
      <DialogContent
        className="max-w-sm rounded-3xl border-border/40 bg-card/95 backdrop-blur-2xl"
        // Block close affordances
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center px-2 py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
            <ArrowUpCircle className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Update required</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You're on Jvala <span className="font-mono">{getInstalledVersion()}</span>.
              The newest version <span className="font-mono">{manifest.latest}</span> includes
              required improvements to keep your data safe and accurate.
            </p>
          </div>
          {manifest.releaseNotes && (
            <div className="w-full text-left text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 max-h-32 overflow-auto">
              {manifest.releaseNotes}
            </div>
          )}
          <Button
            onClick={openAppStoreForUpdate}
            className="w-full h-12 rounded-2xl text-base font-semibold"
          >
            Update Now
          </Button>
          <p className="text-[10px] text-muted-foreground/70">
            You'll need to update before continuing.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
