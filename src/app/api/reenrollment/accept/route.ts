import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server-auth';
import { cpfValido, requestIp } from '@/lib/reenrollment-utils';

// Aceite/recusa de rematrícula pelo ALUNO logado.
//
// Passa por rota de API (e não RPC direto do cliente) porque a trilha de
// auditoria exige o IP real da requisição — que só o servidor conhece; um IP
// vindo do body seria forjável. As funções accept/refuse_reenrollment são
// EXECUTE apenas para service_role por esse motivo.

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { agreementId, action, signerName, signerCpf, signerRelationship, reason } =
      await request.json();

    if (!agreementId || typeof agreementId !== 'string') {
      return NextResponse.json({ error: 'Adesão inválida' }, { status: 400 });
    }
    const act = action === 'refuse' ? 'refuse' : 'accept';

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // IDOR: a adesão precisa pertencer ao aluno autenticado.
    const { data: ag } = await supabaseAdmin
      .from('reenrollment_agreements')
      .select('id, student_id, status')
      .eq('id', agreementId)
      .maybeSingle();
    if (!ag || ag.student_id !== user.id) {
      return NextResponse.json({ error: 'Adesão não encontrada' }, { status: 404 });
    }

    const ip = requestIp(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

    if (act === 'accept') {
      const nome = String(signerName ?? '').trim();
      if (nome.length < 3) {
        return NextResponse.json({ error: 'Informe o nome completo do responsável' }, { status: 400 });
      }
      if (!cpfValido(String(signerCpf ?? ''))) {
        return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin.rpc('accept_reenrollment', {
        p_agreement_id: agreementId,
        p_signer_name: nome,
        p_signer_cpf: String(signerCpf).replace(/\D/g, ''),
        p_via: 'student_portal',
        p_guardian_id: null,
        p_ip: ip,
        p_user_agent: userAgent,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (signerRelationship) {
        await supabaseAdmin
          .from('reenrollment_agreements')
          .update({ signer_relationship: String(signerRelationship).slice(0, 60) })
          .eq('id', agreementId);
      }
      return NextResponse.json({ ok: true, result: data });
    }

    const { data, error } = await supabaseAdmin.rpc('refuse_reenrollment', {
      p_agreement_id: agreementId,
      p_reason: reason ? String(reason).slice(0, 500) : null,
      p_via: 'student_portal',
      p_guardian_id: null,
      p_ip: ip,
      p_user_agent: userAgent,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, result: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
