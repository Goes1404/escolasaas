# Compromisso → escolasaas: transformação multi-tenant white-label

> Status geral: **Fase 1 concluída** (14/08/2026). Fases 2-6 pendentes.

## Contexto

`testecompromisso` é hoje uma plataforma mono-tenant, em produção, para um único
cliente (Cursinho Compromisso, Santana de Parnaíba): marca, cores, textos,
prompt de IA e até uma senha padrão (`compromisso2026`) estavam hardcoded no
código. `escolasaas` (este repositório) é uma **cópia** desse projeto que vai
virar o **core reutilizável** de uma plataforma SaaS: qualquer escola cadastra
um tenant, ganha subdomínio próprio, marca própria (logo/cores/nome) e os
mesmos módulos (simulados, redação, fórum, Aurora/IA, lives) isolados dos
dados de outras escolas. A home pública deste projeto deixa de ser o portal do
Compromisso e passa a ser uma landing comercial — vender a plataforma para
escolas, não logar aluno.

Pré-requisitos assumidos (confirmados com o usuário):
- **Projeto Supabase novo e separado** vai ser criado para este core — nenhuma
  migration/RLS deste plano roda contra o banco de produção do Compromisso.
- **Remote git novo e separado** — este repo não vai commitar por cima do
  histórico/remote do `testecompromisso` original.
- Execução **fase por fase**, com checkpoint de revisão entre cada uma.

### O que já existia (scaffold parcial, desconectado)

Uma tentativa anterior já tinha deixado peças soltas no código, não usadas por
nada — servem de base pras Fases 2-4 em vez de recomeçar do zero:
- `src/lib/tenant.ts` — `TenantConfig`, `DEFAULT_TENANT`, `extractTenantSlug(host)`.
- `src/components/TenantProvider.tsx` — contexto React, mas **não está montado**
  em `layout.tsx`.
- `src/app/api/tenant/config/route.ts` — busca tenant por slug na tabela
  `tenants`, com fallback pro `DEFAULT_TENANT`.
- `src/middleware.ts` — já extrai `x-tenant-slug` do host e propaga no header,
  mas só nas rotas do matcher atual (`/dashboard/:path*`, `/login`) — API não
  recebe.
- `supabase/migrations/20260814000000_create_tenants_and_multitenancy.sql` —
  cria tabela `tenants` + `tenant_id` em só **6 de ~50 tabelas**
  (`profiles`, `classes`, `questions`, `essay_submissions`, `notes`,
  `scheduled_lives`). **Nenhuma policy de RLS existente foi alterada** para
  filtrar por tenant — a coluna existe mas não protege nada ainda. A policy de
  gestão (`Super admin gerencia tenants`) checa `profiles.role = 'admin'`
  direto, inconsistente com o padrão do projeto
  (`check_user_is_staff_or_admin()`, ver `20260524000000_add_secretary_rls.sql`).

---

## Fase 1 — Sanitização & desvinculação do Compromisso ✅ FEITO (14/08/2026)

Objetivo: tirar o hardcode de marca/dados do cliente original, sem ainda
mexer em schema de banco.

- ✅ **71 arquivos removidos** da raiz: dumps de aluno real (`auth_users_dump.json`,
  `students_data.json`, `full_student_list_grouped.md`, etc.), ~40 scripts de
  debug one-off (`check_bianca.mjs`, `reset_joelma.mjs`, `register_ana.mjs`...),
  logs de build, e docs específicos do cliente (`PROPOSTA_COMERCIAL_COMPROMISSO.md`,
  `DEMO_ACCOUNTS.md`).
- ✅ `layout.tsx`/`manifest.ts`: título, description, keywords, `themeColor`
  (`#FF6B00` → `#1E40AF`) e `appleWebApp.title` genéricos.
