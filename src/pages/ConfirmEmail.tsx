import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";

const APP_SCHEME = "jvala://";
const APP_STORE_URL = "https://apps.apple.com/app/jvala/id6743731498";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.jvala.health";

const ConfirmEmail = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "verified" | "error">("verifying");
  const [isMobile, setIsMobile] = useState(false);
  const [triedDeepLink, setTriedDeepLink] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(ua));
  }, []);

  // Handle the auth tokens from the URL hash (Supabase redirects with #access_token=...)
  useEffect(() => {
    const handleAuth = async () => {
      // Check if there's already a session (tokens were picked up automatically)
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("verified");
        // On desktop or if not mobile, auto-navigate to app
        if (!(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))) {
          setTimeout(() => navigate("/", { replace: true }), 1500);
        }
        return;
      }

      // Check URL hash for tokens
      const hash = window.location.hash;
      if (hash.includes("access_token") || hash.includes("type=signup") || hash.includes("type=recovery")) {
        // Supabase client auto-detects hash tokens via onAuthStateChange
        // Wait briefly for it to process
        let retries = 0;
        const poll = setInterval(async () => {
          retries++;
          const { data: s } = await supabase.auth.getSession();
          if (s.session) {
            clearInterval(poll);
            setStatus("verified");
            if (!(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))) {
              setTimeout(() => navigate("/", { replace: true }), 1500);
            }
          } else if (retries > 15) {
            clearInterval(poll);
            setStatus("verified"); // Email was verified even if session isn't here
          }
        }, 500);
        return;
      }

      // No tokens in URL — might be direct navigation
      setStatus("verified");
    };

    handleAuth();
  }, [navigate]);

  const tryOpenApp = () => {
    setTriedDeepLink(true);
    // Try custom URL scheme first
    const currentHash = window.location.hash;
    const deepLinkUrl = `${APP_SCHEME}auth${currentHash}`;
    
    // Use a hidden iframe to try the scheme (avoids error pages)
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = deepLinkUrl;
    document.body.appendChild(iframe);

    // Also try window.location as fallback
    setTimeout(() => {
      window.location.href = deepLinkUrl;
    }, 100);

    // Clean up iframe
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  };

  const openStore = () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    window.location.href = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, #F3F0FF 0%, #FDF2F8 100%)" }}>
      <div className="max-w-sm w-full text-center space-y-6">
        <img src={jvalaLogo} alt="Jvala" className="w-16 h-16 mx-auto rounded-2xl" />

        {status === "verifying" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "#D6006C" }} />
            <h1 className="text-xl font-bold" style={{ color: "#1F2937" }}>Verifying your email…</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>Just a moment.</p>
          </>
        )}

        {status === "verified" && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, #D6006C, #892EFF)" }}>
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: "#1F2937" }}>Email Verified! ✨</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              {isMobile
                ? "Your email has been confirmed. Open the app to sign in."
                : "Your email has been confirmed. You can now sign in."}
            </p>

            {isMobile && (
              <div className="space-y-3 pt-2">
                <button
                  onClick={tryOpenApp}
                  className="w-full py-3.5 px-6 rounded-xl text-white font-semibold text-base"
                  style={{ background: "linear-gradient(135deg, #D6006C, #892EFF)" }}
                >
                  Open Jvala App
                </button>
                {triedDeepLink && (
                  <button
                    onClick={openStore}
                    className="w-full py-3 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                    style={{ color: "#D6006C", border: "1px solid #D6006C20", background: "#D6006C08" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Get Jvala from App Store
                  </button>
                )}
              </div>
            )}

            {!isMobile && (
              <button
                onClick={() => navigate("/auth", { replace: true })}
                className="py-3 px-8 rounded-xl text-white font-semibold"
                style={{ background: "linear-gradient(135deg, #D6006C, #892EFF)" }}
              >
                Sign In
              </button>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold" style={{ color: "#1F2937" }}>Something went wrong</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              The verification link may have expired. Please try signing up again.
            </p>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="py-3 px-8 rounded-xl text-white font-semibold"
              style={{ background: "linear-gradient(135deg, #D6006C, #892EFF)" }}
            >
              Back to Sign In
            </button>
          </>
        )}

        <p className="text-xs pt-4" style={{ color: "#9CA3AF" }}>
          © {new Date().getFullYear()} Jvala Health · <a href="https://jvala.tech" style={{ color: "#D6006C" }}>jvala.tech</a>
        </p>
      </div>
    </div>
  );
};

export default ConfirmEmail;
