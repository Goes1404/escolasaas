# Esqueci minha senha via SMS OTP

## Contexto

Hoje `/forgot-password` (`ForgotPasswordForm.tsx` + `api/student/primeiro-acesso` ação
`recover`) reseta a senha só com nome + telefone + data de nascimento digitados — nenhum
desses três é segredo, então não há prova real de que o solicitante é dono da conta, só
prova de que ele *conhece dados cadastrais*. O CLAUDE.md já documenta esse gap como
"Fase 2: reset self-service por SMS OTP" (não implementada).

Este spec substitui a ação `recover` por um fluxo que soma **posse do telefone** (via
código enviado por SMS) à verificação de identidade já existente (nome + data de
nascimento). As ações `search` e `register` da mesma rota não são alteradas.

## Objetivo

Aluno redefine a própria senha sem depender da secretaria, com prova de identidade real:
nome+nascimento batem com um cadastro E o aluno tem acesso físico ao telefone cadastrado
(ou consegue provar identidade para cadastrar um novo, no caso de conta sem telefone).

## Fora de escopo

- Gate obrigatório de telefone na home (Fase 1 do CLAUDE.md) — não faz parte deste spec.
- Reset manual pela secretaria — já existe, não muda.
- Rotação da senha `compromisso2026` — item separado do backlog de segurança.

## Arquitetura

### Nova tabela `password_reset_otps`

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | FK profiles.id |
| code_hash | text | sha256 do código de 6 dígitos, nunca plaintext |
| expires_at | timestamptz | now() + 5 min |
| attempts | int default 0 | incrementa a cada tentativa errada de `confirm` |
| consumed | boolean default false | true após reset de senha bem-sucedido |
| created_at | timestamptz default now() | |

RLS: sem acesso de cliente; só service role escreve/lê (mesmo padrão de
`password_reset_attempts`).

### resetToken assinado

Token opaco (HMAC-SHA256, mesmo padrão de `src/lib/registration-token.ts`) carregando
`userId` + `exp` (10 min). **Usa secret dedicado** `PASSWORD_RESET_TOKEN_SECRET` (nova env
var) — não reaproveita `SUPABASE_SERVICE_ROLE_KEY` como HMAC key (esse reuso já está
mapeado como débito ALTO no CLAUDE.md para `registration-token.ts`; este código novo não
repete o problema). Client recebe e ecoa o token entre as telas; servidor sempre
re-verifica assinatura antes de qualquer ação.

### `src/lib/sms.ts`

Wrapper fino sobre o SDK oficial `twilio` (npm). Export único:
`sendOtpSms(phone: string, code: string): Promise<void>`. Lança erro se envio falhar —
rota chamadora converte em HTTP 503.

Env vars novas: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
(server-side only, nunca `NEXT_PUBLIC_*`).

### Rota `api/student/primeiro-acesso`

Ação `recover` é removida. Quatro ações novas substituem o fluxo:

- `identify` — { fullName, birthDate }
- `set-phone` — { resetToken, phone }
- `resend` — { resetToken }
- `confirm` — { resetToken, code, newPassword }

## Fluxo de telas

1. **Identidade** — aluno digita nome completo + data de nascimento.
   `POST { action: 'identify', fullName, birthDate }`.
   Server busca candidato (reusa `generateEmail` + `.or()` sanitizado, igual hoje) e
   aplica o mesmo rate limit por identidade+IP já existente
   (`password_reset_attempts`, tabela reaproveitada sem mudança de schema).
   - Match com telefone cadastrado → gera código de 6 dígitos, grava hash em
     `password_reset_otps`, envia SMS, responde `{ resetToken, maskedPhone: '***-1234' }`.
   - Match sem telefone → responde `{ resetToken, needsPhone: true }` (nenhum SMS ainda).
   - Sem match → erro genérico 401 (mesma mensagem de hoje, anti-enumeração), conta
     tentativa falha no rate limit.

2. **Telefone** (só quando `needsPhone`) — aluno digita telefone novo.
   `POST { action: 'set-phone', resetToken, phone }`.
   Server valida assinatura+expiração do `resetToken`, grava `phone` no profile do
   `userId` do token, gera código, grava hash, envia SMS, responde `{ maskedPhone }`.

3. **Código + Nova Senha** (uma tela, um submit) — aluno digita código de 6 dígitos +
   nova senha + confirmação.
   `POST { action: 'confirm', resetToken, code, newPassword }`.
   Server valida token, busca OTP não consumido do `userId`, compara hash do código:
   - Código certo e não expirado → reseta senha via a mesma chamada PUT admin
     (`/auth/v1/admin/users/:id`) já usada hoje, marca OTP `consumed`, responde
     `{ success: true }`.
   - Código errado → incrementa `attempts`; ao atingir 5, invalida o OTP (aluno precisa
     reiniciar do passo 1) e responde erro genérico.
   - Expirado → erro pedindo reenvio.

4. **Reenviar código** — botão na tela 3, com cooldown de 60s no client.
   `POST { action: 'resend', resetToken }`. Server valida token, gera novo código
   (invalida o anterior), envia SMS.

## Tratamento de erros

- Mensagens de erro sempre genéricas quanto à existência de conta (anti-enumeração),
  mesmo padrão do `recover` atual.
- Falha no envio de SMS (Twilio fora do ar, número inválido) → HTTP 503, mensagem
  "Não foi possível enviar o SMS agora. Tente novamente."
- `resetToken` expirado/adulterado em qualquer ação → erro claro pedindo reiniciar o
  fluxo (não crasha, não vaza detalhe de verificação de assinatura).
- Rate limit por identidade+IP idêntico ao já existente na ação `identify` (reaproveita
  `password_reset_attempts`); ações `set-phone`/`resend`/`confirm` são gated pela posse de
  um `resetToken` válido, que já é caro de obter em massa por causa do rate limit acima.

## Componentes de UI

`ForgotPasswordForm.tsx` vira wizard de 3 passos (estado local `step: 'identity' |
'phone' | 'otp'`), mantendo o visual atual (mesmos Card/Input/Button, mesma paleta).
Sem mudança de rota — continua `/forgot-password`.

## Testes / verificação manual

- Conta com telefone: identity → recebe SMS real (ambiente com Twilio configurado) →
  confirm com código certo reseta senha → login funciona com senha nova.
- Conta sem telefone: identity → phone → confirm, mesmo resultado.
- Código errado 5x → token invalidado, precisa reiniciar.
- Código expirado (esperar >5min ou ajustar `expires_at` manualmente em teste) → erro
  correto.
- resetToken adulterado (editar payload manualmente) → rejeitado em toda ação.
- Nome/data inexistentes → erro genérico, sem diferenciar de "conta existe mas telefone
  não bate".
- `npm run typecheck` e `npm run build` limpos.