- ✅ Logo: `logocompromisso.png` → `/images/default-logo.png` em 8 componentes
  (`LoginForm`, `dashboard/layout`, `register`, `dashboard/home`,
  `guardian/[token]`, `HeroBook`, `BottomSections`, `page.tsx`).
- ✅ Removido `cityLogoUrl` (brasão da prefeitura) e texto "Plataforma
  Patrocinada pela Prefeitura" (`dashboard/layout.tsx`, `dashboard/home`,
  `BottomSections`) — inclusive o endereço físico real, CNPJ fake e
  "Colégio Colaço" que estavam no footer da home.
- ✅ Cores: tokens `--primary`/`--secondary`/`--accent`/sidebar em
  `globals.css` (laranja → azul `226 71% 40%`), gradientes utilitários
  (`.bg-login-gradient`, `.text-gradient-fire`, `.btn-orange-neon`), rgba
  inline em `page.tsx` e `LoginForm.tsx`.
- ✅ Senha padrão: `compromisso2026` → `DEFAULT_USER_PASSWORD` env var
  (fallback `mudar123`) em `api/admin/create-user/route.ts` + 3 telas que
  exibiam/pré-preenchiam o literal.
- ✅ Prompt da Aurora extraído pra `src/lib/aurora-prompt.ts`
  (`buildAuroraSystemPrompt(institutionName)`), parametrizável por
  instituição em vez de fixar "cursinho Compromisso... ENEM e ETECs".
- ✅ Varredura final: 41 arquivos com "Compromisso"/"Santana de Parnaíba"
  residual corrigidos (comentários de cabeçalho, títulos de página, textos
  de UI, certificado em canvas, recibo/documento gerado em HTML, PDF de
  ranking, SMS, classe CSS do tour guiado, chaves de `localStorage`).
- ✅ `npm run typecheck` limpo. `npm run build` validado no meio do processo
  (rodar de novo antes de prosseguir — disco ficou sem espaço no fim da Fase 1).

**Deixado de propósito pra fases seguintes** (não é pendência esquecida):
- Domínio de e-mail `@compromisso.com`/`compromissose.com` (~10 arquivos,
  incl. `generateEmail()` em `api/admin/create-user/route.ts`) — é lógica
  funcional de geração de login, não cosmética. Mexer sem a infra de tenant
  pronta quebraria auth. **Fase 3.**

### Cor principal trocada pra azul (14/08/2026) ✅ APLICADA

A pedido do usuário, `--primary` deixou de ser o pink (`#ED3474`) e virou o
ciano/azul da paleta (`#4CCCED`) — o pink foi rebaixado a cor secundária/
destaque (`--brand-pink`, usado nos gradientes decorativos). Trocado em:
- `globals.css` (tokens `--primary`/`--secondary`/`--muted`/`--ring`/
  `--brand-dark`/`--sidebar-primary`/`--sidebar-accent`/`--sidebar-ring`,
  os 3 gradientes decorativos recompostos pra liderar com ciano).
- `src/lib/tenant.ts` (`DEFAULT_TENANT.branding`) e a migration
  `20260814000000` (branding JSON do tenant "default").
- Os ~34 arquivos que tinham hex/rgba de primary hardcoded (herdados do
  sweep da Fase 1) — swap mecânico `#ED3474→#4CCCED`, `#B91C5C→#0F7A95`
  (hover mais escuro), `rgba(237,52,116,*)→rgba(76,204,237,*)`.
- `--primary-foreground` mudou de branco pra quase-preto (`0 0% 8%`) — ciano
  claro (L 61%) não tem contraste suficiente com texto branco. ⚠️ **Ressalva**:
  isso só corrige automaticamente componentes que usam a classe semântica
  `text-primary-foreground`. Muitos botões pelo app usam `text-white` literal
  junto de `bg-primary` (não a classe semântica) — esses continuam brancos
  sobre ciano claro e merecem uma auditoria de contraste antes de ir pra
  produção. Não foi feito agora por ser um escopo bem maior (dezenas de
  arquivos) do que só "trocar a cor".

