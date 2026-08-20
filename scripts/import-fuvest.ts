/**
 * Importa questões da FUVEST a partir do dataset Alvorada-Bench (licença MIT).
 *
 *   https://huggingface.co/datasets/HenriqueGodoy/Alvorada-bench
 *   Godoy, H. "Alvorada-Bench: Can Language Models Solve Brazilian University
 *   Entrance Exams?" arXiv:2508.15835
 *
 * Uso:
 *   npx tsx scripts/import-fuvest.ts --from 2003 --to 2020 --dry-run
 *   npx tsx scripts/import-fuvest.ts --from 2003 --to 2020
 *   npx tsx scripts/import-fuvest.ts --year 2024
 *
 * Flags:
 *   --dry-run       Não escreve nada. Relata exatamente o que faria.
 *   --keep-images   Importa também as questões que dependem de imagem, marcadas
 *                   com [IMAGEM_PENDENTE]. Fora do padrão de propósito: o
 *                   dataset não traz as imagens e a tela de simulado REMOVE o
 *                   marcador na exibição, então o aluno receberia um enunciado
 *                   do tipo "observe o gráfico" sem gráfico e sem aviso. Foi
 *                   assim que 76 questões precisaram ser apagadas depois da
 *                   primeira importação.
 *
 * Requer no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← bypass RLS, nunca expor no frontend
 *
 * Sobre a banca: o script NÃO grava `questions.exam_board`. Ele cria/reaproveita
 * uma prova por ano com `exam_type = 'fuvest'` e vincula as questões; o trigger
 * `trg_exam_questions_set_board` carimba a banca sozinho.
 *
 * Cobertura: o dataset traz ~46 das 90 questões de cada 1ª fase, e sem as
 * imagens. Para as provas completas, use o Motor de Provas com o PDF oficial.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── Config ────────────────────────────────────────────────────────────────

const DATASET = "HenriqueGodoy/Alvorada-bench";
const PAGE_SIZE = 100;
const BATCH_SIZE = 50;

/** Matérias do dataset → nomes em `subjects`. Todas as 10 já existem no banco. */
const SUBJECT_ALIASES: Record<string, string> = {
  "Português": "Português",
  "História": "História",
  "Biologia": "Biologia",
  "Química": "Química",
  "Física": "Física",
  "Geografia": "Geografia",
  "Matemática": "Matemática",
  "Sociologia": "Sociologia",
  "Filosofia": "Filosofia",
  "Inglês": "Inglês",
};

/** Menções a conteúdo visual que o dataset não inclui. */
const IMAGE_HINT =
  /\b(charge|imagem|figura|gr[áa]fico|mapa|tirinha|fotografia|ilustra[çc]|esquema|quadro abaixo|tabela abaixo|reprodu[çc][ãa]o|obra|pintura|cartum|infogr[áa]fico)/i;

type AlvoradaRow = {
  question_statement: string | null;
  alternative_a: string | null;
  alternative_b: string | null;
  alternative_c: string | null;
  alternative_d: string | null;
  alternative_e: string | null;
  correct_answer: string | null;
  subject: string | null;
  exam_year: number | string | null;
  question_number: number | string | null;
  exam_type: string | null;
};

// ─── Supabase ───────────────────────────────────────────────────────────────

// Inicialização preguiçosa: mantém o módulo importável (e testável) sem exigir
// as variáveis de ambiente só para ler as funções puras.
let _supabase: SupabaseClient | null = null;
function db() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _supabase;
}

// ─── Dataset ────────────────────────────────────────────────────────────────

