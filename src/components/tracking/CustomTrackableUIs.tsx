import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

// ─── Water Glass Fill ───
export const WaterGlassTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [fillLevel, setFillLevel] = useState(0); // 0-8 glasses
  const maxGlasses = 8;

  const handleTap = () => {
    const next = fillLevel >= maxGlasses ? 0 : fillLevel + 1;
    setFillLevel(next);
    haptics.light();
  };

  const handleLog = () => {
    haptics.success();
    onLog("Water", `${fillLevel} glass${fillLevel !== 1 ? 'es' : ''}`);
  };

  const fillPct = (fillLevel / maxGlasses) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-center gap-4">
        {/* Glass SVG */}
        <div className="relative w-20 h-32 cursor-pointer" onClick={handleTap}>
          <svg viewBox="0 0 80 130" className="w-full h-full">
            {/* Glass outline */}
            <path d="M15 10 L10 120 Q10 125 15 125 L65 125 Q70 125 70 120 L65 10 Z" 
              fill="none" stroke="hsl(200 30% 75%)" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Water fill */}
            <clipPath id="glassClip">
              <path d="M16 11 L11 119 Q11 124 16 124 L64 124 Q69 124 69 119 L64 11 Z" />
            </clipPath>
            <rect x="10" y={11 + (113 * (1 - fillPct / 100))} 
              width="60" height={113 * (fillPct / 100)} 
              fill="url(#waterGrad)" clipPath="url(#glassClip)"
              className="transition-all duration-500 ease-out" />
            {/* Water gradient */}
            <defs>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(200 80% 65%)" stopOpacity="0.7" />
                <stop offset="100%" stopColor="hsl(210 85% 55%)" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {/* Shine */}
            <path d="M20 15 L17 100" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
            {/* Bubbles when filling */}
            {fillLevel > 0 && (
              <>
                <circle cx="30" cy={120 - fillPct * 0.9} r="2" fill="white" opacity="0.4" className="animate-bounce" />
                <circle cx="50" cy={115 - fillPct * 0.8} r="1.5" fill="white" opacity="0.3" className="animate-bounce" style={{ animationDelay: '200ms' }} />
              </>
            )}
          </svg>
          {/* Level label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-600/80 drop-shadow-sm">{fillLevel}</span>
          </div>
        </div>
        <div className="pb-2 text-center">
          <p className="text-xs text-muted-foreground">Tap glass to fill</p>
          <p className="text-lg font-bold text-blue-600">{fillLevel}/{maxGlasses}</p>
          <p className="text-[10px] text-muted-foreground">glasses</p>
        </div>
      </div>
      {/* Quick amount buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 4, 8].map(n => (
          <button key={n} onClick={() => { setFillLevel(Math.min(n, maxGlasses)); haptics.light(); }}
            className={cn(
              "py-2 rounded-xl text-xs font-semibold transition-all active:scale-95",
              fillLevel === n ? "bg-blue-500/20 text-blue-600 border border-blue-500/30" : "bg-muted/40 text-muted-foreground border border-transparent"
            )}
          >
            {n} 🥤
          </button>
        ))}
      </div>
      <button onClick={handleLog} disabled={fillLevel === 0}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log {fillLevel} glass{fillLevel !== 1 ? 'es' : ''}
      </button>
    </div>
  );
};

// ─── Stress Thermometer ───
export const StressThermometer = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [level, setLevel] = useState(3);
  const labels = ['Zen', 'Calm', 'Mild', 'Tense', 'Stressed', 'Very Stressed', 'Overwhelmed', 'Maxed Out'];
  const colors = [
    'hsl(160 60% 50%)', 'hsl(150 50% 50%)', 'hsl(90 50% 50%)',
    'hsl(50 70% 50%)', 'hsl(35 80% 50%)', 'hsl(20 80% 50%)',
    'hsl(5 80% 50%)', 'hsl(350 80% 45%)',
  ];
  const pct = ((level) / 7) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* Thermometer */}
        <div className="relative w-10 h-28 flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-muted/30 border border-border/30" />
          <div className="absolute bottom-0 left-0 right-0 rounded-full overflow-hidden transition-all duration-500"
            style={{ height: `${Math.max(15, pct)}%`, background: `linear-gradient(to top, ${colors[level]}, ${colors[Math.max(0, level - 1)]})` }}
          />
          {/* Bulb */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-2 border-border/20"
            style={{ background: `radial-gradient(circle at 40% 40%, ${colors[level]}cc, ${colors[level]})` }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-lg font-bold" style={{ color: colors[level] }}>{labels[level]}</p>
          <p className="text-xs text-muted-foreground">{level + 1}/8 stress level</p>
          <input type="range" min={0} max={7} value={level} onChange={e => { setLevel(+e.target.value); haptics.selection(); }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: colors[level] }}
          />
        </div>
      </div>
      <button onClick={() => { haptics.success(); onLog("Stress", `${labels[level]} (${level + 1}/8)`); }}
        className="w-full py-2.5 rounded-xl text-sm font-medium text-white active:scale-[0.98] transition-all"
        style={{ background: `linear-gradient(135deg, ${colors[level]}, ${colors[Math.max(0, level - 1)]})` }}
      >
        Log Stress: {labels[level]}
      </button>
    </div>
  );
};

