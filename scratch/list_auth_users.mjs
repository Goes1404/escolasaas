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

const { data: users, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error("Erro ao listar:", error);
} else {
  console.log("Users em auth.users:", users.users.map(u => ({ id: u.id, email: u.email })));
}
