import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server-auth';

// Publica um comunicado em massa. A RLS da tabela `announcements` só permite
// INSERT para profile_type teacher/admin; a secretaria é `staff`. Por isso esta
// rota valida a sessão (admin/staff) e insere com service role — seguindo a
// regra de segurança nº 1 do CLAUDE.md (sessão + service role, nunca senha mestra).
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { title, message, priority, target_group } = await request.json();

    const cleanTitle = String(title ?? '').trim();
    const cleanMessage = String(message ?? '').trim();
    if (!cleanTitle || !cleanMessage) {
      return NextResponse.json(
        { error: 'Título e mensagem são obrigatórios' },
        { status: 400 },
      );
    }
    if (cleanTitle.length > 160 || cleanMessage.length > 2000) {
      return NextResponse.json(
        { error: 'Título ou mensagem excedem o tamanho máximo' },
        { status: 400 },
      );
    }

    const safePriority = ['low', 'medium', 'high'].includes(priority)
      ? priority
      : 'low';
    const safeTarget =
      typeof target_group === 'string' && target_group.trim()
        ? target_group.trim().slice(0, 80)
        : 'all';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: Record<string, unknown> = {
      title: cleanTitle,
      message: cleanMessage,
      priority: safePriority,
      target_group: safeTarget,
      author_id: admin.id,
    };

    // Tenta com target_group; se a coluna não existir nesse ambiente, repete sem ela.
    let { data, error } = await supabaseAdmin
      .from('announcements')
      .insert([payload])
      .select()
      .single();

    if (error && (error.code === '42703' || error.message.includes('target_group'))) {
      const { target_group: _omit, ...fallback } = payload;
      const retry = await supabaseAdmin
        .from('announcements')
        .insert([fallback])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, announcement: data });
  } catch (error: any) {
    console.error('[ADMIN_ANNOUNCE]', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao publicar comunicado' },
      { status: 500 },
    );
  }
}