// ─── Sleep Quality Moon ───
export const SleepQualityTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [quality, setQuality] = useState<string | null>(null);
  const [hours, setHours] = useState(7);
  const options = [
    { id: 'terrible', label: 'Terrible', stars: 1, color: 'hsl(0 70% 55%)' },
    { id: 'poor', label: 'Poor', stars: 2, color: 'hsl(30 70% 55%)' },
    { id: 'fair', label: 'Fair', stars: 3, color: 'hsl(50 70% 50%)' },
    { id: 'good', label: 'Good', stars: 4, color: 'hsl(150 60% 45%)' },
    { id: 'great', label: 'Great', stars: 5, color: 'hsl(200 60% 50%)' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1">
        {options.map(opt => (
          <button key={opt.id} onClick={() => { setQuality(opt.id); haptics.light(); }}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95",
              quality === opt.id ? "scale-110 shadow-md" : "opacity-60 hover:opacity-80"
            )}
            style={quality === opt.id ? { background: `${opt.color}15`, border: `1px solid ${opt.color}40` } : {}}
          >
            <div className="flex gap-0.5">
              {Array.from({ length: opt.stars }).map((_, i) => (
                <svg key={i} viewBox="0 0 20 20" className="w-3 h-3" fill={quality === opt.id ? opt.color : 'hsl(var(--muted-foreground))'}>
                  <path d="M10 1l2.5 5.5L18 7.5l-4 4 1 5.5L10 14.5 5 17l1-5.5-4-4 5.5-1z" />
                </svg>
              ))}
            </div>
            <span className="text-[10px] font-semibold">{opt.label}</span>
          </button>
        ))}
      </div>
      {/* Hours slider */}
      <div className="flex items-center gap-3 px-2">
        <span className="text-[10px] text-muted-foreground">Hours:</span>
        <input type="range" min={1} max={14} step={0.5} value={hours}
          onChange={e => setHours(+e.target.value)}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'hsl(260 60% 55%)' }}
        />
        <span className="text-sm font-bold text-primary w-8 text-right">{hours}h</span>
      </div>
      <button onClick={() => { if (quality) { haptics.success(); onLog("Sleep", `${options.find(o => o.id === quality)?.label} — ${hours}h`); } }}
        disabled={!quality}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log Sleep
      </button>
    </div>
  );
};

