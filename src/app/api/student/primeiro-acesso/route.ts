import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyRegistrationToken } from '@/lib/registration-token';
import crypto from 'crypto';
import { generateResetToken, verifyResetToken } from '@/lib/password-reset-token';
import { sendOtpSms } from '@/lib/sms';

const SUPABASE_TIMEOUT_MS = 10_000;

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60_000;

function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `***-${digits.slice(-4)}`;
}

// Telefone em dígitos puros, sem DDI 55, para comparar formatos diferentes.
function normalizePhoneDigits(p: string): string {
  let d = (p || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
}

async function createAndSendOtp(admin: any, userId: string, phone: string) {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await admin.from('password_reset_otps').insert({
    user_id: userId,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  await sendOtpSms(phone, code);
}

// ── Rate limit do reset self-service ──────────────────────────────────────
// Por ALVO (hash do nome): trava o chute de data de nascimento num aluno.
// Por IP: bem alto, pois na escola muitos alunos dividem o mesmo Wi-Fi.
const RECOVER_IDENTITY_MAX_PER_HOUR = 8;
const RECOVER_IP_MAX_PER_HOUR = 30;

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

// Hash do nome normalizado — evita gravar PII no log de tentativas.
function hashIdentifier(name: string): string {
  const norm = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(norm).digest('hex');
}


async function checkRecoverRateLimit(admin: any, ip: string, idHash: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const [byId, byIp] = await Promise.all([
      admin.from('password_reset_attempts').select('id', { count: 'exact', head: true })
        .eq('identifier', idHash).eq('success', false).gte('created_at', since),
      admin.from('password_reset_attempts').select('id', { count: 'exact', head: true })
        .eq('ip', ip).gte('created_at', since),
    ]);
    return (byId.count ?? 0) >= RECOVER_IDENTITY_MAX_PER_HOUR
        || (byIp.count ?? 0) >= RECOVER_IP_MAX_PER_HOUR;
  } catch (e) {
    // Tabela ausente / indisponível → degrada sem travar o reset legítimo.
    console.warn('[RECOVER] rate-limit indisponível (degradando):', e);
    return false;
  }
}

async function recordRecoverAttempt(admin: any, ip: string, idHash: string, success: boolean) {
  try {
    await admin.from('password_reset_attempts').insert({ ip, identifier: idHash, success });
  } catch {
    /* degrada silenciosamente */
  }
}

function generateEmail(fullName: string): string {
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `${normalize(parts[0])}@compromisso.com`;
  if (parts.length === 2) return `${normalize(parts[0])}${normalize(parts[1])}@compromisso.com`;

  const first = normalize(parts[0]);
  const middleInitial = normalize(parts[1]).charAt(0);
  const last = normalize(parts[parts.length - 1]);
  return `${first}${middleInitial}${last}@compromisso.com`;
}

function makeAdmin(signal: AbortSignal) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, signal }),
      },
    }
  );
}

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

  try {
    const body = await request.json();
    const { action } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[PRIMEIRO_ACESSO] Missing ENV vars');
      return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
    }

    const supabaseAdmin = makeAdmin(controller.signal);

    // 1. AÇÃO: BUSCAR ALUNO
    if (action === 'search') {
      const { fullName } = body;
      if (!fullName?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

      // Esta busca é, por construção, um oráculo: digite um nome e descubra se
      // a pessoa estuda aqui e qual é o login dela. Não dá para fechar sem
      // matar o primeiro acesso — o aluno precisa justamente descobrir o
      // próprio login —, mas dá para impedir a VARREDURA, que é o que
      // transforma isso em vazamento de base.
      //
      // O limite por IP é generoso de propósito: na escola muitos alunos
      // dividem o mesmo Wi-Fi, e travar cedo demais quebraria o fluxo legítimo
      // numa sala inteira fazendo o primeiro acesso ao mesmo tempo.
      const ipBusca = getClientIp(request);
      const hashBusca = hashIdentifier(fullName);
      if (await checkRecoverRateLimit(supabaseAdmin, ipBusca, hashBusca)) {
        return NextResponse.json(
          { error: 'Muitas buscas seguidas. Espere alguns minutos e tente de novo.' },
          { status: 429 },
        );
      }
      await recordRecoverAttempt(supabaseAdmin, ipBusca, hashBusca, true);

      console.log('[PRIMEIRO_ACESSO] Busca de aluno recebida');

      const generatedEmail = generateEmail(fullName.trim());
      // Segurança: remove caracteres de controle do PostgREST (vírgula/parênteses/*) antes
      // de interpolar no filtro .or(), evitando injeção de filtro. Nomes reais não usam isso.
      const safeName = fullName.trim().replace(/[,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();

      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, name')
        .or(`email.eq.${generatedEmail},name.ilike.%${safeName}%`)
        .limit(1);

      if (error) {
        console.error('[PRIMEIRO_ACESSO] Erro na query:', error);
        throw error;
      }

      if (profiles && profiles.length > 0) {
        // Sem o `id`: a tela nunca usou (só exibe nome e e-mail de login), e o
        // uuid do perfil é a chave usada em várias rotas — não há motivo para
        // entregá-lo a quem só digitou um nome.
        return NextResponse.json({
          found: true,
          user: { email: profiles[0].email, name: profiles[0].name }
        });
      } else {
        return NextResponse.json({ found: false });
      }
    }

    // AÇÃO: BUSCAR POR TELEFONE (passo 1 do wizard de recuperação por SMS)
    // O telefone é a chave primária: quem tem o aparelho prova posse via OTP.
    // Não há mais fallback por nome+nascimento — quando o telefone não bate com
    // nenhuma conta, o aluno é direcionado à secretaria (ver nota abaixo).
    if (action === 'lookup-phone') {
      const { phone } = body;
      if (!phone?.trim() || phone.replace(/\D/g, '').length < 10) {
        return NextResponse.json({ error: 'Informe um telefone válido com DDD.' }, { status: 400 });
      }

      const ip = getClientIp(request);
      const inputDigits = normalizePhoneDigits(phone);
      const idHash = hashIdentifier(inputDigits);

      if (await checkRecoverRateLimit(supabaseAdmin, ip, idHash)) {
        return NextResponse.json(
          { error: 'Muitas tentativas. Por segurança, aguarde 1 hora ou procure a secretaria.' },
          { status: 429 }
        );
      }

      // Estreita candidatos pelos últimos 8 dígitos antes de comparar exato em JS
      // (telefone não é normalizado no banco, então formatos variam).
      const last8 = inputDigits.slice(-8);
      const { data: candidates, error: searchErr } = await supabaseAdmin
        .from('profiles')
        .select('id, phone')
        .ilike('phone', `%${last8}%`)
        .limit(10);

      if (searchErr) {
        console.error('[LOOKUP_PHONE] erro na busca:', searchErr);
        throw searchErr;
      }

      const matches = (candidates || []).filter((c: any) =>
        c.phone && normalizePhoneDigits(c.phone) === inputDigits
      );

      if (matches.length === 0) {
        await recordRecoverAttempt(supabaseAdmin, ip, idHash, false);
        return NextResponse.json({ found: false });
      }

      if (matches.length > 1) {
        // Telefone compartilhado entre contas (ex: responsável de dois irmãos) —
        // não dá pra saber qual conta resetar. Manda pra secretaria.
        await recordRecoverAttempt(supabaseAdmin, ip, idHash, false);
        return NextResponse.json(
          { error: 'Este telefone está associado a mais de uma conta. Procure a secretaria para redefinir.' },
          { status: 409 }
        );
      }

      await recordRecoverAttempt(supabaseAdmin, ip, idHash, true);
      const match = matches[0];
      const resetToken = generateResetToken(match.id);

      try {
        await createAndSendOtp(supabaseAdmin, match.id, match.phone);
      } catch (e: any) {
        console.error('[LOOKUP_PHONE] falha ao enviar SMS (code):', e?.code ?? 'unknown');
        return NextResponse.json({ error: 'Não foi possível enviar o SMS agora. Tente novamente.' }, { status: 503 });
      }

      return NextResponse.json({ resetToken, maskedPhone: maskPhone(match.phone) });
    }

    // A AÇÃO 'register-phone' FOI REMOVIDA.
    //
    // Ela deixava o aluno cadastrar um telefone provando identidade por nome +
    // data de nascimento. Só que a data de nascimento era a ÚNICA prova desse
    // caminho, e apenas 39 dos 1058 alunos a têm preenchida: atendia 3,7% e
    // devolvia erro para todo o resto (263 falhas de 126 pessoas em um mês).
    //
    // Remover só o campo, mantendo o cadastro por nome, transformaria isso em
    // tomada de conta: bastaria digitar o nome de um aluno, registrar o próprio
    // telefone e receber o OTP. Por isso o caminho inteiro saiu. Quem não tem
    // telefone cadastrado vai para a secretaria, que confere identidade
    // presencialmente.

    // AÇÃO: REENVIAR CÓDIGO
    if (action === 'resend') {
      const { resetToken } = body;
      const verified = verifyResetToken(resetToken);
      if (verified.status !== 'valid') {
        return NextResponse.json({ error: 'Sessão de recuperação expirada. Reinicie o processo.' }, { status: 401 });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles').select('phone').eq('id', verified.userId).maybeSingle();
      if (!profile?.phone) {
        return NextResponse.json({ error: 'Telefone não encontrado. Reinicie o processo.' }, { status: 400 });
      }

      const { data: lastOtp } = await supabaseAdmin
        .from('password_reset_otps')
        .select('created_at')
        .eq('user_id', verified.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastOtp && Date.now() - new Date(lastOtp.created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
        return NextResponse.json({ error: 'Aguarde um pouco antes de reenviar o código.' }, { status: 429 });
      }

      try {
        await createAndSendOtp(supabaseAdmin, verified.userId, profile.phone);
      } catch (e: any) {
        console.error('[RESEND] falha ao enviar SMS (code):', e?.code ?? 'unknown');
        return NextResponse.json({ error: 'Não foi possível enviar o SMS agora. Tente novamente.' }, { status: 503 });
      }

      return NextResponse.json({ maskedPhone: maskPhone(profile.phone) });
    }

    // AÇÃO: CONFIRMAR CÓDIGO E TROCAR SENHA (passo final)
    if (action === 'confirm') {
      const { resetToken, code, newPassword } = body;
      const verified = verifyResetToken(resetToken);
      if (verified.status !== 'valid') {
        return NextResponse.json({ error: 'Sessão de recuperação expirada. Reinicie o processo.' }, { status: 401 });
      }
      if (!code?.trim() || !newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'Informe o código e uma senha com pelo menos 8 caracteres.' }, { status: 400 });
      }

      const { data: otp } = await supabaseAdmin
        .from('password_reset_otps')
        .select('id, code_hash, expires_at, attempts, consumed')
        .eq('user_id', verified.userId)
        .eq('consumed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        return NextResponse.json({ error: 'Código incorreto.' }, { status: 401 });
      }
      if (new Date(otp.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Código expirado. Solicite um novo.' }, { status: 400 });
      }
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        return NextResponse.json({ error: 'Muitas tentativas erradas. Reinicie o processo.' }, { status: 429 });
      }

      const inputHash = hashOtpCode(code.trim());
      if (inputHash !== otp.code_hash) {
        await supabaseAdmin.from('password_reset_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
        return NextResponse.json({ error: 'Código incorreto.' }, { status: 401 });
      }

      const authAdminUrl = `${supabaseUrl}/auth/v1/admin/users/${verified.userId}`;
      const authHeaders: Record<string, string> = {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      };
      const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Supabase não respondeu em ${ms / 1000}s. Tente novamente.`)), ms)
          ),
        ]);

      let existingMeta: Record<string, unknown> = {};
      try {
        const getRes = await withTimeout(fetch(authAdminUrl, { method: 'GET', headers: authHeaders }), 7_000);
        if (getRes.ok) existingMeta = (await getRes.json()).user_metadata ?? {};
      } catch (e) {
        console.warn('[CONFIRM] getUserById falhou (não-crítico):', e);
      }

      let putRes: Response;
      try {
        putRes = await withTimeout(
          fetch(authAdminUrl, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({
              password: newPassword,
              email_confirm: true,
              user_metadata: { ...existingMeta, must_change_password: false },
            }),
          }),
          8_000
        );
      } catch (e: any) {
        console.error('[CONFIRM] updateUserById timeout/falhou:', e);
        return NextResponse.json({ error: e.message || 'Tempo esgotado ao gravar senha.' }, { status: 503 });
      }

      if (!putRes.ok) {
        const errBody = await putRes.json().catch(() => ({}));
        const errMsg = errBody.msg ?? errBody.message ?? errBody.error_description ?? `HTTP ${putRes.status}`;
        console.error('[CONFIRM] updateUserById failed:', putRes.status, errBody);
        return NextResponse.json({ error: `Falha ao gravar senha: ${errMsg}` }, { status: 500 });
      }

      await supabaseAdmin.from('password_reset_otps').update({ consumed: true }).eq('id', otp.id);
      return NextResponse.json({ success: true });
    }

    // 3. AÇÃO: CADASTRAR NOVO
    if (action === 'register') {
      const { fullName, examTarget, password, institution, classroom, inviteToken } = body;

      // Validação do Token de Convite
      if (!inviteToken) {
        return NextResponse.json({ error: 'O cadastro requer um link de convite válido.' }, { status: 401 });
      }

      const tokenStatus = verifyRegistrationToken(inviteToken);
      if (tokenStatus === 'expired') {
        return NextResponse.json({ error: 'Este link de convite expirou. Peça um novo ao coordenador.' }, { status: 403 });
      }
      if (tokenStatus === 'invalid') {
        return NextResponse.json({ error: 'Link de convite inválido ou adulterado.' }, { status: 403 });
      }

      if (!fullName?.trim() || !password || password.length < 8) {
        return NextResponse.json({ error: 'Preencha todos os campos corretamente.' }, { status: 400 });
      }

      const email = generateEmail(fullName);
      const username = email.replace('@compromisso.com', '');

      const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'Este perfil já existe. Tente recuperar pelo seu nome.' }, { status: 409 });
      }

      console.log('[PRIMEIRO_ACESSO] Criando Auth User (student) via convite');
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          profile_type: 'student',
          role: 'student',
          exam_target: examTarget || 'ENEM',
          institution: institution || '',
          course: classroom || '',
        },
      });

      if (createError) {
        console.error('[PRIMEIRO_ACESSO] Erro ao criar Auth User:', createError);
        throw createError;
      }

      console.log('[PRIMEIRO_ACESSO] Auth User criado. Criando Profile...');

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        name: fullName,
        email,
        username,
        profile_type: 'student',
        role: 'student',
        status: 'active',
        exam_target: examTarget || 'ENEM',
        institution: institution || null,
        course: classroom || null,
      });

      if (profileError) {
        console.error('[PRIMEIRO_ACESSO] Erro ao criar Profile:', profileError);
        // Tenta limpar o auth user se o profile falhar
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      console.log('[PRIMEIRO_ACESSO] Cadastro concluído com sucesso');

      return NextResponse.json({ success: true, email });
    }

    return NextResponse.json({ error: 'Ação não permitida.' }, { status: 400 });

  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'O servidor demorou muito para responder. Tente novamente em instantes.' },
        { status: 503 }
      );
    }
    console.error('[PRIMEIRO_ACESSO_CRITICAL]', error);
    return NextResponse.json(
      { error: error.message || 'Erro crítico no servidor.' },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
