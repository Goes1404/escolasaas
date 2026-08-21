# Status do deploy (Supabase + Vercel)

Arquivo de memória para retomar o trabalho sem precisar re-investigar tudo.
Atualizado em 21/08/2026, sessão de cherry-pick do repo antigo → escolasaas.

## Projeto Supabase em uso

- **Ref**: `sgkgsjmfcsgfxliwvwjg` (URL: `https://sgkgsjmfcsgfxliwvwjg.supabase.co`)
- **110/110 migrations aplicadas.** A `remote_schema_pull` (3727 linhas) e mais 21
  migrations precisaram de reordenação/correção manual — detalhes de cada fix
  estão só no histórico da conversa, não documentados em arquivo (se precisar
  reconstruir, a lógica foi: topological sort por dependência de tabela, não
  por data do arquivo).
- As chaves (anon/publishable, service_role/secret) estão em `.env.local`
  (gitignored, não versionado) e foram coladas pelo usuário diretamente no
  chat — não estão repetidas aqui de propósito.

## Usuários de teste (criados via `scripts/seed-test-users.mjs`)

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@compromisso.com` | `mudar123` |
| staff (secretaria) | `secretaria@compromisso.com` | `mudar123` |
| teacher | `professor@compromisso.com` | `mudar123` |
| student | `aluno@compromisso.com` | `mudar123` |

Login validado via API (`/auth/v1/token?grant_type=password`) para os 4.

**Achado ao criar esses usuários**: 3 das 4 contas (admin/professor/aluno) já
existiam no banco, criadas por `INSERT INTO auth.users` direto em migrations
antigas (`20240725000000_initial_schema`, `20260615000000_demo_accounts_seed`).
Isso deixa colunas de token (`confirmation_token` etc.) como `NULL` em vez de
string vazia, e o GoTrue rejeita login com "Database error querying schema".
Corrigido rodando um `UPDATE auth.users SET ... = COALESCE(..., '')` nessas 3
contas (o usuário rodou no SQL Editor do painel, já aplicado). Se aparecer de
novo em outra conta legada, o sintoma e o fix são esses.

## Vercel — pendências para o deploy funcionar de verdade

Projeto: `escolasaas` (team `sq1matheusgsilva-7306s-projects`,
`prj_BKX5bUMaZkFkmYXbPE0ZkrJhoyAe`). Vários deploys já feitos, build passa sem
erro. Dois problemas encontrados que **ainda não sei se o usuário corrigiu**:

1. **Env vars de Production apontavam para o Supabase ERRADO**
   (`wyqfyrfkudxroumggnnp.supabase.co`, confirmado lendo o chunk JS da página
   de login em produção). Precisa trocar em Settings → Environment Variables
   (ambiente Production):
   - `NEXT_PUBLIC_SUPABASE_URL` → `https://sgkgsjmfcsgfxliwvwjg.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → a publishable key (está no `.env.local`)
   - `SUPABASE_SERVICE_ROLE_KEY` → a secret key (está no `.env.local`)
   - Depois de trocar, **precisa de redeploy manual** (env var não dispara
     rebuild sozinha).

2. **"Vercel Authentication" (SSO protection) está ligada**
   (`ssoProtection.enabled: true`, `deploymentType: "all_except_custom_domains"`).
   Bloqueia qualquer pessoa fora do time da Vercel — nenhum aluno real
   consegue chegar na tela de login. Usuário autorizou desligar, mas a
   ferramenta MCP (`update_project_deployment_protection`) devolveu
   `403 forbidden` (token do MCP sem permissão de admin no projeto). Precisa
   ser desligada manualmente em Settings → Deployment Protection.

**Próximo passo ao retomar**: perguntar se essas duas coisas já foram feitas
no painel; se sim, disparar redeploy (ou pedir pro usuário) e revalidar login
em produção do mesmo jeito que foi validado localmente (curl no
`/auth/v1/token`, depois conferir que o HTML/JS servido aponta para
`sgkgsjmfcsgfxliwvwjg`, não para o projeto antigo).

## Git

Branch de trabalho: `claude/cherry-pick-old-repo-commit-1d8tnl`, sincronizada
com `main` (mesma HEAD nas últimas verificações — sem divergência).
