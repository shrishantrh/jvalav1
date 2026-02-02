import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/15 text-primary hover:bg-primary/20",
        secondary: "border-white/20 bg-white/70 text-secondary-foreground/90 hover:bg-white/80",
        destructive: "border-destructive/25 bg-destructive/15 text-destructive hover:bg-destructive/20",
        outline: "text-foreground/85 border-white/25 bg-white/50 hover:bg-white/65",
        glass: "border-white/20 bg-white/65 backdrop-blur-[8px] text-foreground/85 hover:bg-white/75",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
