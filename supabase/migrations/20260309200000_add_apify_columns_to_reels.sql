-- Migration: Add camelCase Apify columns to reels table
-- These columns store the raw Apify field names as-is

ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "likesCount" INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "videoPlayCount" INTEGER DEFAULT 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "commentsCount" INTEGER DEFAULT 0;
