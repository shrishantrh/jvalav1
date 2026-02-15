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

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const safeInset = 4; // min distance from viewport edges

  const pad = 8;
  const cutout = {
    x: Math.max(safeInset, targetRect.x - pad),
    y: Math.max(safeInset, targetRect.y - pad),
    w: 0,
    h: 0,
    r: 16,
  };
  // Calculate width/height after clamping x/y, then clamp to viewport
  cutout.w = Math.min(targetRect.width + pad * 2, vw - cutout.x - safeInset);
  cutout.h = Math.min(targetRect.height + pad * 2, vh - cutout.y - safeInset);

  // Bubble positioning — always keep on screen
  const bubbleWidth = Math.min(280, vw - 32);
  const bubbleMargin = 12;
  const bubbleLeft = Math.max(
    bubbleMargin,
    Math.min(
      cutout.x + cutout.w / 2 - bubbleWidth / 2,
      vw - bubbleWidth - bubbleMargin
    )
  );

  const bubbleStyle: React.CSSProperties = {
    position: 'fixed',
    left: bubbleLeft,
    width: bubbleWidth,
    zIndex: 10003,
  };

  // Always place bubble above if target is in lower 60% of screen, otherwise below
  const targetTop = cutout.y;
  const targetBottom = cutout.y + cutout.h;
  const effectivePosition = targetTop > vh * 0.35 ? 'above' : position;

  if (effectivePosition === 'above') {
    // Place bubble so its bottom edge is above the cutout with margin, clamped to viewport
    bubbleStyle.top = Math.max(bubbleMargin, Math.min(targetTop - 110, vh - 140));
  } else {
    bubbleStyle.top = Math.min(targetBottom + bubbleMargin, vh - 140);
  }

  // Final safety clamp: ensure bubble never goes below viewport
  if (typeof bubbleStyle.top === 'number' && bubbleStyle.top > vh - 120) {
    bubbleStyle.top = vh - 120;
  }

  return createPortal(
    <>
      {/* Dark overlay with cutout — blocks clicks unless allowInteraction */}
      <div
        className={cn(
          "fixed inset-0 z-[10000] transition-opacity duration-500",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ pointerEvents: allowInteraction ? 'none' : 'auto' }}
      >
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id={`tour-mask-${stepNumber}`}>
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
            mask={`url(#tour-mask-${stepNumber})`}
          />
        </svg>

        {/* Neon glow border */}
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
      </div>

      {/* Speech bubble — always interactive, on its own layer */}
      <div
        style={{ ...bubbleStyle, pointerEvents: 'auto' }}
        className={cn(
          "fixed transition-opacity duration-500",
          visible ? "opacity-100" : "opacity-0",
          "animate-in fade-in slide-in-from-bottom-3 duration-500"
        )}
      >
        <div
          className={cn(
            "relative p-4 rounded-2xl",
            "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
            "border border-white/60 dark:border-slate-700/50",
            "shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
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

          {/* Footer */}
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

            {/* Hint for interactive step */}
            {allowInteraction && (
              <span className="text-[10px] text-muted-foreground animate-pulse">
                Tap a button to try
              </span>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
