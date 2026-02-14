import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        severity: {
          none: "hsl(var(--severity-none))",
          mild: "hsl(var(--severity-mild))",
          moderate: "hsl(var(--severity-moderate))",
          severe: "hsl(var(--severity-severe))",
          "none-bg": "hsl(var(--severity-none-bg))",
          "mild-bg": "hsl(var(--severity-mild-bg))",
          "moderate-bg": "hsl(var(--severity-moderate-bg))",
          "severe-bg": "hsl(var(--severity-severe-bg))",
        },
        glass: {
          bg: "hsl(var(--glass-bg))",
          border: "hsl(var(--glass-border))",
          highlight: "hsl(var(--glass-highlight))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        medical: "var(--radius-medical)",
        glass: "var(--radius-glass)",
      },
      spacing: {
        touch: "var(--space-touch)",
        comfortable: "var(--space-comfortable)",
        standard: "var(--space-standard)",
      },
      fontWeight: {
        medical: "var(--text-medical)",
        clinical: "var(--text-clinical)",
        body: "var(--text-body)",
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(10px)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.75" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "glass-shimmer": {
          "0%": { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "100% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.35s ease-out",
        "accordion-up": "accordion-up 0.35s ease-out",
        "fade-in": "fade-in 0.45s ease-out forwards",
        "fade-out": "fade-out 0.35s ease-out",
        "slide-in-right": "slide-in-right 0.35s ease-out",
        "slide-in-left": "slide-in-left 0.35s ease-out",
        "scale-in": "scale-in 0.35s ease-out",
        "shimmer": "shimmer 2.5s linear infinite",
        "pulse-soft": "pulse-soft 2.5s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "bounce-soft": "bounce-soft 1.5s ease-in-out infinite",
        "glass-shimmer": "glass-shimmer 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
