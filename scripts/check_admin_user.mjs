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

async function checkAdminEmail() {
  const emailToCheck = 'adm@compromisso.com';
  console.log(`Verificando se o e-mail ${emailToCheck} existe no banco...`);

  // 1. Verificar na tabela profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', emailToCheck)
    .maybeSingle();

  if (profileError) {
    console.error('Erro ao buscar no perfil:', profileError.message);
  }

  if (profile) {
    console.log('E-mail encontrado na tabela profiles:');
    console.log(JSON.stringify(profile, null, 2));
  } else {
    console.log(`E-mail ${emailToCheck} NÃO encontrado na tabela profiles.`);
  }

  // 2. Verificar na tabela auth.users (usando o cliente admin)
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Erro ao buscar em auth.users:', authError.message);
  } else {
    const authUser = users.find(u => u.email === emailToCheck);
    if (authUser) {
      console.log('E-mail encontrado no Supabase Auth:');
      console.log(JSON.stringify(authUser, null, 2));
    } else {
      console.log(`E-mail ${emailToCheck} NÃO encontrado no Supabase Auth.`);
    }
  }
}

checkAdminEmail();
