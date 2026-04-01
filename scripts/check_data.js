import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  const { data, error } = await supabase.from('influencers').select('username, user_id').limit(5);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Influencers Sample:', data);
  }
}

checkData();
