import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    // Segurança: exige sessão de admin/staff (cookie) em vez de senha mestra no body.
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'E-mail e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    // 2. Inicializar Cliente Supabase com Service Role (Admin)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Configuração do Supabase incompleta (.env.local)');
      return NextResponse.json(
        { error: 'Erro de configuração no servidor. Verifique o SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 3. Validar se o e-mail existe no banco de dados
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'E-mail não encontrado em nossa base de dados' },
        { status: 404 }
      );
    }

    // 4. Resetar senha via Admin API (Sem deletar/reproducir o usuário).
    //
    // `must_change_password: true` é obrigatório aqui. A interface da secretaria
    // promete "o aluno será obrigado a alterá-la no próximo login", e a rota
    // não marcava nada: a senha temporária virava definitiva, e a secretaria
    // ficava sabendo a senha do aluno para sempre.
    //
    // O metadado é lido e mesclado porque a Admin API SUBSTITUI o objeto
    // inteiro — passar só uma chave apagaria as demais.
    const { data: atual } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    const metaExistente = atual?.user?.user_metadata ?? {};

    // Promise.race evita que a rota fique pendurada se a Admin API não responder.
    const { error: updateError } = await Promise.race([
      supabaseAdmin.auth.admin.updateUserById(profile.id, {
        password: newPassword,
        user_metadata: { ...metaExistente, must_change_password: true },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Tempo esgotado ao contatar o servidor de autenticação')),
          12_000
        )
      ),
    ]) as { error: any };

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ message: 'Senha atualizada com sucesso' });

  } catch (error: any) {
    console.error('Erro no reset de senha:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar reset' },
      { status: 500 }
    );
  }
}


