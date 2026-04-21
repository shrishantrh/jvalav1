import { supabase } from '@/integrations/supabase/client';

/**
 * HIPAA-style audit logger. Fire-and-forget.
 */
export async function logClinicianAction(args: {
  patient_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('clinician_audit_log').insert({
      clinician_id: user.id,
      patient_id: args.patient_id || null,
      action: args.action,
      resource_type: args.resource_type || null,
      resource_id: args.resource_id || null,
      metadata: args.metadata || {},
      user_agent: navigator.userAgent,
    });
  } catch (e) {
    // Non-blocking
    console.warn('Audit log failed:', e);
  }
}
