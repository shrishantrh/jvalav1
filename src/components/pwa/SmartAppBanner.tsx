import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { isNative } from "@/lib/capacitor";
import jvalaLogo from "@/assets/jvala-logo.png";

const DISMISSED_KEY = "jvala_app_banner_dismissed";
const APP_STORE_URL = "https://apps.apple.com/app/jvala/id6743731498";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.jvala.health";
const APP_SCHEME = "jvala://";

export const SmartAppBanner = () => {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show in native app or if already dismissed
    if (isNative) return;
    
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch { /* ignore */ }

    const ua = navigator.userAgent;
    const mobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (!mobile) return;

    // Don't show if running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    setIsIOS(/iPhone|iPad|iPod/i.test(ua));
    setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()); } catch { /* ignore */ }
  };

  const openApp = () => {
    // Try to open the app first
    window.location.href = APP_SCHEME;

    // If app doesn't open within 1.5s, redirect to store
    setTimeout(() => {
      window.location.href = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
    }, 1500);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center gap-3 px-3 py-2.5 shadow-lg"
      style={{
        background: "linear-gradient(135deg, #1a0a1e 0%, #2d1233 100%)",
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
      }}
    >
      <button onClick={dismiss} className="shrink-0 p-1" aria-label="Close">
        <X className="w-4 h-4 text-white/60" />
      </button>

      <img src={jvalaLogo} alt="" className="w-10 h-10 rounded-xl shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight truncate">Jvala</p>
        <p className="text-white/60 text-xs leading-tight">
          {isIOS ? "Open in the Jvala app" : "Get the Jvala app"}
        </p>
      </div>

      <button
        onClick={openApp}
        className="shrink-0 px-4 py-1.5 rounded-full text-white text-sm font-semibold"
        style={{ background: "linear-gradient(135deg, #D6006C, #892EFF)" }}
      >
        OPEN
      </button>
    </div>
  );
};
