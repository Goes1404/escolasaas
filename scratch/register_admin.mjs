import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const accounts = [
  {
    id: 'f63ab716-d2a5-4e89-b870-9f58064f8e70',
    email: 'adm@compromisso.com',
    fullName: 'Administrador do Sistema',
    role: 'admin',
    profileType: 'admin'
  },
  {
    id: 'd1f94bf8-3196-432b-83a4-3b5f1114ff16',
    email: 'denis@compromissose.com',
    fullName: 'Denis de Jesus Brito',
    role: 'teacher',
    profileType: 'teacher'
  },
  {
    id: 'bcfcbfe9-0d0c-4b16-9724-6f106c12be03',
    email: 'paulobaraujo@compromisso.com',
    fullName: 'Paulobaraujo',
    role: 'teacher',
    profileType: 'teacher'
  }
];

async function registerAccounts() {
  console.log("Registering admin/teacher auth accounts...");
  const password = "Compromisso2026!";

  for (const acc of accounts) {
    console.log(`\nRegistering ${acc.email} (${acc.fullName})...`);

    // Attempt to create user
    const { data, error } = await supabase.auth.admin.createUser({
      id: acc.id,
      email: acc.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: acc.role,
        profile_type: acc.profileType,
        full_name: acc.fullName
      }
    });

    if (error) {
      console.error(`Failed to register ${acc.email}:`, error.message);
    } else {
      console.log(`Successfully registered ${acc.email}! Auth ID matched: ${data.user.id}`);
    }
  }
  
  console.log("\nFinished registration operations.");
}

registerAccounts();
