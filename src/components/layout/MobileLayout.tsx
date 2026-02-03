import { ReactNode } from "react";
import { Activity, Calendar, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: ReactNode;
  currentView?: 'track' | 'history' | 'insights' | 'profile';
  onViewChange?: (view: 'track' | 'history' | 'insights' | 'profile') => void;
  showNav?: boolean;
  header?: ReactNode;
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
  header
}: MobileLayoutProps) => {
  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden max-w-md mx-auto">
      {/* Header area */}
      {header && (
        <header className="flex-shrink-0 z-50 bg-background">
          {header}
        </header>
      )}
      
      {/* Main content - scrollable area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="px-4 py-4 pb-28">
          {children}
        </div>
      </main>
      
      {/* Bottom Navigation - Floating pill style */}
      {showNav && onViewChange && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-6 px-4 safe-area-bottom pointer-events-none">
          <nav className="glass-nav rounded-full shadow-lg border border-border/50 pointer-events-auto">
            <div className="flex items-center gap-1 px-2 py-2">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-full transition-all press-effect",
                      isActive 
                        ? "bg-foreground text-background" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {isActive && (
                      <span className="text-xs font-semibold">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};
