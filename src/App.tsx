import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import * as Sentry from "@sentry/react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Demo from "./pages/Demo";
import Settings from "./pages/Settings";
import SharedReport from "./pages/SharedReport";
import SharedProfile from "./pages/SharedProfile";
import Install from "./pages/Install";
import ClinicianDashboard from "./pages/ClinicianDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import { OfflineIndicator } from "./components/pwa/OfflineIndicator";
import { InstallPrompt } from "./components/pwa/InstallPrompt";

const queryClient = new QueryClient();

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const FallbackUI = () => (
  <div className="flex items-center justify-center min-h-screen bg-background p-6">
    <div className="text-center space-y-4 max-w-md">
      <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
      <p className="text-muted-foreground">
        An unexpected error occurred. Our team has been notified. Please try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-medium"
      >
        Refresh
      </button>
    </div>
  </div>
);

const App = () => (
  <Sentry.ErrorBoundary fallback={<FallbackUI />} showDialog={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <InstallPrompt />
        <HashRouter>
          <SentryRoutes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/clinician" element={<ClinicianDashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/shared-report" element={<SharedReport />} />
            <Route path="/shared-profile" element={<SharedProfile />} />
            <Route path="/install" element={<Install />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </SentryRoutes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
