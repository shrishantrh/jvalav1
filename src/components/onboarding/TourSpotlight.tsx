import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourSpotlightProps {
  targetRect: DOMRect | null;
  message: string;
  position: 'above' | 'below';
  onNext: () => void;
  onDismiss: () => void;
  isLast: boolean;
  allowInteraction: boolean;
  stepNumber: number;
  totalSteps: number;
}

export const TourSpotlight = ({
  targetRect,
  message,
  position,
  onNext,
  onDismiss,
  isLast,
  allowInteraction,
  stepNumber,
  totalSteps,
}: TourSpotlightProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!targetRect) return null;

  // Spotlight cutout dimensions with padding
  const pad = 12;
  const cutout = {
    x: targetRect.x - pad,
    y: targetRect.y - pad,
    w: targetRect.width + pad * 2,
    h: targetRect.height + pad * 2,
    r: 20,
  };

  // Bubble positioning
  const bubbleStyle: React.CSSProperties = {
    position: 'absolute',
    left: Math.max(16, Math.min(cutout.x, window.innerWidth - 280)),
    maxWidth: 'calc(100vw - 32px)',
    width: 280,
    zIndex: 10002,
  };

  if (position === 'above') {
    bubbleStyle.bottom = window.innerHeight - cutout.y + 16;
  } else {
    bubbleStyle.top = cutout.y + cutout.h + 16;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[10000] transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ pointerEvents: allowInteraction ? 'none' : 'auto' }}
    >
      {/* SVG overlay with cutout */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: allowInteraction ? 'none' : 'auto' }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={cutout.x}
              y={cutout.y}
              width={cutout.w}
              height={cutout.h}
              rx={cutout.r}
              ry={cutout.r}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Neon glow border around cutout */}
      <div
        className="absolute tour-glow-border"
        style={{
          left: cutout.x,
          top: cutout.y,
          width: cutout.w,
          height: cutout.h,
          borderRadius: cutout.r,
          pointerEvents: 'none',
        }}
      />

      {/* Interaction hole: allow clicks through to the spotlight area */}
      {allowInteraction && (
        <div
          className="absolute"
          style={{
            left: cutout.x,
            top: cutout.y,
            width: cutout.w,
            height: cutout.h,
            borderRadius: cutout.r,
            pointerEvents: 'auto',
            zIndex: 10001,
            // Transparent - just allows clicks to pass through the overlay
            background: 'transparent',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Speech bubble */}
      <div
        style={{ ...bubbleStyle, pointerEvents: 'auto' }}
        className={cn(
          "animate-in fade-in slide-in-from-bottom-3 duration-500",
        )}
      >
        <div
          className={cn(
            "relative p-4 rounded-2xl",
            "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl",
            "border border-white/50 dark:border-slate-700/50",
            "shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
          )}
        >
          {/* Dismiss X */}
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Message */}
          <p className="text-sm font-medium text-foreground pr-6 leading-relaxed">
            {message}
          </p>

          {/* Footer: step indicator + next button */}
          <div className="flex items-center justify-between mt-3">
            {/* Step dots */}
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                    i === stepNumber
                      ? "bg-primary w-4"
                      : i < stepNumber
                        ? "bg-primary/40"
                        : "bg-muted-foreground/20"
                  )}
                />
              ))}
            </div>

            {/* Next / Done button */}
            {!allowInteraction && (
              <button
                onClick={onNext}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 active:scale-95",
                  "shadow-[0_2px_8px_hsl(330_80%_55%/0.3)]"
                )}
              >
                {isLast ? 'Done' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
