import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Zap,
  Mic,
  Brain,
  ChevronRight,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Clock,
  Plus,
  AlertCircle,
  Heart,
  Moon,
  Activity,
  Pill,
  MessageSquare,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import { isNative, platform } from "@/lib/capacitor";

interface ShortcutDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  urlScheme: string;
  siriPhrase: string;
  howItWorks: string;
  category: 'essential' | 'siri-voice' | 'smart' | 'automations';
}

/**
 * COMPREHENSIVE SIRI SHORTCUTS
 * 
 * Key insight: The "Say Anything" shortcut uses Siri's "Dictate Text" action
 * to capture ANY spoken input, then passes it to Jvala's AI which extracts
 * severity, symptoms, triggers, etc. This means the user can say literally
 * anything and the AI figures out what to log.
 * 
 * How the shortcuts work:
 * 1. User says "Hey Siri, [shortcut name]"
 * 2. Siri runs the shortcut (which is an "Open URL" action)
 * 3. URL opens Jvala with jvala:// deep link
 * 4. useDeepLinkHandler parses the URL params
 * 5. onQuickLog or onOpenVoice callback fires
 * 6. Entry is created/voice recorder opens
 * 
 * For the "Say Anything" shortcut:
 * 1. Siri runs "Dictate Text" action first
 * 2. Captures whatever the user says
 * 3. Passes it as ?note= parameter to jvala://quick-log
 * 4. The AI edge function (transcribe-voice) parses the free text
 * 5. Extracts severity, symptoms, triggers automatically
 */

