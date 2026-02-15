import { useState, useEffect, useCallback } from 'react';
import { TourSpotlight } from './TourSpotlight';
import { supabase } from '@/integrations/supabase/client';

interface TourStep {
  target: string; // data-tour attribute value
  message: string;
  position: 'above' | 'below';
  navigateTo?: 'track' | 'history' | 'insights' | 'exports';
  allowInteraction?: boolean; // step 1: user must tap a button
  waitForEntry?: boolean; // step 1: wait for entry to be logged
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
  },
  {
    target: 'deep-research',
    message: "After 10 entries, AI finds deep links.",
    position: 'above',
    navigateTo: 'insights',
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
  onEntryLogged?: boolean; // becomes true when user logs something during step 1
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

  // Find and measure the target element
  useEffect(() => {
    const findTarget = () => {
      const el = document.querySelector(`[data-tour="${step?.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        setReady(true);
        
        // Scroll element into view if needed (for deep-research button)
        if (step?.target === 'deep-research' || step?.target === 'exports-area') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Re-measure after scroll
          setTimeout(() => {
            const newRect = el.getBoundingClientRect();
            setTargetRect(newRect);
          }, 400);
        }
      } else {
        // Element not rendered yet, retry
        setReady(false);
      }
    };

    setReady(false);
    setTargetRect(null);
    // Delay to allow tab navigation to render
    const timer = setTimeout(findTarget, 400);
    // Also retry a couple more times for slow renders
    const retry1 = setTimeout(findTarget, 800);
    const retry2 = setTimeout(findTarget, 1200);

    return () => {
      clearTimeout(timer);
      clearTimeout(retry1);
      clearTimeout(retry2);
    };
  }, [currentStep, step?.target]);

  // Step 1: auto-advance when entry is logged
  useEffect(() => {
    if (currentStep === 0 && onEntryLogged) {
      // Delay to let the confirmation message appear
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
      // Persist tour_completed in profile metadata
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
