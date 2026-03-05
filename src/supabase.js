import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Defensive check to prevent crash if placeholders are not replaced
const isPlaceholder = (val) => !val || val.includes('YOUR_SUPABASE') || val === 'undefined'

export const supabase = (!isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (!supabase) {
  console.warn('Supabase credentials missing or invalid. Please check your .env file.')
}
