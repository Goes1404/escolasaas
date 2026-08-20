import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEFAULT_USER_PASSWORD || 'mudar123';

if (!supabaseUrl || !serviceKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  { fullName: 'Admin Teste', email: 'admin@compromisso.com', role: 'admin', profileType: 'admin' },
  { fullName: 'Secretaria Teste', email: 'secretaria@compromisso.com', role: 'staff', profileType: 'staff' },
  { fullName: 'Professor Teste', email: 'professor@compromisso.com', role: 'teacher', profileType: 'teacher' },
  { fullName: 'Aluno Teste', email: 'aluno@compromisso.com', role: 'student', profileType: 'student', examTarget: 'ENEM' },
];

for (const u of users) {
  const username = u.email.replace('@compromisso.com', '');

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', u.email)
    .maybeSingle();

  let userId = existingProfile?.id;

  if (!userId) {
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: u.fullName,
        must_change_password: false,
        profile_type: u.profileType,
        exam_target: u.examTarget || 'ENEM',
      },
    });

    if (createError) {
      console.error(`[${u.email}] erro ao criar no Auth:`, createError.message);
      continue;
    }
    userId = authData.user.id;
  } else {
    console.log(`[${u.email}] já existe no Auth, reaproveitando id ${userId}`);
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    name: u.fullName,
    full_name: u.fullName,
    email: u.email,
    username,
    profile_type: u.profileType,
    role: u.role,
    status: 'active',
    exam_target: u.examTarget || null,
  });

  if (profileError) {
    console.error(`[${u.email}] erro ao gravar profile:`, profileError.message);
    continue;
  }

  console.log(`OK  ${u.role.padEnd(8)} ${u.email}`);
}

console.log('\nSenha padrão para todos:', password);
