import { ReactNode, useCallback } from 'react';
import { Activity, Calendar, BarChart3, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshContainer, PullToRefreshIndicator } from '@/components/ui/PullToRefresh';

interface MobileLayoutProps {
  children: ReactNode;
  currentView?: 'track' | 'history' | 'insights' | 'profile';
  onViewChange?: (view: 'track' | 'history' | 'insights' | 'profile') => void;
  showNav?: boolean;
  header?: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const navItems = [
  { id: 'track', label: 'Log', icon: Activity },
  { id: 'history', label: 'History', icon: Calendar },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
] as const;

export const MobileLayout = ({ 
  children, 
  currentView = 'track',
  onViewChange,
  showNav = true,
  header,
  onRefresh
}: MobileLayoutProps) => {
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    maxPull: 120,
  });

  const handleNavClick = (id: string) => {
    haptics.selection();
    onViewChange?.(id as any);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden max-w-md mx-auto bg-background">
      {/* Warm gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(25 70% 85% / 0.3), transparent)',
        }}
      />
      
      {/* Header area */}
      {header && (
        <header className="relative flex-shrink-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
          {header}
        </header>
      )}
      
      {/* Main content - scrollable area with pull-to-refresh */}
      <main className="relative flex-1 overflow-hidden">
        <PullToRefreshIndicator 
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />
        <div 
          ref={containerRef}
          className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide"
          style={{
            transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
            transition: pullDistance === 0 ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : undefined,
          }}
        >
          <div className="px-5 py-5 pb-28">
            {children}
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation - Premium iOS tab bar */}
      {showNav && onViewChange && (
        <nav className="relative flex-shrink-0 z-50 bg-card/90 backdrop-blur-2xl border-t border-border/40 safe-area-bottom">
          {/* Glossy highlight line */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          
          <div className="flex items-center justify-around h-20 px-4">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 px-5 py-2.5 rounded-2xl transition-all duration-300",
                    "active:scale-95 touch-manipulation",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground/70 hover:text-foreground"
                  )}
                >
                  {/* Active indicator glow */}
                  {isActive && (
                    <div 
                      className="absolute inset-0 rounded-2xl opacity-15"
                      style={{
                        background: 'radial-gradient(circle at center, hsl(var(--primary)), transparent 70%)',
                      }}
                    />
                  )}
                  
                  <div className={cn(
                    "relative p-2 rounded-2xl transition-all duration-300",
                    isActive && "bg-primary/12 shadow-sm"
                  )}>
                    <item.icon className={cn(
                      "w-6 h-6 transition-all duration-300",
                      isActive ? "scale-110" : "scale-100"
                    )} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  
                  <span className={cn(
                    "text-[11px] font-semibold tracking-wide transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-70"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
