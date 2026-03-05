-- Create custom_industries table
CREATE TABLE IF NOT EXISTS public.custom_industries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.custom_industries ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read
CREATE POLICY "Allow public read access"
ON public.custom_industries
FOR SELECT
TO public
USING (true);

-- Create policy to allow anyone to insert
CREATE POLICY "Allow public insert access"
ON public.custom_industries
FOR INSERT
TO public
WITH CHECK (true);
