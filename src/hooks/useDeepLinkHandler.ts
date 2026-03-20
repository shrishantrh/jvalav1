/**
 * Deep Link Handler
 * 
 * Listens for Capacitor appUrlOpen events and parses parameterized URLs
 * to trigger actions like quick-logging, voice recording, etc.
 * 
 * Supported URLs:
 * - jvala://quick-log?severity=mild&symptoms=headache,nausea
 * - jvala://quick-log?severity=moderate&note=my head hurts and I feel dizzy
 *   (note is AI-processed to extract symptoms/triggers/severity)
 * - jvala://voice-log  (opens voice recorder)
 * - jvala://insights   (switches to insights tab)
 * - jvala://log         (opens track view)
 */

import { useEffect, useCallback, useRef } from 'react';
import { isNative } from '@/lib/capacitor';
import { useToast } from '@/hooks/use-toast';
import { haptics } from '@/lib/haptics';
import { FlareEntry } from '@/types/flare';
import { supabase } from '@/integrations/supabase/client';

export interface DeepLinkAction {
  type: 'quick-log' | 'voice-log' | 'open-view' | 'none';
  severity?: string;
  symptoms?: string[];
  triggers?: string[];
  note?: string;
  view?: string;
}

interface UseDeepLinkHandlerOptions {
  onQuickLog?: (entry: Partial<FlareEntry>) => Promise<boolean>;
  onOpenVoice?: () => void;
  onSwitchView?: (view: string) => void;
}

export const useDeepLinkHandler = ({ onQuickLog, onOpenVoice, onSwitchView }: UseDeepLinkHandlerOptions) => {
  const { toast } = useToast();
  const pendingActionRef = useRef<DeepLinkAction | null>(null);

  const parseDeepLink = useCallback((url: string): DeepLinkAction => {
    try {
      // Handle both jvala:// and https://app.jvala.tech/
      let path = '';
      let params = new URLSearchParams();

      if (url.startsWith('jvala://')) {
        const withoutScheme = url.replace('jvala://', '');
        const [pathPart, queryPart] = withoutScheme.split('?');
        path = pathPart.replace(/^\/+/, '');
        if (queryPart) params = new URLSearchParams(queryPart);
      } else {
        const parsed = new URL(url);
        path = parsed.pathname.replace(/^\/+/, '');
        params = parsed.searchParams;
      }

      switch (path) {
        case 'quick-log':
        case 'quicklog':
        case 'log-flare': {
          const severity = params.get('severity') || 'moderate';
          const symptoms = params.get('symptoms')?.split(',').filter(Boolean) || [];
          const triggers = params.get('triggers')?.split(',').filter(Boolean) || [];
          const note = params.get('note') || params.get('text') || undefined;
          return { type: 'quick-log', severity, symptoms, triggers, note };
        }
        case 'voice-log':
        case 'voicelog':
        case 'voice':
          return { type: 'voice-log' };
        case 'insights':
        case 'history':
        case 'exports':
        case 'track':
          return { type: 'open-view', view: path };
        default:
          return { type: 'none' };
      }
    } catch (e) {
      console.error('[DeepLink] Failed to parse URL:', url, e);
      return { type: 'none' };
    }
  }, []);

  const handleAction = useCallback(async (action: DeepLinkAction) => {
    console.log('[DeepLink] Handling action:', action);

    switch (action.type) {
      case 'quick-log': {
        if (onQuickLog) {
          let symptoms = action.symptoms?.length ? action.symptoms : undefined;
          let triggers = action.triggers?.length ? action.triggers : undefined;
          let severity = action.severity as any;
          let note = action.note;

          // If there's a freeform note (from "Say Anything" Siri shortcut),
          // run it through AI to extract structured data
          if (note && note.length > 3 && !symptoms?.length) {
            try {
              console.log('[DeepLink] AI-processing note:', note);
              const { data } = await supabase.functions.invoke('transcribe-voice', {
                body: { transcript: note },
              });
              if (data?.extracted) {
                symptoms = data.extracted.symptoms?.length ? data.extracted.symptoms : symptoms;
                triggers = data.extracted.triggers?.length ? data.extracted.triggers : triggers;
                if (data.extracted.severity) severity = data.extracted.severity;
                note = data.extracted.notes || note;
              }
            } catch (e) {
              console.log('[DeepLink] AI extraction failed, using raw note:', e);
            }
          }

          const entry: Partial<FlareEntry> = {
            type: 'flare',
            severity,
            symptoms,
            triggers,
            note,
            timestamp: new Date(),
          };
          const saved = await onQuickLog(entry);
          if (saved) {
            haptics.success();
            toast({
              title: '✓ Logged via Shortcut',
              description: `${severity} flare${symptoms?.length ? ` — ${symptoms.join(', ')}` : ''}`,
            });
          }
        }
        break;
      }
      case 'voice-log': {
        if (onOpenVoice) {
          onOpenVoice();
          haptics.light();
        }
        break;
      }
      case 'open-view': {
        if (onSwitchView && action.view) {
          onSwitchView(action.view);
          haptics.light();
        }
        break;
      }
    }
  }, [onQuickLog, onOpenVoice, onSwitchView, toast]);

  // Listen for Capacitor URL open events
  useEffect(() => {
    if (!isNative) return;

    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appUrlOpen', (event) => {
          console.log('[DeepLink] URL opened:', event.url);
          
          // Skip auth-related deep links
          if (event.url.includes('auth') || event.url.includes('confirm-email') || event.url.includes('reset-password')) {
            return;
          }

          const action = parseDeepLink(event.url);
          if (action.type !== 'none') {
            // If callbacks aren't ready yet, store as pending
            if (!onQuickLog && action.type === 'quick-log') {
              pendingActionRef.current = action;
            } else {
              handleAction(action);
            }
          }
        });
        cleanup = () => listener.remove();
      } catch (e) {
        console.log('[DeepLink] Could not set up listener:', e);
      }
    };

    setup();
    return () => cleanup?.();
  }, [isNative, parseDeepLink, handleAction, onQuickLog]);

  // Process pending action when callbacks become available
  useEffect(() => {
    if (pendingActionRef.current && onQuickLog) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      handleAction(action);
    }
  }, [onQuickLog, handleAction]);

  return { parseDeepLink, handleAction };
};
