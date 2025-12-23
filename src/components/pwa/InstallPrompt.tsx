import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Zap, Bell, Wifi } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

export function InstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    // Only show after a delay to not overwhelm new users
    if (isInstallable && !isDismissed && !isInstalled) {
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isDismissed, isInstalled]);

  const handleDismiss = () => {
    setShowBanner(false);
    setIsDismissed(true);
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowBanner(false);
    }
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-500",
      "md:left-auto md:right-4 md:max-w-sm"
    )}>
      <Card className="p-4 bg-gradient-to-br from-card via-card to-primary/5 border shadow-lg">
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-primary shadow-primary">
            <Smartphone className="w-5 h-5 text-primary-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Install Jvala</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Add to your home screen for the best experience
            </p>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Zap className="w-3 h-3 text-primary" />
                <span>Faster access</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Bell className="w-3 h-3 text-primary" />
                <span>Push alerts</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Wifi className="w-3 h-3 text-primary" />
                <span>Works offline</span>
              </div>
            </div>

            <Button 
              onClick={handleInstall} 
              size="sm" 
              className="w-full h-9 text-xs shadow-primary"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Install App
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