const shortcuts: ShortcutDefinition[] = [
  // ═══ ESSENTIAL ═══
  {
    id: 'say-anything',
    title: 'Say Anything to Jvala',
    subtitle: 'AI understands what you mean',
    description: 'The most powerful shortcut. Say literally anything — "my head hurts and I feel nauseous", "having a bad flare after eating gluten", "feeling great today" — and Jvala\'s AI extracts symptoms, severity, triggers automatically.',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'from-primary to-primary/70',
    urlScheme: 'jvala://quick-log?severity=moderate&note=',
    siriPhrase: '"Hey Siri, tell Jvala" → then speak freely',
    howItWorks: 'In Shortcuts app: (1) "Dictate Text" action → (2) "Open URL" action with jvala://quick-log?severity=moderate&note=[Dictated Text]. Drag the blue Dictated Text variable into the URL. Name it "Tell Jvala".',
    category: 'essential',
  },
  {
    id: 'quick-log',
    title: 'Quick Flare Log',
    subtitle: 'One-tap moderate flare',
    description: 'Instantly logs a moderate flare. The fastest way to record that something happened — no input needed.',
    icon: <Zap className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-400',
    urlScheme: 'jvala://quick-log?severity=moderate',
    siriPhrase: '"Hey Siri, log a flare"',
    howItWorks: 'In Shortcuts app: "Open URL" action → jvala://quick-log?severity=moderate. Name it "Log a Flare".',
    category: 'essential',
  },
  {
    id: 'ask-severity',
    title: 'Rate My Flare',
    subtitle: 'Choose Mild / Moderate / Severe',
    description: 'Siri asks "How bad is it?" and you pick a severity. Logs instantly with your choice.',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-purple-500 to-purple-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: '"Hey Siri, rate my flare"',
    howItWorks: 'In Shortcuts app: (1) "Choose from Menu" → prompt "How bad?", options: Mild, Moderate, Severe. (2) Under each option: "Open URL" → jvala://quick-log?severity=mild (or moderate, severe). Name it "Rate My Flare".',
    category: 'essential',
  },

  // ═══ SIRI VOICE SHORTCUTS ═══
  {
    id: 'headache',
    title: 'I Have a Headache',
    subtitle: 'One phrase, instant log',
    description: 'Says "I have a headache" to Siri and it logs a moderate flare with headache as a symptom.',
    icon: <Brain className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-400',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=headache',
    siriPhrase: '"Hey Siri, I have a headache"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=moderate&symptoms=headache. Name it "I have a headache".',
    category: 'siri-voice',
  },
  {
    id: 'nausea',
    title: 'Feeling Nauseous',
    subtitle: 'Log nausea instantly',
    description: 'Quick-logs nausea as a symptom with moderate severity.',
    icon: <Activity className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-400',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=nausea',
    siriPhrase: '"Hey Siri, I\'m feeling nauseous"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=moderate&symptoms=nausea. Name it "Feeling Nauseous".',
    category: 'siri-voice',
  },
  {
    id: 'fatigue',
    title: 'I\'m Exhausted',
    subtitle: 'Log fatigue + low energy',
    description: 'Logs fatigue with low energy level. Perfect for those crash moments.',
    icon: <Moon className="w-5 h-5" />,
    color: 'from-indigo-500 to-blue-400',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=fatigue',
    siriPhrase: '"Hey Siri, I\'m exhausted"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=moderate&symptoms=fatigue. Name it "I\'m Exhausted".',
    category: 'siri-voice',
  },
  {
    id: 'joint-pain',
    title: 'Joint Pain',
    subtitle: 'Log joint pain flare',
    description: 'Logs a flare with joint pain as the primary symptom.',
    icon: <Activity className="w-5 h-5" />,
    color: 'from-red-500 to-rose-400',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=joint+pain',
    siriPhrase: '"Hey Siri, my joints hurt"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=moderate&symptoms=joint+pain. Name it "My Joints Hurt".',
    category: 'siri-voice',
  },
  {
    id: 'took-medication',
    title: 'Took My Meds',
    subtitle: 'Log medication intake',
    description: 'Logs that you took your medication. Opens Jvala to the medication entry.',
    icon: <Pill className="w-5 h-5" />,
    color: 'from-blue-500 to-cyan-400',
    urlScheme: 'jvala://quick-log?severity=mild&note=took+medication',
    siriPhrase: '"Hey Siri, I took my meds"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=mild&note=took+medication. Name it "Took My Meds".',
    category: 'siri-voice',
  },
  {
    id: 'feeling-good',
    title: 'Feeling Good',
    subtitle: 'Log a positive check-in',
    description: 'Log that you\'re feeling well. Positive data is just as important for tracking patterns.',
    icon: <Heart className="w-5 h-5" />,
    color: 'from-emerald-500 to-green-400',
    urlScheme: 'jvala://quick-log?severity=mild&note=feeling+good+today',
    siriPhrase: '"Hey Siri, feeling good today"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=mild&note=feeling+good+today. Name it "Feeling Good Today".',
    category: 'siri-voice',
  },

  // ═══ SMART SHORTCUTS ═══
  {
    id: 'voice-log',
    title: 'Voice Log',
    subtitle: 'Open recorder in Jvala',
    description: 'Opens Jvala\'s built-in voice recorder. Speak naturally — AI extracts everything.',
    icon: <Mic className="w-5 h-5" />,
    color: 'from-pink-500 to-rose-400',
    urlScheme: 'jvala://voice-log',
    siriPhrase: '"Hey Siri, Jvala voice log"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://voice-log. Name it "Jvala Voice Log".',
    category: 'smart',
  },
  {
    id: 'follow-up',
    title: 'Follow Up on Flare',
    subtitle: 'Update how you\'re doing',
    description: 'Check in on your latest flare. Did it get better, worse, or stay the same?',
    icon: <Activity className="w-5 h-5" />,
    color: 'from-sky-500 to-blue-400',
    urlScheme: 'jvala://quick-log?severity=moderate&note=follow-up+on+previous+flare',
    siriPhrase: '"Hey Siri, follow up on my flare"',
    howItWorks: 'In Shortcuts app: "Open URL" → jvala://quick-log?severity=moderate&note=follow-up+on+previous+flare. Name it "Follow Up Flare".',
    category: 'smart',
  },

  // ═══ AUTOMATIONS ═══
  {
    id: 'morning-checkin',
    title: 'Morning Check-in',
    subtitle: 'Daily automated prompt',
    description: 'Runs every morning at your chosen time. Asks how you\'re feeling, then logs it. Set and forget.',
    icon: <Sun className="w-5 h-5" />,
    color: 'from-amber-400 to-yellow-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: 'Runs automatically each morning',
    howItWorks: 'In Shortcuts app → Automation → + → Time of Day → set time → "Choose from Menu": Good (mild), Okay (moderate), Bad (severe) → "Open URL" with matching jvala:// URL.',
    category: 'automations',
  },
  {
    id: 'evening-log',
    title: 'Evening Wind-down',
    subtitle: 'End-of-day reflection',
    description: 'Automated evening prompt to capture how your day went. Catches patterns you\'d otherwise forget.',
    icon: <Moon className="w-5 h-5" />,
    color: 'from-indigo-500 to-violet-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: 'Runs automatically each evening',
    howItWorks: 'Same as Morning Check-in but set for evening time. In Shortcuts Automation tab → Time of Day → your bedtime hour.',
    category: 'automations',
  },
  {
    id: 'location-trigger',
    title: 'Arrive at Gym / Work',
    subtitle: 'Location-based logging',
    description: 'Automatically prompts a log when you arrive at a specific location (gym, office, etc). Tracks if environment affects symptoms.',
    icon: <Activity className="w-5 h-5" />,
    color: 'from-teal-500 to-cyan-400',
    urlScheme: 'jvala://quick-log?severity=mild&note=arrived+at+location',
    siriPhrase: 'Triggers on location arrival',
    howItWorks: 'In Shortcuts Automation tab → + → Arrive → choose location → "Open URL" → jvala://quick-log?severity=mild&note=arrived+at+gym (customize the note).',
    category: 'automations',
  },
];

