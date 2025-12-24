import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';
import { 
  Download, 
  Smartphone, 
  Zap, 
  Bell, 
  Wifi, 
  Share, 
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import jvalaLogo from '@/assets/jvala-logo.png';

export default function Install() {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  const handleInstall = async () => {
    await promptInstall();
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Already Installed!</h1>
          <p className="text-muted-foreground">
            Jvala is installed on your device. Open it from your home screen for the best experience.
          </p>
          <Link to="/">
            <Button className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to App
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4">
        <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <img 
              src={jvalaLogo} 
              alt="Jvala" 
              className="w-24 h-24 mx-auto rounded-2xl shadow-lg"
            />
            <h1 className="text-3xl font-bold">Install Jvala</h1>
            <p className="text-muted-foreground">
              Get the full app experience on your device
            </p>
          </div>

          {/* Benefits */}
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Why install?</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Instant Access</p>
                  <p className="text-sm text-muted-foreground">Launch from home screen, no browser</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wifi className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Works Offline</p>
                  <p className="text-sm text-muted-foreground">Log symptoms even without internet</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get reminded to log your symptoms</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Full Screen Experience</p>
                  <p className="text-sm text-muted-foreground">No browser bars, feels native</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Install Instructions */}
          {isInstallable ? (
            <Button onClick={handleInstall} size="lg" className="w-full h-14 text-lg">
              <Download className="w-5 h-5 mr-2" />
              Install Jvala
            </Button>
          ) : (
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">How to install</h2>
              
              {platform === 'ios' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap the Share button</p>
                      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <Share className="w-5 h-5" />
                        <span className="text-sm">At the bottom of Safari</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap "Add to Home Screen"</p>
                      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <PlusSquare className="w-5 h-5" />
                        <span className="text-sm">Scroll down if needed</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground mt-1">In the top right corner</p>
                    </div>
                  </div>
                </div>
              )}

              {platform === 'android' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap the menu button</p>
                      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <MoreVertical className="w-5 h-5" />
                        <span className="text-sm">Three dots in the top right</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap "Install app" or "Add to Home screen"</p>
                      <p className="text-sm text-muted-foreground mt-1">The option varies by browser</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Confirm installation</p>
                      <p className="text-sm text-muted-foreground mt-1">Tap "Install" in the popup</p>
                    </div>
                  </div>
                </div>
              )}

              {platform === 'desktop' && (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Look for the install icon in your browser's address bar, or use the browser menu to install this app.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span>Chrome/Edge: Click the install icon in the address bar</span>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
