/**
 * VoicePicker — lets the user pick between the 3 companion voices.
 * Selection is stored both in localStorage (instant) and on the user profile
 * (`metadata.voice_preference`) so it follows them across devices.
 */
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import {
  VOICE_OPTIONS,
  getStoredVoiceId,
  setStoredVoiceId,
  type VoiceId,
} from '@/lib/voiceOptions';
import { supabase } from '@/integrations/supabase/client';

interface VoicePickerProps {
  onChange?: (id: VoiceId) => void;
}

export const VoicePicker = ({ onChange }: VoicePickerProps) => {
  const [selected, setSelected] = useState<VoiceId>(getStoredVoiceId());
  const [saving, setSaving] = useState(false);

  // Hydrate from profile metadata (server is source of truth).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .maybeSingle();
      const remote = (profile?.metadata as any)?.voice_preference;
      if (remote === 'sarah' || remote === 'charlotte' || remote === 'liam') {
        if (!cancelled) {
          setSelected(remote);
          setStoredVoiceId(remote);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pick = async (id: VoiceId) => {
    if (id === selected) return;
    setSelected(id);
    setStoredVoiceId(id);
    onChange?.(id);
    haptics.light();

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Merge into existing metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .maybeSingle();
      const existing = (profile?.metadata as Record<string, any>) || {};
      await supabase
        .from('profiles')
        .update({ metadata: { ...existing, voice_preference: id } })
        .eq('id', user.id);
    } catch (err) {
      console.warn('[VoicePicker] failed to persist preference', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Companion voice
        </p>
        {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {VOICE_OPTIONS.map((v) => {
          const isActive = v.id === selected;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => pick(v.id)}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left transition-all',
                'border backdrop-blur-xl active:scale-[0.99]',
                isActive
                  ? 'bg-primary/10 border-primary/40 ring-2 ring-primary/30'
                  : 'bg-card/70 border-border/40 hover:border-border/70'
              )}
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{v.name}</span>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium',
                    isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {v.tag}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.description}</p>
              </div>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
              )}>
                {isActive && <Check className="w-3.5 h-3.5" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
