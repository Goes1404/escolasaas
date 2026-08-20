import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const email = 'adm@compromisso.com';
  const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
  console.log('--- PERFIL NO BANCO ---');
  console.log(profile);
  
  if (profile) {
    const { data: user, error } = await supabase.auth.admin.getUserById(profile.id);
    console.log('--- USUÁRIO NO AUTH ---');
    if (error) {
      console.error(error);
    } else {
      console.log({
        id: user.user.id,
        email: user.user.email,
        email_confirmed: user.user.email_confirmed_at,
        metadata: user.user.user_metadata,
        last_sign_in: user.user.last_sign_in_at
      });
    }
  }
}

inspect();
