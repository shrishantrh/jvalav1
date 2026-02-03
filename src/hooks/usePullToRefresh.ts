import { useState, useRef, useCallback, useEffect } from 'react';
import { haptics } from '@/lib/haptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Pull distance to trigger refresh
  maxPull?: number; // Maximum pull distance
}

interface UsePullToRefreshReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(false);
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Check if scrolled to top
    isAtTop.current = container.scrollTop <= 0;
    
    if (isAtTop.current) {
      startY.current = e.touches[0].clientY;
      hasTriggeredHaptic.current = false;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isRefreshing || !isAtTop.current) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Prevent default scroll when pulling down from top
      e.preventDefault();
      setIsPulling(true);
      
      // Apply resistance curve for more natural feel
      const resistance = 0.5;
      const newPull = Math.min(diff * resistance, maxPull);
      setPullDistance(newPull);
      
      // Trigger haptic when passing threshold
      if (newPull >= threshold && !hasTriggeredHaptic.current) {
        haptics.medium();
        hasTriggeredHaptic.current = true;
      } else if (newPull < threshold && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }
    }
  }, [isRefreshing, maxPull, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing || !isPulling) return;
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      haptics.success();
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
        haptics.error();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
    setIsPulling(false);
    hasTriggeredHaptic.current = false;
  }, [isRefreshing, isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isPulling,
  };
}
