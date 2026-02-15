import { useState, useEffect, useCallback } from 'react';
import { TourSpotlight } from './TourSpotlight';
import { supabase } from '@/integrations/supabase/client';

interface TourStep {
  target: string;
  message: string;
  position: 'above' | 'below';
  navigateTo?: 'track' | 'history' | 'insights' | 'exports';
  allowInteraction?: boolean;
  waitForEntry?: boolean;
  scrollIntoView?: boolean;
  delay?: number;
  triggerAction?: 'open-profile' | 'open-streaks';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'log-buttons',
    message: "Tap a button to log — it takes 1 second.",
    position: 'above',
    navigateTo: 'track',
    allowInteraction: true,
    waitForEntry: true,
  },
  {
    target: 'log-buttons',
    message: "Nice! Your first entry is saved.",
    position: 'above',
  },
  {
    target: 'calendar-view',
    message: "Your logs appear here by date.",
    position: 'below',
    navigateTo: 'history',
  },
  {
    target: 'trends-area',
    message: "Patterns emerge as you log more.",
    position: 'below',
    navigateTo: 'insights',
    delay: 1500,
  },
  {
    target: 'deep-research',
    message: "After 10 entries, AI finds deep links.",
    position: 'above',
    navigateTo: 'insights',
    scrollIntoView: true,
  },
  {
    target: 'exports-area',
    message: "Share your health story with doctors.",
    position: 'below',
    navigateTo: 'exports',
  },
  {
    target: 'profile-button',
    message: "Your profile and health details live here.",
    position: 'below',
    navigateTo: 'track',
  },
  {
    target: 'streak-pill',
    message: "Track your streak and earn badges here.",
    position: 'below',
    navigateTo: 'track',
  },
  {
    target: 'log-buttons',
    message: "You're all set. Log daily to unlock insights.",
    position: 'above',
    navigateTo: 'track',
  },
];

interface AppTourProps {
  userId: string;
  onViewChange: (view: 'track' | 'history' | 'insights' | 'exports') => void;
  onComplete: () => void;
  onEntryLogged?: boolean;
}

export const AppTour = ({ userId, onViewChange, onComplete, onEntryLogged }: AppTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = TOUR_STEPS[currentStep];

  // Persist in_progress status on mount
  useEffect(() => {
    supabase
      .from('profiles')
      .update({ tour_status: 'in_progress' })
      .eq('id', userId)
      .then(() => {});
  }, [userId]);

  // Navigate to the correct tab for the current step
  useEffect(() => {
    if (step?.navigateTo) {
      onViewChange(step.navigateTo);
    }
  }, [currentStep]);

  // Find and measure the target element
  useEffect(() => {
    setReady(false);
    setTargetRect(null);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;
    let resizeObserver: ResizeObserver | null = null;
    let liveMeasureInterval: ReturnType<typeof setInterval> | null = null;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step?.target}"]`);
      if (el) {
        if (step?.scrollIntoView && attempts === 0) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            if (cancelled) return;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              setTargetRect(rect);
              setReady(true);
            }
          }, 500);
          attempts++;
          return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          setReady(true);

          if (step?.allowInteraction) {
            resizeObserver = new ResizeObserver(() => {
              if (cancelled) return;
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) setTargetRect(r);
            });
            resizeObserver.observe(el);

            liveMeasureInterval = setInterval(() => {
              if (cancelled) return;
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) setTargetRect(r);
            }, 300);
          }
          return;
        }
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(measure, 300);
      }
    };

    const initialDelay = step?.delay || 350;
    const timer = setTimeout(measure, initialDelay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      resizeObserver?.disconnect();
      if (liveMeasureInterval) clearInterval(liveMeasureInterval);
    };
  }, [currentStep, step?.target, step?.scrollIntoView, step?.allowInteraction, step?.delay]);

  // Step 1: auto-advance when entry is logged
  useEffect(() => {
    if (currentStep === 0 && onEntryLogged) {
      const t = setTimeout(() => setCurrentStep(1), 600);
      return () => clearTimeout(t);
    }
  }, [onEntryLogged, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      completeTour();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const completeTour = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();

      const currentMeta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from('profiles')
        .update({ 
          metadata: { ...currentMeta, tour_completed: true },
          tour_status: 'done',
        })
        .eq('id', userId);
    } catch (e) {
      console.error('Failed to persist tour flag:', e);
    }

    onViewChange('track');
    onComplete();
  }, [userId, onComplete, onViewChange]);

  // If user dismisses (X), mark done — they're choosing to skip
  const handleDismiss = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();

      const currentMeta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from('profiles')
        .update({ 
          metadata: { ...currentMeta, tour_completed: true },
          tour_status: 'done',
        })
        .eq('id', userId);
    } catch (e) {
      console.error('Failed to persist tour dismiss:', e);
    }

    onViewChange('track');
    onComplete();
  }, [userId, onComplete, onViewChange]);

  if (!ready || !targetRect || !step) return null;

  return (
    <TourSpotlight
      targetRect={targetRect}
      message={step.message}
      position={step.position}
      onNext={handleNext}
      onDismiss={handleDismiss}
      isLast={currentStep === TOUR_STEPS.length - 1}
      allowInteraction={!!step.allowInteraction && !onEntryLogged}
      stepNumber={currentStep}
      totalSteps={TOUR_STEPS.length}
    />
  );
};
