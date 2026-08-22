import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cpfValido, requestIp } from '@/lib/reenrollment-utils';

// Aceite/recusa de rematrícula pelo RESPONSÁVEL, via portal público por token.
//
// Sem sessão: a identidade vem do token de acesso do portal
// (guardian_access_tokens), validado aqui com service role. O IP/user-agent
// entram na trilha de auditoria do aceite.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { agreementId, action, signerName, signerCpf, reason } = await request.json();

    if (!token || !agreementId) {
      return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });
    }
    const act = action === 'refuse' ? 'refuse' : 'accept';

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Token válido → responsável + aluno.
    const { data: tok } = await supabaseAdmin
      .from('guardian_access_tokens')
      .select('id, guardian_id, student_id, revoked_at, expires_at')
      .eq('token', token)
      .maybeSingle();
    const tokenValido =
      tok && !tok.revoked_at && (!tok.expires_at || new Date(tok.expires_at) > new Date());
    if (!tokenValido) {
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 401 });
    }

    // A adesão precisa ser do aluno deste responsável.
    const { data: ag } = await supabaseAdmin
      .from('reenrollment_agreements')
      .select('id, student_id, status')
      .eq('id', agreementId)
      .maybeSingle();
    if (!ag || ag.student_id !== tok.student_id) {
      return NextResponse.json({ error: 'Adesão não encontrada' }, { status: 404 });
    }

    const ip = requestIp(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

    if (act === 'accept') {
      const nome = String(signerName ?? '').trim();
      if (nome.length < 3) {
        return NextResponse.json({ error: 'Informe o nome completo' }, { status: 400 });
      }
      if (!cpfValido(String(signerCpf ?? ''))) {
        return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin.rpc('accept_reenrollment', {
        p_agreement_id: agreementId,
        p_signer_name: nome,
        p_signer_cpf: String(signerCpf).replace(/\D/g, ''),
        p_via: 'guardian_portal',
        p_guardian_id: tok.guardian_id,
        p_ip: ip,
        p_user_agent: userAgent,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, result: data });
    }

    const { data, error } = await supabaseAdmin.rpc('refuse_reenrollment', {
      p_agreement_id: agreementId,
      p_reason: reason ? String(reason).slice(0, 500) : null,
      p_via: 'guardian_portal',
      p_guardian_id: tok.guardian_id,
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
