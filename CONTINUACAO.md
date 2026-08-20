# Plano de Continuação — Cursinho Compromisso LMS
_Gerado em: 07/05/2026 — Para ser executado no próximo PC com Node.js_

---

## 🔴 PASSO 1 — Executar imediatamente ao abrir o projeto

```bash
cd "c:\Users\ADM\Downloads\testecompromisso"
npm install framer-motion
npm run build
```

> O `framer-motion` já está no `package.json`, mas não foi instalado ainda.
> O `npm run build` vai validar que tudo compila sem erros.

---

## 🟡 PASSO 2 — Aplicar migration no Supabase

O arquivo `supabase/migrations/20240822000000_add_image_url_to_questions.sql` já existe.
Execute pelo MCP Supabase ou pelo CLI:

```bash
npx supabase db push
```

**Ou via MCP:** usar `mcp__claude_ai_Supabase__apply_migration` com o conteúdo:
```sql
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS image_url TEXT;
```

---

## ✅ O QUE JÁ ESTÁ FEITO (não refazer)

### Motor de Provas
- Prompt de extração IA corrigido (regras supporting_text + [IMAGEM_PENDENTE])
- Simulados: card âmbar para supporting_text, suporte a image_url
- Migration SQL criada

### Performance
- `dashboard/home`: 6 queries Supabase em paralelo (sem waterfall)
- `dashboard/home`: Recharts + widgets carregados via `next/dynamic` (lazy)
- `dashboard/books`: `useMemo` + `useDeferredValue` para filtro
- `dashboard/library`: `useMemo` para filtro, `Image` com `sizes` corretos
- `landing/page.tsx`: scroll listener `{ passive: true }`, blurs ocultos no mobile

### Animações (framer-motion — aguarda npm install)
- `simulados/page.tsx`: `AnimatePresence mode="wait"` nas questões
- Stagger nas opções de resposta (`staggerChildren: 0.07`)
- `whileTap={{ scale: 0.97/0.98 }}` em todos os elementos interativos
- Variante `fadeUp` com spring `[0.25, 0.1, 0.25, 1]`

### Design System 21st.dev / Stitch (globals.css — COMPLETO)
Utilitários adicionados: `.dot-grid`, `.dot-grid-dark`, `.gradient-border`,
`.btn-shimmer`, `.aurora-dark`, `.glow-orange`, `.glow-orange-strong`,
`.animate-float`, `.text-gradient-brand`, `.noise`

### Páginas com efeitos aplicados
| Página | dot-grid | gradient-border | shimmer | glow | aurora |
|---|---|---|---|---|---|
| `landing/page.tsx` | ✅ hero | ✅ hero image | ✅ CTA btn | ✅ CTA btn | ✅ insight card |
| `dashboard/home` | ✅ hero | ✅ stat chips + taxa | ✅ quick actions | ✅ aurora card | — |
| `dashboard/books` | — | ✅ cards | — | ✅ cards hover | — |
| `dashboard/library` | — | ✅ cards | — | ✅ cards hover | — |
| `dashboard/student/simulados` | — | ✅ mode card | ✅ start btn | ✅ start btn | — |
| `dashboard/support` | — | ✅ chat card | ✅ send btn | ✅ send btn | ✅ status card |

---

## 🔵 PASSO 3 — Páginas que ainda precisam de efeitos visuais

### 3.1 `dashboard/teacher/home/page.tsx`
Aplicar:
- `.aurora-dark` + `.dot-grid` na seção de header/banner do professor
- `.gradient-border` nos cards de estatísticas (totalStudents, avgScore etc.)
- `.btn-shimmer` + `.glow-orange-strong` no botão de diagnóstico

### 3.2 `dashboard/student/essays/page.tsx`
Aplicar:
- `.gradient-border` nos cards de redação submetidos
- `.btn-shimmer` no botão "Enviar Redação"
- `.glow-orange` no card de nova redação em destaque

