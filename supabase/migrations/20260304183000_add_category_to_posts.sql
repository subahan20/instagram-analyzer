-- Add category column to post_insta_data table
ALTER TABLE post_insta_data 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Software Developer';

-- Update existing records to have the default category if they don't have one
UPDATE post_insta_data 
SET category = 'Software Developer' 
WHERE category IS NULL;
