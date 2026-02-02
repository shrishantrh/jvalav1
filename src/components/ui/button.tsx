import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-primary-foreground hover:-translate-y-0.5 hover:scale-[1.02] before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none",
        warm: "bg-gradient-warm text-primary-foreground hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none",
        destructive: "bg-destructive/90 backdrop-blur-sm text-destructive-foreground hover:bg-destructive/95 border border-destructive/30",
        outline: "border border-white/25 bg-white/80 backdrop-blur-[12px] hover:bg-white/90 hover:border-white/35 text-foreground/90",
        secondary: "bg-white/70 backdrop-blur-[12px] text-secondary-foreground hover:bg-white/85 border border-white/20",
        ghost: "hover:bg-white/50 backdrop-blur-sm hover:text-foreground/95",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        glass: "bg-white/82 backdrop-blur-[16px] backdrop-saturate-[160%] text-foreground/90 border border-white/22 hover:bg-white/90 hover:border-white/32 before:absolute before:top-0 before:left-0 before:right-0 before:h-1/2 before:bg-gradient-to-b before:from-white/15 before:to-transparent before:pointer-events-none",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
