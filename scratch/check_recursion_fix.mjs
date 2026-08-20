import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Create a normal client with the anon key (RLS active)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  console.log("Signing in as adm@compromisso.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'adm@compromisso.com',
    password: 'compromisso2026'
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    process.exit(1);
  }

  console.log("Auth success! Signed in user ID:", authData.user.id);
  console.log("Executing profiles query (RLS should evaluate)...");

  // Query profiles (select public.profiles)
  const { data: profiles, error: queryError } = await supabase
    .from('profiles')
    .select('id, name, role')
    .limit(5);

  if (queryError) {
    console.error("QUERY FAILED!");
    console.error(queryError);
    process.exit(1);
  }

  console.log("QUERY SUCCESS! Returned profiles count:", profiles.length);
  console.log("Sample profile:", profiles[0]);
  console.log("\nRLS recursion is successfully resolved!");
}

runTest();
