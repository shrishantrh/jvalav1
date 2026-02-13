import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = 'February 13, 2026';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Privacy Policy</h1>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        <section>
          <p className="text-sm text-muted-foreground mb-2">Last Updated: {lastUpdated}</p>
          <p className="text-foreground leading-relaxed">
            Jvala ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "Service").
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">1.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
              <li><strong>Account Information:</strong> Email address, name, and authentication credentials when you create an account.</li>
              <li><strong>Health Condition Data:</strong> Your selected health condition(s) provided during onboarding.</li>
              <li><strong>Flare Log Entries:</strong> Severity ratings, symptoms, triggers, medications, notes, timestamps, and energy levels you record.</li>
              <li><strong>Photos &amp; Voice Notes:</strong> Images and audio recordings you choose to attach to log entries. Voice notes are transcribed using AI and the audio is stored securely.</li>
              <li><strong>Medication Information:</strong> Medications, dosages, and frequencies you track.</li>
              <li><strong>Profile Information:</strong> Optional details such as date of birth, biological sex, height, weight, blood type, emergency contacts, and physician information.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">1.2 Apple HealthKit &amp; Google Fit Data</h3>
            <p className="text-foreground/80 text-sm leading-relaxed">
              With your explicit permission, Jvala reads the following data from Apple HealthKit and/or Google Fit:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
              <li>Heart rate and resting heart rate</li>
              <li>Step count</li>
              <li>Sleep analysis (duration and quality)</li>
              <li>Active energy burned</li>
            </ul>
            <div className="bg-accent/50 rounded-lg p-4 border border-accent">
              <p className="text-sm text-foreground font-medium">Apple HealthKit Disclosure (Rule 5.1.3)</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-foreground/80 text-sm">
                <li>HealthKit data is used <strong>solely</strong> to correlate physiological metrics with your flare entries for personal health insights.</li>
                <li>HealthKit data is <strong>never</strong> sold, shared with advertisers, or used for marketing purposes.</li>
                <li>HealthKit data is <strong>never</strong> disclosed to third parties without your explicit consent.</li>
                <li>HealthKit data is <strong>not</strong> used for data mining, machine learning training on aggregated datasets, or any purpose unrelated to providing health insights directly to you.</li>
                <li>You can revoke HealthKit access at any time in iOS Settings &gt; Privacy &gt; Health.</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">1.3 Location Data</h3>
            <p className="text-foreground/80 text-sm leading-relaxed">
              With your permission, we collect <strong>coarse (city-level) location data</strong> to correlate environmental factors (weather, air quality, UV index, pollen) with your flare entries. We do not collect precise GPS coordinates for tracking purposes. Location data is stored only as city name alongside your log entries.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">1.4 Environmental &amp; Weather Data</h3>
            <p className="text-foreground/80 text-sm leading-relaxed">
              Based on your city-level location, we retrieve weather conditions, temperature, humidity, air quality index (AQI), UV index, and pollen levels from third-party weather APIs. This data is stored alongside your flare entries for correlation analysis.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">1.5 Automatically Collected Data</h3>
            <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
              <li>Device type and operating system version</li>
              <li>App usage timestamps</li>
              <li>Crash reports and performance metrics</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li><strong>Health Tracking:</strong> To record, display, and analyze your flare entries and health data.</li>
            <li><strong>AI-Powered Insights:</strong> To generate personalized health insights, correlations, and pattern analysis using Google Gemini AI. Your data is processed through secure backend functions and is not used to train AI models.</li>
            <li><strong>Medical Exports:</strong> To generate clinical-grade PDF reports, FHIR R4 JSON, and other structured formats you can share with your healthcare providers.</li>
            <li><strong>Engagement Features:</strong> To track logging streaks, award milestone badges, and send optional reminders.</li>
            <li><strong>Push Notifications:</strong> To send logging reminders you have opted into.</li>
            <li><strong>Account Management:</strong> To authenticate you, manage your profile, and provide customer support.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. AI-Generated Content Disclaimer</h2>
          <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
            <p className="text-sm text-foreground leading-relaxed">
              Jvala uses artificial intelligence (Google Gemini) to generate health insights, pattern analysis, voice transcription, and export narratives. <strong>AI-generated content is not medical advice</strong> and may contain inaccuracies. Always consult a qualified healthcare professional before making medical decisions. Jvala is a tracking and correlation tool, not a diagnostic or treatment platform.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Data Sharing &amp; Disclosure</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">We do <strong>not</strong> sell your personal data. We may share data only in these limited circumstances:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li><strong>With Your Healthcare Providers:</strong> Only when you explicitly generate and share a report or enable profile sharing via a secure link.</li>
            <li><strong>Service Providers:</strong> We use Supabase for secure data storage and authentication, and Google Cloud for AI processing. These providers process data on our behalf under strict contractual obligations.</li>
            <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental regulation.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Data Security</h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li>All data is encrypted in transit (TLS 1.2+) and at rest (AES-256).</li>
            <li>Authentication tokens are stored securely using platform-native secure storage.</li>
            <li>Row-Level Security (RLS) policies ensure users can only access their own data.</li>
            <li>Backend functions authenticate via JWT tokens before processing any request.</li>
            <li>Optional biometric lock adds an additional layer of protection.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Data Retention &amp; Deletion</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            Your data is retained for as long as your account is active. You may <strong>delete your account at any time</strong> from Settings &gt; Delete Account. Upon deletion, all your personal data — including profile information, flare entries, medication logs, engagement data, wearable tokens, exports, and stored files — is permanently and irreversibly removed from our systems within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li>Access and export your personal data (available via in-app export features)</li>
            <li>Correct inaccurate information (editable in your profile and log history)</li>
            <li>Delete your account and all associated data</li>
            <li>Withdraw consent for optional data collection (HealthKit, location, notifications)</li>
            <li>Lodge a complaint with your local data protection authority</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Children's Privacy</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            Jvala is not intended for use by children under 13 years of age. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided us with personal information, we will delete it immediately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Third-Party Services</h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li><strong>Supabase:</strong> Database hosting, authentication, file storage, and serverless functions.</li>
            <li><strong>Google Gemini AI:</strong> AI-powered insights, voice transcription, and content generation.</li>
            <li><strong>Weather APIs:</strong> Environmental data retrieval based on city-level location.</li>
            <li><strong>Apple HealthKit / Google Fit:</strong> Physiological data reading with user consent.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material changes via in-app notification or email. Your continued use of the Service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            If you have questions about this Privacy Policy or your data, contact us at:
          </p>
          <p className="text-foreground text-sm font-medium">
            Email: privacy@jvala.tech<br />
            Website: https://jvala.tech
          </p>
        </section>

        <footer className="pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Jvala. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
