# Status do deploy (Supabase + Vercel)

Arquivo de memória para retomar o trabalho sem precisar re-investigar tudo.
Atualizado em 22/08/2026 (renomeação da marca para Dalí).

## Marca: Dalí (22/08)

O produto deixou de se chamar "Plataforma EAD"/"Compromisso" e passou a ser
**Dalí**. O Compromisso continua existindo — como primeiro cliente, não como
nome do produto.

Já aplicado, em código e em banco:

- `DEFAULT_TENANT` (`src/lib/tenant.ts`) e a **linha `slug='default'` da tabela
  `tenants`** em produção: `name`/`appName` = `Dalí`, `logoUrl` =
  `/logo-dali.svg`. Versionado em `supabase/migrations/20260822120000_marca_dali.sql`.
- Landing (nav, preloader, rodapé), `metadata` da landing e do layout raiz,
  `appleWebApp.title`, manifest do PWA, login, primeiro acesso, `LoadingShell`,
  `PhoneGate` e o recibo da secretaria.
- Ícones do PWA/favicon **regerados** do desenho novo (`npx tsx
  scripts/gen-icons.ts`). `themeColor` saiu do azul `#1E40AF` — que não existe
  mais na paleta — para a tinta `#09090f`.
- Componentes órfãos da landing antiga removidos (`HeroBook`, `HeroShowcase`,
  `DashboardMockup`, `FeatureBentoGrid`, `FlowSection`, `FluidAccessSection`,
  `BottomSections`) — eram os últimos a apontar para `/images/default-logo.png`.
- Removida também `src/app/guardian/%5Btoken%5D/` — duplicata desatualizada e
  URL-encoded da rota do portal do responsável, criada por engano no commit de
  multi-tenant. A rota boa é `guardian/[token]`.

**Pendente da marca:** nada em código. Se um dia houver domínio próprio, é lá
que o nome aparece publicamente pela primeira vez.

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

## Módulos de gestão escolar (22/08/2026) — Financeiro, Portal, Rematrícula

Três módulos novos de "escola particular" (benchmark: Sponte, TOTVS, ClassApp,
Agenda Edu), implementados nesta ordem porque 2 e 3 dependem de 1. Migrations
`20260822100000` → `20260824110000` (6 arquivos), TODAS já aplicadas no
projeto `sgkgsjmfcsgfxliwvwjg` e versionadas no repo. Testado de ponta a ponta
por REST com login real (idempotência, RLS, permissões, aceite duplo).

1. **Financeiro de mensalidades** — `tuition_plans`, `student_plan_subscriptions`,
   `student_discounts`, `invoices` (unique parcial aluno+competência),
   `invoice_events`. RPCs staff: `generate_monthly_invoices` (idempotente),
   `register_invoice_payment`, `cancel_invoice`, `renegotiate_invoice`;
   `mark_overdue_invoices` roda em pg_cron diário (6h UTC) e a UI também
   deriva "vencida". Páginas: `secretary/tuition` (KPIs, faturas, planos,
   bolsas, recibo imprimível), `student/finance` (leitura). Sem gateway —
   pagamento manual; `external_id`/`gateway` reservados. `src/lib/print-utils.ts`
   centraliza `esc()`/impressão (documents/page.tsx importa de lá).
2. **Portal dos responsáveis** — `guardian_access_tokens` (token POR
   responsável, gerado no banco, expira em 1 ano, revogável; gestão no
   `GuardiansCard`), RPCs públicas por token `get_guardian_portal` (payload
   único: engajamento, frequência, boletim, financeiro, comunicados) e
   `ack_guardian_announcement`. `announcements.audience`
   (students/guardians/all; default students) + `guardian_announcement_reads`
   (confirmação de leitura, contador na secretary/communication). Murais do
   aluno filtram `.neq('audience','guardians')` (UrgentNotice, NotificationBell,
   home). Tokens legados por aluno seguem no fallback da página.
3. **Rematrícula digital** — `reenrollment_campaigns` (template com
   {{aluno}}/{{valor}}/{{ano}}, plano do ano alvo) + `reenrollment_agreements`
   (aceite eletrônico simples MP 2.200-2: nome+CPF+IP+UA+snapshot).
   `open_reenrollment_campaign` (staff, seed reexecutável);
   `accept/refuse_reenrollment` são EXECUTE **só service_role** — o aceite
   passa pelas rotas `/api/reenrollment/accept` (aluno logado) e
   `/api/guardian/[token]/reenrollment` (portal), que capturam o IP real.
   Aceite cria a subscription do ano seguinte (fecha o ciclo com o financeiro).
   Páginas: `secretary/reenrollment` (campanha, funil, impressão do contrato),
   `student/reenrollment`, aba Rematrícula no portal.

Dados de demo já no banco: plano 2026 (R$850, aluno com bolsa de 50% → R$425;
agosto paga via PIX, setembro aberta), plano 2027 (R$920) + campanha
"Rematrícula 2027" ativa e ACEITA pela responsável de teste (contrato
imprimível na secretary/reenrollment), token do portal
`/guardian/demotoken-responsavel-maria-2026`.

Extra: `20260824110000` revoga `funil_alunos` de anon/PUBLIC (pendência do
security advisor — a view junta auth.users; staff usa a RPC `obter_funil_alunos`).

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
