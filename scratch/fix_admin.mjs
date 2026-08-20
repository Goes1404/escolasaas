import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load env
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

async function run() {
  const email = 'adm@compromisso.com';
  const password = 'compromisso2026';
  
  console.log(`Buscando perfil para ${email}...`);
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();
    
  if (profileErr) {
    console.error('Erro ao buscar perfil:', profileErr);
    return;
  }
  
  let userId = profile?.id;
  
  if (!userId) {
    console.log('Perfil não encontrado no banco. Buscando no Auth...');
    // Se não encontrou no profiles, vamos paginar o listUsers para encontrar no Auth
    let page = 1;
    let foundUser = null;
    while (true) {
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({
        page,
        perPage: 100
      });
      if (listErr) {
        console.error('Erro ao listar usuários:', listErr);
        break;
      }
      if (!users || users.length === 0) break;
      const match = users.find(u => u.email === email);
      if (match) {
        foundUser = match;
        break;
      }
      page++;
    }
    
    if (foundUser) {
      userId = foundUser.id;
      console.log(`Usuário encontrado no Auth: ${userId}`);
    }
  }
  
  if (userId) {
    console.log(`Atualizando usuário Auth ${userId} com nova senha e metadados...`);
    const { data: updateData, error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Administrador do Sistema',
        profile_type: 'admin',
        role: 'admin',
        must_change_password: false
      }
    });
    
    if (updateErr) {
      console.error('Erro ao atualizar usuário Auth:', updateErr);
    } else {
      console.log('Usuário Auth atualizado com sucesso!');
    }
    
    console.log('Garantindo perfil atualizado na tabela profiles...');
    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      name: 'Administrador do Sistema',
      role: 'admin',
      profile_type: 'admin',
      status: 'active'
    });
    
    if (upsertErr) {
      console.error('Erro ao atualizar perfil na tabela profiles:', upsertErr);
    } else {
      console.log('Perfil na tabela profiles atualizado com sucesso!');
    }
  } else {
    console.log('Usuário não encontrado em lugar nenhum. Criando novo...');
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Administrador do Sistema',
        profile_type: 'admin',
        role: 'admin',
        must_change_password: false
      }
    });
    
    if (createErr) {
      console.error('Erro ao criar usuário:', createErr);
      return;
    }
    
    console.log(`Novo usuário Auth criado com ID: ${createData.user.id}`);
    
    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: createData.user.id,
      email,
      name: 'Administrador do Sistema',
      role: 'admin',
      profile_type: 'admin',
      status: 'active'
    });
    
    if (upsertErr) {
      console.error('Erro ao criar perfil:', upsertErr);
    } else {
      console.log('Perfil criado com sucesso!');
    }
  }
}

run();