### Paleta de marca definida (14/08/2026) ✅ APLICADA

O usuário forneceu a paleta final: `#ED3474` (pink), `#4CCCED` (ciano),
`#EDE04C` (amarelo), `#638D98` (slate), `#6E6C5A` (oliva). Já aplicada:

- `--primary` = pink `#ED3474` (era placeholder azul provisório), `--accent`
  = amarelo `#EDE04C`, `--secondary`/`--muted` = tint claro do pink. Tons
  ciano/slate/oliva disponíveis como `--brand-cyan`/`--brand-slate`/`--brand-olive`
  em `globals.css` pra uso pontual (Fase 4 decide onde).
- Os ~31 arquivos com laranja hardcoded (`#FF6B00`, `rgba(255,107,0,...)`,
  `#e06000` hover) identificados no fim da Fase 1 foram todos convertidos pro
  pink da nova paleta.
- `src/lib/tenant.ts` (`DEFAULT_TENANT.branding`) e a migration
  `20260814000000` (branding JSON do tenant "default") atualizados com os
  mesmos hex, pra Fase 2/4 já nascerem com o valor certo em vez do azul
  provisório.
- **Não tocado de propósito**: classes Tailwind do preset padrão (`bg-orange-100`,
  `text-orange-600` etc.) usadas como cor semântica de UI em badges/status
  soltos pela plataforma (ex.: badge "ETEC", indicador de isenção) — isso não
  é a cor de marca, é uso comum de paleta de UI, não fazia parte do escopo.
  Nomes de classe CSS internos tipo `.glow-orange` (em `globals.css`) também
  ficaram com o nome antigo — já usam o hex novo por dentro, renomear é só
  cosmético de manutenção, não afeta o usuário.

**Verificação**: `npm run typecheck` + `npm run build` limpos; grep por
`Compromisso|Santana de Parnaíba|compromisso2026` em `src/` só deve retornar
os dois itens acima (domínio de e-mail, comentário histórico em `manifest.ts`)
e usos genuínos da palavra portuguesa comum "compromisso" fora de nome de marca.

---

## Fase 2 — Banco de dados multi-tenant (Supabase novo) ⏳ PENDENTE

Pré-condição: projeto Supabase novo já criado, `NEXT_PUBLIC_SUPABASE_URL` /
`ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` apontando pra ele.

- **Aplicar as 110 migrations existentes** nesse banco novo do zero (schema
  atual do Compromisso vira o baseline do produto genérico).
- **Corrigir a migration `20260814000000`**:
  - Trocar a policy `Super admin gerencia tenants` pra usar
    `check_user_is_staff_or_admin()` (padrão do projeto) em vez de checar
    `profiles.role` direto.
  - Levantar a lista completa de tabelas que precisam de `tenant_id` — não só
    as 6 já cobertas. Usar como checklist: `subjects`, `exams`,
    `exam_questions`, `exam_attempts`, `student_question_answers`,
    `user_badges`, `learning_trails` (+ módulos/conteúdos),
    `library_items`/`library_resources`, `forums` (+ posts/threads/replies/
    bans), `classes` (+ `class_sessions`, `attendance_records`),
    `report_card_entries*`, tabelas de gamificação (`pets`,
    `student_xp_log`, `ranking_cycles`, `weekly_missions`, `daily_*`),
    `direct_messages`/`chat_messages`/`notifications`/`invitations`,
    `announcements`. Decidir caso a caso: tabela com dono direto
    (`user_id`/`profile_id`) pode herdar tenant via join com `profiles` em vez
    de coluna própria — documentar a decisão por tabela em vez de adicionar
    `tenant_id` em tudo cegamente.
  - Resolver a duplicidade de schema em português (`matérias`, `questões`
    vindas de `20260712000000_remote_schema_pull.sql`) — decidir se são
    lixo a dropar ou se algo depende delas antes de migrar.
