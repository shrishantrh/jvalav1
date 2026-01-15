import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// EHR/EMR Integration Options Research & Setup
// Major providers: Epic, Cerner, b.well, HealthEx, 1Up Health, Particle Health

interface EHRProvider {
  id: string;
  name: string;
  type: 'fhir' | 'proprietary';
  available: boolean;
  setupRequired: boolean;
  dataTypes: string[];
  notes: string;
}

const EHR_PROVIDERS: EHRProvider[] = [
  {
    id: 'epic',
    name: 'Epic MyChart',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'encounters', 'immunizations'],
    notes: 'Requires Epic App Orchard registration. Free for patient access apps. SMART on FHIR OAuth.'
  },
  {
    id: 'cerner',
    name: 'Oracle Cerner',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'encounters'],
    notes: 'Requires Cerner Code Console registration. SMART on FHIR OAuth.'
  },
  {
    id: 'bwell',
    name: 'b.well Connected Health',
    type: 'proprietary',
    available: true,
    setupRequired: true,
    dataTypes: ['unified_health_record', 'claims', 'clinical', 'devices', 'user_reported'],
    notes: 'Unified API for 300+ health plans. CMS-aligned network. Requires partnership agreement.'
  },
  {
    id: 'healthex',
    name: 'HealthEx',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['patient_records', 'consent_management', 'data_sharing'],
    notes: 'TEFCA QHIN certified. Patient-driven consent management. SOC2, HITRUST certified.'
  },
  {
    id: '1uphealth',
    name: '1Up Health',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['conditions', 'medications', 'labs', 'claims', 'vitals'],
    notes: 'FHIR aggregator. Connect to 300+ EHRs. Free tier available for developers.'
  },
  {
    id: 'particle',
    name: 'Particle Health',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['medical_records', 'labs', 'encounters', 'medications'],
    notes: 'Carequality network. Real-time patient data. Enterprise pricing.'
  },
  {
    id: 'flexpa',
    name: 'Flexpa',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['claims', 'coverage', 'medications', 'conditions'],
    notes: 'Claims data aggregator. Connect to 200+ payers. Usage-based pricing.'
  },
  {
    id: 'apple_health_records',
    name: 'Apple Health Records',
    type: 'fhir',
    available: true,
    setupRequired: false,
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'immunizations'],
    notes: 'Free. User-initiated. 700+ hospitals. Data syncs to HealthKit.'
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, userId, provider } = await req.json();

    switch (action) {
      case 'list_providers':
        // Return available EHR integration options
        return new Response(JSON.stringify({
          providers: EHR_PROVIDERS,
          recommendations: [
            {
              priority: 1,
              provider: 'apple_health_records',
              reason: 'No setup required. User-controlled. Works immediately if patient has connected hospitals in Apple Health.'
            },
            {
              priority: 2,
              provider: '1uphealth',
              reason: 'Easiest developer integration. Free tier. FHIR aggregator for 300+ EHRs.'
            },
            {
              priority: 3,
              provider: 'epic',
              reason: 'Largest EHR market share (35%+). Direct patient access. Free for patient apps.'
            }
          ],
          setup_steps: {
            epic: [
              '1. Register at open.epic.com',
              '2. Create a non-production app for testing',
              '3. Request App Orchard listing when ready for production',
              '4. Implement SMART on FHIR OAuth flow',
              '5. Epic reviews and approves app (2-4 weeks)'
            ],
            '1uphealth': [
              '1. Sign up at 1up.health/developers',
              '2. Get API credentials (sandbox immediately available)',
              '3. Implement OAuth patient connection flow',
              '4. Switch to production keys when ready'
            ],
            bwell: [
              '1. Request demo at icanbwell.com',
              '2. Complete CMS Network application',
              '3. Sign partnership agreement',
              '4. Technical integration (4-8 weeks typical)',
              '5. Go live with CMS-aligned data sharing'
            ],
            healthex: [
              '1. Request access at healthex.io',
              '2. Complete HIPAA compliance verification',
              '3. Implement consent management flow',
              '4. Connect to TEFCA network'
            ]
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'check_apple_health':
        // Check if user has Apple Health Records data available
        // This would be called from the mobile app
        return new Response(JSON.stringify({
          available: true,
          instructions: [
            'Open the Health app on your iPhone',
            'Tap your profile picture',
            'Tap "Health Records"',
            'Tap "Get Started" or "Add Account"',
            'Search for your healthcare provider',
            'Sign in with your patient portal credentials'
          ],
          supported_data: ['Allergies', 'Conditions', 'Immunizations', 'Labs', 'Medications', 'Procedures', 'Vitals']
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'initiate_connection':
        // Start OAuth flow for a specific EHR provider
        const providerInfo = EHR_PROVIDERS.find(p => p.id === provider);
        if (!providerInfo) {
          throw new Error('Unknown EHR provider');
        }

        // For now, return setup instructions
        // In production, this would redirect to OAuth
        return new Response(JSON.stringify({
          provider: providerInfo,
          status: 'setup_required',
          message: `${providerInfo.name} integration requires additional setup. See notes for details.`,
          next_steps: providerInfo.notes
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'get_fhir_data':
        // Fetch FHIR data from connected provider
        // This is a placeholder - actual implementation depends on the provider
        return new Response(JSON.stringify({
          status: 'not_connected',
          message: 'No EHR provider connected. Connect a provider first.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error('Unknown action');
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('EHR connect error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
