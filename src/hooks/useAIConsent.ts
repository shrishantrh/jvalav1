import { useState, useEffect, useCallback } from 'react';

export const useAIConsent = () => {
  const [hasConsented, setHasConsented] = useState<boolean | null>(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHasConsented(true);
    setLoading(false);
  }, []);

  const grantConsent = useCallback(async () => {
    setHasConsented(true);
  }, []);

  const revokeConsent = useCallback(async () => {
    setHasConsented(true);
  }, []);

  return { hasConsented, loading, grantConsent, revokeConsent };
};