- **Reescrever as policies de RLS** das tabelas com `tenant_id` para
  incluir o filtro de tenant, seguindo o padrão já estabelecido no projeto
  (função `SECURITY DEFINER` tipo `check_user_is_staff_or_admin`, nunca
  `auth.jwt()->>'user_role'` — causa-raiz já documentada no CLAUDE.md: esse
  claim é sempre `null` porque não há access token hook configurado).
- **`handle_new_user()`** (trigger em `auth.users`) — hoje não lê nada de
  tenant do `raw_user_meta_data`; precisa gravar `tenant_id` no `profiles` no
  cadastro, resolvido a partir do subdomínio/contexto de convite.
- **Edge functions com service role sem tenant** (`delete-all-students-only`,
  `reset-students-only`, `reset-user-password-next-login`,
  `create-auth-users`, `backfill-teachers-auth`) — hoje afetam todos os
  registros por role, sem filtrar tenant; precisam de tenant guard antes de
  multi-tenant valer pra valer (senão "apagar todos os alunos" apaga de todas
  as escolas).

**Verificação**: script de simulação RLS (`set role authenticated` +
`request.jwt.claims`) tentando ler/escrever dado do Tenant B logado como
Tenant A, pra cada tabela alterada — zero linha vazando.

---

## Fase 3 — Resolução de tenant no backend/middleware ⏳ PENDENTE

- **Expandir o matcher do `src/middleware.ts`** — hoje só cobre
  `/dashboard/:path*` e `/login`; nenhuma rota de `/api/*` recebe
  `x-tenant-slug`. Ampliar pra cobrir tudo (exceto assets estáticos, já
  tratado) ou resolver tenant também dentro de cada API route via helper
  compartilhado.
- **`src/lib/server-auth.ts`**: estender `requireAdminUser()` /
  `requireTeacherOrAdmin()` (e criar equivalente básico) pra também retornar
  `tenantId` do perfil, e todas as rotas `/api/admin/*`, `/api/student/*`
  etc. passarem a filtrar consultas por esse `tenant_id` — hoje nenhuma rota
  tem esse conceito.
- **Reescrever `generateEmail()`** (`api/admin/create-user/route.ts`) e os
  demais pontos que hardcodam `@compromisso.com`/`compromissose.com` — domínio
  de login vira função do tenant, não constante global.
- **Unificar os clients Supabase**: hoje coexistem 3 padrões
  (`src/app/lib/supabase.ts` singleton, `src/utils/supabase/client.ts` por
  chamada, `src/utils/supabase/server.ts`/`server-auth.ts` por request) — não
  precisa virar um só, mas nenhum hoje é tenant-aware; decidir onde o
  `tenant_id` entra (via RLS automática pelo `profiles.tenant_id` do usuário
  logado é suficiente pra maioria dos casos; rotas públicas sem sessão —
  landing, cadastro, `api/tenant/config` — precisam do slug do host).
- **`next.config.ts`**: hoje sem `rewrites()`/config de domínio. Definir
  estratégia de subdomínio (`escolaA.escolasaas.com`) vs domínio customizado
  (`custom_domain` já existe na tabela `tenants`) — provavelmente não precisa
  de rewrite (Next.js App Router resolve isso via middleware + header), mas
  confirmar durante a implementação.
- **Fluxos de convite/cadastro** (`register/`, `cadastro/`,
  `primeiro-acesso/`, `api/student/self-register`,
  `api/student/validate-invite`) — vincular o novo usuário ao `tenant_id`
  resolvido da URL de acesso.

**Verificação**: acessar `http://escola-a.localhost:3000` vs
`http://escola-b.localhost:3000`, confirmar que login/cadastro de um não
vaza pro outro e que `x-tenant-slug` chega em rotas de API.

---

## Fase 4 — Frontend white-label dinâmico ⏳ PARCIAL (14/08/2026)

