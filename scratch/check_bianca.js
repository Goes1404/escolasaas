
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBianca() {
  console.log("Searching for Bianca (fuzzier)...");
  
  // Search in profiles
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .or('name.ilike.%Bianca%,name.ilike.%Souza%,name.ilike.%Sousa%');
    
  if (pError) console.error("Profile error:", pError);
  console.log("Profiles found count:", profiles?.length);
  
  const matches = profiles?.filter(p => p.name.toLowerCase().includes('bianca'));
  console.log("Matches:", matches);

  for (const p of matches || []) {
    const { data: authUser, error: aError } = await supabase.auth.admin.getUserById(p.id);
    if (aError) console.log(`Auth for ${p.name} (id: ${p.id}) failed: ${aError.message}`);
    else console.log(`Profile: ${p.name}, Auth Email: ${authUser.user.email}`);
  }
}

checkBianca();
