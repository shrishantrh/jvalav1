import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Demo from "./pages/Demo";
import Settings from "./pages/Settings";
import SharedReport from "./pages/SharedReport";
import SharedProfile from "./pages/SharedProfile";
import Install from "./pages/Install";
import ClinicianDashboard from "./pages/ClinicianDashboard";
import NotFound from "./pages/NotFound";
import { OfflineIndicator } from "./components/pwa/OfflineIndicator";
import { InstallPrompt } from "./components/pwa/InstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <InstallPrompt />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/clinician" element={<ClinicianDashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/shared-report" element={<SharedReport />} />
          <Route path="/shared-profile" element={<SharedProfile />} />
          <Route path="/install" element={<Install />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
