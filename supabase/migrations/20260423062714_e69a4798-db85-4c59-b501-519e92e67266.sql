
-- Drop the overly restrictive update policy
DROP POLICY IF EXISTS "Clinicians can update their draft SOAP notes" ON public.soap_notes;

-- Allow clinicians to update their own SOAP notes (draft or finalized for amendments)
CREATE POLICY "Clinicians can update their own SOAP notes"
ON public.soap_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = clinician_id);
