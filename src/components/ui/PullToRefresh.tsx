import { ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export const PullToRefreshIndicator = ({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const opacity = Math.min(pullDistance / 40, 1);
  const scale = 0.5 + progress * 0.5;
  const rotation = progress * 180;

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div 
      className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-50"
      style={{ 
        top: -8,
        transform: `translateY(${pullDistance}px)`,
        opacity,
      }}
    >
      <div 
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          "bg-card/95 backdrop-blur-xl border border-border/30 shadow-lg"
        )}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {isRefreshing ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <svg 
            className="w-5 h-5 text-primary transition-transform duration-150"
            style={{ transform: `rotate(${rotation}deg)` }}
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
          >
            <path d="M12 4v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
};

interface PullToRefreshContainerProps {
  children: ReactNode;
  pullDistance: number;
  isRefreshing: boolean;
  className?: string;
}

export const PullToRefreshContainer = forwardRef<HTMLDivElement, PullToRefreshContainerProps>(
  ({ children, pullDistance, isRefreshing, className }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn("relative overflow-y-auto overflow-x-hidden", className)}
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.3}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
        }}
      >
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing}
        />
        {children}
      </div>
    );
  }
);

PullToRefreshContainer.displayName = 'PullToRefreshContainer';
