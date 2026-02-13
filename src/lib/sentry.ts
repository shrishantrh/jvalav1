/**
 * Sentry initialization for the Jvala client app.
 * Captures errors, performance, and routes AI/API observability
 * events as Sentry breadcrumbs for full context on crash reports.
 */
import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn("[sentry] VITE_SENTRY_DSN not set — Sentry disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE, // "development" | "production"
    release: `jvala@${__APP_VERSION__}`,

    // Performance: sample 20% of transactions in prod, 100% in dev
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.2 : 1.0,

    // Session replay for crash reproduction (1% normal, 100% on error)
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    // Don't send PII unless explicitly tagged
    sendDefaultPii: false,

    // Filter noisy errors
    beforeSend(event) {
      // Drop ResizeObserver loop errors (browser noise)
      if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Set authenticated user context for Sentry.
 * Call after login; clear on logout with clearSentryUser().
 */
export function setSentryUser(id: string, email?: string): void {
  Sentry.setUser({ id, email });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Add an AI/API observability event as a Sentry breadcrumb.
 * These appear in the timeline of any subsequent error report.
 */
export function addObservabilityBreadcrumb(
  category: "ai-call" | "api-call",
  data: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info"
): void {
  Sentry.addBreadcrumb({
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Re-export for convenience
export { Sentry };
