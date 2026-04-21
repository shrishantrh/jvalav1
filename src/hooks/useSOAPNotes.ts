import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SOAPNote {
  id: string;
  patient_id: string;
  clinician_id: string;
  visit_date: string;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  ai_generated: boolean;
  ai_model: string | null;
  ai_evidence_entry_ids: string[];
  status: 'draft' | 'finalized' | 'amended';
  finalized_at: string | null;
  signed_by: string | null;
  signed_clinician_name: string | null;
  signed_clinician_npi: string | null;
  amendment_of: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

export function useSOAPNotes(patientId: string | undefined) {
  const [notes, setNotes] = useState<SOAPNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('soap_notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false });
    setNotes((data || []) as SOAPNote[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const draftWithAI = useCallback(async (chiefComplaint?: string): Promise<SOAPNote | null> => {
    if (!patientId) return null;
    const { data, error } = await supabase.functions.invoke('clinician-soap-draft', {
      body: { patient_id: patientId, chief_complaint: chiefComplaint },
    });
    if (error) throw error;
    await load();
    return data?.note ?? null;
  }, [patientId, load]);

  const updateNote = useCallback(async (id: string, patch: Partial<SOAPNote>) => {
    const { error } = await supabase.from('soap_notes').update(patch).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  const finalize = useCallback(async (id: string, clinicianName: string, npi?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('soap_notes').update({
      status: 'finalized',
      finalized_at: new Date().toISOString(),
      signed_by: user.id,
      signed_clinician_name: clinicianName,
      signed_clinician_npi: npi || null,
    }).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await supabase.from('soap_notes').delete().eq('id', id);
    await load();
  }, [load]);

  return { notes, loading, draftWithAI, updateNote, finalize, remove, refetch: load };
}
