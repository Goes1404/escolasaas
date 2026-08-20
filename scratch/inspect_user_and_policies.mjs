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

async function run() {
  console.log("--- Supabase connection info ---");
  console.log("URL:", supabaseUrl);

  console.log("\n--- Policies on class_sessions ---");
  const { data: policies, error: polErr } = await supabase.rpc('get_policies'); // may fail if get_policies rpc doesn't exist
  if (polErr) {
    // query using postgres system tables
    console.log("RPC get_policies failed, running SQL query via direct SELECT on pg_policies...");
    // Since we don't have direct SQL execution RPC by default unless we define one,
    // let's try calling a query using pg_catalog if exposed, otherwise we can inspect other things.
  }

  // Let's inspect all roles in profiles table
  console.log("\n--- Active profiles list ---");
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, email, role, profile_type')
    .limit(10);
  if (profErr) {
    console.error("Error fetching profiles:", profErr);
  } else {
    console.log(profiles);
  }

  // Let's inspect class sessions in database
  console.log("\n--- Class sessions list ---");
  const { data: sessions, error: sessErr } = await supabase
    .from('class_sessions')
    .select('id, title, teacher_id, class_label')
    .limit(5);
  if (sessErr) {
    console.error("Error fetching sessions:", sessErr);
  } else {
    console.log(sessions);
  }
}

run();
