import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: profiles, error } = await supabase
  .from('profiles')
  .select('email, full_name, profile_type')
  .eq('profile_type', 'student')
  .limit(3);

if (error) {
  console.error("Erro ao buscar estudantes:", error);
} else {
  console.log("Estudantes encontrados:", profiles);
}
