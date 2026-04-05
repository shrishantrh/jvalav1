import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Search, Plus, Minus, Loader2, ChevronDown, ChevronRight, UtensilsCrossed, Flame, Droplets, Wheat, Beef, Apple, Clock } from 'lucide-react';
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
  { value: 'breakfast', label: 'Morning', icon: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: '☀️' },
  { value: 'dinner', label: 'Dinner', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍿' },
];

const round = (v: number, decimals = 0) => Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);

export const FoodLogger = ({ userId, open, onClose, onLogged }: FoodLoggerProps) => {
  const { addFoodLog, searchFood, analyzePhoto, getDailySummary } = useFoodLogs(userId);
  const { toast } = useToast();

  const [step, setStep] = useState<'input' | 'review'>('input');
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
  const [showFullNutrition, setShowFullNutrition] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Daily totals
  const dailySummary = getDailySummary(new Date());

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchFood(query);
      setSearchResults(results);
      setSearching(false);
    }, 350);
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
            toast({ title: "Couldn't identify food", description: "Try searching instead", variant: "destructive" });
          }
        } catch {
          toast({ title: "Analysis failed", description: "Try searching instead", variant: "destructive" });
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
      toast({
        title: `✓ ${selectedFood.food_name} logged`,
        description: `${cal} kcal · ${mealType}`,
      });
      onLogged?.(selectedFood.food_name, cal, mealType);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setStep('input');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setPhotoUrl(null);
    setServings(1);
    setShowFullNutrition(false);
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
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-md"
        onClick={() => { handleReset(); onClose(); }}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      {/* Bottom Sheet */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-[100]",
        "max-h-[88vh] flex flex-col",
        "rounded-t-[28px]",
        "animate-slide-up"
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.88) 100%)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        borderTop: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}>
        {/* Specular highlight */}
        <div className="absolute inset-x-0 top-0 h-16 rounded-t-[28px] pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)' }} />

        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1 relative z-10">
          <div className="w-9 h-[5px] rounded-full bg-foreground/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.1) 100%)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}>
              <Apple className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {step === 'review' ? 'Review' : 'Log Food'}
              </h2>
              {dailySummary.logCount > 0 && step === 'input' && (
                <p className="text-[10px] text-muted-foreground">
                  Today: {dailySummary.totalCalories} kcal · {dailySummary.logCount} items
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'review' && (
              <button onClick={handleReset} className="text-xs text-primary font-semibold px-2 py-1 rounded-lg active:bg-primary/10 transition-colors">
                Back
              </button>
            )}
            <button
              onClick={() => { handleReset(); onClose(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(0,0,0,0.06)' }}
            >
              <X className="w-3.5 h-3.5 text-foreground/60" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-safe overscroll-contain relative z-10">
          {/* ─── INPUT STEP ─── */}
          {step === 'input' && (
            <div className="space-y-3 pb-6">
              {/* Meal Type Selector */}
              <div className="flex gap-1.5">
                {MEAL_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    onClick={() => { setMealType(mt.value); haptics.selection(); }}
                    className={cn(
                      "flex-1 py-2 rounded-2xl text-[11px] font-semibold transition-all",
                      "active:scale-[0.96]"
                    )}
                    style={{
                      background: mealType === mt.value
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.08) 100%)'
                        : 'rgba(0,0,0,0.03)',
                      border: mealType === mt.value
                        ? '1px solid rgba(34,197,94,0.25)'
                        : '1px solid transparent',
                      color: mealType === mt.value ? 'rgb(22,163,74)' : undefined,
                    }}
                  >
                    <span className="text-sm block">{mt.icon}</span>
                    {mt.label}
                  </button>
                ))}
              </div>

              {/* Camera + Search Row */}
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzingPhoto}
                  className="w-14 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-[0.95] transition-all flex-shrink-0"
                  style={{
                    background: analyzingPhoto
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(22,163,74,0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(22,163,74,0.06) 100%)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  {analyzingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  ) : (
                    <Camera className="w-5 h-5 text-green-600" />
                  )}
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search food or scan..."
                    className="pl-9 h-12 rounded-2xl border-0 text-sm"
                    style={{
                      background: 'rgba(0,0,0,0.04)',
                    }}
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-green-600" />
                  )}
                </div>
              </div>

              {/* AI Photo Preview */}
              {analyzingPhoto && photoUrl && (
                <div className="relative rounded-2xl overflow-hidden"
                  style={{
                    border: '1px solid rgba(34,197,94,0.2)',
                    boxShadow: '0 4px 16px rgba(34,197,94,0.1)',
                  }}>
                  <img src={photoUrl} alt="" className="w-full h-28 object-cover opacity-70" />
                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
                    style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                      </div>
                      <span className="text-white text-[11px] font-semibold drop-shadow">Identifying food...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Summary Bar (if has logs) */}
              {dailySummary.logCount > 0 && !searchQuery && (
                <div className="rounded-2xl p-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(22,163,74,0.03) 100%)',
                    border: '1px solid rgba(34,197,94,0.1)',
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">Today's Nutrition</span>
                    <span className="text-[10px] text-muted-foreground">{dailySummary.logCount} items</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <DailyStat label="Calories" value={dailySummary.totalCalories} unit="kcal" color="rgb(239,68,68)" />
                    <DailyStat label="Fat" value={round(dailySummary.totalFat, 1)} unit="g" color="hsl(25, 95%, 55%)" />
                    <DailyStat label="Carbs" value={round(dailySummary.totalCarbs, 1)} unit="g" color="hsl(210, 90%, 55%)" />
                    <DailyStat label="Protein" value={round(dailySummary.totalProtein, 1)} unit="g" color="hsl(320, 75%, 55%)" />
                  </div>
                </div>
              )}

              {/* Search Results */}
              <div className="space-y-1 max-h-[45vh] overflow-y-auto">
                {searchResults.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectFood(item)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left active:scale-[0.98] transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(34,197,94,0.1)' }}>
                        <UtensilsCrossed className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{item.food_name}</p>
                      {item.brand && <p className="text-[11px] text-muted-foreground truncate">{item.brand}</p>}
                      {item.serving_size && <p className="text-[10px] text-muted-foreground/60">{item.serving_size}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {item.calories != null && (
                        <p className="text-sm font-bold text-green-600">{Math.round(item.calories)}</p>
                      )}
                      <p className="text-[9px] text-muted-foreground">kcal</p>
                    </div>
                  </button>
                ))}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="text-center py-8">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No results found</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Try a photo instead</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── REVIEW STEP ─── */}
          {step === 'review' && selectedFood && (
            <div className="space-y-3 pb-6">
              {/* Food Hero Card */}
              <div className="rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 100%)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), 0 4px 16px rgba(0,0,0,0.06)',
                }}>
                {photoUrl && (
                  <div className="relative h-28">
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(255,255,255,0.9) 100%)' }} />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-foreground leading-tight">{selectedFood.food_name}</h3>
                      {selectedFood.brand && (
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedFood.brand}</p>
                      )}
                      {selectedFood.serving_size && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{selectedFood.serving_size}</p>
                      )}
                    </div>
                    {/* Calorie orb */}
                    <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(22,163,74,0.06) 100%)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        boxShadow: '0 4px 12px rgba(34,197,94,0.1)',
                      }}>
                      <span className="text-lg font-black text-green-600">{scaledCalories}</span>
                      <span className="text-[8px] font-semibold text-green-600/60">kcal</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Macro Breakdown */}
              <div className="rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 100%)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), 0 4px 16px rgba(0,0,0,0.06)',
                }}>
                <div className="flex items-center gap-4">
                  {/* Macro Ring */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(25, 95%, 55%)" strokeWidth="3"
                        strokeDasharray={`${(scaledFat * 9 / macroTotal) * 88} 88`} strokeLinecap="round" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(210, 90%, 55%)" strokeWidth="3"
                        strokeDasharray={`${(scaledCarbs * 4 / macroTotal) * 88} 88`}
                        strokeDashoffset={`${-(scaledFat * 9 / macroTotal) * 88}`} strokeLinecap="round" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(320, 75%, 55%)" strokeWidth="3"
                        strokeDasharray={`${(scaledProtein * 4 / macroTotal) * 88} 88`}
                        strokeDashoffset={`${-((scaledFat * 9 + scaledCarbs * 4) / macroTotal) * 88}`} strokeLinecap="round" />
                    </svg>
                  </div>
                  {/* Macro pills */}
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <MacroPill label="Fat" value={scaledFat} color="hsl(25, 95%, 55%)" pct={macroTotal > 1 ? Math.round((scaledFat * 9 / macroTotal) * 100) : 0} />
                    <MacroPill label="Carbs" value={scaledCarbs} color="hsl(210, 90%, 55%)" pct={macroTotal > 1 ? Math.round((scaledCarbs * 4 / macroTotal) * 100) : 0} />
                    <MacroPill label="Protein" value={scaledProtein} color="hsl(320, 75%, 55%)" pct={macroTotal > 1 ? Math.round((scaledProtein * 4 / macroTotal) * 100) : 0} />
                  </div>
                </div>
              </div>

              {/* Servings Control */}
              <div className="rounded-2xl p-3.5 flex items-center justify-between"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}>
                <span className="text-sm font-semibold text-foreground">Servings</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setServings(Math.max(0.25, servings - 0.25)); haptics.light(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: 'rgba(0,0,0,0.06)' }}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-lg font-black w-8 text-center text-foreground">{servings}</span>
                  <button
                    onClick={() => { setServings(servings + 0.25); haptics.light(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: 'rgba(0,0,0,0.06)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meal Type (compact) */}
              <div className="flex gap-1.5">
                {MEAL_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    onClick={() => { setMealType(mt.value); haptics.selection(); }}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.96]"
                    )}
                    style={{
                      background: mealType === mt.value
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.08) 100%)'
                        : 'rgba(0,0,0,0.03)',
                      border: mealType === mt.value ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent',
                      color: mealType === mt.value ? 'rgb(22,163,74)' : undefined,
                    }}
                  >
                    {mt.icon} {mt.label}
                  </button>
                ))}
              </div>

              {/* Nutrition Facts (collapsible) */}
              <button
                onClick={() => setShowFullNutrition(!showFullNutrition)}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-sm font-medium active:scale-[0.99] transition-transform"
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
              >
                <span className="text-foreground">Nutrition Facts</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", showFullNutrition && "rotate-180")} />
              </button>
              {showFullNutrition && (
                <div className="rounded-2xl p-4 space-y-0"
                  style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 100%)',
                    border: '1px solid rgba(255,255,255,0.6)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                  <NutritionRow label="Calories" value={scaledCalories} unit="kcal" bold />
                  <div className="w-full h-[2px] my-1" style={{ background: 'rgba(34,197,94,0.2)' }} />
                  <NutritionRow label="Total Fat" value={scaledFat} unit="g" bold />
                  <NutritionRow label="  Saturated" value={round((selectedFood.saturated_fat_g || 0) * servings)} unit="g" />
                  <NutritionRow label="  Trans" value={round((selectedFood.trans_fat_g || 0) * servings)} unit="g" />
                  <NutritionRow label="Cholesterol" value={round((selectedFood.cholesterol_mg || 0) * servings)} unit="mg" />
                  <NutritionRow label="Sodium" value={round((selectedFood.sodium_mg || 0) * servings)} unit="mg" />
                  <NutritionRow label="Total Carbs" value={scaledCarbs} unit="g" bold />
                  <NutritionRow label="  Fiber" value={round((selectedFood.dietary_fiber_g || 0) * servings)} unit="g" />
                  <NutritionRow label="  Sugars" value={round((selectedFood.total_sugars_g || 0) * servings)} unit="g" />
                  <NutritionRow label="Protein" value={scaledProtein} unit="g" bold />
                  <div className="w-full h-px my-1" style={{ background: 'rgba(0,0,0,0.06)' }} />
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
                className="w-full h-[52px] rounded-2xl text-[15px] font-bold border-0"
                style={{
                  background: 'linear-gradient(135deg, rgb(34,197,94) 0%, rgb(22,163,74) 100%)',
                  boxShadow: '0 4px 20px rgba(34,197,94,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  color: 'white',
                }}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Apple className="w-5 h-5 mr-2" />
                )}
                Log · {scaledCalories} kcal
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
        .pb-safe { padding-bottom: max(env(safe-area-inset-bottom, 20px), 20px); }
      `}</style>
    </>
  );
};

// ─── Sub-components ───

const MacroPill = ({ label, value, color, pct }: { label: string; value: number; color: string; pct: number }) => (
  <div className="text-center p-2 rounded-xl"
    style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
    <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: color, boxShadow: `0 2px 6px ${color}40` }} />
    <p className="text-xs font-bold text-foreground">{value}g</p>
    <p className="text-[9px] text-muted-foreground">{label} · {pct}%</p>
  </div>
);

const DailyStat = ({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) => (
  <div className="text-center">
    <p className="text-sm font-bold" style={{ color }}>{value}</p>
    <p className="text-[9px] text-muted-foreground">{unit}</p>
  </div>
);

const NutritionRow = ({ label, value, unit, bold }: { label: string; value: number; unit: string; bold?: boolean }) => (
  <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
    <span className={cn("text-xs", bold ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
    <span className={cn("text-xs tabular-nums", bold ? "font-semibold text-foreground" : "text-muted-foreground")}>{value} {unit}</span>
  </div>
);
