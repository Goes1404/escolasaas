# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Projeto: Dalí

Plataforma de gestão educacional e aprendizado adaptativo, nascida no cursinho
Compromisso (Santana de Parnaíba). Voltada ao ENEM e ETEC, com papéis: `admin`,
`teacher`, `student`.

**O produto é o Dalí; o Compromisso é o primeiro cliente.** A plataforma é
white-label: o nome e o logo do painel vêm de `tenants.branding` (resolvido pelo
host em `src/lib/get-tenant.ts`). Nunca escreva "Dalí" fixo numa tela de
dashboard — lá vale `tenant.branding.appName`. O nome fixo só aparece onde a
tela é do produto e não de uma escola: landing, metadata, PWA, login e primeiro
acesso.

## 🎭 Marca

O nome é uma referência ao surrealismo, **não a Salvador Dalí**. Isso não é
detalhe jurídico solto: as obras dele estão protegidas até ~2060 (Lei 9.610/98)
e a Fundação Gala-Salvador Dalí defende ativamente nome e imagem. Por isso a
identidade **nunca** usa o rosto do artista, o bigode, nem ícone de obra
específica (relógio derretido, elefante de pernas longas, gaveta no corpo).

O que a logo usa é o surrealismo como *linguagem*: a matéria que amolece. O
símbolo é a própria letra **D derretendo** — desenho original, em
`src/components/LogoDali.tsx` (`LogoDali` e `LogoDaliLockup`).

| Onde | Arquivo |
|------|---------|
| Componente React (nav, preloader, rodapé) | `src/components/LogoDali.tsx` |
| Símbolo solto, para `tenants.branding.logoUrl` | `public/logo-dali.svg` |
| Favicon vetorial | `public/icon.svg` |
| PNGs do PWA (192/512/maskable/apple/badge) | `public/icons/` |

A geometria é **uma só**, em `src/lib/logo-dali-geometry.ts`: o componente
React e o gerador de ícones leem os mesmos paths. Os PNGs são gerados, não
desenhados — `npx tsx scripts/gen-icons.ts` rasteriza com `sharp`. Mudou o
traço? Edite a geometria e **rode o script**, senão o ícone da tela de início
do celular continua com o logo antigo e o app parece pirata.

## 🚧 Deploy em andamento — ler antes de mexer em Supabase/Vercel

Detalhe completo em `docs/DEPLOY_STATUS.md` (atualize esse arquivo, não só este
resumo, sempre que o status mudar). Resumo:

- **Supabase em uso**: projeto `sgkgsjmfcsgfxliwvwjg` — as 110 migrations de
  `/supabase/migrations` já estão aplicadas nele. Não é o projeto que estava
  configurado por padrão; confira antes de assumir qual é o ativo.
- **Usuários de teste** (criados por `scripts/seed-test-users.mjs`, senha
  `mudar123` para os 4): `admin@compromisso.com`, `secretaria@compromisso.com`
  (staff), `professor@compromisso.com`, `aluno@compromisso.com`.
- **Pendente na Vercel** (projeto `escolasaas`, team
  `sq1matheusgsilva-7306s-projects`): confirmar se as env vars de Production
  já foram trocadas para apontar pro Supabase acima (estavam apontando para
  `wyqfyrfkudxroumggnnp`, projeto errado) e se "Vercel Authentication" (SSO
  protection) já foi desligada — enquanto ligada, ninguém fora do time
  consegue acessar o site. Ver `docs/DEPLOY_STATUS.md` para o passo a passo.
- **Módulos de gestão escolar (22/08)**: financeiro de mensalidades
  (`secretary/tuition`, `student/finance`), portal do responsável por token
  (`guardian/[token]`, tokens no `GuardiansCard`) e rematrícula digital
  (`secretary/reenrollment`, `student/reenrollment`, aceite via
  `/api/reenrollment/accept` e `/api/guardian/[token]/reenrollment`).
  Migrations `20260822*`–`20260824*` já aplicadas. Regras: mutações do
  financeiro SÓ via RPCs (`generate_monthly_invoices` etc.); aceite de
  contrato SÓ via rotas de API (IP real na trilha de auditoria);
  `announcements.audience` separa mural do aluno do portal do responsável.
  Detalhes em `docs/DEPLOY_STATUS.md`.

