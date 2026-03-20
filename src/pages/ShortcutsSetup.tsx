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
    title: 'Log a Flare',
    subtitle: 'One-tap moderate flare',
    description: 'Instantly logs a moderate flare with timestamp. Say "Hey Siri, log a flare" to trigger hands-free.',
    icon: <Zap className="w-5 h-5" />,
    color: 'from-primary to-primary/70',
    urlScheme: 'jvala://quick-log?severity=moderate',
    siriPhrase: '"Hey Siri, log a flare"',
    steps: [
      'Tap "Add to Shortcuts" below',
      'Review the shortcut and tap "Add Shortcut"',
      'Say "Hey Siri, log a flare" to test it',
      'Optional: Go to Settings → Action Button to assign it',
    ],
    category: 'essential',
  },
  {
    id: 'headache',
    title: 'Log a Headache',
    subtitle: '"Hey Siri, I have a headache"',
    description: 'Logs a moderate flare with "headache" pre-filled. Perfect for Siri or Action Button.',
    icon: <Brain className="w-5 h-5" />,
    color: 'from-purple-500 to-purple-400',
    urlScheme: 'jvala://quick-log?severity=moderate&symptoms=headache',
    siriPhrase: '"Hey Siri, I have a headache"',
    steps: [
      'Tap "Add to Shortcuts" below',
      'Review the shortcut and tap "Add Shortcut"',
      'Say "Hey Siri, I have a headache" to test',
    ],
    category: 'essential',
  },
  {
    id: 'voice-log',
    title: 'Voice Log',
    subtitle: 'Dictate and log',
    description: 'Opens Jvala\'s voice recorder so you can describe how you feel. AI extracts symptoms automatically.',
    icon: <Mic className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-400',
    urlScheme: 'jvala://voice-log',
    siriPhrase: '"Hey Siri, Jvala voice log"',
    steps: [
      'Tap "Add to Shortcuts" below',
      'Review and tap "Add Shortcut"',
      'Say "Hey Siri, Jvala voice log" to start recording',
    ],
    category: 'power',
  },
  {
    id: 'severity-ask',
    title: 'Rate My Flare',
    subtitle: 'Choose severity then log',
    description: 'Prompts "How bad?" with Mild / Moderate / Severe, then logs your choice.',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: '"Hey Siri, rate my flare"',
    steps: [
      'Tap "Add to Shortcuts" below',
      'Review the multi-step shortcut',
      'Say "Hey Siri, rate my flare"',
      'Choose Mild, Moderate, or Severe',
    ],
    category: 'power',
  },
  {
    id: 'morning-checkin',
    title: 'Morning Check-in',
    subtitle: 'Start your day right',
    description: 'A daily automation that asks how you\'re feeling at your chosen time and logs it.',
    icon: <Clock className="w-5 h-5" />,
    color: 'from-sky-500 to-blue-400',
    urlScheme: 'jvala://quick-log?severity=',
    siriPhrase: 'Runs automatically',
    steps: [
      'Tap "Add to Shortcuts" below',
      'Open Shortcuts app → Automation tab',
      'Tap + → Time of Day → Set your morning time',
      'Select "Run Shortcut" → pick "Morning Check-in"',
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
      toast({ title: 'Copied!', description: 'URL scheme copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Copy failed', description: url, variant: 'destructive' });
    }
  };

  const addToShortcuts = (shortcut: ShortcutDefinition) => {
    haptics.light();
    
    // On native iOS, try to open the Shortcuts app with the URL scheme
    if (isNative && platform === 'ios') {
      // Open jvala:// URL to test it works, then guide to Shortcuts app
      window.open(`shortcuts://create-shortcut`, '_system');
      toast({
        title: 'Shortcuts app opened',
        description: `Create a shortcut with the URL: ${shortcut.urlScheme}`,
      });
    } else {
      // On web, copy the URL and explain
      copyURL(shortcut.urlScheme, shortcut.id);
      toast({
        title: 'URL copied!',
        description: 'Open the Shortcuts app on your iPhone and create a new shortcut with "Open URL" action.',
      });
    }
  };

  const openShortcutsApp = () => {
    if (isNative && platform === 'ios') {
      window.open('shortcuts://', '_system');
    } else {
      toast({ 
        title: 'Open on iPhone', 
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
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      {/* Safe area spacer */}
      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      
      {/* Header */}
      <header className="flex-shrink-0 bg-background/80 backdrop-blur-xl border-b border-border/40">
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
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain">
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
                  Use Siri, the Action Button, Lock Screen widgets, or Home Screen shortcuts to log flares instantly.
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

          {/* Quick Actions info */}
          <Card className="p-4 bg-muted/30 border-border/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Long-press your Jvala icon</span> on the Home Screen for quick actions — log a mild, moderate, or severe flare without opening the app.
              </p>
            </div>
          </Card>

          {/* Tips bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {[
              { icon: <Mic className="w-3.5 h-3.5" />, text: '"Hey Siri, log a flare"' },
              { icon: <Smartphone className="w-3.5 h-3.5" />, text: 'Action Button → assign shortcut' },
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
                onAddToShortcuts={() => addToShortcuts(shortcut)}
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
                onAddToShortcuts={() => addToShortcuts(shortcut)}
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
                onAddToShortcuts={() => addToShortcuts(shortcut)}
              />
            ))}
          </section>

          {/* Pro tips */}
          <Card className="p-4 bg-muted/40 border-border/40 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Action Button:</span> On iPhone 15 Pro or later, go to{' '}
              <span className="font-medium">Settings → Action Button</span> and assign your favorite Jvala shortcut.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Siri tip:</span> Once you add a shortcut, Siri learns the name. Just say "Hey Siri" followed by the shortcut name to trigger it hands-free.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}

function ShortcutCard({
  shortcut,
  isExpanded,
  isCopied,
  onToggle,
  onCopy,
  onAddToShortcuts,
}: {
  shortcut: ShortcutDefinition;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onAddToShortcuts: () => void;
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

          {/* Add to Shortcuts button */}
          <Button
            className="w-full gap-2 rounded-xl"
            onClick={(e) => { e.stopPropagation(); onAddToShortcuts(); }}
          >
            <Plus className="w-4 h-4" />
            Add to Shortcuts
          </Button>

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
            <p className="text-xs font-semibold text-foreground">Setup steps:</p>
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
