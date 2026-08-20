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

// Pega o ID do auth.users
const { data: users, error: userError } = await supabase.auth.admin.listUsers();
if (userError) {
  console.error("Erro ao listar users:", userError);
  process.exit(1);
}

const targetUser = users.users.find(u => u.email === 'alunoetec@compromisso.com');
if (!targetUser) {
  console.error("Usuário anajf@compromisso.com não encontrado!");
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(
  targetUser.id,
  { password: 'compromisso2026' }
);

if (updateError) {
  console.error("Erro ao resetar senha:", updateError.message);
} else {
  console.log("Senha resetada com sucesso para 'compromisso2026'!");
}
