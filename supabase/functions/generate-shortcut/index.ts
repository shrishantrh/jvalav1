import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generates Apple Shortcut configuration data.
 * Since .shortcut files must be signed by Apple's CLI tool,
 * this returns the shortcut metadata as JSON for the client
 * to build the shortcuts:// URL import flow.
 * 
 * For actual signed shortcuts, we serve pre-signed iCloud links.
 */

interface ShortcutConfig {
  id: string;
  name: string;
  description: string;
  urlScheme: string;
  siriPhrase: string;
  icon: string;
  color: string;
  // iCloud link if manually created & shared
  icloudLink?: string;
}

const SHORTCUTS: Record<string, ShortcutConfig> = {
  'quick-moderate': {
    id: 'quick-moderate',
    name: 'Log a Flare',
    description: 'Instantly logs a moderate flare with one tap.',
    urlScheme: 'jvala://quick-log?severity=moderate',
    siriPhrase: 'Log a flare',
    icon: '⚡',
    color: '#D6006C',
  },
  'quick-mild': {
    id: 'quick-mild',
    name: 'Log Mild Flare',
    description: 'Quick-log a mild flare.',
    urlScheme: 'jvala://quick-log?severity=mild',
    siriPhrase: 'Mild flare',
    icon: '🟢',
    color: '#22C55E',
  },
  'quick-severe': {
    id: 'quick-severe',
    name: 'Log Severe Flare',
    description: 'Quick-log a severe flare.',
    urlScheme: 'jvala://quick-log?severity=severe',
    siriPhrase: 'Bad flare',
    icon: '🔴',
    color: '#EF4444',
  },
  'headache': {
    id: 'headache',
    name: 'Log a Headache',
    description: 'Logs a moderate flare with headache pre-filled.',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=headache',
    siriPhrase: 'I have a headache',
    icon: '🧠',
    color: '#892EFF',
  },
  'voice-log': {
    id: 'voice-log',
    name: 'Voice Log',
    description: 'Open Jvala voice recorder to dictate your symptoms.',
    urlScheme: 'jvala://voice-log',
    siriPhrase: 'Jvala voice log',
    icon: '🎙️',
    color: '#EC4899',
  },
  'ask-severity': {
    id: 'ask-severity',
    name: 'Rate My Flare',
    description: 'Choose severity (Mild/Moderate/Severe) then log.',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: 'Rate my flare',
    icon: '📊',
    color: '#F59E0B',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shortcutId = url.searchParams.get('id');

    if (shortcutId) {
      const config = SHORTCUTS[shortcutId];
      if (!config) {
        return new Response(JSON.stringify({ error: 'Shortcut not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(config), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return all shortcuts
    return new Response(JSON.stringify({ shortcuts: Object.values(SHORTCUTS) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