- ✅ **`TenantProvider` montado** em `src/app/layout.tsx` (Server Component
  async): lê o host via `next/headers`, resolve o tenant com
  `getTenantForHost()` (novo, `src/lib/get-tenant.ts` — extrai a lógica que
  antes só existia em `api/tenant/config`, reaproveitada pelos dois) e passa
  como `initialTenant`. Sem tabela `tenants` ainda (Fase 2 não rodou), sempre
  cai no `DEFAULT_TENANT` — funciona igual a hoje, sem regressão.
- ✅ **CSS variables reais conectadas**: `deriveBrandTokens()` (novo, em
  `src/lib/tenant.ts`) converte o hex do branding pra HSL e escreve direto em
  `--primary`/`--secondary`/`--muted`/`--accent`/`--ring`/`--brand-dark`/
  `--sidebar-primary`/`--sidebar-accent`/`--sidebar-ring` — os mesmos tokens
  que `tailwind.config.ts` já usa. As antigas `--primary-tenant`/
  `--secondary-tenant` (nunca lidas por ninguém) saíram. `--secondary`/
  `--muted` seguem o mesmo matiz do `--primary` só que bem claros, espelhando
  o papel deles no design system atual (tom de fundo, não cor independente).
- ✅ **Logo/nome dinâmicos**: `useTenant().tenant.branding.logoUrl`/`.appName`
  ligados em `LoginForm.tsx`, `dashboard/layout.tsx` (sidebar),
  `register/page.tsx`, `guardian/[token]/page.tsx`, `dashboard/home/page.tsx`.
  A landing pública (`src/app/page.tsx`, `BottomSections.tsx`, `HeroBook.tsx`)
  ficou de propósito com o logo genérico fixo — ainda é o site comercial da
  escolasaas em si, não a página de uma escola-cliente.
- ✅ **`src/app/manifest.ts` dinâmico**: `name`/`short_name`/`theme_color` vêm
  do tenant resolvido pelo host. Ícones (`icon-192.png` etc.) continuam fixos
  de propósito — precisam de asset quadrado pré-dimensionado por escola pra
  não repetir o bug de instalação já documentado no arquivo; virar por-tenant
  é trabalho futuro (upload de ícone no backoffice da Fase 5).
- ✅ **Persona da Aurora por tenant**: `api/chat/route.ts` resolve o tenant
  pelo host da própria request (`getTenantForHost()`, já que é rota
  server-side sem acesso ao contexto React do `TenantProvider`) e passa
  `tenant.branding.appName` pro `buildAuroraSystemPrompt()`.
- ✅ **Home pública nova — FEITO (14/08/2026)**: `src/app/page.tsx` e os
  componentes de `src/components/home/` deixaram de ser a landing herdada do
  Compromisso (student-facing, "Sua Aprovação é o nosso objetivo") e viraram
  landing comercial B2B — pública-alvo definida com o usuário: **escolas/
  instituições em geral**, não só cursinho preparatório.
  - `HeroShowcase.tsx`: headline/stats pivotados pra proposta de valor da
    plataforma (marca própria, isolamento de dados, mentoria IA), CTA
    principal vira "Falar com a gente" (WhatsApp).
  - `FlowSection.tsx`: timeline saiu de "fluxo do aluno" (login → aprovação)
    pra "como funciona pra sua escola" (contato → branding → importação de
    alunos → uso → acompanhamento).
  - `FluidAccessSection.tsx`: widget de login de aluno removido da landing
    (não fazia sentido pro comprador B2B) — virou CTA de contato; login real
    for clientes existentes ficou como link secundário.
  - `BottomSections.tsx`: galeria de fotos do prédio físico do Compromisso e
    a seção de mapa/endereço **removidas** (eram fotos/endereço reais do
    cliente original, não fariam sentido — nem seriam apropriadas — numa
    landing SaaS genérica) e substituídas por uma seção de proposta de valor
    (branding, isolamento de dado, módulos configuráveis). Depoimentos
    viraram baseados em papel (coordenação/direção/secretaria) em vez de
    aluno aprovado em universidade específica. FAQ reescrito pra perguntas de
    comprador B2B (preço, isolamento de dado, tempo de implantação).
  - CTA usa WhatsApp real (`src/lib/site-contact.ts`, novo) — número fornecido
    pelo usuário. E-mail de contato ainda é placeholder
    (`contato@escolasaas.com`) até ter um definitivo.
  - A landing **por tenant** (quando acessada via subdomínio de uma escola
    específica já cliente) continua em aberto — decisão de produto pra Fase
    3/4: pode ser a mesma home genérica sempre no domínio raiz, com cada
    subdomínio pulando direto pro login da escola.

