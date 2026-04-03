import React, { useState, useRef } from 'react';
import { X, Camera, Search, Plus, Minus, Loader2, ChevronDown, ScanBarcode, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useFoodLogs, FoodSearchResult } from '@/hooks/useFoodLogs';
import { useToast } from '@/hooks/use-toast';

interface FoodLoggerProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onLogged?: (foodName: string, calories: number, mealType: string) => void;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: '☀️' },
  { value: 'dinner', label: 'Dinner', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍿' },
];

const round = (v: number, decimals = 0) => Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);

export const FoodLogger = ({ userId, open, onClose, onLogged }: FoodLoggerProps) => {
  const { addFoodLog, searchFood, analyzePhoto } = useFoodLogs(userId);
  const { toast } = useToast();

  const [step, setStep] = useState<'search' | 'review'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [mealType, setMealType] = useState<MealType>(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 17 && hour < 22) return 'dinner';
    return 'snack';
  });
  const [servings, setServings] = useState(1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchFood(query);
      setSearchResults(results);
      setSearching(false);
    }, 400);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1024;
        let { width, height } = img;
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoUrl(compressed);
        setAnalyzingPhoto(true);
        try {
          const result = await analyzePhoto(compressed);
          if (result?.items?.length) {
            const item = result.items[0];
            setSelectedFood({ ...item, image_url: null, barcode: item.detected_barcode || null });
            setStep('review');
            haptics.success();
          } else {
            toast({ title: "Couldn't identify food", description: "Try searching manually", variant: "destructive" });
          }
        } catch {
          toast({ title: "Analysis failed", description: "Try searching manually", variant: "destructive" });
        } finally {
          setAnalyzingPhoto(false);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectFood = (food: FoodSearchResult) => {
    setSelectedFood(food);
    setStep('review');
    haptics.selection();
  };

  const handleLog = async () => {
    if (!selectedFood) return;
    setSaving(true);
    haptics.light();
    const result = await addFoodLog({
      food_name: selectedFood.food_name,
      brand: selectedFood.brand,
      barcode: selectedFood.barcode,
      source: photoUrl ? 'photo_ai' : selectedFood.barcode ? 'barcode' : 'search',
      meal_type: mealType,
      serving_size: selectedFood.serving_size,
      servings,
      calories: selectedFood.calories,
      total_fat_g: selectedFood.total_fat_g,
      saturated_fat_g: selectedFood.saturated_fat_g,
      trans_fat_g: selectedFood.trans_fat_g,
      cholesterol_mg: selectedFood.cholesterol_mg,
      sodium_mg: selectedFood.sodium_mg,
      total_carbs_g: selectedFood.total_carbs_g,
      dietary_fiber_g: selectedFood.dietary_fiber_g,
      total_sugars_g: selectedFood.total_sugars_g,
      added_sugars_g: selectedFood.added_sugars_g,
      protein_g: selectedFood.protein_g,
      vitamin_d_mcg: selectedFood.vitamin_d_mcg,
      calcium_mg: selectedFood.calcium_mg,
      iron_mg: selectedFood.iron_mg,
      potassium_mg: selectedFood.potassium_mg,
      vitamin_a_mcg: selectedFood.vitamin_a_mcg,
      vitamin_c_mg: selectedFood.vitamin_c_mg,
      photos: photoUrl ? [photoUrl.slice(0, 200)] : null,
    } as any);
    setSaving(false);
    if (result) {
      haptics.success();
      const cal = Math.round((selectedFood.calories || 0) * servings);
      onLogged?.(selectedFood.food_name, cal, mealType);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setStep('search');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setPhotoUrl(null);
    setServings(1);
    setShowNutrition(false);
  };

  const scaledCalories = Math.round((selectedFood?.calories || 0) * servings);
  const scaledFat = round((selectedFood?.total_fat_g || 0) * servings, 1);
  const scaledCarbs = round((selectedFood?.total_carbs_g || 0) * servings, 1);
  const scaledProtein = round((selectedFood?.protein_g || 0) * servings, 1);
  const macroTotal = scaledFat * 9 + scaledCarbs * 4 + scaledProtein * 4 || 1;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={() => { handleReset(); onClose(); }}
      />

      {/* Bottom Sheet */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-[100]",
        "max-h-[85vh] flex flex-col",
        "bg-background/80 backdrop-blur-2xl",
        "border-t border-white/20 dark:border-white/10",
        "rounded-t-3xl",
        "shadow-[0_-8px_40px_rgba(0,0,0,0.12)]",
        "animate-slide-up"
      )}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-bold">
            {step === 'search' ? 'Log Food' : selectedFood?.food_name || 'Review'}
          </h2>
          <div className="flex items-center gap-2">
            {step === 'review' && (
              <button onClick={handleReset} className="text-xs text-primary font-medium">
                Back
              </button>
            )}
            <button
              onClick={() => { handleReset(); onClose(); }}
              className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-safe overscroll-contain">
          {/* ─── SEARCH STEP ─── */}
          {step === 'search' && (
            <div className="space-y-4 pb-6">
              {/* Meal Type Pills */}
              <div className="flex gap-2">
                {MEAL_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    onClick={() => { setMealType(mt.value); haptics.selection(); }}
                    className={cn(
                      "flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all",
                      "bg-card/60 backdrop-blur-md border",
                      mealType === mt.value
                        ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]"
                        : "border-white/15 text-muted-foreground"
                    )}
                  >
                    <span className="text-base block mb-0.5">{mt.icon}</span>
                    {mt.label}
                  </button>
                ))}
              </div>

              {/* Camera Actions */}
              <div className="flex gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzingPhoto}
                  className={cn(
                    "flex-1 h-[72px] rounded-2xl flex flex-col items-center justify-center gap-1.5",
                    "bg-gradient-to-br from-primary/15 to-primary/5",
                    "border border-primary/20 backdrop-blur-md",
                    "transition-all active:scale-[0.97]",
                    analyzingPhoto && "animate-pulse"
                  )}
                >
                  {analyzingPhoto ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-[10px] text-primary font-medium">Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">Snap & Scan</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
                    input.onchange = (e: any) => handlePhotoCapture(e);
                    input.click();
                  }}
                  disabled={analyzingPhoto}
                  className={cn(
                    "flex-1 h-[72px] rounded-2xl flex flex-col items-center justify-center gap-1.5",
                    "bg-card/60 border border-white/15 backdrop-blur-md",
                    "transition-all active:scale-[0.97]"
                  )}
                >
                  <ScanBarcode className="w-5 h-5 text-foreground/70" />
                  <span className="text-[10px] text-muted-foreground font-medium">Scan Label</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search food..."
                  className="pl-10 h-11 rounded-2xl bg-card/60 backdrop-blur-md border-white/15"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                )}
              </div>

              {/* AI Photo Preview */}
              {analyzingPhoto && photoUrl && (
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={photoUrl} alt="" className="w-full h-32 object-cover rounded-2xl opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-2xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                      <span className="text-white text-xs font-medium">Identifying food...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Search Results */}
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {searchResults.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectFood(item)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-2xl text-left",
                      "bg-card/50 backdrop-blur-md border border-white/10",
                      "hover:border-primary/20 hover:bg-primary/5",
                      "transition-all active:scale-[0.98]"
                    )}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-11 h-11 rounded-xl object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <UtensilsCrossed className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.food_name}</p>
                      {item.brand && <p className="text-[11px] text-muted-foreground truncate">{item.brand}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {item.calories != null && (
                        <p className="text-sm font-bold text-primary">{Math.round(item.calories)}</p>
                      )}
                      <p className="text-[9px] text-muted-foreground">kcal</p>
                    </div>
                  </button>
                ))}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">No results. Try a photo instead.</p>
                )}
              </div>
            </div>
          )}

          {/* ─── REVIEW STEP ─── */}
          {step === 'review' && selectedFood && (
            <div className="space-y-4 pb-6">
              {/* Food Card with Photo */}
              <div className={cn(
                "rounded-2xl overflow-hidden",
                "bg-card/60 backdrop-blur-xl border border-white/15"
              )}>
                {photoUrl && (
                  <img src={photoUrl} alt="" className="w-full h-32 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base">{selectedFood.food_name}</h3>
                      {selectedFood.brand && (
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedFood.brand}</p>
                      )}
                      {selectedFood.serving_size && (
                        <Badge variant="outline" className="mt-1.5 text-[10px] border-white/20">{selectedFood.serving_size}</Badge>
                      )}
                    </div>
                    {/* Calorie Badge */}
                    <div className="text-center bg-primary/10 rounded-xl px-3 py-2">
                      <p className="text-xl font-black text-primary">{scaledCalories}</p>
                      <p className="text-[9px] text-primary/70 font-medium">kcal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Macro Ring + Breakdown */}
              <div className={cn(
                "rounded-2xl p-4",
                "bg-card/60 backdrop-blur-xl border border-white/15"
              )}>
                <div className="flex items-center gap-5">
                  {/* Ring */}
                  <div className="relative w-[72px] h-[72px] flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" opacity="0.3" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(25, 95%, 55%)" strokeWidth="2.5"
                        strokeDasharray={`${(scaledFat * 9 / macroTotal) * 88} 88`} strokeLinecap="round" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(210, 90%, 55%)" strokeWidth="2.5"
                        strokeDasharray={`${(scaledCarbs * 4 / macroTotal) * 88} 88`}
                        strokeDashoffset={`${-(scaledFat * 9 / macroTotal) * 88}`} strokeLinecap="round" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(320, 75%, 55%)" strokeWidth="2.5"
                        strokeDasharray={`${(scaledProtein * 4 / macroTotal) * 88} 88`}
                        strokeDashoffset={`${-((scaledFat * 9 + scaledCarbs * 4) / macroTotal) * 88}`} strokeLinecap="round" />
                    </svg>
                  </div>
                  {/* Macros */}
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <MacroPill label="Fat" value={scaledFat} unit="g" color="hsl(25, 95%, 55%)" pct={macroTotal > 1 ? Math.round((scaledFat * 9 / macroTotal) * 100) : 0} />
                    <MacroPill label="Carbs" value={scaledCarbs} unit="g" color="hsl(210, 90%, 55%)" pct={macroTotal > 1 ? Math.round((scaledCarbs * 4 / macroTotal) * 100) : 0} />
                    <MacroPill label="Protein" value={scaledProtein} unit="g" color="hsl(320, 75%, 55%)" pct={macroTotal > 1 ? Math.round((scaledProtein * 4 / macroTotal) * 100) : 0} />
                  </div>
                </div>
              </div>

              {/* Servings */}
              <div className={cn(
                "rounded-2xl p-4 flex items-center justify-between",
                "bg-card/60 backdrop-blur-xl border border-white/15"
              )}>
                <span className="text-sm font-semibold">Servings</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => { setServings(Math.max(0.25, servings - 0.25)); haptics.light(); }}
                    className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-lg font-black w-8 text-center">{servings}</span>
                  <button
                    onClick={() => { setServings(servings + 0.25); haptics.light(); }}
                    className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meal Selector (compact) */}
              <div className="flex gap-1.5">
                {MEAL_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    onClick={() => { setMealType(mt.value); haptics.selection(); }}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all",
                      mealType === mt.value
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-card/40 text-muted-foreground border border-transparent"
                    )}
                  >
                    {mt.icon} {mt.label}
                  </button>
                ))}
              </div>

              {/* Full Nutrition (collapsible) */}
              <button
                onClick={() => setShowNutrition(!showNutrition)}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-2xl",
                  "bg-card/40 backdrop-blur-md border border-white/10",
                  "text-sm font-medium"
                )}
              >
                Nutrition Facts
                <ChevronDown className={cn("w-4 h-4 transition-transform", showNutrition && "rotate-180")} />
              </button>
              {showNutrition && (
                <div className={cn(
                  "rounded-2xl p-4 space-y-0",
                  "bg-card/60 backdrop-blur-xl border border-white/15"
                )}>
                  <NutritionRow label="Calories" value={scaledCalories} unit="kcal" bold />
                  <div className="w-full h-px bg-primary/30 my-1.5" />
                  <NutritionRow label="Total Fat" value={scaledFat} unit="g" bold />
                  <NutritionRow label="  Saturated" value={round((selectedFood.saturated_fat_g || 0) * servings)} unit="g" />
                  <NutritionRow label="  Trans" value={round((selectedFood.trans_fat_g || 0) * servings)} unit="g" />
                  <NutritionRow label="Cholesterol" value={round((selectedFood.cholesterol_mg || 0) * servings)} unit="mg" />
                  <NutritionRow label="Sodium" value={round((selectedFood.sodium_mg || 0) * servings)} unit="mg" />
                  <NutritionRow label="Total Carbs" value={scaledCarbs} unit="g" bold />
                  <NutritionRow label="  Fiber" value={round((selectedFood.dietary_fiber_g || 0) * servings)} unit="g" />
                  <NutritionRow label="  Sugars" value={round((selectedFood.total_sugars_g || 0) * servings)} unit="g" />
                  <NutritionRow label="Protein" value={scaledProtein} unit="g" bold />
                  <div className="w-full h-px bg-border/30 my-1.5" />
                  <NutritionRow label="Vitamin D" value={round((selectedFood.vitamin_d_mcg || 0) * servings, 1)} unit="mcg" />
                  <NutritionRow label="Calcium" value={round((selectedFood.calcium_mg || 0) * servings)} unit="mg" />
                  <NutritionRow label="Iron" value={round((selectedFood.iron_mg || 0) * servings, 1)} unit="mg" />
                  <NutritionRow label="Potassium" value={round((selectedFood.potassium_mg || 0) * servings)} unit="mg" />
                </div>
              )}

              {/* Log Button */}
              <Button
                onClick={handleLog}
                disabled={saving}
                className={cn(
                  "w-full h-13 rounded-2xl text-base font-bold",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "shadow-[0_4px_20px_rgba(var(--primary-rgb),0.3)]"
                )}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <UtensilsCrossed className="w-5 h-5 mr-2" />
                )}
                Log {mealType.charAt(0).toUpperCase() + mealType.slice(1)} · {scaledCalories} kcal
              </Button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
        .pb-safe { padding-bottom: max(env(safe-area-inset-bottom, 16px), 16px); }
      `}</style>
    </>
  );
};

// ─── Sub-components ───

const MacroPill = ({ label, value, unit, color, pct }: { label: string; value: number; unit: string; color: string; pct: number }) => (
  <div className="text-center">
    <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: color }} />
    <p className="text-xs font-bold">{value}{unit}</p>
    <p className="text-[9px] text-muted-foreground">{label} · {pct}%</p>
  </div>
);

const NutritionRow = ({ label, value, unit, bold }: { label: string; value: number; unit: string; bold?: boolean }) => (
  <div className="flex justify-between py-1 border-b border-white/5 last:border-0">
    <span className={cn("text-xs", bold ? "font-semibold" : "text-muted-foreground")}>{label}</span>
    <span className={cn("text-xs", bold && "font-semibold")}>{value}{unit}</span>
  </div>
);
