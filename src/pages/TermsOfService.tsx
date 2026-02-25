import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
  const navigate = useNavigate();
  const lastUpdated = 'February 13, 2026';

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto z-[9999]" style={{ position: 'fixed', overflow: 'auto' }}>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Terms of Service</h1>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        <section>
          <p className="text-sm text-muted-foreground mb-2">Last Updated: {lastUpdated}</p>
          <p className="text-foreground leading-relaxed">
            These Terms of Service ("Terms") govern your use of the Jvala mobile application and related services (the "Service") operated by Jvala ("we", "our", or "us"). By accessing or using the Service, you agree to be bound by these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Eligibility</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            You must be at least 13 years of age to use the Service. By using the Service, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. Medical Disclaimer</h2>
          <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
            <p className="text-sm text-foreground leading-relaxed">
              <strong>Jvala is not a medical device, diagnostic tool, or treatment platform.</strong> The Service provides health tracking, data correlation, and AI-generated insights for informational purposes only. Nothing in the Service constitutes medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare professional with any questions regarding a medical condition. Never disregard professional medical advice or delay seeking it because of information provided by the Service.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Your Account</h2>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You agree to provide accurate and complete information when creating your account.</li>
            <li>You are responsible for all activities that occur under your account.</li>
            <li>You may delete your account at any time through Settings &gt; Delete Account, which permanently removes all your data.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80 text-sm leading-relaxed">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Upload malicious content, viruses, or harmful code</li>
            <li>Impersonate another person or entity</li>
            <li>Use the Service to provide medical advice to others</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Intellectual Property</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            The Service, including its design, features, and content (excluding your personal data), is owned by Jvala and protected by intellectual property laws. You retain ownership of the health data you input into the Service. You grant us a limited license to process your data solely for the purpose of providing the Service to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. AI-Generated Content</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            The Service uses artificial intelligence to generate health insights, correlations, voice transcriptions, and export narratives. AI-generated content may be inaccurate, incomplete, or misleading. You acknowledge that AI outputs are provided "as-is" and should not be relied upon as a substitute for professional medical judgment.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Third-Party Integrations</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            The Service integrates with Apple HealthKit, Google Fit, and other third-party services. Your use of these integrations is subject to the respective third-party terms and privacy policies. We are not responsible for the availability, accuracy, or conduct of third-party services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            To the fullest extent permitted by law, Jvala shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, health complications, or damages arising from reliance on AI-generated content. Our total liability shall not exceed the amount you paid for the Service in the twelve months preceding the claim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Disclaimer of Warranties</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Indemnification</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            You agree to indemnify and hold harmless Jvala, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">11. Termination</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            We may suspend or terminate your access to the Service at any time for violation of these Terms or for any other reason at our discretion. You may terminate your account at any time by using the Delete Account feature in Settings. Upon termination, your right to use the Service ceases immediately and your data will be permanently deleted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">12. Governing Law</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these Terms shall be resolved through binding arbitration or in the courts of competent jurisdiction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">13. Changes to These Terms</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            We reserve the right to modify these Terms at any time. We will notify you of material changes via in-app notification or email. Your continued use of the Service after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">14. Contact Us</h2>
          <p className="text-foreground/80 text-sm leading-relaxed">
            For questions about these Terms, contact us at:
          </p>
          <p className="text-foreground text-sm font-medium">
            Email: legal@jvala.tech<br />
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

export default TermsOfService;
