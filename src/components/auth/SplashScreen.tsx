import { useEffect } from 'react';
import jvalaLogo from '@/assets/jvala-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  useEffect(() => {
    // Simple fade in/out - complete after 1.5 seconds
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 1500);

    return () => {
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-slate-950">
      {/* Logo container with entrance animation */}
      <div className="flex flex-col items-center space-y-4 animate-in fade-in-0 zoom-in-95 duration-500">
        {/* Logo */}
        <div className="w-24 h-24">
          <img 
            src={jvalaLogo} 
            alt="Jvala" 
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};
