/**
 * useAppUpdatePrompt — drives the two-tier update UX.
 * - Soft tier: toast (dismissible).
 * - Hard tier: full-screen modal blocker.
 *
 * The hook returns `tier` so a top-level component can render the modal,
 * and it auto-fires the toast itself for the soft tier.
 */
import { useEffect, useState } from 'react';
import {
  classifyUpdate,
  fetchVersionManifest,
  getInstalledVersion,
  openAppStoreForUpdate,
  type UpdateTier,
  type VersionManifest,
} from '@/lib/appVersion';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { createElement } from 'react';

const SOFT_DISMISS_KEY = 'jvala_soft_update_dismissed_for';

export function useAppUpdatePrompt() {
  const [tier, setTier] = useState<UpdateTier>('none');
  const [manifest, setManifest] = useState<VersionManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const installed = getInstalledVersion();
      const m = await fetchVersionManifest();
      if (cancelled || !m) return;

      const t = classifyUpdate(installed, m);
      setManifest(m);
      setTier(t);

      if (t === 'soft') {
        // Don't re-toast for the same latest version twice.
        const dismissedFor = (() => {
          try { return localStorage.getItem(SOFT_DISMISS_KEY); } catch { return null; }
        })();
        if (dismissedFor === m.latest) return;

        toast({
          title: 'Update available',
          description: `Jvala ${m.latest} is out — tap Update to get the latest improvements.`,
          duration: 8000,
          action: createElement(
            ToastAction,
            { altText: 'Update Jvala', onClick: () => openAppStoreForUpdate() },
            'Update'
          ) as any,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissSoft = () => {
    if (manifest?.latest) {
      try { localStorage.setItem(SOFT_DISMISS_KEY, manifest.latest); } catch { /* ignore */ }
    }
    if (tier === 'soft') setTier('none');
  };

  return { tier, manifest, dismissSoft };
}
