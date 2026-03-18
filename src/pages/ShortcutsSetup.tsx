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
  Shield,
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
  steps: string[];
  category: 'essential' | 'power' | 'contextual';
}

const shortcuts: ShortcutDefinition[] = [
  {
    id: 'quick-moderate',
    title: 'Quick Flare Log',
    subtitle: 'One-tap moderate flare',
    description: 'Instantly logs a moderate flare with timestamp, location, and weather data. No typing required.',
    icon: <Zap className="w-5 h-5" />,
    color: 'from-primary to-primary/70',
    urlScheme: 'jvala://quick-log?severity=moderate',
    siriPhrase: '"Hey Siri, log a flare"',
    steps: [
      'Open the Shortcuts app',
      'Tap + to create a new shortcut',
      'Add the "Open URLs" action',
      'Set URL to: jvala://quick-log?severity=moderate',
      'Tap the name at top → rename to "Log a Flare"',
      'Tap ⓘ → Add to Home Screen',
    ],
    category: 'essential',
  },
  {
    id: 'headache',
    title: 'Log a Headache',
    subtitle: '"Hey Siri, I have a headache"',
    description: 'Logs a moderate flare with "headache" pre-filled as a symptom. Perfect for Siri or Action Button.',
    icon: <Brain className="w-5 h-5" />,
    color: 'from-purple-500 to-purple-400',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=headache',
    siriPhrase: '"Hey Siri, I have a headache"',
    steps: [
      'Open the Shortcuts app',
      'Tap + to create a new shortcut',
      'Add the "Open URLs" action',
      'Set URL to: jvala://quick-log?severity=moderate&symptoms=headache',
      'Rename to "I have a headache"',
      'Tap ⓘ → Add to Siri → Record your phrase',
    ],
    category: 'essential',
  },
  {
    id: 'voice-log',
    title: 'Voice Log',
    subtitle: 'Dictate, transcribe, log',
    description: 'Uses Siri\'s "Dictate Text" to capture your words, then sends the transcript to Jvala for AI-powered symptom extraction.',
    icon: <Mic className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-400',
    urlScheme: 'jvala://quick-log?severity=moderate&note=',
    siriPhrase: '"Hey Siri, Jvala voice log"',
    steps: [
      'Open the Shortcuts app',
      'Tap + to create a new shortcut',
      'Add "Dictate Text" action',
      'Add "Open URLs" action',
      'Set URL to: jvala://quick-log?severity=moderate&note=[Dictated Text]',
      'Drag the blue "Dictated Text" variable into the URL',
      'Rename to "Jvala Voice Log"',
    ],
    category: 'power',
  },
  {
    id: 'severity-ask',
    title: 'Ask Severity',
    subtitle: 'Choose severity then log',
    description: 'Prompts "How bad is it?" with Mild/Moderate/Severe options, then logs with your choice. Great for Action Button.',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: '"Hey Siri, rate my flare"',
    steps: [
      'Open the Shortcuts app',
      'Tap + to create a new shortcut',
      'Add "Choose from Menu" action',
      'Set prompt: "How bad is it?"',
      'Add 3 options: Mild, Moderate, Severe',
      'Under each option, add "Open URLs"',
      'Set URLs: jvala://quick-log?severity=mild (etc.)',
      'Rename to "Rate My Flare"',
    ],
    category: 'power',
  },
  {
    id: 'morning-checkin',
    title: 'Morning Check-in',
    subtitle: 'Start your day right',
    description: 'A daily automation that runs at your chosen time and asks how you\'re feeling, then logs it.',
    icon: <Clock className="w-5 h-5" />,
    color: 'from-sky-500 to-blue-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: 'Runs automatically',
    steps: [
      'Open the Shortcuts app',
      'Go to the Automation tab',
      'Tap + → "Time of Day"',
      'Set your preferred morning time',
      'Add "Choose from Menu": How are you feeling?',
      'Options: Good (mild), Okay (moderate), Bad (severe)',
      'Under each, add "Open URLs" with the matching jvala:// URL',
    ],
    category: 'contextual',
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
      toast({ title: 'Copied!', description: 'URL copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Copy failed', description: url, variant: 'destructive' });
    }
  };

  const openShortcutsApp = () => {
    if (isNative && platform === 'ios') {
      window.open('shortcuts://', '_system');
    } else {
      toast({ 
        title: 'Shortcuts app', 
        description: 'Open the Shortcuts app on your iPhone to get started.',
      });
    }
  };

  const categorized = {
    essential: shortcuts.filter(s => s.category === 'essential'),
    power: shortcuts.filter(s => s.category === 'power'),
    contextual: shortcuts.filter(s => s.category === 'contextual'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div 
        className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Siri & Shortcuts</h1>
            <p className="text-xs text-muted-foreground">Log without even opening the app</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-32 space-y-6 pt-4">
        {/* Hero */}
        <Card className="p-5 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-primary/15">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="font-bold text-foreground">Supercharge your logging</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use Siri, the Action Button, Lock Screen widgets, or Home Screen shortcuts to log flares instantly — without ever opening the app.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-2"
                onClick={openShortcutsApp}
              >
                <ExternalLink className="w-4 h-4" />
                Open Shortcuts App
              </Button>
            </div>
          </div>
        </Card>

        {/* Tips bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {[
            { icon: <Shield className="w-3.5 h-3.5" />, text: 'Action Button → assign any shortcut' },
            { icon: <Smartphone className="w-3.5 h-3.5" />, text: 'Lock Screen → add shortcut widget' },
            { icon: <Mic className="w-3.5 h-3.5" />, text: '"Hey Siri" → voice trigger' },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {tip.icon}
              {tip.text}
            </div>
          ))}
        </div>

        {/* Essential Shortcuts */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Essential
          </h3>
          {categorized.essential.map(shortcut => (
            <ShortcutCard
              key={shortcut.id}
              shortcut={shortcut}
              isExpanded={expandedId === shortcut.id}
              isCopied={copiedId === shortcut.id}
              onToggle={() => setExpandedId(expandedId === shortcut.id ? null : shortcut.id)}
              onCopy={() => copyURL(shortcut.urlScheme, shortcut.id)}
            />
          ))}
        </section>

        {/* Power Shortcuts */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Power User
          </h3>
          {categorized.power.map(shortcut => (
            <ShortcutCard
              key={shortcut.id}
              shortcut={shortcut}
              isExpanded={expandedId === shortcut.id}
              isCopied={copiedId === shortcut.id}
              onToggle={() => setExpandedId(expandedId === shortcut.id ? null : shortcut.id)}
              onCopy={() => copyURL(shortcut.urlScheme, shortcut.id)}
            />
          ))}
        </section>

        {/* Contextual Shortcuts */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Automations
          </h3>
          {categorized.contextual.map(shortcut => (
            <ShortcutCard
              key={shortcut.id}
              shortcut={shortcut}
              isExpanded={expandedId === shortcut.id}
              isCopied={copiedId === shortcut.id}
              onToggle={() => setExpandedId(expandedId === shortcut.id ? null : shortcut.id)}
              onCopy={() => copyURL(shortcut.urlScheme, shortcut.id)}
            />
          ))}
        </section>

        {/* Pro tip */}
        <Card className="p-4 bg-muted/40 border-border/40">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Pro tip:</span> On iPhone 15 Pro or later, go to{' '}
            <span className="font-medium">Settings → Action Button</span> and assign your favorite Jvala shortcut. 
            One press to log — even from your lock screen.
          </p>
        </Card>
      </div>
    </div>
  );
}

function ShortcutCard({
  shortcut,
  isExpanded,
  isCopied,
  onToggle,
  onCopy,
}: {
  shortcut: ShortcutDefinition;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300 border",
        isExpanded ? "border-primary/30 shadow-md" : "border-border/50"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br text-white shrink-0", shortcut.color)}>
          {shortcut.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{shortcut.title}</p>
          <p className="text-xs text-muted-foreground truncate">{shortcut.subtitle}</p>
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0",
            isExpanded && "rotate-90"
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {shortcut.description}
          </p>

          {/* Siri phrase */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <Mic className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">{shortcut.siriPhrase}</span>
          </div>

          {/* URL to copy */}
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/60 px-3 py-2 rounded-lg font-mono text-foreground/80 truncate">
              {shortcut.urlScheme}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={(e) => { e.stopPropagation(); onCopy(); }}
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">How to set up:</p>
            <ol className="space-y-1.5">
              {shortcut.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
}
