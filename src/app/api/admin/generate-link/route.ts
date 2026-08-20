import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server-auth';

// type: 'invite'   → link de primeiro acesso (novo usuário define a senha)
// type: 'recovery' → link de reset de senha (usuário existente redefine)
export async function POST(request: Request) {
  try {
    // Segurança: exige sessão de admin/staff (cookie) em vez de senha mestra no body.
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { email, type } = await request.json();

    if (!email || !type || !['invite', 'recovery'].includes(type)) {
      return NextResponse.json(
        { error: 'E-mail e tipo (invite | recovery) são obrigatórios' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Detectar a URL base da aplicação via header Origin
    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    // Recovery → redireciona DIRETAMENTE para /reset-password (mesmo fluxo do
    // forgot-password nativo do Supabase). O token fica no hash da URL e o
    // client Supabase processa automaticamente via onAuthStateChange.
    // Isso evita passar pelo /auth/callback compartilhado e contaminar a
    // sessão do admin que gerou o link.
    //
    // Invite → ainda usa /auth/callback porque o token de convite precisa
    // do exchangeCodeForSession (fluxo PKCE) para criar a sessão corretamente.
    const redirectTo = type === 'recovery'
      ? `${origin}/reset-password`
      : `${origin}/auth/callback?next=${encodeURIComponent('/dashboard/first-access')}`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: type as 'invite' | 'recovery',
      email: email.toLowerCase(),
      options: { redirectTo },
    });

    if (error) throw error;

    const actionLink = data?.properties?.action_link;
    if (!actionLink) throw new Error('Supabase não retornou um link válido');

    return NextResponse.json({
      success: true,
      link: actionLink,
      type,
      expiresIn: '1 hora',
    });

  } catch (error: any) {
    console.error('[ADMIN_GENERATE_LINK]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar link temporário' },
      { status: 500 }
    );
  }
}
