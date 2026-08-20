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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const emails = [
  'adm@compromisso.com',
  'professor@compromisso.com',
  'secretaria@compromisso.com',
  'priscila@compromisso.com',
  'priscilaadm@compromisso.com',
  'priscilaprof@compromisso.com'
];

async function run() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  
  for (const email of emails) {
    console.log(`\n=== Checking: ${email} ===`);
    const authUser = users.find(u => u.email === email);
    console.log("Auth User:", authUser ? { id: authUser.id, email: authUser.email, metadata: authUser.user_metadata } : "not found in auth.users");
    
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    console.log("Profile:", profile ? { id: profile.id, email: profile.email, role: profile.role, profile_type: profile.profile_type } : "not found in profiles");
  }
}

run();
