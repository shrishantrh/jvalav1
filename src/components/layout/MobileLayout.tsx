import { ReactNode, useCallback, useEffect } from 'react';
import { Activity, Calendar, BarChart3, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshContainer, PullToRefreshIndicator } from '@/components/ui/PullToRefresh';
import { initializeThemeColor } from '@/hooks/useThemeColor';

interface MobileLayoutProps {
  children: ReactNode;
  currentView?: 'track' | 'history' | 'insights' | 'exports';
  onViewChange?: (view: 'track' | 'history' | 'insights' | 'exports') => void;
  showNav?: boolean;
  header?: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const navItems = [
  { id: 'track', label: 'Log', icon: Activity },
  { id: 'history', label: 'History', icon: Calendar },
  { id: 'insights', label: 'Trends', icon: BarChart3 },
  { id: 'exports', label: 'Exports', icon: Download },
] as const;

export const MobileLayout = ({ 
  children, 
  currentView = 'track',
  onViewChange,
  showNav = true,
  header,
  onRefresh
}: MobileLayoutProps) => {
  // Initialize theme color on mount
  useEffect(() => {
    initializeThemeColor();
  }, []);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      haptics.light();
      await onRefresh();
      haptics.success();
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
    <div className="flex flex-col overflow-hidden max-w-md mx-auto bg-background" style={{ 
      overscrollBehavior: 'none', 
      position: 'fixed',
      top: 0, 
      bottom: 0, 
      left: 0, 
      right: 0,
    }}>
      
      {/* Warm gradient overlay - 3D depth effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 100% 60% at 50% -10%, hsl(var(--primary) / 0.08), transparent 50%),
            radial-gradient(ellipse 80% 40% at 80% 0%, hsl(var(--primary) / 0.05), transparent 40%),
            radial-gradient(ellipse 60% 30% at 20% 10%, hsl(var(--primary) / 0.04), transparent 35%)
          `,
        }}
      />
      
      {/* Header area - extends into top safe area to eliminate black slivers */}
      {header && (
        <header 
          className="relative flex-shrink-0 z-50 glass-header"
          style={{ 
            marginTop: 'calc(-1 * env(safe-area-inset-top, 0px) - 60px)',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 60px)',
            backgroundColor: 'hsl(var(--background))',
          }}
        >
          {header}
        </header>
      )}
      
      {/* Main content area */}
      <main className="relative flex-1 overflow-hidden" style={{ overscrollBehavior: 'none' }}>
        {currentView === 'track' ? (
          /* Track view: children manage their own scroll (SmartTrack has internal scroll) */
          <div className="h-full overflow-hidden">
            {children}
          </div>
        ) : (
          /* Other views: scrollable with pull-to-refresh */
          <>
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
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="px-5 py-4 pb-20">
                {children}
              </div>
            </div>
          </>
        )}
      </main>
      
      {/* Bottom Navigation - Fixed, never scrolls */}
      {showNav && onViewChange && (
        <nav 
          className="relative flex-shrink-0 z-50"
          style={{
            background: 'hsl(var(--glass-bg) / 0.95)',
            backdropFilter: 'blur(30px) saturate(200%)',
            WebkitBackdropFilter: 'blur(30px) saturate(200%)',
            borderTop: '1px solid hsl(var(--border) / 0.3)',
            boxShadow: '0 -8px 32px hsl(var(--foreground) / 0.03)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Extend nav background color below into any remaining gap */}
          <div 
            className="absolute left-0 right-0 bottom-0 translate-y-full z-[-1]"
            style={{
              height: '100px',
              background: 'hsl(var(--glass-bg) / 0.95)',
            }}
          />
          
          {/* Glossy highlight line */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          
          <div className="flex items-center justify-around h-[72px] px-2">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  data-tour={`nav-${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-2xl transition-all duration-300",
                    "active:scale-90 touch-manipulation no-select",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <>
                      <div 
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background: 'linear-gradient(180deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.08) 100%)',
                          boxShadow: `
                            inset 0 1px 0 hsl(var(--primary) / 0.2),
                            0 2px 8px hsl(var(--primary) / 0.15)
                          `,
                        }}
                      />
                      <div 
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-3 rounded-full blur-md"
                        style={{ background: 'hsl(var(--primary) / 0.4)' }}
                      />
                    </>
                  )}
                  
                  <div className={cn(
                    "relative z-10 transition-all duration-300",
                    isActive && "scale-110"
                  )}>
                    <item.icon 
                      className="w-6 h-6 transition-all duration-300" 
                      strokeWidth={isActive ? 2.5 : 1.8} 
                    />
                  </div>
                  
                  <span className={cn(
                    "relative z-10 text-[10px] font-semibold tracking-wide transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-60"
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
