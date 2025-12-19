import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

export const useMedicationLogs = (userId: string | undefined) => {
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    if (!userId) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs((data || []).map(log => ({
        id: log.id,
        medicationName: log.medication_name,
        dosage: log.dosage || 'standard',
        frequency: log.frequency || 'as-needed',
        takenAt: new Date(log.taken_at)
      })));
    } catch (error) {
      console.error('Error fetching medication logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const addLog = useCallback(async (log: Omit<MedicationLog, 'id' | 'takenAt'>) => {
    if (!userId) {
      toast({
        title: "Not logged in",
        description: "Please log in to track medications",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .insert({
          user_id: userId,
          medication_name: log.medicationName,
          dosage: log.dosage,
          frequency: log.frequency,
          taken_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const newLog: MedicationLog = {
        id: data.id,
        medicationName: data.medication_name,
        dosage: data.dosage || 'standard',
        frequency: data.frequency || 'as-needed',
        takenAt: new Date(data.taken_at)
      };

      setLogs(prev => [newLog, ...prev]);

      toast({
        title: "Medication logged",
        description: `${log.medicationName} recorded`
      });
    } catch (error) {
      console.error('Error logging medication:', error);
      toast({
        title: "Error",
        description: "Failed to log medication",
        variant: "destructive"
      });
    }
  }, [userId, toast]);

  return { logs, isLoading, addLog, refetch: fetchLogs };
};
