-- Create profiles table for JSONB storage
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id BIGINT REFERENCES public.subcategories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    profile_data JSONB NOT NULL,
    username TEXT -- Added for easier lookup if needed, though redundant with profile_data
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access" ON public.profiles
    FOR SELECT USING (true);

-- Allow public insert (adjust as needed, usually you'd want authenticated only)
CREATE POLICY "Allow public insert access" ON public.profiles
    FOR INSERT WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
