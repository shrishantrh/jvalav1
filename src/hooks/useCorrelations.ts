import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FlareEntry } from '@/types/flare';

export interface Correlation {
  id: string;
  user_id: string;
  trigger_type: 'activity' | 'food' | 'weather' | 'medication' | 'time_of_day';
  trigger_value: string;
  outcome_type: 'symptom' | 'flare' | 'severity';
  outcome_value: string;
  avg_delay_minutes: number;
  occurrence_count: number;
  confidence: number;
  last_occurred: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  activity_value?: string;
  duration_minutes?: number;
  intensity?: 'low' | 'moderate' | 'high';
  timestamp: string;
  followed_up: boolean;
  follow_up_result?: any;
  metadata?: any;
  created_at: string;
}

interface UseCorrelationsReturn {
  correlations: Correlation[];
  topCorrelations: Correlation[];
  recentActivities: ActivityLog[];
  pendingFollowUps: ActivityLog[];
  isLoading: boolean;
  error: string | null;
  logActivity: (activity: Omit<ActivityLog, 'id' | 'user_id' | 'created_at' | 'followed_up'>) => Promise<ActivityLog | null>;
  markActivityFollowedUp: (activityId: string, result: any) => Promise<void>;
  buildCorrelation: (trigger: { type: string; value: string }, outcome: { type: string; value: string }, delayMinutes: number) => Promise<Correlation | null>;
  analyzeCorrelations: (entries: FlareEntry[]) => Promise<void>;
  getCorrelationsForTrigger: (triggerType: string, triggerValue: string) => Correlation[];
  getHighConfidenceCorrelations: (minConfidence?: number) => Correlation[];
  refreshCorrelations: () => Promise<void>;
}

