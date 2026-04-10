-- Migration: Globalize Reels Access
-- This migration relaxes the RLS policy on the reels table to allow all authenticated users
-- to view reels synced by any other user. This enables a shared content pool while 
-- maintaining private "Followed" lists in the influencers table.

-- 1. Update SELECT policy for reels
DROP POLICY IF EXISTS "Users can only see their own reels" ON public.reels;

CREATE POLICY "Allow authenticated users to see all reels" ON public.reels
    FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Ensure Insert/Update/Delete remain restricted to the owner
-- These policies already exist from the 'restore_user_isolation' migration, 
-- but we ensure they stay owner-only for security.
-- "Users can only insert their own reels" (auth.uid() = user_id)
-- "Users can only update their own reels" (auth.uid() = user_id)
-- "Users can only delete their own reels" (auth.uid() = user_id)
