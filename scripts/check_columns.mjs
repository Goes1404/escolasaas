import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0)
    process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0]));
}

check();