export default function ShortcutsSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const copyURL = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      haptics.light();
      toast({ title: 'Copied!', description: 'URL scheme copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Copy failed', description: url, variant: 'destructive' });
    }
  };

  const addToShortcuts = (shortcut: ShortcutDefinition) => {
    haptics.light();
    if (isNative && platform === 'ios') {
      window.open(`shortcuts://create-shortcut`, '_system');
      toast({
        title: 'Shortcuts app opened',
        description: `Create a shortcut with URL: ${shortcut.urlScheme}`,
      });
    } else {
      copyURL(shortcut.urlScheme, shortcut.id);
      toast({
        title: 'URL copied — open Shortcuts on iPhone',
        description: 'Create a new shortcut → add "Open URL" action → paste this URL.',
      });
    }
  };

  const openShortcutsApp = () => {
    if (isNative && platform === 'ios') {
      window.open('shortcuts://', '_system');
    } else {
      toast({ title: 'Open on iPhone', description: 'Open the Shortcuts app on your iPhone.' });
    }
  };

  const categorized = {
    essential: shortcuts.filter(s => s.category === 'essential'),
    'siri-voice': shortcuts.filter(s => s.category === 'siri-voice'),
    smart: shortcuts.filter(s => s.category === 'smart'),
    automations: shortcuts.filter(s => s.category === 'automations'),
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      
      <header className="flex-shrink-0 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Siri & Shortcuts</h1>
            <p className="text-xs text-muted-foreground">{shortcuts.length} shortcuts available</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide">
        <div className="px-4 pb-32 space-y-6 pt-4">
          {/* Hero */}
          <Card className="p-5 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-primary/15">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="font-bold text-foreground">Log without opening Jvala</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Use Siri, Action Button, Lock Screen, or automations to log flares hands-free. Say anything naturally — AI understands.
                </p>
                <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={openShortcutsApp}>
                  <ExternalLink className="w-4 h-4" />
                  Open Shortcuts App
                </Button>
              </div>
            </div>
          </Card>

          {/* Star shortcut callout */}
          <Card className="p-4 bg-gradient-to-r from-primary/15 to-purple-500/10 border-primary/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-bold text-foreground">Recommended: "Say Anything to Jvala"</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  One shortcut that handles everything. Say "Hey Siri, tell Jvala I have a splitting headache and feel dizzy" — AI extracts it all.
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Actions info */}
          <Card className="p-4 bg-muted/30 border-border/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Long-press your Jvala icon</span> on the Home Screen for quick actions — log a flare, voice log, or follow up instantly.
              </p>
            </div>
          </Card>

          {/* Essential */}
          <Section title="Essential" shortcuts={categorized.essential} expandedId={expandedId} copiedId={copiedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
            onCopy={(url, id) => copyURL(url, id)}
            onAdd={addToShortcuts}
          />

          {/* Siri Voice */}
          <Section title="Siri Voice Commands" shortcuts={categorized['siri-voice']} expandedId={expandedId} copiedId={copiedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
            onCopy={(url, id) => copyURL(url, id)}
            onAdd={addToShortcuts}
          />

          {/* Smart */}
          <Section title="Smart Actions" shortcuts={categorized.smart} expandedId={expandedId} copiedId={copiedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
            onCopy={(url, id) => copyURL(url, id)}
            onAdd={addToShortcuts}
          />

          {/* Automations */}
          <Section title="Automations" shortcuts={categorized.automations} expandedId={expandedId} copiedId={copiedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
            onCopy={(url, id) => copyURL(url, id)}
            onAdd={addToShortcuts}
          />

          {/* Pro tips */}
          <Card className="p-4 bg-muted/40 border-border/40 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Action Button:</span> iPhone 15 Pro+ → Settings → Action Button → assign your favorite shortcut. One press from lock screen.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Siri learns names:</span> Once you add a shortcut, just say "Hey Siri" + the shortcut name. It works immediately.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Custom symptoms:</span> Duplicate any shortcut and change the &symptoms= parameter to match YOUR specific symptoms.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}

// ─── Section component ───────────────────────────────────────────────

function Section({ title, shortcuts: items, expandedId, copiedId, onToggle, onCopy, onAdd }: {
  title: string;
  shortcuts: ShortcutDefinition[];
  expandedId: string | null;
  copiedId: string | null;
  onToggle: (id: string) => void;
  onCopy: (url: string, id: string) => void;
  onAdd: (s: ShortcutDefinition) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {items.map(s => (
        <ShortcutCard key={s.id} shortcut={s}
          isExpanded={expandedId === s.id} isCopied={copiedId === s.id}
          onToggle={() => onToggle(s.id)}
          onCopy={() => onCopy(s.urlScheme, s.id)}
          onAddToShortcuts={() => onAdd(s)}
        />
      ))}
    </section>
  );
}

// ─── Card component ──────────────────────────────────────────────────

function ShortcutCard({ shortcut, isExpanded, isCopied, onToggle, onCopy, onAddToShortcuts }: {
  shortcut: ShortcutDefinition;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onAddToShortcuts: () => void;
}) {
  return (
    <Card className={cn("overflow-hidden transition-all duration-300 border", isExpanded ? "border-primary/30 shadow-md" : "border-border/50")}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br text-white shrink-0", shortcut.color)}>
          {shortcut.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{shortcut.title}</p>
          <p className="text-xs text-muted-foreground truncate">{shortcut.subtitle}</p>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0", isExpanded && "rotate-90")} />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-muted-foreground leading-relaxed">{shortcut.description}</p>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <Mic className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">{shortcut.siriPhrase}</span>
          </div>

          <Button className="w-full gap-2 rounded-xl" onClick={(e) => { e.stopPropagation(); onAddToShortcuts(); }}>
            <Plus className="w-4 h-4" />
            Add to Shortcuts
          </Button>

          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/60 px-3 py-2 rounded-lg font-mono text-foreground/80 truncate">
              {shortcut.urlScheme}
            </code>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={(e) => { e.stopPropagation(); onCopy(); }}>
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-xs font-semibold text-foreground mb-1.5">How to set up:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{shortcut.howItWorks}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
