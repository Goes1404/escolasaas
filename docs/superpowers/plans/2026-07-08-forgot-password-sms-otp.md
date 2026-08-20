# Esqueci Minha Senha via SMS OTP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o reset de senha atual (nome+telefone+nascimento, sem prova de posse) por um fluxo que soma código OTP via SMS (Twilio) como prova real de posse do telefone.

**Architecture:** Nova tabela `password_reset_otps` guarda hash do código; um `resetToken` HMAC assinado (secret próprio, não reaproveita `SUPABASE_SERVICE_ROLE_KEY`) carrega o `userId` entre as 3 telas do wizard; a rota `api/student/primeiro-acesso` ganha 4 ações novas (`identify`, `set-phone`, `resend`, `confirm`) substituindo `recover`; `ForgotPasswordForm.tsx` vira wizard de 3 passos.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (service role client), pacote `twilio` (Node SDK), Tailwind/Shadcn (form existente).

## Global Constraints

- Nenhum dado de PII (nome, telefone, e-mail) em `console.*` — apenas hash/mascarado (regra CLAUDE.md item 7).
- `SUPABASE_SERVICE_ROLE_KEY` e credenciais Twilio só em código server-side, nunca `"use client"` nem `NEXT_PUBLIC_*`.
- Mensagens de erro do fluxo `identify`/`confirm` não revelam se a conta existe (anti-enumeração) — mesma mensagem genérica para "não achou" e "código errado".
- Reaproveitar rate limit já existente (`password_reset_attempts`, hash do nome, sem alterar schema) na ação `identify`.
- `npm run typecheck` e `npm run build` devem passar limpos antes de cada commit ser considerado concluído.
- Projeto não tem framework de testes automatizados instalado (sem Jest/Vitest) — verificação é `typecheck` + `build` + testes manuais via `curl`/UI, documentados em cada tarefa.

---

### Task 1: Migration da tabela `password_reset_otps`

**Files:**
- Create: `supabase/migrations/20260708200000_password_reset_otps.sql`

**Interfaces:**
- Produces: tabela `public.password_reset_otps(id uuid pk, user_id uuid, code_hash text, expires_at timestamptz, attempts int, consumed boolean, created_at timestamptz)`. Task 3 (`primeiro-acesso/route.ts`) faz INSERT/SELECT/UPDATE nela via service role.

- [ ] **Step 1: Escrever a migration**

```sql
-- Códigos OTP de recuperação de senha via SMS.
-- Guarda só o hash SHA-256 do código de 6 dígitos, nunca o valor em claro.

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  consumed    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_id
  ON public.password_reset_otps (user_id, created_at DESC);

-- RLS ligado e SEM policies => ninguém acessa pelo cliente.
-- Apenas a service role (rota server-side) lê/escreve.
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Aplicar a migration no projeto remoto**

Run: `npx supabase db push`
Expected: output lista `20260708200000_password_reset_otps.sql` como aplicada, sem erro.

- [ ] **Step 3: Confirmar a tabela existe**

Run: `npx supabase db push --dry-run` (ou `npx supabase migration list`)
Expected: migration aparece como já aplicada (sem pendências).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260708200000_password_reset_otps.sql
git commit -m "feat: add password_reset_otps table for SMS OTP recovery"
```

---

### Task 2: `src/lib/password-reset-token.ts` — resetToken HMAC assinado

**Files:**
- Create: `src/lib/password-reset-token.ts`

**Interfaces:**
- Consumes: env var `PASSWORD_RESET_TOKEN_SECRET` (string, obrigatória).
- Produces:
  - `generateResetToken(userId: string, expiryMinutes = 10): string`
  - `verifyResetToken(token: string): { status: 'valid'; userId: string } | { status: 'expired' | 'invalid' }`
  Task 3 usa essas duas funções em todas as 4 ações novas da rota.

- [ ] **Step 1: Escrever o módulo**

Segue exatamente o padrão de `src/lib/registration-token.ts` (HMAC-SHA256, base64url, 3 segmentos), mas carregando `userId` no payload em vez de só expiry+nonce, e com secret dedicado.

```typescript
/**
 * Tokens HMAC para o wizard de recuperação de senha via SMS OTP.
 * Validação 100% server-side — nunca importe este arquivo em componentes cliente.
 *
 * Formato interno do token (antes do base64url):
 *   "<expiry_ms>:<userId>:<hmac_hex_24>"
 */

import { createHmac } from 'crypto';

function secret(): string {
  const s = process.env.PASSWORD_RESET_TOKEN_SECRET;
  if (!s) throw new Error('PASSWORD_RESET_TOKEN_SECRET não definida');
  return s;
}

export function generateResetToken(userId: string, expiryMinutes = 10): string {
  const expiry = Date.now() + expiryMinutes * 60 * 1000;
  const payload = `${expiry}:${userId}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex').substring(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export type ResetTokenResult =
  | { status: 'valid'; userId: string }
  | { status: 'expired' | 'invalid' };