### 3.3 `dashboard/trails/page.tsx`
Aplicar:
- `.dot-grid-dark` no banner hero
- `.gradient-border` nos cards de trilha
- `.glow-orange` em hover dos cards
- Converter `transition-all` → `transition-[transform,box-shadow]`

### 3.4 `dashboard/classroom/[id]/page.tsx`
Aplicar:
- `.gradient-border` no player de vídeo
- `.glow-orange` no botão de próxima aula
- Barra de progresso com gradiente laranja→amber

---

## 🔵 PASSO 4 — Melhorias de Componentes UI Remanescentes

### 4.1 `components/ui/button.tsx` (já feito parcialmente)
Verificar se `active:scale-[0.97]` e `[touch-action:manipulation]` estão em todas as variantes.

### 4.2 `components/GamificationWidget.tsx`
- Adicionar `.aurora-dark` no fundo do widget de XP
- `.gradient-border` no card de badges

### 4.3 `components/NotificationBell.tsx`
- Adicionar `.glow-orange` quando há notificações não lidas

---

## 🔵 PASSO 5 — Funcionalidades novas a implementar

### 5.1 Upload de imagem para questões (IMAGEM_PENDENTE)
**Contexto:** O motor de extração IA agora insere `[IMAGEM_PENDENTE]` no enunciado.
**O que falta:**
1. Na tela `teacher/questions`, detectar questões com `[IMAGEM_PENDENTE]`
2. Adicionar botão de upload de imagem nessas questões
3. Ao fazer upload → salvar URL no campo `image_url` da questão
4. Substituir `[IMAGEM_PENDENTE]` pelo `<img>` no simulado

**Arquivo:** `src/app/dashboard/teacher/questions/page.tsx`

### 5.2 Página de Provas Completas (`student/provas`)
**Contexto:** A rota existe mas a implementação do simulado por prova completa pode precisar de melhorias.
**Verificar:** Se já renderiza `supporting_text` e `image_url` da mesma forma que simulados.

### 5.3 Relatório de Desempenho do Aluno
**O que falta:** Tela dedicada mostrando evolução por matéria ao longo do tempo.
- Usar os dados de `student_question_answers` já gravados
- Gráfico de radar por matéria (recharts RadarChart)

---

## 🟣 PASSO 6 — Otimizações de Build (Produção)

```bash
# Verificar tamanho dos chunks
npm run build 2>&1 | grep -E "First Load|Page"

# Targets desejados (Mobile Lighthouse > 90):
# / (landing)           < 120 kB First Load
# /dashboard/home       < 90 kB (widgets lazy)
# /dashboard/simulados  < 80 kB (framer lazy se necessário)
```

Se algum chunk ultrapassar 150 kB, mover para `next/dynamic`:
- `recharts` no `teacher/home` (ainda importado de forma estática — CRÍTICO)
- `framer-motion` pode ser lazy em páginas que não precisam das animações

---

## 🟣 PASSO 7 — Deploy Vercel

```bash
# Verificar variáveis de ambiente
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# OPENAI_API_KEY (para Aurora)

# Deploy
npx vercel --prod
```

Ou via MCP: `mcp__claude_ai_Vercel__deploy_to_vercel`

---

## 📋 Ordem de prioridade recomendada

```
1. npm install framer-motion          ← BLOCKER (animações quebradas sem isso)
2. npm run build                      ← validar que não há erros de TS
3. Apply Supabase migration           ← image_url nas questões
4. Teacher home visual effects        ← alta visibilidade
5. Essays page visual effects         ← alta visibilidade
6. Trails page visual effects         ← muita tração de uso
7. Upload de imagem IMAGEM_PENDENTE   ← funcionalidade nova
8. Otimização recharts teacher/home   ← performance prod
9. Deploy Vercel                      ← entrega final
```

---

_Este arquivo pode ser deletado após a conclusão de todos os passos._
