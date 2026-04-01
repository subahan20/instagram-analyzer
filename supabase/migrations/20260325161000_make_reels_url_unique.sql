-- Migration: Ensure reel_url is unique to support non-destructive upserts
-- This allows us to keep historical reels even if they fall out of the "latest posts" window.

ALTER TABLE public.reels ADD CONSTRAINT reels_reel_url_key UNIQUE (reel_url);
