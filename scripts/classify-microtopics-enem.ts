/**
 * Classifica as questões do ENEM (já organizadas por matéria) num micro-tópico,
 * usando IA (gpt-4o-mini) restrita à taxonomia curada de cada matéria.
 *
 * Uso:
 *   npm run classify:microtopics -- --dry                  # preview (não escreve)
 *   npm run classify:microtopics                            # aplica
 *   npm run classify:microtopics -- --subject "Matemática"  # uma matéria (ou "all")
 *   npm run classify:microtopics -- --batch 20 --limit 100
 *
 * Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 *
 * Idempotente: só processa questões com micro_topic_id IS NULL.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { OpenAI } from "openai";
import { classifyIntoCategories } from "../src/services/enem-classifier";
import { MICRO_TOPICS_BY_SUBJECT } from "../src/services/enem-microtopics";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── Args ──────────────────────────────────────────────────────────────────
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
const BATCH = numFlag("--batch", 20);
const LIMIT = numFlag("--limit", 5000);
const SUBJECT_ARG = strFlag("--subject", "all");

// ─── Clients ───────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Helpers ───────────────────────────────────────────────────────────────
async function fetchSubjectMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("subjects").select("id, name");
  if (error) throw new Error(`Erro ao buscar subjects: ${error.message}`);
  return Object.fromEntries((data ?? []).map((s) => [s.name, s.id]));
}

/** Garante que os micro-tópicos da matéria existam; retorna name → id. */
async function ensureMicroTopics(
  subjectId: string,
  names: string[]
): Promise<Record<string, string>> {
  if (!DRY) {
    const rows = names.map((name) => ({ subject_id: subjectId, name }));
    const { error } = await supabase
      .from("micro_topics")
      .upsert(rows, { onConflict: "subject_id,name", ignoreDuplicates: true });
    if (error) console.error(`  ⚠️ upsert micro_topics: ${error.message}`);
  }
  const { data } = await supabase
    .from("micro_topics")
    .select("id, name")
    .eq("subject_id", subjectId);
  return Object.fromEntries(((data ?? []) as any[]).map((m) => [m.name, m.id]));
}

// ─── Classificação por matéria ───────────────────────────────────────────────
async function classifySubject(subjectName: string, subjectId: string) {
  const topics = MICRO_TOPICS_BY_SUBJECT[subjectName];
  console.log(`\n📚 ${subjectName} → ${topics.length} micro-tópicos`);

  const topicMap = await ensureMicroTopics(subjectId, topics);
  if (!DRY && Object.keys(topicMap).length > 0) {
    console.log(`  micro-tópicos garantidos no banco`);
  }

  const { data: rows, error } = await supabase
    .from("questions")
    .select("id, question_text, supporting_text")
    .eq("subject_id", subjectId)
    .is("micro_topic_id", null)
    .limit(LIMIT);

  if (error) {
    console.error(`  ⚠️ erro ao buscar questões: ${error.message}`);
    return { marked: 0, unclassified: 0 };
  }

  const questions = rows ?? [];
  console.log(`  ${questions.length} questões sem micro-tópico${DRY ? " (dry-run)" : ""}`);

  const tally: Record<string, number> = {};
  let marked = 0;
  let unclassified = 0;

  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);

    let results: { id: string; category: string }[];
    try {
      results = await classifyIntoCategories(batch, topics, `da matéria "${subjectName}"`, {
        client: openai,
      });
    } catch (e) {
      console.error(`\n  ⚠️ erro no lote ${i}: ${(e as Error).message}`);
      continue;
    }

    const byTopic: Record<string, string[]> = {};
    const classified = new Set<string>();
    for (const r of results) {
      classified.add(r.id);
      (byTopic[r.category] ??= []).push(r.id);
      tally[r.category] = (tally[r.category] ?? 0) + 1;
    }
    unclassified += batch.length - classified.size;

    for (const [topic, ids] of Object.entries(byTopic)) {
      if (DRY) {
        marked += ids.length;
        continue;
      }
      const microId = topicMap[topic];
      if (!microId) continue;
      const { error: upErr } = await supabase
        .from("questions")
        .update({ micro_topic_id: microId })
        .in("id", ids);
      if (upErr) console.error(`\n  ⚠️ update ${topic}: ${upErr.message}`);
      else marked += ids.length;
    }

    process.stdout.write(
      `\r  processadas ${Math.min(i + BATCH, questions.length)}/${questions.length} · marcadas ${marked} · sem tópico ${unclassified}`
    );
  }

  console.log(`\n  ✔ ${subjectName}: ${DRY ? "(dry) " : ""}${marked} marcadas, ${unclassified} sem micro-tópico`);
  const dist = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} ${n}`)
    .join(" · ");
  if (dist) console.log(`     distribuição: ${dist}`);
  return { marked, unclassified };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.OPENAI_API_KEY
  ) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY no .env.local");
    process.exit(1);
  }

  const allSubjects = Object.keys(MICRO_TOPICS_BY_SUBJECT);
  const targets = SUBJECT_ARG === "all" ? allSubjects : [SUBJECT_ARG];

  if (SUBJECT_ARG !== "all" && !MICRO_TOPICS_BY_SUBJECT[SUBJECT_ARG]) {
    console.error(`❌ --subject inválido: "${SUBJECT_ARG}". Opções: ${allSubjects.join(", ")}`);
    process.exit(1);
  }

  console.log(`🎯 Classificação por micro-tópico (IA) — ${DRY ? "DRY-RUN" : "APLICANDO"}`);
  console.log(`   matérias: ${targets.join(", ")} · lote ${BATCH} · limite/matéria ${LIMIT}`);

  const subjectMap = await fetchSubjectMap();

  let totalMarked = 0;
  let totalUnclassified = 0;

  for (const subjectName of targets) {
    const subjectId = subjectMap[subjectName];
    if (!subjectId) {
      console.warn(`\n⏭  subject "${subjectName}" não existe no banco — pulando.`);
      continue;
    }
    const { marked, unclassified } = await classifySubject(subjectName, subjectId);
    totalMarked += marked;
    totalUnclassified += unclassified;
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`🏁 ${DRY ? "DRY-RUN concluído (nada escrito)" : "Classificação concluída"}`);
  console.log(`   ✅ ${totalMarked} questões ${DRY ? "seriam marcadas" : "marcadas"} com micro-tópico`);
  console.log(`   ❔ ${totalUnclassified} sem micro-tópico (permanecem só com a matéria)`);
  if (DRY) console.log(`\n💡 Rode sem --dry para aplicar.`);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
