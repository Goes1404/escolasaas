import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envLocalPath = join(__dirname, '../.env.local');

if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// List of profile types that indicate a staff/secretary/support member
const STAFF_PROFILE_TYPES = [
  'secretaria', 
  'agente de organização', 
  'apoio - representante do colégio', 
  'equipe técnica', 
  'assistente'
];

async function run() {
  console.log("--- Fetching all profiles to check roles ---");
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, email, role, profile_type');
    
  if (profErr) {
    console.error("Error fetching profiles:", profErr);
    return;
  }

  // Fetch all auth users to update user_metadata in parallel
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Error listing auth users:", authErr);
    return;
  }

  for (const profile of profiles) {
    const pt = (profile.profile_type || '').toLowerCase().trim();
    
    // Check if the profile_type matches any staff types, and if the current role is not 'staff'
    if (STAFF_PROFILE_TYPES.includes(pt) && profile.role !== 'staff') {
      console.log(`\nFound staff member with incorrect role: ${profile.name} (${profile.email})`);
      console.log(`- Current DB Role: ${profile.role}`);
      console.log(`- Profile Type: ${profile.profile_type}`);

      // 1. Update auth.users metadata
      const authUser = users.find(u => u.id === profile.id);
      if (authUser) {
        console.log(`- Updating auth user metadata for ${profile.email}...`);
        const { error: authUpErr } = await supabase.auth.admin.updateUserById(profile.id, {
          user_metadata: {
            ...authUser.user_metadata,
            role: 'staff',
            profile_type: 'staff'
          }
        });
        if (authUpErr) {
          console.error(`  Error updating auth user:`, authUpErr);
        } else {
          console.log(`  Auth user metadata updated successfully!`);
        }
      }

      // 2. Update profiles table row
      console.log(`- Updating profiles table row for ${profile.name}...`);
      const { error: dbUpErr } = await supabase
        .from('profiles')
        .update({
          role: 'staff',
          profile_type: 'staff' // Map to standardized 'staff' profile_type too
        })
        .eq('id', profile.id);
        
      if (dbUpErr) {
        console.error(`  Error updating profiles table:`, dbUpErr);
      } else {
        console.log(`  Profiles table updated successfully!`);
      }
    }
  }

  console.log("\n--- Update run completed ---");
}

run();
