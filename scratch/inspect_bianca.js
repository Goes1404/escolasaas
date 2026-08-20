
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectBianca() {
  const id = 'd43a9e67-f7cb-4f2a-a2cc-2f633f8dc7ab';
  const { data: authUser, error: aError } = await supabase.auth.admin.getUserById(id);
  
  if (aError) {
    console.error("Auth error:", aError);
  } else {
    console.log("Auth User metadata:", authUser.user.user_metadata);
    console.log("Auth User email confirmed:", authUser.user.email_confirmed_at);
  }
}

inspectBianca();
