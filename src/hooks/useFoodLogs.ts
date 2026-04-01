import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FoodLog {
  id: string;
  user_id: string;
  food_name: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  meal_type: string;
  serving_size: string | null;
  servings: number;
  calories: number | null;
  total_fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  total_carbs_g: number | null;
  dietary_fiber_g: number | null;
  total_sugars_g: number | null;
  added_sugars_g: number | null;
  protein_g: number | null;
  vitamin_d_mcg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  potassium_mg: number | null;
  vitamin_a_mcg: number | null;
  vitamin_c_mg: number | null;
  photos: string[] | null;
  ai_confidence: number | null;
  logged_at: string;
  created_at: string;
}

export interface FoodSearchResult {
  food_name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: string | null;
  image_url: string | null;
  calories: number | null;
  total_fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  total_carbs_g: number | null;
  dietary_fiber_g: number | null;
  total_sugars_g: number | null;
  added_sugars_g: number | null;
  protein_g: number | null;
  vitamin_d_mcg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  potassium_mg: number | null;
  vitamin_a_mcg: number | null;
  vitamin_c_mg: number | null;
}

export function useFoodLogs(userId: string | undefined) {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadLogs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setLogs((data as any[]) || []);
    } catch (e) {
      console.error('Failed to load food logs:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const addFoodLog = async (log: Partial<FoodLog>) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('food_logs')
        .insert({ ...log, user_id: userId } as any)
        .select()
        .single();
      if (error) throw error;
      setLogs(prev => [data as any, ...prev]);
      return data;
    } catch (e: any) {
      console.error('Failed to add food log:', e);
      toast({ title: "Error", description: "Failed to log food", variant: "destructive" });
      return null;
    }
  };

  const deleteFoodLog = async (id: string) => {
    try {
      const { error } = await supabase.from('food_logs').delete().eq('id', id);
      if (error) throw error;
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      console.error('Failed to delete food log:', e);
    }
  };

  const searchFood = async (query: string): Promise<FoodSearchResult[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-food', {
        body: { action: 'search', query },
      });
      if (error) throw error;
      return data?.items || [];
    } catch (e) {
      console.error('Food search error:', e);
      return [];
    }
  };

  const lookupBarcode = async (barcode: string): Promise<FoodSearchResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-food', {
        body: { action: 'barcode', barcode },
      });
      if (error) throw error;
      return data?.item || null;
    } catch (e) {
      console.error('Barcode lookup error:', e);
      return null;
    }
  };

  const analyzePhoto = async (imageDataUrl: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-food', {
        body: { action: 'analyze_photo', imageDataUrl },
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Photo analysis error:', e);
      return null;
    }
  };

  // Daily nutrition summary
  const getDailySummary = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.logged_at.startsWith(dateStr));
    
    return {
      totalCalories: dayLogs.reduce((s, l) => s + (Number(l.calories) || 0) * (Number(l.servings) || 1), 0),
      totalFat: dayLogs.reduce((s, l) => s + (Number(l.total_fat_g) || 0) * (Number(l.servings) || 1), 0),
      totalCarbs: dayLogs.reduce((s, l) => s + (Number(l.total_carbs_g) || 0) * (Number(l.servings) || 1), 0),
      totalProtein: dayLogs.reduce((s, l) => s + (Number(l.protein_g) || 0) * (Number(l.servings) || 1), 0),
      totalSugar: dayLogs.reduce((s, l) => s + (Number(l.total_sugars_g) || 0) * (Number(l.servings) || 1), 0),
      totalSodium: dayLogs.reduce((s, l) => s + (Number(l.sodium_mg) || 0) * (Number(l.servings) || 1), 0),
      totalFiber: dayLogs.reduce((s, l) => s + (Number(l.dietary_fiber_g) || 0) * (Number(l.servings) || 1), 0),
      logCount: dayLogs.length,
      meals: dayLogs,
    };
  };

  return {
    logs,
    loading,
    addFoodLog,
    deleteFoodLog,
    searchFood,
    lookupBarcode,
    analyzePhoto,
    getDailySummary,
    reload: loadLogs,
  };
}
