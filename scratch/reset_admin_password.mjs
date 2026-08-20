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

async function resetPassword() {
  const accounts = [
    { id: 'f63ab716-d2a5-4e89-b870-9f58064f8e70', email: 'adm@compromisso.com' },
    { id: 'd1f94bf8-3196-432b-83a4-3b5f1114ff16', email: 'denis@compromissose.com' },
    { id: 'bcfcbfe9-0d0c-4b16-9724-6f106c12be03', email: 'paulobaraujo@compromisso.com' }
  ];
  const newPassword = 'compromisso2026';

  for (const acc of accounts) {
    console.log(`Resetting password for ${acc.email} directly by ID ${acc.id} in Supabase Auth...`);
    const { error } = await supabase.auth.admin.updateUserById(
      acc.id,
      { password: newPassword }
    );

    if (error) {
      console.error(`Failed to update password for ${acc.email}:`, error.message);
    } else {
      console.log(`SUCCESS! Password for ${acc.email} has been updated to "${newPassword}".`);
    }
  }
}

resetPassword();
