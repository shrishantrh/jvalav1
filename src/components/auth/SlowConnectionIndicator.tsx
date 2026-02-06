import { Loader2, WifiOff } from 'lucide-react';

interface SlowConnectionIndicatorProps {
  show: boolean;
}

export const SlowConnectionIndicator = ({ show }: SlowConnectionIndicatorProps) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl backdrop-blur-xl">
        <div className="relative">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <Loader2 className="absolute -bottom-1 -right-1 w-3 h-3 text-amber-600 animate-spin" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Taking longer than expected...
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
            Please check your internet connection
          </p>
        </div>
      </div>
    </div>
  );
};