// Activity detection patterns
const ACTIVITY_PATTERNS = [
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' as const },
  { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' as const },
  { pattern: /(?:just\s+)?(?:finished|completed|did)\s+(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' as const },
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' as const },
  { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' as const },
  { pattern: /(?:just\s+)?(?:finished|completed|did)\s+(?:a\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' as const },
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:the\s+)?(gym|workout|exercise)/i, type: 'gym', intensity: 'high' as const },
  { pattern: /(?:went|going|gone)\s+(?:to\s+)?(?:the\s+)?(gym)/i, type: 'gym', intensity: 'high' as const },
  { pattern: /(?:just\s+)?(?:finished|completed|did)\s+(?:a\s+)?(workout|exercise)/i, type: 'gym', intensity: 'high' as const },
  { pattern: /(?:woke\s+up|just\s+woke|got\s+up)/i, type: 'sleep', intensity: 'low' as const },
  { pattern: /(?:slept|sleep)\s+(?:for\s+)?(\d+)\s*(?:hours?|hrs?)/i, type: 'sleep', intensity: 'low' as const },
  { pattern: /(?:ate|eating|had)\s+(?:some\s+)?(?:a\s+)?(.+?)(?:\s+for\s+)?(?:breakfast|lunch|dinner|meal)?/i, type: 'eat', intensity: 'low' as const },
  { pattern: /(?:finished|back\s+from|done\s+with)\s+work/i, type: 'work', intensity: 'moderate' as const },
  { pattern: /(?:long|tough|stressful)\s+(?:day\s+at\s+)?work/i, type: 'work', intensity: 'high' as const },
  { pattern: /(?:commute|commuting|drove|driving)\s+(?:to|from|home)/i, type: 'commute', intensity: 'low' as const },
  { pattern: /(?:stressed|stress|anxious|anxiety)/i, type: 'stress', intensity: 'high' as const },
  { pattern: /(?:yoga|meditation|meditate)/i, type: 'relaxation', intensity: 'low' as const },
  { pattern: /(?:swimming|swam|swim)/i, type: 'swim', intensity: 'moderate' as const },
  { pattern: /(?:cycling|cycled|biking|biked|bike)/i, type: 'cycling', intensity: 'moderate' as const },
  { pattern: /(?:hiking|hiked|hike)/i, type: 'hike', intensity: 'high' as const },
];

export function detectActivity(message: string): { type: string; intensity: 'low' | 'moderate' | 'high'; value?: string } | null {
  const lower = message.toLowerCase();
  
  for (const { pattern, type, intensity } of ACTIVITY_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      return { 
        type, 
        intensity,
        value: match[1] || undefined
      };
    }
  }
  
  return null;
}

// Calculate confidence based on occurrence count and recency
function calculateConfidence(occurrenceCount: number, daysSinceLastOccurrence: number): number {
  // Base confidence from occurrence count (logarithmic scale)
  const countScore = Math.min(Math.log2(occurrenceCount + 1) / 5, 0.7);
  
  // Recency bonus (up to 0.3)
  const recencyScore = Math.max(0, 0.3 - (daysSinceLastOccurrence / 30) * 0.3);
  
  return Math.min(countScore + recencyScore, 1.0);
}

export function useCorrelations(userId: string | null): UseCorrelationsReturn {
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch correlations
  const fetchCorrelations = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('correlations')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      setCorrelations((data as Correlation[]) || []);
    } catch (e) {
      console.error('Error fetching correlations:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch correlations');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch recent activities
  const fetchActivities = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error: fetchError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (fetchError) throw fetchError;
      
      setRecentActivities((data as ActivityLog[]) || []);
    } catch (e) {
      console.error('Error fetching activities:', e);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchCorrelations();
      fetchActivities();
    }
  }, [userId, fetchCorrelations, fetchActivities]);

  // Log a new activity
  const logActivity = useCallback(async (
    activity: Omit<ActivityLog, 'id' | 'user_id' | 'created_at' | 'followed_up'>
  ): Promise<ActivityLog | null> => {
    if (!userId) return null;
    
    try {
      const { data, error: insertError } = await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          activity_type: activity.activity_type,
          activity_value: activity.activity_value,
          duration_minutes: activity.duration_minutes,
          intensity: activity.intensity,
          timestamp: activity.timestamp,
          followed_up: false,
          metadata: activity.metadata || {},
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      const newActivity = data as ActivityLog;
      setRecentActivities(prev => [newActivity, ...prev]);
      
      return newActivity;
    } catch (e) {
      console.error('Error logging activity:', e);
      return null;
    }
  }, [userId]);

  // Mark an activity as followed up
  const markActivityFollowedUp = useCallback(async (activityId: string, result: any) => {
    try {
      const { error: updateError } = await supabase
        .from('activity_logs')
        .update({ 
          followed_up: true, 
          follow_up_result: result 
        })
        .eq('id', activityId);
      
      if (updateError) throw updateError;
      
      setRecentActivities(prev => 
        prev.map(a => a.id === activityId 
          ? { ...a, followed_up: true, follow_up_result: result } 
          : a
        )
      );
    } catch (e) {
      console.error('Error marking activity as followed up:', e);
    }
  }, []);

  // Build or update a correlation
  const buildCorrelation = useCallback(async (
    trigger: { type: string; value: string },
    outcome: { type: string; value: string },
    delayMinutes: number
  ): Promise<Correlation | null> => {
    if (!userId) return null;
    
    try {
      // Check if correlation already exists
      const { data: existing } = await supabase
        .from('correlations')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', trigger.type)
        .eq('trigger_value', trigger.value)
        .eq('outcome_type', outcome.type)
        .eq('outcome_value', outcome.value)
        .maybeSingle();
      
      if (existing) {
        // Update existing correlation
        const newCount = (existing as Correlation).occurrence_count + 1;
        const currentAvgDelay = (existing as Correlation).avg_delay_minutes;
        const newAvgDelay = Math.round((currentAvgDelay * (newCount - 1) + delayMinutes) / newCount);
        const daysSinceLastOccurrence = 0; // Just occurred
        const newConfidence = calculateConfidence(newCount, daysSinceLastOccurrence);
        
        const { data: updated, error: updateError } = await supabase
          .from('correlations')
          .update({
            occurrence_count: newCount,
            avg_delay_minutes: newAvgDelay,
            confidence: newConfidence,
            last_occurred: new Date().toISOString(),
          })
          .eq('id', (existing as Correlation).id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        
        const updatedCorrelation = updated as Correlation;
        setCorrelations(prev => 
          prev.map(c => c.id === updatedCorrelation.id ? updatedCorrelation : c)
        );
        
        return updatedCorrelation;
      } else {
        // Create new correlation
        const newConfidence = calculateConfidence(1, 0);
        
        const { data: created, error: createError } = await supabase
          .from('correlations')
          .insert({
            user_id: userId,
            trigger_type: trigger.type,
            trigger_value: trigger.value,
            outcome_type: outcome.type,
            outcome_value: outcome.value,
            avg_delay_minutes: delayMinutes,
            occurrence_count: 1,
            confidence: newConfidence,
            last_occurred: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        const newCorrelation = created as Correlation;
        setCorrelations(prev => [newCorrelation, ...prev]);
        
        return newCorrelation;
      }
    } catch (e) {
      console.error('Error building correlation:', e);
      return null;
    }
  }, [userId]);

  // Analyze entries to build correlations automatically
  const analyzeCorrelations = useCallback(async (entries: FlareEntry[]) => {
    if (!userId || entries.length < 2) return;
    
    const flareEntries = entries.filter(e => e.type === 'flare' && e.severity);
    const activityEntries = recentActivities;
    
    // Find activities that preceded flares
    for (const flare of flareEntries) {
      const flareTime = new Date(flare.timestamp).getTime();
      
      // Check activities in the 24 hours before the flare
      for (const activity of activityEntries) {
        const activityTime = new Date(activity.timestamp).getTime();
        const delayMinutes = (flareTime - activityTime) / (1000 * 60);
        
        // Activity should be 15 min to 24 hours before the flare
        if (delayMinutes > 15 && delayMinutes < 1440) {
          // Build correlation for activity → symptom
          for (const symptom of (flare.symptoms || [])) {
            await buildCorrelation(
              { type: 'activity', value: activity.activity_type },
              { type: 'symptom', value: symptom },
              Math.round(delayMinutes)
            );
          }
          
          // Build correlation for activity → severity
          await buildCorrelation(
            { type: 'activity', value: activity.activity_type },
            { type: 'severity', value: flare.severity || 'moderate' },
            Math.round(delayMinutes)
          );
        }
      }
      
      // Check triggers in the flare entry
      for (const trigger of (flare.triggers || [])) {
        for (const symptom of (flare.symptoms || [])) {
          await buildCorrelation(
            { type: 'food', value: trigger },
            { type: 'symptom', value: symptom },
            0
          );
        }
      }
    }
  }, [userId, recentActivities, buildCorrelation]);

  // Get correlations for a specific trigger
  const getCorrelationsForTrigger = useCallback((
    triggerType: string, 
    triggerValue: string
  ): Correlation[] => {
    return correlations.filter(c => 
      c.trigger_type === triggerType && 
      c.trigger_value.toLowerCase() === triggerValue.toLowerCase()
    );
  }, [correlations]);

  // Get high confidence correlations
  const getHighConfidenceCorrelations = useCallback((minConfidence = 0.4): Correlation[] => {
    return correlations.filter(c => c.confidence >= minConfidence && c.occurrence_count >= 3);
  }, [correlations]);

  // Get pending follow-ups (activities in last 2 hours not yet followed up)
  const pendingFollowUps = recentActivities.filter(a => {
    if (a.followed_up) return false;
    const hoursSince = (Date.now() - new Date(a.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSince >= 0.5 && hoursSince <= 4; // 30 min to 4 hours after activity
  });

  // Get top correlations (high confidence + high count)
  const topCorrelations = correlations
    .filter(c => c.confidence >= 0.3 && c.occurrence_count >= 2)
    .slice(0, 10);

  return {
    correlations,
    topCorrelations,
    recentActivities,
    pendingFollowUps,
    isLoading,
    error,
    logActivity,
    markActivityFollowedUp,
    buildCorrelation,
    analyzeCorrelations,
    getCorrelationsForTrigger,
    getHighConfidenceCorrelations,
    refreshCorrelations: fetchCorrelations,
  };
}
