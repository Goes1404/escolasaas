import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'anajf@compromisso.com',
  password: 'compromisso2026',
});

if (error) {
  console.error("Erro no login:", error.message);
} else {
  console.log("Login com sucesso! User ID:", data.user.id);
}
