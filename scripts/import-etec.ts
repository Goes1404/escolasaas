/**
 * Importa questões do Vestibulinho ETEC a partir dos textos extraídos
 * (gerados por scripts/fetch-etec-pdfs.sh).
 *
 * Uso:
 *   npm run import:etec -- --dry                 # preview (não escreve)
 *   npm run import:etec                           # aplica
 *   npm run import:etec -- --dir /caminho         # pasta com os .txt
 *   npm run import:etec -- --limit 1              # só N provas (teste)
 *
 * Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 *
 * Pipeline por prova: parseGabarito → structureQuestions (IA) → filtra imagem/incompletas →
 * cruza gabarito → classifica matéria + micro-tópico → cria exam + questions + exam_questions.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { parseGabarito, structureQuestions } from "../src/services/etec-extractor";
import { classifyIntoCategories } from "../src/services/enem-classifier";
import { MICRO_TOPICS_BY_SUBJECT } from "../src/services/enem-microtopics";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Matérias possíveis no Vestibulinho ETEC (ensino fundamental, interdisciplinar).
const ETEC_SUBJECTS = [
  "Matemática", "Português", "História", "Geografia",
  "Física", "Química", "Biologia", "Inglês", "Literatura", "Arte",
];

/**
 * Desempate para a classificação por matéria.
 *
 * A prova da ETEC é interdisciplinar: um mesmo texto de apoio (ex.: sobre a
 * Amazônia) serve a questões de matérias diferentes. Sem estas regras o modelo
 * classificava pelo TEMA do texto e não pela competência avaliada — uma questão
 * de geometria ambientada na floresta virava "Geografia", e interpretação de
 * texto e gramática viravam "Literatura".
 */
const ETEC_CLASSIFY_GUIDANCE = [
  "Estas questões são do Vestibulinho ETEC, não do ENEM.",
  "Classifique pela COMPETÊNCIA AVALIADA, nunca pelo tema do texto de apoio:",
  "vários enunciados compartilham o mesmo texto e pertencem a matérias diferentes.",
  "Se a questão pede cálculo, geometria, porcentagem, proporção, gráfico numérico ou",
  "raciocínio quantitativo, é Matemática — mesmo que o texto fale de floresta, história ou saúde.",
  "Português cobre interpretação de texto, gramática, ortografia, coesão, reescrita,",
  "gênero e função da linguagem. Literatura só quando a questão trata de obra literária,",
  "autor, escola literária ou figura de linguagem em texto literário.",
  "Arte só quando a questão trata de obra de arte, artista, música ou movimento artístico.",
].join(" ");

// ─── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function strFlag(name: string, def: string): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
function numFlag(name: string, def: number): number {
  const v = strFlag(name, "");
  const n = Number(v);
  return v && Number.isFinite(n) ? n : def;
}
const DRY = args.includes("--dry") || args.includes("--dry-run");
const DIR = strFlag("--dir", "C:/Users/User/AppData/Local/Temp/etec");
const LIMIT = numFlag("--limit", 999);
/**
 * Rótulos de prova a processar (ex.: `--only 2019-1,2019-2`). Serve para
 * retomar uma execução interrompida sem gastar cota de IA reprocessando o que
 * já entrou.
 */
const ONLY = strFlag("--only", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ─── Clients ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fetchSubjectMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from("subjects").select("id, name");
  return Object.fromEntries(((data ?? []) as any[]).map((s) => [s.name, s.id]));
}
async function ensureSubject(name: string, map: Record<string, string>): Promise<string> {
  if (map[name]) return map[name];
  const { data, error } = await supabase.from("subjects").insert({ name }).select("id").single();
  if (error || !data) throw new Error(`subject "${name}": ${error?.message}`);
  map[name] = data.id;
  return data.id;
}
async function microTopicMap(subjectId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from("micro_topics").select("id, name").eq("subject_id", subjectId);
  return Object.fromEntries(((data ?? []) as any[]).map((m) => [m.name, m.id]));
}
async function ensureMicroTopics(subjectId: string, names: string[]): Promise<Record<string, string>> {
  if (!DRY) {
    await supabase
      .from("micro_topics")
      .upsert(names.map((name) => ({ subject_id: subjectId, name })), {
        onConflict: "subject_id,name",
        ignoreDuplicates: true,
      });
  }
  return microTopicMap(subjectId);
}