export function verifyResetToken(token: string): ResetTokenResult {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const colonIdxFirst = decoded.indexOf(':');
    const colonIdxLast = decoded.lastIndexOf(':');
    if (colonIdxFirst === colonIdxLast || colonIdxFirst === -1) return { status: 'invalid' };

    const expiryStr = decoded.substring(0, colonIdxFirst);
    const userId = decoded.substring(colonIdxFirst + 1, colonIdxLast);
    const sig = decoded.substring(colonIdxLast + 1);

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || userId.length < 8 || sig.length < 16) return { status: 'invalid' };

    const payload = `${expiryStr}:${userId}`;
    const expectedSig = createHmac('sha256', secret()).update(payload).digest('hex').substring(0, 24);

    if (sig !== expectedSig) return { status: 'invalid' };
    if (Date.now() > expiry) return { status: 'expired' };

    return { status: 'valid', userId };
  } catch {
    return { status: 'invalid' };
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros novos relacionados a `password-reset-token.ts`.

- [ ] **Step 3: Teste manual rápido via node**

Run:
```bash
PASSWORD_RESET_TOKEN_SECRET=test123 node -e "
const { generateResetToken, verifyResetToken } = require('./src/lib/password-reset-token.ts');
" 2>&1 | head -5
```
Como é TypeScript, valide via um teste ad-hoc dentro do próprio Next (ex.: chamada temporária em uma rota de debug) OU pule para Task 3, onde o uso real na rota já exercita as duas funções end-to-end. Não é necessário criar infra de teste isolada para isso — o projeto não tem Jest configurado.

- [ ] **Step 4: Commit**

```bash
git add src/lib/password-reset-token.ts
git commit -m "feat: add HMAC reset token helper for password recovery wizard"
```

---

### Task 3: `src/lib/sms.ts` — wrapper Twilio

**Files:**
- Create: `src/lib/sms.ts`
- Modify: `package.json` (adiciona dependência `twilio`)

**Interfaces:**
- Consumes: env vars `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
- Produces: `sendOtpSms(phone: string, code: string): Promise<void>` — lança `Error` se o envio falhar. Task 4 chama essa função e converte erro em HTTP 503.

- [ ] **Step 1: Instalar o SDK**

Run: `npm install twilio`
Expected: `package.json` e `package-lock.json` atualizados, sem erro de instalação.

- [ ] **Step 2: Escrever o wrapper**

```typescript
/**
 * Envio de SMS via Twilio para códigos OTP de recuperação de senha.
 * Server-side only — nunca importe em componentes "use client".
 */

import twilio from 'twilio';

function client() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Credenciais Twilio não configuradas');
  return twilio(sid, token);
}

