require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  const { data, error, count } = await supabase
    .from('profiles')
    .delete({ count: 'exact' })
    .is('username', null);

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(`Deleted ${count} null records.`);
  }
}

cleanup();
