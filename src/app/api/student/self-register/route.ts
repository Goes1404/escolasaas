import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyRegistrationToken } from '@/lib/registration-token';

function generateEmail(fullName: string): string {
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `${normalize(parts[0])}@compromisso.com`;
  if (parts.length === 2) return `${normalize(parts[0])}${normalize(parts[1])}@compromisso.com`;

  const first = normalize(parts[0]);
  const middleInitial = normalize(parts[1]).charAt(0);
  const last = normalize(parts[parts.length - 1]);
  return `${first}${middleInitial}${last}@compromisso.com`;
}

export async function POST(request: Request) {
  try {
    const { token, fullName, cpf, examTarget, institution, sala, turno, password } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token ausente.' }, { status: 400 });
    }

    const tokenStatus = verifyRegistrationToken(token);
    if (tokenStatus === 'invalid') {
      return NextResponse.json({ error: 'Link de cadastro inválido ou adulterado.' }, { status: 400 });
    }
    if (tokenStatus === 'expired') {
      return NextResponse.json({ error: 'Este link de cadastro expirou. Solicite um novo ao seu coordenador.' }, { status: 410 });
    }

    if (!fullName?.trim() || !password) {
      return NextResponse.json({ error: 'Nome completo e senha são obrigatórios.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limit por IP. Esta rota cria conta sem sessão, protegida só pelo
    // token de convite — se um token vazar, dá para encher a base de contas
    // falsas até alguém perceber. O limite é alto porque uma turma inteira
    // pode se cadastrar do mesmo Wi-Fi da escola no mesmo dia.
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || request.headers.get('x-real-ip') || 'unknown';
    try {
      const desde = new Date(Date.now() - 3_600_000).toISOString();
      const { count } = await supabaseAdmin
        .from('password_reset_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .eq('identifier', 'self-register')
        .gte('created_at', desde);
      if ((count ?? 0) >= 40) {
        return NextResponse.json(
          { error: 'Muitos cadastros deste local na última hora. Procure a secretaria.' },
          { status: 429 },
        );
      }
      await supabaseAdmin.from('password_reset_attempts')
        .insert({ ip, identifier: 'self-register', success: true });
    } catch {
      // Tabela indisponível: degrada sem travar cadastro legítimo.
    }

    const email = generateEmail(fullName);
    if (!email) {
      return NextResponse.json({ error: 'Não foi possível gerar e-mail a partir do nome fornecido.' }, { status: 400 });
    }

    const username = email.replace('@compromisso.com', '');

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `O e-mail ${email} já está cadastrado. Entre em contato com seu coordenador.` },
        { status: 409 }
      );
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        profile_type: 'student',
        role: 'student',
        institution: institution || '',
        exam_target: examTarget || 'ENEM',
        sala: sala || '',
        turno: turno || '',
        cpf: cpf || '',
      },
    });

    if (createError) throw createError;
    if (!authData?.user) throw new Error('Usuário não foi criado pelo Supabase Auth');

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      name: fullName,
      email,
      username,
      cpf: cpf || null,
      profile_type: 'student',
      role: 'student',
      status: 'active',
      institution: institution || null,
      sala: sala || null,
      turno: turno || null,
      exam_target: examTarget || null,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true, email });

  } catch (error: any) {
    console.error('[STUDENT_SELF_REGISTER]', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao criar conta.' },
      { status: 500 }
    );
  }
}
