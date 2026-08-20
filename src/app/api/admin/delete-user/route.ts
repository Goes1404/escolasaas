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

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`[DELETE USER] Iniciando exclusão do usuário ID: ${userId}`);

    // Deletar da autenticação do Supabase (o delete cascade do banco de dados irá deletar o profile automaticamente)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      // Se não encontrou no auth (ou der outro erro), tentamos limpar o profile diretamente
      console.warn(`[DELETE USER] Erro ao deletar no auth.users, tentando deletar direto da tabela profiles: ${deleteError.message}`);
    }

    // Forçamos a deleção na tabela de perfis por precaução
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error(`[DELETE USER] Erro ao deletar da tabela profiles: ${profileError.message}`);
      if (deleteError) {
        // Se ambos falharem, retornamos o erro do auth
        throw deleteError;
      }
    }

    console.log(`[DELETE USER] Usuário ID ${userId} excluído com sucesso do Auth e Profiles.`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_DELETE_USER]', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao excluir usuário' },
      { status: 500 }
    );
  }
}