## 🛠 Comandos

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Validar build de produção
npm run typecheck    # tsc --noEmit (verificar tipos sem compilar)
npm run lint         # ESLint
npx supabase login   # Autenticar no CLI Supabase
npx supabase db push # Aplicar migrations locais ao projeto remoto
```

## 🚀 Stack

- **Framework**: Next.js 15 (App Router) — versão real é 15, não 14
- **Linguagem**: TypeScript (path alias `@/*` → `./src/*`)
- **Estilização**: Tailwind CSS + Shadcn/UI
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **IA (Aurora)**: OpenAI GPT-4o-mini via Vercel AI SDK (`ai`, `@ai-sdk/openai`)
- **Ícones**: Lucide React
- **Animações**: Framer Motion (já instalado)
- **Charts**: Recharts (usar `dynamic(..., { ssr: false })` para SSR)
- **Mascote 3D**: SVG em camadas + CSS transform (sem three.js — ver abaixo)

## 🐺 Mascote (bichinho) 3D

O bichinho tem **dois modos de desenho**, e quem escolhe é o `Mascote`:

- **Arte renderizada** (preferida): existe `/public/mascotes/<arquetipo>.webp`?
  É ela que aparece. Requisitos e prompts de geração em
  `public/mascotes/README.md` — **fundo transparente é obrigatório**, porque a
  arena desenha o próprio cenário e o boneco pula/inclina/roda por cima dele.
- **Rig 2.5D em SVG** (fallback): sem arquivo, o bicho é montado em dez camadas
  de SVG e gira 360° de verdade por paralaxe. Nada de `three` +
  `react-three-fiber` — custaria ~600 KB de JS e um `.glb` por arquétipo, numa
  plataforma que roda no celular do aluno em rede móvel.

O vetor entra primeiro e a foto substitui quando carrega. É de propósito: em
rede ruim, esperar a imagem deixaria a arena vazia por segundos, e vazia para
sempre se ela nunca chegar.

| Arquivo | Papel |
|---------|-------|
| `src/lib/mascote.ts` | Engine: arquétipos, CP/HP, iluminação, estado de animação, `specDoMascote` e `promptDeImagem` |
| `components/mascote/Mascote.tsx` | Decide entre foto e vetor |
| `components/mascote/useImagemDoMascote.ts` | Sonda se existe arte renderizada (cache de uma sondagem por sessão) |
| `components/mascote/MascoteRenderizado.tsx` | A foto: inclinação ±22° no arrasto, pirueta, carinho |
| `components/mascote/Mascote3D.tsx` | O rig em SVG: giro 360°, arrasto, carinho |
| `components/mascote/arte.tsx` | As peças em SVG (orelha, focinho, cauda…) e a profundidade de cada camada |
| `components/mascote/ArenaMascote.tsx` | A moldura estilo Pokémon GO (CP, HP, anel de captura) |
| `components/mascote/MascoteRetrato.tsx` | Versão parada — foto ou vetor, para grades e cartões |
| `components/mascote/controle.ts` | `MascoteControle`, a interface que as duas implementações expõem |

**Foto e vetor não são equivalentes**, e a diferença é deliberada: uma imagem é
uma face só, então `girar360` nela é uma pirueta (não há costas para mostrar) e
`expressao`/`nivel` não chegam a ela (não há camada de olho para trocar nem peça
de chapéu para acrescentar). Humor e nível continuam legíveis pela iluminação da
arena, pela barra de HP e pelo estado de animação, que valem para os dois modos.

### Regras ao mexer aqui

1. **Peça grudada em outra tem a mesma profundidade** (só vale para o rig SVG).
   Orelha e chapéu andam com a cabeça (z=16/18), bandana com o peito (z=8). Só
   protuberância real (focinho, cauda, asas) ganha z próprio — é ela que produz
   a paralaxe. Dar z diferente a uma peça grudada faz ela descolar e flutuar ao
   girar.
2. **CP nunca cai.** Sai de `nivel` + `dias_estudo`, as duas grandezas que o banco
   garante monotônicas. Ofensiva e saldo de XP ficam fora de propósito: um CP que
   despenca depois de um fim de semana mal dado, ou que cai porque o aluno comprou
   proteção, transforma o boneco em cobrança.
3. **Carinho não dá XP.** XP vem de estudar (régua de 11/08). Afeto que paga vira
   tarefa.
4. **Animação só em `transform`/`opacity`**, e o giro é escrito no DOM dentro de um
   `requestAnimationFrame` — passar o ângulo por `useState` custaria um render por
   frame de arrasto.
5. **Espécie nova exige migration**: o CHECK de `pets.especie` *e* a validação
   dentro de `adotar_bichinho()` (as duas listas precisam bater com `ARQUETIPOS`).
   Nunca remover uma espécie da lista — isso deixaria o bicho de quem a adotou num
   estado que a própria tabela recusa.
6. **Nome é por espécie, não por bicho.** `pets.nome` é só o apelido ativo (o da
   espécie corrente); `pets.apelidos` (JSONB, espécie → nome) é quem lembra. Trocar
   de dragão "Fumaça" para lobinho e voltar devolve "Fumaça" — não abre um campo em
   branco. `adotar_bichinho()` escreve nos dois; `apelidoDe()` em `lib/bichinho.ts`
   lê o mapa para pré-preencher o campo de nome na troca.
7. **A Aurora usa a cara do bicho do aluno.** `components/AuroraAvatar.tsx` sonda
   `getBichinho()` e mostra o retrato do bichinho (foto ou vetor, via
   `MascoteRetrato`) no lugar do ícone genérico de robô — na lista de conversas, no
   cabeçalho do chat e no mentor de sala de aula. Sem bicho adotado, ou enquanto
   carrega, continua mostrando o robô — nunca um estado de carregamento visível.

## 🗂 Banco de Dados (Tabelas Principais)

Sempre verifique `/supabase/migrations/` antes de qualquer query — nunca assuma colunas.

| Tabela | Colunas-chave |
|--------|--------------|
| `profiles` | id, full_name, email, role (`admin`/`teacher`/`student`), profile_type, institution, course, exam_target, birth_date |
| `questions` | question_text, options (JSONB), correct_answer, subject_id, micro_topic_id, explanation, target_audience, supporting_text, image_url |
| `subjects` | id, name |
| `exams` | id, title, year, exam_type, pdf_url |
| `exam_questions` | exam_id, question_id, order_index |
| `student_question_answers` | student_id, question_id, selected_option, is_correct |
| `exam_attempts` | user_id, exam_id, score, completed_at |
| `essay_submissions` | user_id, theme, content, score, status, created_at |
| `scheduled_lives` | id, title, teacher_id, start_time, meet_url |
| `notes` | id, user_id, title, blocks (JSONB), subject_id, tags (TEXT[]), is_pinned, updated_at, created_at |
| `user_badges` | user_id, badge_id, awarded_at |

### RLS
Todas as tabelas têm RLS ativo. Filtre sempre por `user_id` ou `role`. Nunca exponha dados de outros usuários.

## 🎨 Sistema visual único — 3 níveis de intensidade

A plataforma tem **um sistema com três doses**, não dois estilos. A landing
(`/`) e o dashboard usam os MESMOS primitivos; o que muda entre uma tela de
festa e uma de trabalho é a intensidade, nunca a linguagem. É isso que evita
a sensação de colcha de retalhos.

**Regra de decisão:** *quanto mais tempo o usuário passa na tela, menor a
intensidade.*

| Nível | Onde | O que pode usar |
|-------|------|-----------------|
| **Alto** (segundos, emoção) | bichinho, ranking, desafio diário, resultado de simulado, primeiro acesso, landing | cor chapada de fundo, bloco diagonal, sombra dura, animação contínua, display gigante |
| **Médio** (minutos) | home do aluno, materiais, portal do responsável | fundo neutro, acento em detalhe, sombra dura **só** no botão primário, animação na entrada |
| **Baixo** (horas) | simulado em andamento, redação, caderno, painel da secretaria/admin | cor só como sinal semântico (verde=pago, vermelho=vencido), sem sombra dura, sem animação |

**O que costura tudo:** toda tela de nível baixo mantém o **cabeçalho em nível
médio** — título em `u-page-title` (display) + `u-label` (mono) acima. Como
manchete de jornal: expressiva no topo, corpo sóbrio embaixo.

### Primitivos (mexer aqui muda as 132 rotas de uma vez)

- **Raio**: `--radius-card` (14px) e `--radius-control` (10px) em
  `globals.css`. Em código novo use `rounded-card` / `rounded-control` — nunca
  valor hardcoded. A escala `rounded-xl/2xl/3xl` do Tailwind foi reapontada
  para esses tokens, então telas antigas seguem o sistema sem edição.
- **Tipografia com papéis fixos** (declarada em `layout.tsx`):
  `font-display`/`u-display`/`u-num` (Boldonse) para número grande e título de
  destaque — **nunca** texto corrido; `font-sans` (Sora) para interface e
  leitura longa; `font-mono`/`u-label` (Space Mono) para label e metadado.
- **Sombra dura**: `shadow-hard` / `<Button variant="arcade">` — a assinatura
  da landing em dose de app. Só no **CTA primário** da tela; em toda superfície
  vira poluição nas telas densas.
- **Utilitários** em `globals.css`: `.u-label`, `.u-display`, `.u-num`,
  `.u-page-title`, `.u-surface`.
- **Cores da marca por classe**: `bg-brand-pink` / `-yellow` / `-slate` /
  `-olive` (as variáveis já existiam, faltava expor no Tailwind). As telas de
  nível alto usam as três cores do produto como blocos chapados.
- **Celebração**: `celebrate()` / `celebrateOnce(chave)` / `haptic()` em
  `src/lib/celebrate.ts` — confete na paleta do produto, com guarda de
  `prefers-reduced-motion` e canvas próprio. Use `celebrateOnce` em tela que
  celebra ao carregar, senão a festa se repete a cada refresh.

### Telas já convertidas para nível alto

- `student/ranking` (primeira, fase 2): pódio em blocos chapados com as três
  cores, sombra dura no lugar de glow, posições/XP em `u-num`, destaque da
  própria linha por forma (borda + sombra) e não por opacidade, confete no
  top 3. Serve de molde para bichinho, desafio diário e resultado de simulado.

### Outros padrões

- **Títulos**: `font-black italic` (padrão legado, ainda presente em telas
  antigas — em tela nova prefira `u-page-title`)
- **Feedback**: use **sempre** o hook `useToast` (`src/hooks/use-toast.ts`) para erros e sucessos
- **Responsividade**: mobile-first; sidebar com toggle móvel já implementado no layout

## 🧠 Regras de Desenvolvimento

### Componentes
- Server Components por padrão. `"use client"` apenas quando há estado/interatividade.
- Recharts e qualquer lib que acesse `window`/`document` deve usar `dynamic(..., { ssr: false })`.

### IA Extraction (Motor de Provas)
- Se o enunciado original diz "utilize o texto para responder as questões X a Y", a IA **deve** repetir o `supporting_text` integralmente em **cada** objeto de questão do JSON gerado.
- Se houver referência a imagem/gráfico, insira `[IMAGEM_PENDENTE]` no enunciado.

### Simulados & Provas
- Renderize `supporting_text` em card destacado **antes** do enunciado.
- Se `image_url` existir, exibi-la no topo do card da questão (prioridade visual).
- Siga padrão ENEM: 3,5 min/questão, navegação por grade, opção de revisão.

### Auth & Middleware
- `src/middleware.ts` protege `/dashboard/*` — redireciona para `/login` sem sessão.
- Metadado `must_change_password: true` no Supabase Auth força `/dashboard/first-access`.
- Supabase client browser-side: `src/app/lib/supabase.ts` (use `safeExecute()` para queries com tratamento de erro).

## 🔐 Segurança (LEIA ANTES DE MEXER EM AUTH / API ROUTES)

> Esta plataforma está **em produção** com dados reais de alunos. Trate auth, RLS e
> rotas `/api/*` com o máximo de cuidado. Nunca confie em dados controlados pelo cliente
> para autorização.

### Regras obrigatórias

1. **Rotas privilegiadas usam sessão, não "senha mestra".** Toda rota em `/api/admin/*`,
   reset de senha, criação/exclusão de usuário ou qualquer ação com `SUPABASE_SERVICE_ROLE_KEY`
   **deve** validar o chamador com o helper `requireAdminUser()` / `requireTeacherOrAdmin()`
   de `src/lib/server-auth.ts` (lê o cookie de sessão + checa `profiles.role` no servidor).
   Referência correta: `/api/enem-import`. **Nunca** faça gate via campo `masterPassword`
   no body — ele viaja no bundle do cliente e não é segredo.
2. **`SUPABASE_SERVICE_ROLE_KEY` só no servidor.** Nunca em arquivos `"use client"`, nunca em
   `NEXT_PUBLIC_*`. Ele ignora RLS — qualquer rota que o usa precisa fazer a autorização na mão.
3. **IDOR:** rotas que recebem `userId`/`user_id` no body e leem/escrevem com service role devem
   conferir que o id pertence ao usuário autenticado (`getAuthUser()`), nunca confiar no id do cliente.
4. **HTML dinâmico:** ao montar HTML manualmente (`document.write`, `dangerouslySetInnerHTML`)
   com dados do banco/UI, **escape** os valores (ver `esc()` em `secretary/documents/page.tsx`).
5. **Redirects:** valide `?next=`/`?redirect=` — só aceite caminho interno (`startsWith('/')` e
   não `//`). Ver `auth/callback/page.tsx`.
6. **Filtros Supabase `.or()` / `.ilike()`:** não interpole input cru do usuário (vírgula, `()`, `*`
   são caracteres de controle do PostgREST). Sanitize ou use o builder com valor parametrizado.
7. **Logs:** nunca logar senha, token, e-mail ou nome completo (PII) em `console.*`.
8. **localStorage:** não persista PII/dados acadêmicos sem necessidade; limpe no `signOut`
   (já feito para `dash_cache_*`).
9. **Segredos:** nunca commitar senha/chave/token no código. Use env vars + rotação.

### ⚠️ Pendências de segurança conhecidas (backlog priorizado)

Estas falhas foram auditadas mas **não corrigidas** porque exigem mudança coordenada
servidor+cliente e rotação de segredo (decisão do time):

| Sev | Local | Problema |
|-----|-------|----------|
| ✅ CORRIGIDO | `api/auth/reset-password`, `api/admin/{create-user,delete-user,generate-link,generate-registration-link}` | Antes protegidas só pela string fixa `'compromisso2026'`. **Agora exigem sessão de admin/staff via `requireAdminUser()`.** ⚠️ Ainda falta: rotacionar a senha `'compromisso2026'` (é também `DEFAULT_PASSWORD` de novos usuários) e limpar os literais inertes `masterPassword` nos clientes. |
| ✅ CORRIGIDO (11/08) | `api/student/primeiro-acesso` (action `search`) | Deixou de devolver o `id` do perfil (a tela nunca usou) e ganhou rate limit por IP e por nome, reaproveitando o limitador do reset. O e-mail continua sendo devolvido de propósito: é o login que o aluno precisa descobrir. Fechar isso mataria o primeiro acesso — o que dá para impedir é a varredura. |
| ✅ CORRIGIDO (11/08) | `lib/registration-token.ts` | Passa a usar `REGISTRATION_TOKEN_SECRET`. A chave antiga continua aceita **só na verificação**, para os links já emitidos valerem até expirar (7 dias). Comparação com `timingSafeEqual`. ⚠️ Defina a variável em produção — sem ela, o código cai no legado e avisa no log. |
| ✅ CORRIGIDO | `api/student/weekly-summary` | Usa `getAuthUser()` e ignora o `userId` do corpo. |
| ✅ CORRIGIDO (11/08) | `api/push/notify` (branch `chat`) | O texto não vem mais do corpo: a rota lê a mensagem gravada nos últimos 2 minutos entre remetente e destinatário. Prova que a conversa existe e impede forjar mensagem em nome de outra pessoa. |
| ✅ CORRIGIDO | `api/essay-save` | Exige sessão (`getAuthUser()`) e grava sempre para o usuário autenticado. |
| ✅ CORRIGIDO (11/08) | `api/student/self-register` | Rate limit por IP (40/hora — alto porque uma turma inteira usa o mesmo Wi-Fi). |

**Ação recomendada nº 1:** rotacionar a senha `'compromisso2026'` (é também a senha padrão de
novos usuários) e a `SUPABASE_SERVICE_ROLE_KEY`. São as duas únicas pendências que sobraram
desta lista, e ambas dependem de acesso ao painel.

### ⚠️ Contas duplicadas (descoberto em 11/08/2026)

**201 alunos têm mais de uma conta** — 403 contas, 202 excedentes. A base tem 1.057 contas
para cerca de 855 alunos reais. "Abner de Jesus Jales da Silva" tem TRÊS contas, cada uma com
um pedaço do boletim.

Causa: `generateEmail()` deriva o login do nome, e a regra mudou ao longo do tempo —
`abnerjsilva@` (inicial do primeiro nome do meio), `abnerdsilva@` (inicial da segunda palavra,
que aqui é a preposição "de") e `abnersilva@` (regra de duas partes). Como nomes com preposição
são a maioria em português, isso atingiu metade do cadastro.

`create-user` passou a recusar nome já existente (com saída por `emailOverride` para homônimos
reais), então o problema não cresce. **Fundir as contas existentes continua pendente e é decisão
da secretaria** — escolher qual sobrevive é escolha sobre o histórico do aluno.
Relatório: `npx tsx scripts/duplicatas-de-alunos.ts --csv`.

### 🔒 Auditoria de RLS + Edge Functions (2026-07-10) — aplicado em produção

Auditoria completa do banco (Supabase security advisor) + edge functions. Correções
já **aplicadas em produção** e versionadas em `/supabase/migrations` e `/supabase/functions`:

| Sev | Local | Correção |
|-----|-------|----------|
| ✅ CRÍTICO | `direct_messages` e ~30 tabelas (`profiles`, `essay_submissions`, `student_question_answers`, `material_annotations`, `simulation_attempts`, `invitations`, fóruns, lives, trilhas, materiais…) | Policies residuais de "modo demo" (`Acesso Demo`, `open_*`) com `USING/WITH CHECK true` anulavam as restritas via OR. Em `profiles` permitia escalada de privilégio (qualquer autenticado alterava o próprio `role`). **Removidas; mantidas/criadas policies por dono ou papel.** Migrations `20260710010000`/`020000`/`030000`. ⚠️ **A remoção NÃO fechou a escalada** — ver linha abaixo. |
| ✅ CRÍTICO | `profiles.role` (escalada de privilégio) | Remover as policies abertas não bastou: as policies de dono que ficaram (`auth.uid() = id`) valem para **qualquer coluna**, inclusive `role`, e a tabela não tinha trigger nenhum. Confirmado por simulação de RLS em 2026-07-29: como aluno autenticado, `UPDATE profiles SET role='admin' WHERE id=<ele mesmo>` era aceito sem erro. **Corrigido** pelo trigger `trg_profiles_block_role_escalation` (migration `20260729090000`), que barra a troca de papel em sessão de usuário comum e mantém `service_role` e admin/staff. A edição legítima do próprio perfil (telefone, nome, avatar) continua funcionando. |
| ✅ CRÍTICO | 8 tabelas com RLS **desligada** (`trails`, `classes`, `user_progress`, `student_checklists`, `activity_logs`, `forum_bans`, `library_items`, `subjects`) + `learning_trails`/`learning_modules`/`notices`/`quiz_submissions` | **RLS religada** com policies mínimas corretas. |
| ✅ CRÍTICO | edge function `learning-trails-crud` | SQL injection (concatenação de string com `id` da URL) + JWT sem verificar assinatura, rodando com service role. **Reescrita** para usar supabase-js com o JWT do chamador (RLS + query builder parametrizado). |
| ✅ CRÍTICO | edge functions `delete-all-students-only`, `reset-students-only`, `reset-user-password-next-login`, `create-auth-users`, `backfill-teachers-auth` | Rodavam com service role gateadas só por `verify_jwt` (qualquer sessão, até de aluno) — permitiam apagar todos os alunos, resetar/assumir a conta admin, escalar privilégio. **Adicionado guard `requireAdmin` (checa `profiles.role='admin'`).** Não são usadas pelo app (scripts one-off). |

**Pendências desta auditoria (backlog):**
| Sev | Local | Problema |
|-----|-------|----------|
| 🟡 MÉDIO | edge functions `request-password-reset`, `invite-send-magiclink` | Ainda gateadas só por `verify_jwt`. Podem fazer parte de fluxos deslogados (reset/convite) — revisar se são usadas antes de blindar. Enumeração de e-mail em `request-password-reset`. |
| 🟡 MÉDIO | Views `SECURITY DEFINER` (`profile_public`, `profiles_public`, `weekly_ranking`) e ~14 funções `SECURITY DEFINER` executáveis por `anon`/`authenticated` | Revisar se o `SECURITY DEFINER` é intencional; senão trocar por `SECURITY INVOKER` ou revogar `EXECUTE`. |
| 🟢 BAIXO | Buckets públicos `avatars`/`exam_pdfs`/`learning-contents` com SELECT amplo (listagem) + proteção de senha vazada (HaveIBeenPwned) desligada no Auth + `function_search_path` mutável em ~15 funções | Hardening de menor prioridade. |

**⚠️ Rotacionar a `SUPABASE_SERVICE_ROLE_KEY`:** foi exposta em texto puro num chat durante a auditoria.

#### 🐛 Causa-raiz descoberta: claim `user_role` do JWT é sempre `null`

Não existe *custom access token hook* configurado no Auth, então **`auth.jwt() ->> 'user_role'`
(e `get_my_claim('user_role')`) retornam `null` para os 1622 usuários**. Toda policy que
gateia por esse claim **nunca concede acesso** — era mascarado pelas policies abertas.
Ao removê-las, operações legítimas quebraram. **Regra:** para papel em RLS, use sempre
`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN (...))` —
**nunca** `auth.jwt()->>'user_role'`. (Fix definitivo de longo prazo: criar o hook de
access token OU migrar as poucas policies mortas restantes.)

Regressões corrigidas na revisão completa de RLS (migrations `050000`/`060000`, verificadas
por simulação de RLS `set role authenticated` + `request.jwt.claims`):
- `forums`/`forum_bans` (moderação de fórum: criar/apagar tópico, banir/desbanir) → `profiles.role` admin/staff.
- `modules`/`learning_contents`/`library_resources` (gestão de conteúdo) → `profiles.role` admin/staff/teacher.
- `student_question_answers` (admin/professor viam desempenho do aluno vazio) → SELECT por `profiles.role`.

Policies mortas remanescentes **sem impacto** (feature não usada client-side ou coberta por
outra policy): `subjects`, `live_messages` (moderador), `classes` (admin gerencia de outros),
`announcements` (admin edita de outros), `questions` (redundante). Nota menor de exposição:
`forums.open_select_for_authenticated_forums` (true) deixa fóruns `is_teacher_only` visíveis a
alunos — revisar se a confidencialidade importa.

### 📱 Plano: reset de senha & primeiro acesso (telefone + SMS) — FASE 2 IMPLEMENTADA

Decisão de produto: **não armazenar CPF**; usar **telefone** como base da recuperação
(minimização de dados / LGPD). Observação importante: os e-mails `@compromisso.com` são
sintéticos (login interno, sem caixa de e-mail real), então recuperação por e-mail não é opção.

**Princípio de segurança:** o telefone NÃO é segredo. Nunca validar "digitando o número".
A prova de identidade é **posse do aparelho** → enviar **OTP via SMS para o número já cadastrado**.

Fases:
1. **Telefone obrigatório (gate):** ✅ **IMPLEMENTADO** — `src/components/PhoneGate.tsx`, montado em
   `src/app/dashboard/layout.tsx`. Bloqueia o dashboard para aluno sem telefone, igual ao
   `must_change_password`, com saída por "Sair da conta" para não prender ninguém na tela.
   ⚠️ **Cobertura ainda baixa:** em 2026-07-29, **224 de 1110 perfis** têm telefone (20%); entre
   alunos, **834 de 1058 estão sem**. O gate só alcança quem faz login a partir de agora, então
   a Fase 3 (fallback pela secretaria) segue necessária para quem não acessa há tempo.
2. **Reset self-service por SMS OTP:** ✅ **IMPLEMENTADO** — aluno informa o nome → servidor acha a conta → envia
   OTP ao telefone cadastrado → valida OTP → permite trocar a senha. Integração com provedor SMS
   (Twilio). Detalhes da implementação em `docs/superpowers/plans/2026-07-08-forgot-password-sms-otp.md`.
   ⚠️ Pendente: a action `search` (usada pelo fluxo de primeiro acesso, separada da recuperação por
   SMS) ainda devolve `userId`/`email` e permite enumeração de usuários — blindar antes de expor
   publicamente.
3. **Fallback permanente (os dois):** quem não tem telefone → a **secretaria reseta direto**
   pelo painel **ou** **gera link de recuperação** (`generate-link`), à escolha dela. Adequado
   para cursinho presencial (prova de identidade offline). *(Pendente)*

### Já corrigido nesta auditoria (mudanças seguras, sem quebrar fluxo)
- Open-redirect em `auth/callback` (valida `next` interno).
- XSS armazenado no gerador de documentos da secretaria (escape de HTML).
- Redação de PII (nome/e-mail) nos logs de `primeiro-acesso`.
- Sanitização do filtro `.or()` em `primeiro-acesso`.
- Limpeza do cache acadêmico (`dash_cache_*`) no `signOut`.

## 📌 Estrutura de Rotas Relevantes

```
/dashboard/
├── admin/
│   ├── users/          # Diretório de usuários (criar, editar, resetar senha)
│   ├── students/       # Gestão de turmas
│   └── students/[id]/  # Perfil de desempenho individual do aluno
├── student/
│   ├── notes/          # Caderno de notas (blocos, wikilinks, backlinks)
│   └── notes/graph/    # Graph View (grafo de conhecimento)
└── teacher/
    ├── questions/      # Banco de questões
    └── analytics/      # BI & analytics
```

## 🔑 Variáveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPENAI_API_KEY  (server-side only)
PASSWORD_RESET_TOKEN_SECRET  (server-side only — secret dedicado do wizard de recuperação por SMS)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

## 📌 Pastas Importantes

- `/src/app/dashboard`: Rotas por cargo (student/teacher/admin)
- `/src/components/ui`: Componentes base Shadcn
- `/src/lib`: `AuthProvider`, `gamification`, `constants` (escolas, matérias), `utils` (`cn()`)
- `/supabase/migrations`: Fonte da verdade do schema — ler antes de qualquer query
- `/public/templates`: Templates JSON de provas