// Telefone brasileiro em dígitos puros (com ou sem DDI 55) -> formato E.164 (+55...).
function toE164BR(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = `55${digits}`;
  return `+${digits}`;
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER não configurado');

  await client().messages.create({
    to: toE164BR(phone),
    from,
    body: `Compromisso: seu código de recuperação de senha é ${code}. Válido por 5 minutos.`,
  });
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros novos relacionados a `sms.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sms.ts package.json package-lock.json
git commit -m "feat: add Twilio SMS wrapper for OTP delivery"
```

---

### Task 4: Rota `api/student/primeiro-acesso` — ações `identify`, `set-phone`, `resend`, `confirm`

**Files:**
- Modify: `src/app/api/student/primeiro-acesso/route.ts`

**Interfaces:**
- Consumes:
  - `generateResetToken`, `verifyResetToken` de `src/lib/password-reset-token.ts` (Task 2)
  - `sendOtpSms` de `src/lib/sms.ts` (Task 3)
  - Helpers já existentes no arquivo: `hashIdentifier`, `normalizePhone`, `generateEmail`, `makeAdmin`, `getClientIp`, `checkRecoverRateLimit`, `recordRecoverAttempt` (mantidos, reaproveitados por `identify`)
- Produces: 4 novos formatos de resposta JSON que o wizard (Task 5) consome:
  - `identify` → `{ resetToken: string, maskedPhone: string } | { resetToken: string, needsPhone: true }` ou erro `{ error: string }` (401/429)
  - `set-phone` → `{ maskedPhone: string }` ou erro
  - `resend` → `{ maskedPhone: string }` ou erro
  - `confirm` → `{ success: true }` ou erro

- [ ] **Step 1: Remover a ação `recover` e adicionar helpers de OTP no topo do arquivo**

Em `src/app/api/student/primeiro-acesso/route.ts`, adicionar após os imports existentes:

```typescript
import { generateResetToken, verifyResetToken } from '@/lib/password-reset-token';
import { sendOtpSms } from '@/lib/sms';

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
```

Remover por completo o bloco `if (action === 'recover') { ... }` (linhas 143–247 do arquivo atual).

- [ ] **Step 2: Adicionar ação `identify`**

Inserir no lugar do bloco `recover` removido:

```typescript
    // AÇÃO: IDENTIFICAR (passo 1 do wizard de recuperação por SMS)
    // Verifica nome+data de nascimento contra o cadastro (mesmo rate-limit de antes).
    // Se achar telefone cadastrado, já dispara o OTP. Senão, sinaliza needsPhone.
    if (action === 'identify') {
      const { fullName, birthDate } = body;

      if (!fullName?.trim() || !birthDate?.trim()) {
        return NextResponse.json({ error: 'Preencha nome e data de nascimento.' }, { status: 400 });
      }

      const ip = getClientIp(request);
      const idHash = hashIdentifier(fullName);

      if (await checkRecoverRateLimit(supabaseAdmin, ip, idHash)) {
        return NextResponse.json(
          { error: 'Muitas tentativas. Por segurança, aguarde 1 hora ou procure a secretaria.' },
          { status: 429 }
        );
      }

      const generatedEmail = generateEmail(fullName.trim());
      const safeName = fullName.trim().replace(/[,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
      const { data: candidates, error: searchErr } = await supabaseAdmin
        .from('profiles')
        .select('id, phone, birth_date')
        .or(`email.eq.${generatedEmail},name.ilike.%${safeName}%`)
        .limit(10);

      if (searchErr) {
        console.error('[IDENTIFY] erro na busca:', searchErr);
        throw searchErr;
      }

      const inputBirth = String(birthDate).slice(0, 10);
      const match = (candidates || []).find((c: any) =>
        c.birth_date && String(c.birth_date).slice(0, 10) === inputBirth
      );

      if (!match) {
        await recordRecoverAttempt(supabaseAdmin, ip, idHash, false);
        return NextResponse.json(
          { error: 'Os dados não conferem com nenhum cadastro. Confira nome e data de nascimento — ou procure a secretaria.' },
          { status: 401 }
        );
      }

      await recordRecoverAttempt(supabaseAdmin, ip, idHash, true);
      const resetToken = generateResetToken(match.id);

      if (!match.phone) {
        return NextResponse.json({ resetToken, needsPhone: true });
      }

      try {
        await createAndSendOtp(supabaseAdmin, match.id, match.phone);
      } catch (e) {
        console.error('[IDENTIFY] falha ao enviar SMS:', e);
        return NextResponse.json({ error: 'Não foi possível enviar o SMS agora. Tente novamente.' }, { status: 503 });
      }

      return NextResponse.json({ resetToken, maskedPhone: maskPhone(match.phone) });
    }

    // AÇÃO: CADASTRAR TELEFONE (passo 1b, só quando needsPhone)
    if (action === 'set-phone') {
      const { resetToken, phone } = body;
      const verified = verifyResetToken(resetToken);
      if (verified.status !== 'valid') {
        return NextResponse.json({ error: 'Sessão de recuperação expirada. Reinicie o processo.' }, { status: 401 });
      }
      if (!phone?.trim() || phone.replace(/\D/g, '').length < 10) {
        return NextResponse.json({ error: 'Informe um telefone válido com DDD.' }, { status: 400 });
      }

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', verified.userId);
      if (updateErr) {
        console.error('[SET_PHONE] erro ao salvar telefone:', updateErr);
        throw updateErr;
      }

      try {
        await createAndSendOtp(supabaseAdmin, verified.userId, phone.trim());
      } catch (e) {
        console.error('[SET_PHONE] falha ao enviar SMS:', e);
        return NextResponse.json({ error: 'Não foi possível enviar o SMS agora. Tente novamente.' }, { status: 503 });
      }

      return NextResponse.json({ maskedPhone: maskPhone(phone.trim()) });
    }

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
      } catch (e) {
        console.error('[RESEND] falha ao enviar SMS:', e);
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
        return NextResponse.json({ error: 'Código não encontrado. Reinicie o processo.' }, { status: 400 });
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
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros. Se `crypto.randomInt` reclamar de tipo, confirmar que `import crypto from 'crypto'` já está no topo do arquivo (está, linha 4 do arquivo original) — `crypto.randomInt` e `crypto.createHash` vêm do mesmo import.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build limpo, sem erro na rota `api/student/primeiro-acesso`.

- [ ] **Step 5: Teste manual via curl (ambiente local, com env vars configuradas)**

```bash
# 1. identify — usar nome+nascimento de uma conta de teste real no banco
curl -X POST http://localhost:3000/api/student/primeiro-acesso \
  -H "Content-Type: application/json" \
  -d '{"action":"identify","fullName":"Nome Teste","birthDate":"2005-01-01"}'
# Expected: {"resetToken":"...","maskedPhone":"***-1234"} (ou needsPhone:true se sem telefone)
```
Guardar o `resetToken` retornado, conferir SMS recebido no telefone de teste, então:
```bash
curl -X POST http://localhost:3000/api/student/primeiro-acesso \
  -H "Content-Type: application/json" \
  -d '{"action":"confirm","resetToken":"<token>","code":"<código do SMS>","newPassword":"NovaSenha123"}'
# Expected: {"success":true}
```
Confirmar login com a nova senha funciona.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/student/primeiro-acesso/route.ts
git commit -m "feat: replace password recover action with SMS OTP wizard endpoints"
```

---

### Task 5: `ForgotPasswordForm.tsx` — wizard de 3 passos

**Files:**
- Modify: `src/app/forgot-password/ForgotPasswordForm.tsx` (reescrita completa)

**Interfaces:**
- Consumes: as 4 ações da rota (Task 4): `identify`, `set-phone`, `resend`, `confirm`.
- Produces: nenhum consumidor a jusante (componente de UI folha).

- [ ] **Step 1: Reescrever o componente com estado de wizard**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, AlertCircle, CheckCircle2, Lock, User, Phone, Calendar,
  Eye, EyeOff, ArrowLeft, KeyRound, MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Step = "identity" | "phone" | "otp";

async function callApi(action: string, payload: Record<string, unknown>) {
  const res = await Promise.race([
    fetch("/api/student/primeiro-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo esgotado. Verifique sua conexão e tente novamente.")), 15_000)
    ),
  ]);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Não foi possível completar a operação.");
  return data;
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("identity");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const startCooldown = () => {
    setResendCooldown(60);
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !birthDate) {
      setError("Preencha nome e data de nascimento.");
      return;
    }
    setLoading(true);
    try {
      const data = await callApi("identify", { fullName, birthDate });
      setResetToken(data.resetToken);
      if (data.needsPhone) {
        setStep("phone");
      } else {
        setMaskedPhone(data.maskedPhone);
        setStep("otp");
        startCooldown();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Informe seu telefone com DDD.");
      return;
    }
    setLoading(true);
    try {
      const data = await callApi("set-phone", { resetToken, phone });
      setMaskedPhone(data.maskedPhone);
      setStep("otp");
      startCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setLoading(true);
    try {
      await callApi("resend", { resetToken });
      startCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Informe o código recebido por SMS.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await callApi("confirm", { resetToken, code, newPassword });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 7) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };
  const strength = getPasswordStrength(newPassword);
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"][strength];
  const strengthText = ["Muito Fraca", "Fraca", "Média", "Forte", "Excelente"][strength];

  if (success) {
    return (
      <Card className="w-full max-w-md border-none shadow-2xl bg-white/95 backdrop-blur-md rounded-[2rem] p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-primary italic uppercase tracking-tighter">Senha Redefinida!</h2>
          <p className="text-sm text-primary/60 font-medium leading-relaxed italic">
            Tudo certo, <strong>{fullName.split(" ")[0]}</strong>. Sua nova senha já está ativa. É só entrar.
          </p>
        </div>
        <Button asChild className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 rounded-2xl shadow-xl border-none text-sm uppercase tracking-widest">
          <a href="/login">Ir para o Login</a>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-md rounded-[2rem]">
      <CardHeader className="space-y-1 pb-6 pt-8 text-center bg-primary/5 border-b border-dashed">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-accent" />
          </div>
        </div>
        <CardTitle className="text-xl font-black text-primary italic uppercase">Recuperar Acesso</CardTitle>
        <CardDescription className="text-xs font-medium italic px-4">
          {step === "identity" && "Confirme seus dados de cadastro pra começar."}
          {step === "phone" && "Não encontramos telefone no seu cadastro — informe um pra receber o código."}
          {step === "otp" && `Enviamos um código pro telefone ${maskedPhone}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pt-8 space-y-5 pb-8">
        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-[11px] font-bold">{error}</AlertDescription>
          </Alert>
        )}

        {step === "identity" && (
          <form onSubmit={handleIdentity} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como foi cadastrado pela escola"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Nascimento</Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 text-sm shadow-xl rounded-xl transition-all border-none uppercase tracking-widest">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
            </Button>
          </form>
        )}

        {step === "phone" && (
          <form onSubmit={handleSetPhone} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 90000-0000"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 text-sm shadow-xl rounded-xl transition-all border-none uppercase tracking-widest">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar Código"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Código Recebido</Label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold tracking-[0.3em]"
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="text-[10px] font-black uppercase text-accent/70 hover:text-accent disabled:text-muted-foreground/50 px-2"
              >
                {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pl-11 pr-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPass((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="px-2 space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                    <span className="text-primary/40">Segurança</span>
                    <span className={strength > 2 ? "text-emerald-500" : "text-orange-500"}>{strengthText}</span>
                  </div>
                  <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} transition-all duration-500`} style={{ width: `${(strength / 4) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary/40 px-2">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="pl-11 h-14 bg-muted/30 border-none rounded-xl font-bold"
                  required
                  disabled={loading}
                />
              </div>
              {confirmPassword && (
                <div className={`flex items-center gap-2 text-[11px] font-bold ml-2 ${newPassword === confirmPassword ? "text-emerald-600" : "text-red-500"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {newPassword === confirmPassword ? "Senhas coincidem" : "Senhas não coincidem"}
                </div>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/95 text-white font-black h-14 text-sm shadow-xl rounded-xl transition-all border-none uppercase tracking-widest">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Redefinir Senha"}
            </Button>
          </form>
        )}

        <div className="pt-1 space-y-3">
          <Button asChild variant="ghost" className="w-full text-[10px] font-black uppercase text-primary/40 h-10 rounded-xl">
            <a href="/login" className="flex items-center justify-center gap-2"><ArrowLeft className="h-3 w-3" /> Lembrei minha senha / Voltar</a>
          </Button>
          <p className="text-center text-[10px] text-muted-foreground/70 font-medium leading-relaxed px-2">
            Não conseguiu recuperar? Procure a secretaria para redefinir.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros novos em `ForgotPasswordForm.tsx`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Teste manual no browser**

Run: `npm run dev`, abrir `http://localhost:3000/forgot-password`.
- Preencher nome+nascimento de conta de teste com telefone cadastrado → confirmar que avança direto pra tela de código, SMS chega.
- Testar com conta de teste sem telefone → confirmar que aparece tela de telefone antes do código.
- Digitar código errado → confirmar mensagem de erro sem travar a tela.
- Digitar código certo + nova senha → confirmar tela de sucesso e login funcionando com a senha nova.
- Testar botão "Reenviar código" e o cooldown de 60s.

- [ ] **Step 5: Commit**

```bash
git add src/app/forgot-password/ForgotPasswordForm.tsx
git commit -m "feat: rewrite forgot-password form as 3-step SMS OTP wizard"
```

---

### Task 6: Atualizar CLAUDE.md com as novas env vars e status do backlog

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nada (documentação).
- Produces: nada (documentação).

- [ ] **Step 1: Adicionar as 4 novas env vars na seção "🔑 Variáveis de Ambiente"**

Editar o bloco existente em `CLAUDE.md` para incluir:

```
PASSWORD_RESET_TOKEN_SECRET  (server-side only — secret dedicado do wizard de recuperação por SMS)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

- [ ] **Step 2: Marcar a Fase 2 do plano de reset de senha como implementada**

Na seção "📱 Plano: reset de senha & primeiro acesso (telefone + SMS)", atualizar o título de
"NÃO IMPLEMENTADO" para refletir que a Fase 2 (reset self-service por SMS OTP) foi implementada,
mantendo Fases 1 e 3 como pendentes. Referenciar este plano
(`docs/superpowers/plans/2026-07-08-forgot-password-sms-otp.md`) como a implementação.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document SMS OTP env vars and mark recovery Phase 2 as implemented"
```

---

## Pós-implementação (fora deste plano, ação do usuário)

- Criar conta Twilio, comprar/configurar número compatível com Brasil (ou Messaging Service).
- Definir `PASSWORD_RESET_TOKEN_SECRET` com valor aleatório forte (ex.: `openssl rand -hex 32`) nas env vars de produção (Vercel).
- Definir `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` nas env vars de produção.
- Rodar `npx supabase db push` contra o projeto remoto de produção (Task 1 já cobre isso no ambiente de desenvolvimento/staging usado durante a implementação).
