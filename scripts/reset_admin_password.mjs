import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetAdminPassword() {
  const userId = 'f63ab716-d2a5-4e89-b870-9f58064f8e70'; // ID de adm@compromisso.com
  const newPassword = 'compromisso2026';

  console.log(`Redefinindo senha para o usuário ${userId}...`);

  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (error) {
    console.error('Erro ao redefinir senha:', error.message);
    process.exit(1);
  }

  console.log('Senha redefinida com sucesso para: compromisso2026');
}

resetAdminPassword();
