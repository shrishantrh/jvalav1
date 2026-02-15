import { useState, useRef, useCallback } from "react";
import { Shield } from "lucide-react";
import jvalaLogo from "@/assets/jvala-logo.png";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

interface TermsAcceptanceGateProps {
  onAccept: () => void;
}

export const TermsAcceptanceGate = ({ onAccept }: TermsAcceptanceGateProps) => {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom && !scrolledToBottom) {
      setScrolledToBottom(true);
    }
  }, [scrolledToBottom]);

  return (
    <div
      className="fixed inset-0 flex flex-col max-w-[430px] mx-auto"
      style={{ background: '#000' }}
    >
      {/* Shader gradient background */}
      <div className="fixed inset-0 pointer-events-none max-w-[430px] mx-auto" style={{ zIndex: 0 }}>
        <ShaderGradientCanvas
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <ShaderGradient
            type="waterPlane"
            animate="on"
            uTime={0.2}
            uSpeed={0.3}
            uStrength={1.5}
            uDensity={1.3}
            uFrequency={5.5}
            uAmplitude={2.5}
            positionX={-0.1}
            positionY={0.2}
            positionZ={0}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            color1="#ff7a33"
            color2="#ffb366"
            color3="#ff5c5c"
            reflection={0.1}
            wireframe={false}
            shader="defaults"
            cAzimuthAngle={180}
            cPolarAngle={115}
            cDistance={3.5}
            cameraZoom={1}
            grain="on"
          />
        </ShaderGradientCanvas>
      </div>

      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{
              background: "hsl(0 0% 100% / 0.2)",
              backdropFilter: "blur(16px)",
              border: "1px solid hsl(0 0% 100% / 0.3)",
              boxShadow: "0 4px 20px hsl(0 0% 0% / 0.1)",
            }}
          >
            <img src={jvalaLogo} alt="Jvala" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h1
              className="text-[22px]"
              style={{
                fontFamily: "'Satoshi', sans-serif",
                fontWeight: 800,
                color: "#fff",
                textShadow: "0 2px 16px hsl(0 0% 0% / 0.3)",
              }}
            >
              Terms & Privacy
            </h1>
            <p
              className="text-[13px]"
              style={{
                fontFamily: "'Satoshi', sans-serif",
                fontWeight: 600,
                color: "#fff",
                textShadow: "0 1px 8px hsl(0 0% 0% / 0.25)",
              }}
            >
              Please read and scroll to the bottom to continue
            </p>
          </div>
        </div>

        {/* Scrollable terms content - frosted glass card */}
        <div
          className="flex-1 mx-5 mb-3 rounded-2xl overflow-hidden"
          style={{
            background: "hsl(0 0% 100% / 0.15)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid hsl(0 0% 100% / 0.25)",
            boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.3), 0 8px 32px hsl(0 0% 0% / 0.12)",
          }}
        >
          <div
            ref={viewportRef}
            className="h-full overflow-y-auto px-5 py-5 space-y-6"
            onScroll={handleScroll}
          >
            {/* Terms of Service */}
            <div>
              <h2
                className="text-base mb-1"
                style={{
                  fontFamily: "'Satoshi', sans-serif",
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 4px hsl(0 0% 0% / 0.15)",
                }}
              >
                Terms of Service
              </h2>
              <p className="text-[10px] mb-3" style={{ color: "hsl(0 0% 100% / 0.6)" }}>
                Last Updated: February 13, 2026
              </p>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "hsl(0 0% 100% / 0.85)" }}>
              These Terms of Service ("Terms") govern your use of the Jvala mobile application and related services (the "Service") operated by Jvala ("we", "our", or "us"). By accessing or using the Service, you agree to be bound by these Terms.
            </p>

            <Section title="1. Eligibility">
              You must be at least 13 years of age to use the Service. By using the Service, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms.
            </Section>

            <Section title="2. Medical Disclaimer" highlight>
              <strong>Jvala is not a medical device, diagnostic tool, or treatment platform.</strong> The Service provides health tracking, data correlation, and AI-generated insights for informational purposes only. Nothing in the Service constitutes medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare professional with any questions regarding a medical condition.
            </Section>

            <Section title="3. Your Account">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate and complete information when creating your account. You are responsible for all activities that occur under your account. You may delete your account at any time through Settings → Delete Account, which permanently removes all your data.
            </Section>

            <Section title="4. Acceptable Use">
              You agree not to use the Service for any unlawful purpose, attempt to gain unauthorized access to any part of the Service, interfere with or disrupt the Service, upload malicious content, impersonate another person, or use the Service to provide medical advice to others.
            </Section>

            <Section title="5. AI-Generated Content">
              The Service uses artificial intelligence to generate health insights, correlations, voice transcriptions, and export narratives. AI-generated content may be inaccurate, incomplete, or misleading. You acknowledge that AI outputs are provided "as-is" and should not be relied upon as a substitute for professional medical judgment.
            </Section>

            <Section title="6. Intellectual Property">
              The Service, including its design, features, and content (excluding your personal data), is owned by Jvala and protected by intellectual property laws. You retain ownership of the health data you input into the Service.
            </Section>

            <Section title="7. Third-Party Integrations">
              The Service integrates with Apple HealthKit, Google Fit, and other third-party services. Your use of these integrations is subject to the respective third-party terms and privacy policies.
            </Section>

            <Section title="8. Limitation of Liability">
              To the fullest extent permitted by law, Jvala shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data or health complications arising from reliance on AI-generated content.
            </Section>

            <Section title="9. Disclaimer of Warranties">
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied.
            </Section>

            <Section title="10. Termination">
              We may suspend or terminate your access at any time for violation of these Terms. You may terminate your account at any time using the Delete Account feature in Settings.
            </Section>

            {/* Divider */}
            <div className="py-3">
              <div style={{ borderTop: "1px solid hsl(0 0% 100% / 0.15)" }} />
            </div>

            {/* Privacy Policy */}
            <div>
              <h2
                className="text-base mb-1"
                style={{
                  fontFamily: "'Satoshi', sans-serif",
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 4px hsl(0 0% 0% / 0.15)",
                }}
              >
                Privacy Policy
              </h2>
              <p className="text-[10px] mb-3" style={{ color: "hsl(0 0% 100% / 0.6)" }}>
                Last Updated: February 13, 2026
              </p>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "hsl(0 0% 100% / 0.85)" }}>
              Jvala ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
            </p>

            <Section title="1. Information We Collect">
              We collect: account information (email), health data you enter (symptoms, triggers, medications, notes, photos, voice recordings), city-level location for environmental correlation, optional wearable device data from Apple HealthKit and Google Fit (heart rate, sleep, steps, active energy), and basic device information.
            </Section>

            <Section title="2. Apple HealthKit Disclosure" highlight>
              HealthKit data is used solely to correlate physiological metrics with your flare entries. HealthKit data is never sold, shared with advertisers, used for marketing, disclosed to third parties, or used for data mining or ML training on aggregated datasets. You can revoke HealthKit access at any time in iOS Settings → Privacy → Health.
            </Section>

            <Section title="3. How We Use Your Data">
              Your data is used exclusively for personalized health tracking, AI-powered insights, clinical report generation, engagement features (streaks, badges), optional push notification reminders, and account management. We never sell, rent, or trade your personal health data.
            </Section>

            <Section title="4. AI Processing">
              We use Google Gemini AI to generate insights, voice transcriptions, and content. Your data is processed through secure backend functions and is not used to train AI models. AI-generated content is not medical advice and may contain inaccuracies.
            </Section>

            <Section title="5. Data Sharing">
              We do not sell your personal data. We share data only: with your healthcare providers when you explicitly generate and share a report, with our infrastructure providers (for hosting and AI processing under strict contractual obligations), or when required by law.
            </Section>

            <Section title="6. Data Security">
              All data is encrypted in transit (TLS 1.2+) and at rest (AES-256). Row-Level Security policies ensure only you can access your own data. Backend functions authenticate via JWT tokens. Optional biometric lock adds additional protection.
            </Section>

            <Section title="7. Data Retention & Deletion">
              Your data is retained while your account is active. You may delete your account at any time from Settings → Delete Account. Upon deletion, all your personal data is permanently and irreversibly removed within 30 days.
            </Section>

            <Section title="8. Your Rights">
              You may access and export your data, correct inaccurate information, delete your account and all associated data, withdraw consent for optional data collection, and lodge a complaint with your local data protection authority.
            </Section>

            <Section title="9. Children's Privacy">
              Jvala is not intended for children under 13. We do not knowingly collect personal information from children under 13.
            </Section>

            <Section title="10. Contact">
              For questions, contact us at support@jvala.tech or visit https://jvala.tech.
            </Section>

            <p className="text-[10px] text-center pt-4 pb-2" style={{ color: "hsl(0 0% 100% / 0.5)" }}>
              © {new Date().getFullYear()} Jvala. All rights reserved.
            </p>
          </div>
        </div>

        {/* Accept button */}
        <div className="px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {!scrolledToBottom && (
            <p
              className="text-[10px] text-center mb-2 animate-pulse"
              style={{ color: "hsl(0 0% 100% / 0.7)", fontFamily: "'Satoshi', sans-serif" }}
            >
              ↓ Scroll to the bottom to accept
            </p>
          )}
          <button
            onClick={onAccept}
            disabled={!scrolledToBottom}
            className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-40 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: scrolledToBottom
                ? "linear-gradient(135deg, hsl(0 0% 100% / 0.3) 0%, hsl(0 0% 100% / 0.15) 100%)"
                : "hsl(0 0% 100% / 0.1)",
              boxShadow: scrolledToBottom
                ? "inset 0 1px 0 hsl(0 0% 100% / 0.3), 0 4px 16px hsl(0 0% 0% / 0.15)"
                : "none",
              backdropFilter: "blur(12px)",
              border: "1px solid hsl(0 0% 100% / 0.2)",
              fontFamily: "'Satoshi', sans-serif",
              fontWeight: 700,
            }}
          >
            <Shield className="w-4 h-4" />
            I Accept the Terms & Privacy Policy
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) => (
  <div className="space-y-1.5">
    <h3
      className="text-[11px] uppercase tracking-wide"
      style={{
        fontFamily: "'Satoshi', sans-serif",
        fontWeight: 700,
        color: "hsl(0 0% 100% / 0.9)",
      }}
    >
      {title}
    </h3>
    <p
      className={`text-xs leading-relaxed rounded-lg ${highlight ? "p-3" : ""}`}
      style={{
        color: "hsl(0 0% 100% / 0.8)",
        ...(highlight
          ? {
              background: "hsl(0 0% 100% / 0.08)",
              border: "1px solid hsl(0 0% 100% / 0.12)",
            }
          : {}),
      }}
    >
      {children}
    </p>
  </div>
);
