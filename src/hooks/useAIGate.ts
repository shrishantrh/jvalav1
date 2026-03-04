import { useState, useCallback } from 'react';
import { useAIConsent } from './useAIConsent';
import { useToast } from './use-toast';

/**
 * Hook that gates AI feature usage behind consent.
 * Returns `requireConsent` — call it before any AI operation.
 * If user has already consented, returns true immediately.
 * If not, opens the consent dialog (via showConsentDialog state).
 */
export const useAIGate = () => {
  const { hasConsented, grantConsent } = useAIConsent();
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { toast } = useToast();

  const requireConsent = useCallback(
    (onConsented: () => void): boolean => {
      if (hasConsented) {
        onConsented();
        return true;
      }
      // Show dialog and store the pending action
      setPendingAction(() => onConsented);
      setShowConsentDialog(true);
      return false;
    },
    [hasConsented]
  );

  const handleConsent = useCallback(async () => {
    await grantConsent();
    setShowConsentDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [grantConsent, pendingAction]);

  const handleDecline = useCallback(() => {
    setShowConsentDialog(false);
    setPendingAction(null);
    toast({
      title: "AI features disabled",
      description: "You can enable AI features anytime in Settings.",
    });
  }, [toast]);

  return {
    hasConsented,
    showConsentDialog,
    requireConsent,
    handleConsent,
    handleDecline,
  };
};
