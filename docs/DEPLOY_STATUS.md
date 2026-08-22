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

## Conteúdo de demonstração (inserido direto no banco, sem migration)

Pedido do usuário: "quero algo para apresentar". Descoberta importante: as
contas `aluno@compromisso.com` e `professor@compromisso.com` **já tinham**
uma história de demo bem construída, vinda de `20260615000000_demo_accounts_seed`
+ a reconciliação de XP (`20260729180000`) — 3 redações corrigidas, notas, 3
simulados ("Simulado ENEM 1/2/3") com `exam_attempts` e nota, streak, etc. Não
recriei nada disso; só somei em cima.

O que foi adicionado (tudo via `execute_sql`, dados puros — nenhuma migration
nova, nenhum arquivo no repo):
- **15 questões novas**, reais (não placeholder), 3 cada em Matemática,
  Português, Biologia, História, Geografia — `teacher_id` = professor.
- **1 exame novo** "Simulado ENEM — Demonstração" com 10 dessas questões
  linkadas via `exam_questions` (os 3 exames antigos continuam sem questões
  linkadas — não mexi neles).
- **2 trilhas publicadas** ("Matemática Básica para o ENEM", "Redação Nota
  1000"), cada uma com 2 módulos e 2 aulas por módulo.
- **1 turma** ("3º Ano ENEM — Manhã"), **3 materiais de aula**, **5 itens de
  biblioteca** (2 livros com prefixo `LIVRO|`, 3 recursos avulsos).
- **2 fóruns** com 3 posts (pergunta do aluno + resposta do professor).
- **1 aula ao vivo agendada** (daqui a 2 dias, host = professor).
- Para o **aluno**: bichinho adotado (lobinho "Fumaça"), streak atualizada
  (6 dias correntes), ~245 XP novo somado ao histórico já existente (total
  agora **3.485 XP** — número alto de propósito, mostra um aluno engajado),
  15 respostas de questão, 1 tentativa completa no exame novo (nota 90), 3
  flashcards em revisão, 1 redação nova (880/1000) e 2 notas novas no
  caderno.

Se quiser mais conteúdo (mais questões, mais trilhas, dados para o
admin/secretaria), é só pedir — o padrão de UUIDs usado aqui é
`1111...`=questões, `2222...`=exame, `3333...`=trilhas/módulos/conteúdo,
`4444...`=turma, `5555...`=fóruns, então dá pra estender sem colidir.

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
