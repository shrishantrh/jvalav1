import { useEffect, useState } from 'react';
import jvalaLogo from '@/assets/jvala-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

const TAGLINES = [
  "Know Tomorrow Today",
  "AI-Powered Health Insights",
  "Track Smarter, Not Harder",
  "Your Health, Decoded",
];

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [currentTagline, setCurrentTagline] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    // Cycle through taglines
    const taglineInterval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentTagline(prev => (prev + 1) % TAGLINES.length);
        setFadeIn(true);
      }, 200);
    }, 800);

    // Complete after animation
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(taglineInterval);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-purple-600">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-purple-300/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '500ms' }} />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-pink-300/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1000ms' }} />
      </div>

      {/* Logo container with entrance animation */}
      <div className="relative z-10 flex flex-col items-center space-y-6 animate-in fade-in-0 zoom-in-95 duration-700">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/20 rounded-3xl blur-2xl scale-150 animate-pulse" />
          <div className="relative w-28 h-28 bg-white rounded-3xl shadow-2xl p-4 animate-bounce-slow">
            <img 
              src={jvalaLogo} 
              alt="Jvala" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Brand name */}
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Jvala
        </h1>

        {/* Rotating taglines */}
        <div className="h-8 flex items-center justify-center">
          <p 
            className={`text-white/90 text-lg font-medium transition-all duration-200 ${
              fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            {TAGLINES[currentTagline]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 mt-8">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-12 text-white/60 text-xs font-medium">
        © 2024 Jvala Health
      </div>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
