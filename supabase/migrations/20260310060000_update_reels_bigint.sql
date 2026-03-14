-- Migration: Update reels view columns to BIGINT to prevent overflow
-- Some reels have billions of views which exceed the INTEGER limit (2.1B)

ALTER TABLE public.reels ALTER COLUMN views TYPE BIGINT;
ALTER TABLE public.reels ALTER COLUMN "videoPlayCount" TYPE BIGINT;
