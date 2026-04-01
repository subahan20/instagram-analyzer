-- Fix: Assign existing orphaned data to the current user
-- Run this if your existing profiles are not showing up after the isolation update.

DO $$ 
DECLARE
    target_user_id UUID;
BEGIN 
    -- 1. Identify the user who should own the orphaned data
    -- We'll take the most recently created user as the target.
    SELECT id INTO target_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        RAISE NOTICE 'Assigning orphaned records to User ID: %', target_user_id;

        -- 2. Update influencers
        UPDATE public.influencers 
        SET user_id = target_user_id 
        WHERE user_id IS NULL;

        -- 3. Update reels
        UPDATE public.reels 
        SET user_id = target_user_id 
        WHERE user_id IS NULL;
    ELSE
        RAISE WARNING 'No users found in auth.users. Cannot assign data.';
    END IF;
END $$;