/** Baixa todas as linhas da FUVEST, paginando a API do Hugging Face. */
async function fetchFuvestRows(): Promise<AlvoradaRow[]> {
  const where = encodeURIComponent(`"exam_type"='fuvest'`);
  const base =
    `https://datasets-server.huggingface.co/filter` +
    `?dataset=${encodeURIComponent(DATASET)}&config=questions&split=train&where=${where}`;

  const out: AlvoradaRow[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${base}&offset=${offset}&limit=${PAGE_SIZE}`;
    let payload: any = null;

    // O índice do dataset pode estar "aquecendo" na primeira chamada.
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url);
      payload = await res.json();
      if (!payload?.error) break;
      process.stdout.write(`\r  índice carregando, tentativa ${attempt + 1}...`);
      await new Promise((r) => setTimeout(r, 12_000));
    }
    if (payload?.error) throw new Error(`Hugging Face: ${payload.error}`);

    total = payload.num_rows_total ?? 0;
    out.push(...(payload.rows ?? []).map((r: any) => r.row as AlvoradaRow));
    offset += PAGE_SIZE;
    process.stdout.write(`\r  baixando questões... ${out.length}/${total}   `);
  }
  process.stdout.write("\n");
  return out;
}

// ─── Limpeza ────────────────────────────────────────────────────────────────

/**
 * Em ~13% das linhas o texto das alternativas aparece repetido dentro do
 * enunciado. Corta o enunciado no ponto em que a lista inline começa.
 */
export function stripInlineAlternatives(statement: string, altA: string): string {
  const a = (altA ?? "").trim();
  if (a.length < 25) return statement;

  const idx = statement.indexOf(a.slice(0, 25));
  if (idx < 40) return statement;

  // Recua até o marcador "(A)" / "A)" que abre a lista, se houver.
  const lookbehind = statement.slice(Math.max(0, idx - 12), idx);
  const marker = lookbehind.search(/\(?[A-Ea-e]\)\s*$/);
  const cut = marker === -1 ? idx : Math.max(0, idx - 12) + marker;

  return statement.slice(0, cut).trim();
}

function normalizeForHash(text: string): string {
  // Espelha fn_set_question_hash: trim → colapsa espaços → lower.
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function questionHash(text: string): string {
  return crypto.createHash("md5").update(normalizeForHash(text), "utf8").digest("hex");
}

type Prepared = {
  question_text: string;
  options: { key: string; text: string }[];
  correct_answer: string;
  subject_id: string;
  target_audience: string;
  year: number;
  question_number: number | null;
  hash: string;
};

export function prepare(
  row: AlvoradaRow,
  subjectMap: Record<string, string>,
  opts: { skipImages: boolean }
): { ok: true; value: Prepared } | { ok: false; reason: string } {
  const rawStatement = (row.question_statement ?? "").trim();
  if (rawStatement.length < 20) return { ok: false, reason: "enunciado vazio ou curto demais" };

  const alts = (["a", "b", "c", "d", "e"] as const).map((L) => ({
    key: L.toUpperCase(),
    text: ((row as any)[`alternative_${L}`] ?? "").trim(),
  }));
  if (alts.some((o) => !o.text)) return { ok: false, reason: "alternativa vazia" };

  const answer = (row.correct_answer ?? "").trim().toUpperCase().charAt(0);
  if (!"ABCDE".includes(answer)) return { ok: false, reason: `gabarito inválido (${row.correct_answer})` };

  const subjectName = SUBJECT_ALIASES[(row.subject ?? "").trim()];
  const subject_id = subjectName ? subjectMap[subjectName] : undefined;
  if (!subject_id) return { ok: false, reason: `matéria não mapeada (${row.subject})` };

  let statement = stripInlineAlternatives(rawStatement, alts[0].text);

  const needsImage = IMAGE_HINT.test(statement);
  if (needsImage) {
    if (opts.skipImages) return { ok: false, reason: "depende de imagem (use --keep-images para incluir)" };
    statement = `[IMAGEM_PENDENTE]\n${statement}`;
  }

  const yearNum = Number(row.exam_year);
  const numberNum = Number(row.question_number);

  return {
    ok: true,
    value: {
      question_text: statement,
      options: alts,
      correct_answer: answer,
      subject_id,
      // Trilha do aluno que verá a questão — a banca vem do vínculo com a prova.
      target_audience: "enem",
      year: Number.isFinite(yearNum) ? yearNum : new Date().getFullYear(),
      question_number: Number.isFinite(numberNum) ? numberNum : null,
      hash: questionHash(statement),
    },
  };
}

// ─── Persistência ───────────────────────────────────────────────────────────

async function fetchSubjectMap(): Promise<Record<string, string>> {
  const { data, error } = await db().from("subjects").select("id, name");
  if (error) throw new Error(`Erro ao buscar subjects: ${error.message}`);
  return Object.fromEntries((data ?? []).map((s) => [s.name, s.id]));
}

/** Cria (ou reaproveita) a prova do ano. O trigger carimba a banca ao vincular. */
async function ensureExam(year: number): Promise<string> {
  const title = `FUVEST ${year} — 1ª fase`;
  const { data: found } = await db()
    .from("exams").select("id").eq("title", title).eq("exam_type", "fuvest").maybeSingle();
  if (found?.id) return found.id;

  const { data, error } = await db()
    .from("exams").insert({ title, year, exam_type: "fuvest" }).select("id").single();
  if (error) throw new Error(`Erro ao criar prova ${title}: ${error.message}`);
  return data.id;
}

async function importYear(
  year: number,
  rows: Prepared[],
  dryRun: boolean
): Promise<{ inserted: number; duplicates: number; linked: number; errors: number }> {
  console.log(`\n📥 FUVEST ${year} — ${rows.length} questões preparadas`);

  if (dryRun) {
    const bySubject = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.subject_id] = (acc[r.subject_id] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`  [simulação] criaria/reusaria a prova "FUVEST ${year} — 1ª fase" (exam_type=fuvest)`);
    console.log(`  [simulação] inseriria ${rows.length} questões em ${Object.keys(bySubject).length} matérias`);
    console.log(`  [simulação] vincularia as ${rows.length} em exam_questions (trigger carimba exam_board)`);
    return { inserted: 0, duplicates: 0, linked: 0, errors: 0 };
  }

  // 1. Insere as questões. O índice único em question_hash ignora repetidas.
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
      question_text: r.question_text,
      options: r.options,
      correct_answer: r.correct_answer,
      subject_id: r.subject_id,
      target_audience: r.target_audience,
      year: r.year,
    }));
    const { data, error } = await db().from("questions").insert(batch).select("id");
    if (error) {
      if (error.code === "23505") {
        // lote inteiro já existia
      } else {
        console.error(`\n  ⚠️  erro no lote ${i}: ${error.message}`);
        errors += batch.length;
      }
    } else {
      inserted += data?.length ?? 0;
    }
    process.stdout.write(`\r  inserindo... ${inserted} novas, ${errors} erros   `);
  }
  process.stdout.write("\n");

  // 2. Resolve os ids pelo hash — pega tanto as recém-inseridas quanto as que
  //    já existiam, para que o vínculo com a prova fique completo mesmo em re-execução.
  const hashes = rows.map((r) => r.hash);
  const idByHash = new Map<string, string>();
  for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
    const { data, error } = await db()
      .from("questions").select("id, question_hash").in("question_hash", hashes.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(`Erro ao resolver ids: ${error.message}`);
    for (const q of data ?? []) idByHash.set(q.question_hash as string, q.id as string);
  }

  const missing = rows.filter((r) => !idByHash.has(r.hash)).length;
  if (missing > 0) console.warn(`  ⚠️  ${missing} questões não puderam ser resolvidas por hash`);

  const duplicates = Math.max(0, rows.length - missing - inserted);

  // 3. Vincula à prova do ano — é este passo que define a banca, via trigger.
  const examId = await ensureExam(year);
  const links = rows
    .filter((r) => idByHash.has(r.hash))
    .map((r, idx) => ({
      exam_id: examId,
      question_id: idByHash.get(r.hash)!,
      order_index: r.question_number ?? idx + 1,
    }));

  let linked = 0;
  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const { error } = await db()
      .from("exam_questions")
      .upsert(links.slice(i, i + BATCH_SIZE), { onConflict: "exam_id,question_id", ignoreDuplicates: true });
    if (error) {
      console.error(`\n  ⚠️  erro ao vincular lote ${i}: ${error.message}`);
      errors += 1;
    } else {
      linked += links.slice(i, i + BATCH_SIZE).length;
    }
  }

  console.log(`  ✔ ${inserted} novas, ${duplicates} já existiam, ${linked} vinculadas à prova, ${errors} erros`);
  return { inserted, duplicates, linked, errors };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  // Padrão é descartar: questão que depende de imagem ausente é inrespondível.
  const skipImages = !args.includes("--keep-images");

  const flag = (name: string): number | null => {
    const i = args.indexOf(name);
    if (i === -1) return null;
    const v = Number(args[i + 1]);
    return Number.isFinite(v) ? v : null;
  };

  const single = flag("--year");
  const from = single ?? flag("--from");
  const to = single ?? flag("--to");

  if (from === null || to === null) {
    console.error(
      "Uso:\n" +
        "  npx tsx scripts/import-fuvest.ts --from 2003 --to 2020 --dry-run\n" +
        "  npx tsx scripts/import-fuvest.ts --year 2024\n\n" +
        "Flags: --dry-run, --keep-images"
    );
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }

  console.log(`🎯 FUVEST ${from}–${to}${dryRun ? "  (SIMULAÇÃO — nada será gravado)" : ""}`);
  console.log(`   fonte: Alvorada-Bench (MIT) · ${skipImages ? "descartando" : "marcando"} questões que dependem de imagem\n`);

  const subjectMap = await fetchSubjectMap();
  const raw = await fetchFuvestRows();

  const inRange = raw.filter((r) => {
    const y = Number(r.exam_year);
    return Number.isFinite(y) && y >= from && y <= to;
  });
  console.log(`\n📚 ${raw.length} questões da FUVEST no dataset · ${inRange.length} dentro de ${from}–${to}`);

  // Prepara e agrupa por ano, contabilizando os descartes por motivo.
  const byYear = new Map<number, Prepared[]>();
  const rejected: Record<string, number> = {};
  for (const row of inRange) {
    const res = prepare(row, subjectMap, { skipImages });
    if (!res.ok) {
      rejected[res.reason] = (rejected[res.reason] ?? 0) + 1;
      continue;
    }
    const list = byYear.get(res.value.year) ?? [];
    list.push(res.value);
    byYear.set(res.value.year, list);
  }

  const usable = [...byYear.values()].reduce((n, l) => n + l.length, 0);
  console.log(`✅ ${usable} aproveitáveis`);
  if (Object.keys(rejected).length > 0) {
    console.log("⏭  descartadas:");
    for (const [reason, n] of Object.entries(rejected).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${n.toString().padStart(4)} — ${reason}`);
    }
  }

  // Duplicatas dentro do próprio lote (mesmo enunciado em anos diferentes).
  const seen = new Set<string>();
  for (const [year, list] of byYear) {
    byYear.set(year, list.filter((r) => (seen.has(r.hash) ? false : (seen.add(r.hash), true))));
  }

  let totals = { inserted: 0, duplicates: 0, linked: 0, errors: 0 };
  for (const year of [...byYear.keys()].sort()) {
    const r = await importYear(year, byYear.get(year)!, dryRun);
    totals = {
      inserted: totals.inserted + r.inserted,
      duplicates: totals.duplicates + r.duplicates,
      linked: totals.linked + r.linked,
      errors: totals.errors + r.errors,
    };
  }

  console.log(`\n${"─".repeat(56)}`);
  if (dryRun) {
    console.log(`🔍 Simulação concluída — ${usable} questões seriam importadas. Nada foi gravado.`);
  } else {
    console.log(
      `🏁 ${totals.inserted} novas · ${totals.duplicates} já existiam · ` +
        `${totals.linked} vinculadas · ${totals.errors} erros`
    );
  }
}

// Só executa quando chamado direto — permite importar as funções puras em testes.
if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌", e.message);
    process.exit(1);
  });
}
