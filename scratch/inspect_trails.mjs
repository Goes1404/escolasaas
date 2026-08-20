import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkTrails() {
  const { data, error } = await supabase
    .from('trails')
    .select('id, title, category, image_url, status, target_audience');
  
  if (error) {
    console.error('Error fetching trails:', error);
    return;
  }
  
  console.log('Trails in database:');
  console.log(JSON.stringify(data, null, 2));
}

checkTrails();
