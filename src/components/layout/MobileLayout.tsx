import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
        <header className="flex-shrink-0 z-50 glass border-b border-white/10">
          {header}
        </header>
      )}
      
      {/* Main content - scrollable area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="px-4 py-4 pb-24">
          {children}
        </div>
      </main>
      
      {/* Bottom Navigation - iOS style */}
      {showNav && onViewChange && (
        <nav className="flex-shrink-0 z-50 glass border-t border-white/10 safe-area-bottom">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-2xl transition-all press-effect",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-xl transition-all",
                    isActive && "bg-primary/15"
                  )}>
                    <item.icon className={cn(
                      "w-5 h-5 transition-all",
                      isActive && "scale-110"
                    )} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium transition-all",
                    isActive && "text-primary"
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
