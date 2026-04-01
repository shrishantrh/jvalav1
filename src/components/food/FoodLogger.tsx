import React, { useState, useRef, useMemo } from 'react';
import { X, Camera, Search, Plus, Minus, Trash2, Loader2, UtensilsCrossed, Apple, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useFoodLogs, FoodSearchResult } from '@/hooks/useFoodLogs';
import { useToast } from '@/hooks/use-toast';

interface FoodLoggerProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: '☀️' },
  { value: 'dinner', label: 'Dinner', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍿' },
];

export const FoodLogger = ({ userId, open, onClose, onLogged }: FoodLoggerProps) => {
  const { addFoodLog, searchFood, analyzePhoto } = useFoodLogs(userId);
  const { toast } = useToast();
  
  const [step, setStep] = useState<'search' | 'review' | 'nutrition'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [mealType, setMealType] = useState<MealType>('snack');
  const [servings, setServings] = useState(1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFullNutrition, setShowFullNutrition] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-detect meal type based on time
  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) setMealType('breakfast');
    else if (hour >= 11 && hour < 15) setMealType('lunch');
    else if (hour >= 17 && hour < 22) setMealType('dinner');
    else setMealType('snack');
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
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
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoUrl(compressed);
        setAnalyzingPhoto(true);
        
        try {
          const result = await analyzePhoto(compressed);
          if (result?.items?.length) {
            const item = result.items[0];
            setSelectedFood({
              ...item,
              image_url: null,
              barcode: item.detected_barcode || null,
            });
            setStep('review');
            haptics.success();
            toast({ title: `Found: ${item.food_name}`, description: `${item.calories || '?'} kcal` });
          } else {
            toast({ title: "Couldn't identify food", description: "Try searching manually", variant: "destructive" });
          }
        } catch (e) {
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
      photos: photoUrl ? [photoUrl.slice(0, 200)] : null, // Don't store full data url
    } as any);

    setSaving(false);

    if (result) {
      haptics.success();
      toast({ title: "Food logged!", description: `${selectedFood.food_name} — ${Math.round((selectedFood.calories || 0) * servings)} kcal` });
      onLogged?.();
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
    setShowFullNutrition(false);
  };

  const scaledCalories = Math.round((selectedFood?.calories || 0) * servings);
  const scaledFat = Math.round((selectedFood?.total_fat_g || 0) * servings * 10) / 10;
  const scaledCarbs = Math.round((selectedFood?.total_carbs_g || 0) * servings * 10) / 10;
  const scaledProtein = Math.round((selectedFood?.protein_g || 0) * servings * 10) / 10;
  const macroTotal = scaledFat * 9 + scaledCarbs * 4 + scaledProtein * 4 || 1;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-3 border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={() => { handleReset(); onClose(); }}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Log Food</h2>
        {step !== 'search' ? (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground">
            Reset
          </Button>
        ) : <div className="w-10" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ─── Search Step ─── */}
        {step === 'search' && (
          <div className="p-4 space-y-4">
            {/* Meal Type Selector */}
            <div className="flex gap-2">
              {MEAL_TYPES.map(mt => (
                <button
                  key={mt.value}
                  onClick={() => { setMealType(mt.value); haptics.selection(); }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-medium transition-all",
                    mealType === mt.value
                      ? "bg-primary/15 text-primary border-2 border-primary/30"
                      : "bg-card border border-border/50 text-muted-foreground"
                  )}
                >
                  <span className="text-sm">{mt.icon}</span>
                  <br />
                  {mt.label}
                </button>
              ))}
            </div>

            {/* Photo / Camera */}
            <div className="flex gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
              <Button
                variant="outline"
                className="flex-1 h-20 rounded-2xl border-dashed border-2 flex-col gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzingPhoto}
              >
                {analyzingPhoto ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-primary" />
                    <span className="text-xs text-muted-foreground">Take Photo</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-20 rounded-2xl border-dashed border-2 flex-col gap-1"
                onClick={() => {
                  // For barcode, we use the same camera but instruct user
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.capture = 'environment';
                  input.onchange = (e: any) => handlePhotoCapture(e);
                  input.click();
                }}
                disabled={analyzingPhoto}
              >
                <UtensilsCrossed className="w-6 h-6 text-primary" />
                <span className="text-xs text-muted-foreground">Scan Label</span>
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search food or paste barcode..."
                className="pl-10 h-12 rounded-2xl bg-card"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
              )}
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {searchResults.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectFood(item)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all text-left"
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-muted" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Apple className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.food_name}</p>
                    {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand}</p>}
                    <div className="flex gap-2 mt-0.5">
                      {item.calories && <span className="text-xs text-primary font-medium">{Math.round(item.calories)} kcal</span>}
                      {item.serving_size && <span className="text-xs text-muted-foreground">per {item.serving_size}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No results found. Try a different search or take a photo.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─── Review Step ─── */}
        {step === 'review' && selectedFood && (
          <div className="p-4 space-y-4">
            {/* Food Header */}
            <Card className="p-4 bg-card border-0 shadow-soft rounded-2xl">
              <div className="flex items-start gap-3">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
                ) : selectedFood.image_url ? (
                  <img src={selectedFood.image_url} alt="" className="w-16 h-16 rounded-xl object-cover bg-muted" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Apple className="w-7 h-7 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base">{selectedFood.food_name}</h3>
                  {selectedFood.brand && (
                    <p className="text-sm text-muted-foreground">{selectedFood.brand}</p>
                  )}
                  {selectedFood.serving_size && (
                    <Badge variant="outline" className="mt-1 text-xs">{selectedFood.serving_size}</Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Macro Ring + Summary */}
            <Card className="p-4 bg-card border-0 shadow-soft rounded-2xl">
              <div className="flex items-center gap-4">
                {/* Simple macro visualization */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    {/* Fat arc (orange) */}
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#F97316" strokeWidth="3"
                      strokeDasharray={`${(scaledFat * 9 / macroTotal) * 94.2} 94.2`} strokeLinecap="round" />
                    {/* Carbs arc (blue) */}
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#3B82F6" strokeWidth="3"
                      strokeDasharray={`${(scaledCarbs * 4 / macroTotal) * 94.2} 94.2`}
                      strokeDashoffset={`${-(scaledFat * 9 / macroTotal) * 94.2}`} strokeLinecap="round" />
                    {/* Protein arc (pink) */}
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#EC4899" strokeWidth="3"
                      strokeDasharray={`${(scaledProtein * 4 / macroTotal) * 94.2} 94.2`}
                      strokeDashoffset={`${-((scaledFat * 9 + scaledCarbs * 4) / macroTotal) * 94.2}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">{scaledCalories}</span>
                    <span className="text-[9px] text-muted-foreground">kcal</span>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-[#F97316] font-semibold">Fat</p>
                    <p className="text-base font-bold">{scaledFat}g</p>
                    <p className="text-[10px] text-muted-foreground">{macroTotal > 1 ? Math.round((scaledFat * 9 / macroTotal) * 100) : 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#3B82F6] font-semibold">Carbs</p>
                    <p className="text-base font-bold">{scaledCarbs}g</p>
                    <p className="text-[10px] text-muted-foreground">{macroTotal > 1 ? Math.round((scaledCarbs * 4 / macroTotal) * 100) : 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#EC4899] font-semibold">Protein</p>
                    <p className="text-base font-bold">{scaledProtein}g</p>
                    <p className="text-[10px] text-muted-foreground">{macroTotal > 1 ? Math.round((scaledProtein * 4 / macroTotal) * 100) : 0}%</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Servings Control */}
            <Card className="p-4 bg-card border-0 shadow-soft rounded-2xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Servings</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => { setServings(Math.max(0.25, servings - 0.25)); haptics.light(); }}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-lg font-bold w-10 text-center">{servings}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => { setServings(servings + 0.25); haptics.light(); }}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Meal Type */}
            <Card className="p-4 bg-card border-0 shadow-soft rounded-2xl">
              <p className="text-sm font-medium mb-2">Meal</p>
              <div className="flex gap-2">
                {MEAL_TYPES.map(mt => (
                  <button
                    key={mt.value}
                    onClick={() => { setMealType(mt.value); haptics.selection(); }}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-medium transition-all",
                      mealType === mt.value
                        ? "bg-primary/15 text-primary border-2 border-primary/30"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {mt.icon} {mt.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Full Nutrition Details (collapsible) */}
            <button
              onClick={() => setShowFullNutrition(!showFullNutrition)}
              className="flex items-center justify-between w-full p-4 bg-card rounded-2xl border-0 shadow-soft"
            >
              <span className="text-sm font-medium">Full Nutrition Facts</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showFullNutrition && "rotate-180")} />
            </button>

            {showFullNutrition && (
              <Card className="p-4 bg-card border-0 shadow-soft rounded-2xl">
                <NutritionRow label="Calories" value={scaledCalories} unit="kcal" bold />
                <div className="w-full h-px bg-primary my-2" />
                <NutritionRow label="Total Fat" value={scaledFat} unit="g" bold />
                <NutritionRow label="Saturated Fat" value={round((selectedFood.saturated_fat_g || 0) * servings)} unit="g" indent />
                <NutritionRow label="Trans Fat" value={round((selectedFood.trans_fat_g || 0) * servings)} unit="g" indent />
                <NutritionRow label="Cholesterol" value={round((selectedFood.cholesterol_mg || 0) * servings)} unit="mg" bold />
                <NutritionRow label="Sodium" value={round((selectedFood.sodium_mg || 0) * servings)} unit="mg" bold />
                <NutritionRow label="Total Carbohydrates" value={scaledCarbs} unit="g" bold />
                <NutritionRow label="Dietary Fiber" value={round((selectedFood.dietary_fiber_g || 0) * servings)} unit="g" indent />
                <NutritionRow label="Total Sugars" value={round((selectedFood.total_sugars_g || 0) * servings)} unit="g" indent />
                <NutritionRow label="Added Sugars" value={round((selectedFood.added_sugars_g || 0) * servings)} unit="g" indent />
                <NutritionRow label="Protein" value={scaledProtein} unit="g" bold />
                <div className="w-full h-px bg-border my-2" />
                <NutritionRow label="Vitamin D" value={round((selectedFood.vitamin_d_mcg || 0) * servings, 1)} unit="mcg" />
                <NutritionRow label="Calcium" value={round((selectedFood.calcium_mg || 0) * servings)} unit="mg" />
                <NutritionRow label="Iron" value={round((selectedFood.iron_mg || 0) * servings, 1)} unit="mg" />
                <NutritionRow label="Potassium" value={round((selectedFood.potassium_mg || 0) * servings)} unit="mg" />
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action */}
      {step === 'review' && selectedFood && (
        <div className="p-4 border-t border-border/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
          <Button
            onClick={handleLog}
            disabled={saving}
            className="w-full h-14 rounded-2xl text-base font-semibold"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Apple className="w-5 h-5 mr-2" />
            )}
            Add to Log • {scaledCalories} kcal
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ───

const round = (v: number, decimals = 0) => Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);

const NutritionRow = ({ label, value, unit, bold, indent }: { label: string; value: number; unit: string; bold?: boolean; indent?: boolean }) => (
  <div className={cn("flex justify-between py-1.5 border-b border-border/30 last:border-0", indent && "pl-4")}>
    <span className={cn("text-sm", bold ? "font-semibold" : "text-muted-foreground")}>{label}</span>
    <span className={cn("text-sm", bold && "font-semibold")}>{value}{unit}</span>
  </div>
);