**Verificação**: dois tenants de teste com cores/logo diferentes, navegar
login/dashboard de cada um, confirmar branding aplicado e nenhum vazamento
visual de nome/cor do outro tenant.

---

## Fase 5 — Portal Super Admin (backoffice) ⏳ PENDENTE

- Nova área `/dashboard/super-admin` (papel novo ou reaproveitar `admin` com
  um flag "platform admin" — decidir, já que hoje `admin` é por tenant).
- CRUD de tenants: criar escola (nome/slug/subdomínio), editor de branding
  (logo upload, paleta), toggle de `features` (JSONB já existe na tabela
  `tenants` — `essays`/`simulations`/`forum`/`aiAurora`/`lives`).
- Dashboard de métricas globais (alunos por tenant, uso de storage, tokens de
  IA) — precisa de agregação cross-tenant, então roda com service role +
  guard de platform-admin, não RLS comum.

**Verificação**: criar tenant novo pelo painel, confirmar que aparece
funcional em `escolaX.localhost:3000` sem tocar em SQL manual.

---

## Fase 6 — Homologação e segurança ⏳ PENDENTE

- Testes automatizados de isolamento cross-tenant (script de simulação RLS,
  formato já usado no projeto pra outras auditorias — ver
  `CLAUDE.md` seção de auditoria de RLS de 2026-07-10 como referência de
  metodologia).
- Script de seed `seed-tenant-demo.mjs` — tenant "Escola Modelo" completo
  (turmas, questões, professor, alunos de exemplo) pra demonstração
  comercial sem precisar de dado de cliente real.
- Revisão final: repetir a varredura de hardcode da Fase 1 (nada deve ter
  voltado) + `npm run typecheck` + `npm run build`.

---

## Arquivos críticos por fase

| Fase | Arquivos principais |
|---|---|
| 1 ✅ | `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/globals.css`, `src/app/dashboard/layout.tsx`, `src/app/login/LoginForm.tsx`, `src/app/api/chat/route.ts`, `src/lib/aurora-prompt.ts` (novo), `src/app/api/admin/create-user/route.ts` |
| 2 | `supabase/migrations/20260814000000_create_tenants_and_multitenancy.sql` (corrigir), novas migrations de `tenant_id`+RLS por tabela, `supabase/functions/*` (guards) |
| 3 | `src/middleware.ts`, `src/lib/server-auth.ts`, `src/lib/tenant.ts`, `src/app/api/admin/create-user/route.ts` (`generateEmail`), `next.config.ts` |
| 4 | `src/components/TenantProvider.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/page.tsx`, `tailwind.config.ts` |
| 5 | novo `src/app/dashboard/super-admin/**` |
| 6 | novo `scripts/seed-tenant-demo.mjs`, scripts de teste de RLS |

## Observação de risco

Este plano assume que da Fase 2 em diante o trabalho roda contra o Supabase
novo e separado (confirmado pelo usuário) — nenhuma etapa aqui deve ser
executada contra o projeto de produção do Compromisso. Fase 1 foi segura em
qualquer banco porque não tocou schema/dado, só código/UI.
