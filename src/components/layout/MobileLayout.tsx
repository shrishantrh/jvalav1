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
      top: 0, bottom: 0, left: 0, right: 0,
    }}>
      
      {/* Warm gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 100% 60% at 50% -10%, hsl(var(--primary) / 0.06), transparent 50%),
            radial-gradient(ellipse 80% 40% at 80% 0%, hsl(var(--primary) / 0.04), transparent 40%),
            radial-gradient(ellipse 60% 30% at 20% 10%, hsl(var(--primary) / 0.03), transparent 35%)
          `,
        }}
      />
      
      {/* Header — Liquid Glass */}
      {header && (
        <header 
          className="relative flex-shrink-0 z-50"
          style={{ 
            paddingTop: 'env(safe-area-inset-top, 0px)',
            background: 'hsl(var(--background) / 0.65)',
            backdropFilter: 'blur(40px) saturate(220%)',
            WebkitBackdropFilter: 'blur(40px) saturate(220%)',
          }}
        >
          {header}
        </header>
      )}
      
      {/* Main content */}
      <main className="relative flex-1 overflow-hidden" style={{ 
        overscrollBehavior: 'none',
        paddingBottom: showNav && onViewChange ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : undefined,
      }}>
        {currentView === 'track' ? (
          <div className="h-full overflow-hidden">
            {children}
          </div>
        ) : (
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
              <div className="px-5 py-4">
                {children}
              </div>
            </div>
          </>
        )}
      </main>
      
      {/* ─── Bottom Navigation — Floating Liquid Glass Pill ─── */}
      {showNav && onViewChange && (
        <nav 
          className="absolute bottom-0 left-0 right-0 z-50"
          style={{
            padding: '0 12px',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
          }}
        >
          <div className="liquid-glass-nav mx-auto">
            <div className="relative z-10 flex items-center justify-around h-[64px] px-1">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-0.5 px-5 py-2 rounded-2xl transition-all duration-500",
                      "active:scale-90 touch-manipulation no-select",
                      isActive 
                        ? "text-primary" 
                        : "text-muted-foreground/50 hover:text-foreground/70"
                    )}
                    style={{ transition: 'var(--transition-liquid)' }}
                  >
                    {/* Active indicator — glass prominent pill */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-2xl glass-prominent"
                        style={{
                          background: 'hsl(var(--primary) / 0.12)',
                          border: '1px solid hsl(var(--primary) / 0.15)',
                          boxShadow: '0 2px 12px hsl(var(--primary) / 0.15), inset 0 1px 0 hsl(var(--glass-specular) / 0.2)',
                        }}
                      />
                    )}
                    
                    <div className={cn(
                      "relative z-10 transition-all duration-500",
                      isActive && "scale-110"
                    )}>
                      <item.icon 
                        className="w-[22px] h-[22px] transition-all duration-500" 
                        strokeWidth={isActive ? 2.5 : 1.6} 
                      />
                    </div>
                    
                    <span className={cn(
                      "relative z-10 text-[10px] font-semibold tracking-wide transition-all duration-500",
                      isActive ? "opacity-100" : "opacity-50"
                    )}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};
