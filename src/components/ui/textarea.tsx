import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border border-white/20 bg-white/80 backdrop-blur-[12px] px-4 py-3 text-sm text-foreground/90 ring-offset-background placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 focus-visible:bg-white/92 focus-visible:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 resize-none",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
