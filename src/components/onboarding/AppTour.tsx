import { useState, useEffect, useCallback } from 'react';
import { TourSpotlight } from './TourSpotlight';
import { supabase } from '@/integrations/supabase/client';

interface TourStep {
  target: string; // data-tour attribute value
  message: string;
  position: 'above' | 'below';
  navigateTo?: 'track' | 'history' | 'insights' | 'exports';
  allowInteraction?: boolean;
  waitForEntry?: boolean;
  scrollIntoView?: boolean; // scroll element into view before measuring
  delay?: number; // extra ms to wait before first measure (for async-loading content)
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
    message: "Nice! Your first entry is saved. ✨",
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
    message: "Track your streak and earn badges!",
    position: 'below',
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

  // Navigate to the correct tab for the current step
  useEffect(() => {
    if (step?.navigateTo) {
      onViewChange(step.navigateTo);
    }
  }, [currentStep]);

  // Find and measure the target element with robust retry + live re-measure for interactive steps
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

          // For interactive steps, keep re-measuring so the highlight
          // grows/shrinks when panels expand (e.g. flare → severity wheel)
          if (step?.allowInteraction) {
            resizeObserver = new ResizeObserver(() => {
              if (cancelled) return;
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) setTargetRect(r);
            });
            resizeObserver.observe(el);

            // Also poll in case children change without triggering resize
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
        .update({ metadata: { ...currentMeta, tour_completed: true } })
        .eq('id', userId);
    } catch (e) {
      console.error('Failed to persist tour flag:', e);
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
      onDismiss={completeTour}
      isLast={currentStep === TOUR_STEPS.length - 1}
      allowInteraction={!!step.allowInteraction && !onEntryLogged}
      stepNumber={currentStep}
      totalSteps={TOUR_STEPS.length}
    />
  );
};