// ─── Exercise Ring ───
export const ExerciseTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [type, setType] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState<'light' | 'moderate' | 'intense'>('moderate');
  const types = [
    { id: 'walk', label: 'Walk', emoji: '🚶' },
    { id: 'run', label: 'Run', emoji: '🏃' },
    { id: 'gym', label: 'Gym', emoji: '🏋️' },
    { id: 'yoga', label: 'Yoga', emoji: '🧘' },
    { id: 'swim', label: 'Swim', emoji: '🏊' },
    { id: 'cycle', label: 'Cycle', emoji: '🚴' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {types.map(t => (
          <button key={t.id} onClick={() => { setType(t.id); haptics.light(); }}
            className={cn(
              "py-2.5 rounded-xl text-center transition-all active:scale-95",
              type === t.id ? "bg-green-500/15 border border-green-500/30 shadow-sm" : "bg-muted/30 border border-transparent"
            )}
          >
            <span className="text-lg">{t.emoji}</span>
            <p className="text-[10px] font-semibold mt-0.5">{t.label}</p>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 px-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Duration:</span>
        <input type="range" min={5} max={120} step={5} value={minutes}
          onChange={e => setMinutes(+e.target.value)}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'hsl(140 60% 45%)' }}
        />
        <span className="text-sm font-bold text-emerald-600 w-12 text-right">{minutes}m</span>
      </div>
      <div className="flex gap-1.5">
        {(['light', 'moderate', 'intense'] as const).map(i => (
          <button key={i} onClick={() => { setIntensity(i); haptics.selection(); }}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all active:scale-95 capitalize",
              intensity === i ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" : "bg-muted/30 text-muted-foreground"
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <button onClick={() => { if (type) { haptics.success(); const t = types.find(x => x.id === type); onLog("Exercise", `${t?.label} — ${minutes}min (${intensity})`); } }}
        disabled={!type}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-green-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log Exercise
      </button>
    </div>
  );
};

// ─── Pain Body Map (simplified) ───
export const PainLocationTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [severity, setSeverity] = useState(5);
  const locations = [
    { id: 'head', label: 'Head', x: 50, y: 8 },
    { id: 'neck', label: 'Neck', x: 50, y: 18 },
    { id: 'shoulder_l', label: 'L Shoulder', x: 25, y: 25 },
    { id: 'shoulder_r', label: 'R Shoulder', x: 75, y: 25 },
    { id: 'chest', label: 'Chest', x: 50, y: 35 },
    { id: 'back', label: 'Back', x: 50, y: 42 },
    { id: 'stomach', label: 'Stomach', x: 50, y: 50 },
    { id: 'hip_l', label: 'L Hip', x: 35, y: 58 },
    { id: 'hip_r', label: 'R Hip', x: 65, y: 58 },
    { id: 'knee_l', label: 'L Knee', x: 38, y: 72 },
    { id: 'knee_r', label: 'R Knee', x: 62, y: 72 },
    { id: 'ankle_l', label: 'L Ankle', x: 38, y: 88 },
    { id: 'ankle_r', label: 'R Ankle', x: 62, y: 88 },
    { id: 'hands', label: 'Hands', x: 15, y: 50 },
    { id: 'feet', label: 'Feet', x: 50, y: 95 },
  ];

  const toggle = (id: string) => {
    haptics.light();
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full" style={{ height: 180 }}>
        {/* Body silhouette */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-10">
          <ellipse cx="50" cy="10" rx="10" ry="10" fill="currentColor" />
          <rect x="40" y="20" width="20" height="35" rx="5" fill="currentColor" />
          <rect x="20" y="22" width="20" height="8" rx="4" fill="currentColor" />
          <rect x="60" y="22" width="20" height="8" rx="4" fill="currentColor" />
          <rect x="42" y="55" width="7" height="35" rx="3" fill="currentColor" />
          <rect x="51" y="55" width="7" height="35" rx="3" fill="currentColor" />
        </svg>
        {/* Pain points */}
        {locations.map(loc => (
          <button key={loc.id} onClick={() => toggle(loc.id)}
            className={cn(
              "absolute w-6 h-6 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all active:scale-90",
              "flex items-center justify-center text-[7px] font-bold",
              selected.includes(loc.id) 
                ? "bg-red-500 text-white scale-125 shadow-lg shadow-red-500/30" 
                : "bg-muted/60 text-muted-foreground border border-border/50 hover:bg-muted"
            )}
            style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
          >
            {selected.includes(loc.id) ? '✓' : ''}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <>
          <div className="flex items-center gap-3 px-1">
            <span className="text-[10px] text-muted-foreground">Pain:</span>
            <input type="range" min={1} max={10} value={severity}
              onChange={e => setSeverity(+e.target.value)}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'hsl(0 70% 55%)' }}
            />
            <span className="text-sm font-bold text-red-500">{severity}/10</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {selected.map(id => locations.find(l => l.id === id)?.label).join(', ')}
          </p>
        </>
      )}
      <button onClick={() => { if (selected.length) { haptics.success(); const names = selected.map(id => locations.find(l => l.id === id)?.label).join(', '); onLog("Pain", `${names} — ${severity}/10`); } }}
        disabled={selected.length === 0}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-rose-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log Pain
      </button>
    </div>
  );
};

// ─── Caffeine Counter ───
export const CaffeineTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const drinks = [
    { id: 'coffee', label: 'Coffee', emoji: '☕', mg: 95 },
    { id: 'espresso', label: 'Espresso', emoji: '🫘', mg: 63 },
    { id: 'tea', label: 'Tea', emoji: '🍵', mg: 47 },
    { id: 'energy', label: 'Energy Drink', emoji: '⚡', mg: 80 },
    { id: 'soda', label: 'Soda', emoji: '🥤', mg: 35 },
    { id: 'matcha', label: 'Matcha', emoji: '🍃', mg: 70 },
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const [count, setCount] = useState(1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {drinks.map(d => (
          <button key={d.id} onClick={() => { setSelected(d.id); haptics.light(); }}
            className={cn(
              "py-2.5 rounded-xl text-center transition-all active:scale-95",
              selected === d.id ? "bg-amber-500/15 border border-amber-500/30 shadow-sm" : "bg-muted/30 border border-transparent"
            )}
          >
            <span className="text-lg">{d.emoji}</span>
            <p className="text-[9px] font-semibold mt-0.5">{d.label}</p>
            <p className="text-[8px] text-muted-foreground">{d.mg}mg</p>
          </button>
        ))}
      </div>
      {selected && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => { if (count > 1) setCount(count - 1); haptics.light(); }}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg font-bold active:scale-90"
          >−</button>
          <span className="text-2xl font-bold text-amber-600 w-8 text-center">{count}</span>
          <button onClick={() => { setCount(count + 1); haptics.light(); }}
            className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-lg font-bold text-amber-600 active:scale-90"
          >+</button>
        </div>
      )}
      <button onClick={() => { if (selected) { haptics.success(); const d = drinks.find(x => x.id === selected)!; onLog("Caffeine", `${count}× ${d.label} (${count * d.mg}mg)`); } }}
        disabled={!selected}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log Caffeine{selected ? ` · ${count * (drinks.find(x => x.id === selected)?.mg || 0)}mg` : ''}
      </button>
    </div>
  );
};

// ─── Breathing Exercise ───
export const BreathingTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [breathing, setBreathing] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [cycles, setCycles] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setBreathing(true);
    setCycles(0);
    setSeconds(0);
    let s = 0;
    timerRef.current = setInterval(() => {
      s++;
      setSeconds(s);
      const cyclePos = s % 12; // 4 in, 4 hold, 4 out
      if (cyclePos < 4) setPhase('inhale');
      else if (cyclePos < 8) setPhase('hold');
      else setPhase('exhale');
      if (cyclePos === 0 && s > 0) setCycles(c => c + 1);
    }, 1000);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setBreathing(false);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const circleScale = phase === 'inhale' ? 1.3 : phase === 'hold' ? 1.3 : 0.8;
  const phaseColors = { inhale: 'hsl(200 70% 55%)', hold: 'hsl(250 60% 55%)', exhale: 'hsl(160 60% 45%)' };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-center">
        <div 
          className="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-[3000ms] ease-in-out"
          style={{ 
            transform: `scale(${breathing ? circleScale : 1})`,
            background: `radial-gradient(circle, ${phaseColors[phase]}40, ${phaseColors[phase]}15)`,
            border: `2px solid ${phaseColors[phase]}50`,
          }}
        >
          <span className="text-sm font-semibold capitalize" style={{ color: phaseColors[phase] }}>
            {breathing ? phase : 'Ready'}
          </span>
        </div>
      </div>
      {breathing && (
        <p className="text-xs text-muted-foreground">
          {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')} · {cycles} cycle{cycles !== 1 ? 's' : ''}
        </p>
      )}
      <div className="flex gap-2">
        {!breathing ? (
          <button onClick={start}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white active:scale-[0.98] transition-all"
          >
            Start Breathing
          </button>
        ) : (
          <>
            <button onClick={stop}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground active:scale-[0.98]"
            >
              Stop
            </button>
            <button onClick={() => { stop(); haptics.success(); onLog("Breathing", `${cycles} cycles — ${Math.floor(seconds / 60)}m ${seconds % 60}s`); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white active:scale-[0.98] transition-all"
            >
              Log & Done
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Mood Journal (quick emotional check-in with journal prompt) ───
export const MoodJournalTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const moods = [
    { id: 'great', label: 'Great', color: 'hsl(150 60% 45%)', emoji: '😊' },
    { id: 'good', label: 'Good', color: 'hsl(180 50% 45%)', emoji: '🙂' },
    { id: 'okay', label: 'Okay', color: 'hsl(50 60% 50%)', emoji: '😐' },
    { id: 'low', label: 'Low', color: 'hsl(30 70% 50%)', emoji: '😔' },
    { id: 'bad', label: 'Bad', color: 'hsl(0 60% 50%)', emoji: '😞' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        {moods.map(m => (
          <button key={m.id} onClick={() => { setSelected(m.id); haptics.light(); }}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95",
              selected === m.id ? "scale-110 shadow-md" : "opacity-50 hover:opacity-75"
            )}
            style={selected === m.id ? { background: `${m.color}15`, border: `1.5px solid ${m.color}40` } : { border: '1.5px solid transparent' }}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-[9px] font-semibold">{m.label}</span>
          </button>
        ))}
      </div>
      {selected && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What's on your mind? (optional)"
          rows={2}
          className="w-full rounded-xl border border-border/50 bg-muted/20 p-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      )}
      <button onClick={() => { if (selected) { haptics.success(); const m = moods.find(x => x.id === selected)!; onLog("Mood Journal", `${m.label}${note ? ` — "${note}"` : ''}`); } }}
        disabled={!selected}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log Mood
      </button>
    </div>
  );
};

// ─── Screen Time Monitor ───
export const ScreenTimeTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [hours, setHours] = useState(4);
  const [eyeStrain, setEyeStrain] = useState(false);
  const maxHours = 16;
  const pct = (hours / maxHours) * 100;
  const color = hours <= 4 ? 'hsl(150 60% 45%)' : hours <= 8 ? 'hsl(50 60% 50%)' : hours <= 12 ? 'hsl(30 70% 50%)' : 'hsl(0 60% 50%)';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4">
        <div className="relative w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3"
              strokeDasharray={`${pct * 0.942} 100`} strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold" style={{ color }}>{hours}h</span>
          </div>
        </div>
        <div className="space-y-1">
          <input type="range" min={0} max={maxHours} step={0.5} value={hours}
            onChange={e => { setHours(+e.target.value); haptics.selection(); }}
            className="w-28 h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: color }}
          />
          <p className="text-[10px] text-muted-foreground">Drag to set hours</p>
        </div>
      </div>
      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 cursor-pointer">
        <input type="checkbox" checked={eyeStrain} onChange={e => setEyeStrain(e.target.checked)}
          className="rounded border-border accent-red-500" />
        <span className="text-xs">Eye strain / headache</span>
      </label>
      <button onClick={() => { haptics.success(); onLog("Screen Time", `${hours}h${eyeStrain ? ' (eye strain)' : ''}`); }}
        className="w-full py-2.5 rounded-xl text-sm font-medium text-white active:scale-[0.98] transition-all"
        style={{ background: `linear-gradient(135deg, ${color}, hsl(250 50% 50%))` }}
      >
        Log Screen Time
      </button>
    </div>
  );
};

// ─── Meditation Timer ───
export const MeditationTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [minutes, setMinutes] = useState(10);
  const [meditating, setMeditating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [type, setType] = useState<string>('guided');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const types = [
    { id: 'guided', label: 'Guided', emoji: '🧘' },
    { id: 'breath', label: 'Breath', emoji: '🌬️' },
    { id: 'body_scan', label: 'Body Scan', emoji: '🫀' },
    { id: 'mindful', label: 'Mindful', emoji: '🧠' },
  ];

  const start = () => {
    setMeditating(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMeditating(false);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div className="space-y-3 text-center">
      {!meditating ? (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {types.map(t => (
              <button key={t.id} onClick={() => { setType(t.id); haptics.light(); }}
                className={cn(
                  "py-2 rounded-xl text-center transition-all active:scale-95",
                  type === t.id ? "bg-teal-500/15 border border-teal-500/30" : "bg-muted/30 border border-transparent"
                )}
              >
                <span className="text-lg">{t.emoji}</span>
                <p className="text-[8px] font-semibold mt-0.5">{t.label}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-2">
            <span className="text-[10px] text-muted-foreground">Duration:</span>
            <input type="range" min={1} max={60} value={minutes}
              onChange={e => setMinutes(+e.target.value)}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'hsl(170 50% 45%)' }}
            />
            <span className="text-sm font-bold text-teal-600 w-10 text-right">{minutes}m</span>
          </div>
          <button onClick={start}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-teal-500 to-cyan-500 text-white active:scale-[0.98]"
          >
            Start Meditation
          </button>
        </>
      ) : (
        <>
          <div className="relative w-24 h-24 mx-auto">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(170 50% 45%)" strokeWidth="2.5"
                strokeDasharray={`${Math.min((elapsed / (minutes * 60)) * 94.2, 94.2)} 100`} strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-teal-600">{Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}</span>
              <span className="text-[9px] text-muted-foreground">of {minutes}m</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={stop} className="flex-1 py-2 rounded-xl text-sm bg-muted text-muted-foreground active:scale-[0.98]">Cancel</button>
            <button onClick={() => { stop(); haptics.success(); const t = types.find(x => x.id === type); onLog("Meditation", `${t?.label} — ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`); }}
              className="flex-1 py-2 rounded-xl text-sm bg-gradient-to-r from-teal-500 to-cyan-500 text-white active:scale-[0.98]"
            >
              Log & Done
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Hydration Tracker (different from water glass — tracks total fluid intake) ───
export const HydrationTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [ml, setMl] = useState(500);
  const [type, setType] = useState('water');
  const types = [
    { id: 'water', label: 'Water', emoji: '💧' },
    { id: 'tea', label: 'Tea', emoji: '🍵' },
    { id: 'juice', label: 'Juice', emoji: '🧃' },
    { id: 'electrolyte', label: 'Electrolyte', emoji: '⚡' },
  ];
  const presets = [250, 500, 750, 1000];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {types.map(t => (
          <button key={t.id} onClick={() => { setType(t.id); haptics.light(); }}
            className={cn(
              "py-2 rounded-xl text-center transition-all active:scale-95",
              type === t.id ? "bg-cyan-500/15 border border-cyan-500/30" : "bg-muted/30 border border-transparent"
            )}
          >
            <span className="text-base">{t.emoji}</span>
            <p className="text-[8px] font-semibold mt-0.5">{t.label}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {presets.map(p => (
          <button key={p} onClick={() => { setMl(p); haptics.light(); }}
            className={cn(
              "py-2 rounded-xl text-xs font-semibold transition-all active:scale-95",
              ml === p ? "bg-cyan-500/20 text-cyan-600 border border-cyan-500/30" : "bg-muted/30 text-muted-foreground"
            )}
          >
            {p}ml
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 px-2">
        <input type="range" min={100} max={2000} step={50} value={ml}
          onChange={e => { setMl(+e.target.value); haptics.selection(); }}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'hsl(190 70% 50%)' }}
        />
        <span className="text-sm font-bold text-cyan-600 w-16 text-right">{ml}ml</span>
      </div>
      <button onClick={() => { haptics.success(); const t = types.find(x => x.id === type)!; onLog("Hydration", `${ml}ml ${t.label}`); }}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white active:scale-[0.98] transition-all"
      >
        Log {ml}ml {types.find(x => x.id === type)?.label}
      </button>
    </div>
  );
};

// ─── Symptom Severity Tracker (quick multi-symptom with severity) ───
export const SymptomQuickTrackable = ({ onLog }: { onLog: (label: string, value: string) => void }) => {
  const [symptoms, setSymptoms] = useState<Record<string, number>>({});
  const commonSymptoms = ['Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Brain fog', 'Joint pain', 'Muscle ache', 'Cramping'];

  const toggle = (s: string) => {
    haptics.light();
    setSymptoms(prev => {
      const copy = { ...prev };
      if (copy[s] !== undefined) {
        // Cycle through severities: 1 → 2 → 3 → remove
        if (copy[s] >= 3) delete copy[s];
        else copy[s]++;
      } else {
        copy[s] = 1;
      }
      return copy;
    });
  };

  const sevLabel = (n: number) => n === 1 ? 'mild' : n === 2 ? 'mod' : 'severe';
  const sevColor = (n: number) => n === 1 ? 'hsl(50 70% 50%)' : n === 2 ? 'hsl(30 70% 50%)' : 'hsl(0 60% 50%)';
  const count = Object.keys(symptoms).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {commonSymptoms.map(s => {
          const sev = symptoms[s];
          const active = sev !== undefined;
          return (
            <button key={s} onClick={() => toggle(s)}
              className={cn(
                "py-2 px-2 rounded-xl text-xs font-medium transition-all active:scale-95 text-left",
                active ? "shadow-sm" : "bg-muted/30 text-muted-foreground"
              )}
              style={active ? { background: `${sevColor(sev)}15`, border: `1.5px solid ${sevColor(sev)}40`, color: sevColor(sev) } : {}}
            >
              {s} {active && <span className="text-[9px] opacity-70">({sevLabel(sev)})</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Tap to add, tap again to increase severity</p>
      <button onClick={() => { if (count > 0) { haptics.success(); const items = Object.entries(symptoms).map(([s, n]) => `${s} (${sevLabel(n)})`).join(', '); onLog("Symptoms", items); } }}
        disabled={count === 0}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-rose-500 to-pink-500 text-white active:scale-[0.98] transition-all disabled:opacity-40"
      >
        Log {count} symptom{count !== 1 ? 's' : ''}
      </button>
    </div>
  );
};
