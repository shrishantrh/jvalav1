-- Allow users to delete their own profile (needed for account deletion)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- Allow users to delete their own engagement records
CREATE POLICY "Users can delete their own engagement"
ON public.engagement
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own weekly reports
CREATE POLICY "Users can delete their own weekly reports"
ON public.weekly_reports
FOR DELETE
USING (auth.uid() = user_id);