type Prova = { id: string; year: number; provaTxt: string; gabTxt: string };

function discoverProvas(dir: string): Prova[] {
  if (!fs.existsSync(dir)) return [];
  const provas: Prova[] = [];
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)\.prova\.txt$/);
    if (!m) continue;
    const id = m[1];
    const gab = path.join(dir, `${id}.gabarito.txt`);
    if (!fs.existsSync(gab)) continue;
    const year = parseInt(id.slice(0, 4), 10) || 0;
    provas.push({ id, year, provaTxt: path.join(dir, f), gabTxt: gab });
  }
  return provas.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Import de uma prova ─────────────────────────────────────────────────────
async function importProva(p: Prova, subjectMap: Record<string, string>) {
  const examText = fs.readFileSync(p.provaTxt, "utf8");
  const gab = parseGabarito(fs.readFileSync(p.gabTxt, "utf8"));
  const total = Math.max(0, ...Object.keys(gab).map(Number));

  console.log(`\n📄 ETEC ${p.id} — gabarito: ${Object.keys(gab).length} respostas (total ${total})`);
  if (!examText.trim() || total === 0) {
    console.log("  ⏭  texto/gabarito vazio — pulando");
    return { inserted: 0, skipped: 0, dropped: 0 };
  }

  const structured = await structureQuestions(examText, { client: openai, totalQuestions: total });

  // Filtra: sem imagem, 5 alternativas, e com gabarito conhecido.
  const valid = structured.filter(
    (q) => !q.depends_on_image && q.options.length === 5 && gab[q.number]
  );
  const dropped = structured.length - valid.length;
  console.log(`  estruturadas ${structured.length} · válidas ${valid.length} · descartadas ${dropped} (imagem/incompletas)`);

  if (valid.length === 0) return { inserted: 0, skipped: 0, dropped };

  // 1) Classifica a matéria de cada questão.
  const classifiable = valid.map((q) => ({
    id: String(q.number),
    question_text: q.question_text,
    supporting_text: q.supporting_text,
  }));
  const matRes = await classifyIntoCategories(
    classifiable, ETEC_SUBJECTS, "do Vestibulinho ETEC (ensino fundamental, interdisciplinar)",
    { client: openai, guidance: ETEC_CLASSIFY_GUIDANCE }
  );
  const materiaDe = new Map(matRes.map((r) => [r.id, r.category]));

  // 2) Classifica micro-tópico por matéria.
  const microDe = new Map<string, string>();
  const byMateria: Record<string, typeof classifiable> = {};
  for (const c of classifiable) {
    const mat = materiaDe.get(c.id);
    if (mat) (byMateria[mat] ??= []).push(c);
  }
  for (const [mat, qs] of Object.entries(byMateria)) {
    const topics = MICRO_TOPICS_BY_SUBJECT[mat];
    if (!topics) continue;
    const res = await classifyIntoCategories(qs, topics, `da matéria "${mat}"`, { client: openai });
    for (const r of res) microDe.set(r.id, r.category);
  }

  // Distribuição (para dry-run e log)
  const tally: Record<string, number> = {};
  for (const q of valid) {
    const mat = materiaDe.get(String(q.number)) ?? "—";
    tally[mat] = (tally[mat] ?? 0) + 1;
  }
  console.log(`  matérias: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(" · ")}`);

  if (DRY) return { inserted: valid.length, skipped: 0, dropped };

  // 3) Garante subjects + micro_topics e resolve ids.
  const microMapCache: Record<string, Record<string, string>> = {};
  for (const mat of Object.keys(byMateria)) {
    const sid = await ensureSubject(mat, subjectMap);
    if (MICRO_TOPICS_BY_SUBJECT[mat]) microMapCache[mat] = await ensureMicroTopics(sid, MICRO_TOPICS_BY_SUBJECT[mat]);
  }

  // 4) Cria o exame — ou reaproveita, se já existir.
  //
  // Antes esta linha era um INSERT puro, então reexecutar o script duplicava
  // todas as provas já importadas. Isso importa muito na prática: uma execução
  // pode parar no meio (falha de rede, cota da IA esgotada) e a retomada
  // natural é rodar de novo. Agora a retomada é segura.
  const examTitle = `ETEC ${p.id}`;
  const { data: existente } = await supabase
    .from("exams")
    .select("id")
    .eq("title", examTitle)
    .eq("exam_type", "etec")
    .maybeSingle();

  let exam = existente ?? null;
  if (!exam) {
    const { data: novo, error: examErr } = await supabase
      .from("exams")
      .insert({ title: examTitle, year: p.year, exam_type: "etec" })
      .select("id")
      .single();
    if (examErr || !novo) {
      console.error(`  ⚠️ erro ao criar exame: ${examErr?.message}`);
      return { inserted: 0, skipped: 0, dropped };
    }
    exam = novo;
  } else {
    console.log(`  ↻ prova "${examTitle}" já existia — reaproveitando`);
  }

  // 5) Insere as questões e vincula ao exame.
  let inserted = 0;
  let skipped = 0;
  const links: { exam_id: string; question_id: string; order_index: number }[] = [];

  for (const q of valid) {
    const mat = materiaDe.get(String(q.number));
    const subject_id = mat ? subjectMap[mat] : undefined;
    const micro = microDe.get(String(q.number));
    const micro_topic_id = mat && micro ? microMapCache[mat]?.[micro] : null;

    const { data: row, error } = await supabase
      .from("questions")
      .insert({
        question_text: q.question_text,
        supporting_text: q.supporting_text,
        options: q.options,
        correct_answer: gab[q.number],
        subject_id,
        micro_topic_id: micro_topic_id ?? null,
        target_audience: "etec",
        explanation: null,
      })
      .select("id")
      .single();

    if (error) {
      skipped++; // duplicata (hash) ou erro pontual
      continue;
    }
    if (row) {
      links.push({ exam_id: exam.id, question_id: row.id, order_index: q.number });
      inserted++;
    }
  }

  if (links.length > 0) await supabase.from("exam_questions").insert(links);

  console.log(`  ✔ ${inserted} inseridas, ${skipped} duplicadas/erro`);
  return { inserted, skipped, dropped };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY no .env.local");
    process.exit(1);
  }

  const todas = discoverProvas(DIR);
  const provas = (ONLY.length > 0 ? todas.filter((p) => ONLY.includes(p.id)) : todas).slice(0, LIMIT);
  if (ONLY.length > 0) {
    const faltando = ONLY.filter((id) => !todas.some((p) => p.id === id));
    if (faltando.length > 0) console.warn(`⚠️  sem arquivos para: ${faltando.join(", ")}`);
  }
  if (provas.length === 0) {
    console.error(`❌ Nenhuma prova em ${DIR}. Rode antes: bash scripts/fetch-etec-pdfs.sh`);
    process.exit(1);
  }

  console.log(`🎯 Import ETEC — ${DRY ? "DRY-RUN" : "APLICANDO"} · ${provas.length} prova(s) · pasta ${DIR}`);
  const subjectMap = await fetchSubjectMap();

  let ti = 0, ts = 0, td = 0;
  for (const p of provas) {
    try {
      const { inserted, skipped, dropped } = await importProva(p, subjectMap);
      ti += inserted; ts += skipped; td += dropped;
    } catch (e) {
      console.error(`\n⚠️ erro na prova ${p.id}: ${(e as Error).message}`);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`🏁 ${DRY ? "DRY-RUN concluído (nada escrito)" : "Import concluído"}`);
  console.log(`   ✅ ${ti} questões ${DRY ? "seriam inseridas" : "inseridas"}`);
  console.log(`   ⏭  ${ts} duplicadas/erro · 🖼  ${td} descartadas (imagem/incompletas)`);
  if (DRY) console.log(`\n💡 Rode sem --dry para aplicar.`);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
