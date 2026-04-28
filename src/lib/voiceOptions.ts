/**
 * The three companion voices the user can pick between.
 * Each maps to a distinct ElevenLabs ConvAI agent (configured in the dashboard).
 *
 * Agent IDs are read from Vite env vars at build time. If a specific agent ID
 * is missing we fall back to the default agent so the picker never breaks.
 */

export type VoiceId = 'sarah' | 'charlotte' | 'liam';

export interface VoiceOption {
  id: VoiceId;
  name: string;
  description: string;
  /** Short tag shown on the picker chip. */
  tag: string;
  /** ElevenLabs agent ID for this voice. */
  agentId: string;
}

const DEFAULT_AGENT = import.meta.env.VITE_ELEVENLABS_AGENT_ID || '';

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'sarah',
    name: 'Sarah',
    description: 'Warm, calm — easy to listen to.',
    tag: 'Calm',
    agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID_SARAH || DEFAULT_AGENT,
  },
  {
    id: 'charlotte',
    name: 'Charlotte',
    description: 'Clinical, focused — like a thoughtful doctor.',
    tag: 'Clinical',
    agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID_CHARLOTTE || DEFAULT_AGENT,
  },
  {
    id: 'liam',
    name: 'Liam',
    description: 'Friendly, grounded — a steady male voice.',
    tag: 'Friendly',
    agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID_LIAM || DEFAULT_AGENT,
  },
];

export const DEFAULT_VOICE_ID: VoiceId = 'sarah';

const STORAGE_KEY = 'jvala_voice_preference';

export function getStoredVoiceId(): VoiceId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'sarah' || v === 'charlotte' || v === 'liam') return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_VOICE_ID;
}

export function setStoredVoiceId(id: VoiceId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getVoiceOption(id: VoiceId): VoiceOption {
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}

export function getAgentIdForVoice(id: VoiceId): string {
  return getVoiceOption(id).agentId;
}
