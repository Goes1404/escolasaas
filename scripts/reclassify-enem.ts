/**
 * Reclassifica as questões do ENEM já importadas, movendo-as das 3 grandes áreas
 * agregadas para as matérias finas do cursinho, usando IA (gpt-4o-mini).
 *
 * Uso:
 *   npm run reclassify:enem -- --dry              # preview (não escreve nada)
 *   npm run reclassify:enem                        # aplica
 *   npm run reclassify:enem -- --area natureza     # só uma área (natureza|humanas|linguagens|all)
 *   npm run reclassify:enem -- --batch 20          # tamanho do lote enviado à IA
 *   npm run reclassify:enem -- --limit 100         # máx de questões por área (teste)
 *
 * Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 *
 * Seguro por construção:
 *  - Só toca questões cujo subject é uma das 3 áreas agregadas (nunca Matemática).
 *  - Idempotente: ao mover, a questão sai da área → re-rodar não a re-seleciona.
 *  - Grava enem_discipline = área de origem (rastreabilidade / rollback).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { OpenAI } from "openai";
import {
  classifyBatch,
  AREA_TO_SUBJECTS,
  AGGREGATE_SUBJECT_TO_AREA,
  type EnemArea,
} from "../src/services/enem-classifier";

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
const AREA_ARG = strFlag("--area", "all");

const AREA_ARG_TO_SUBJECT: Record<string, string> = {
  natureza: "Ciências da Natureza",
  humanas: "Ciências Humanas",
  linguagens: "Linguagens e Códigos",
};

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

async function ensureSubject(name: string): Promise<string> {
  const { data, error } = await supabase
    .from("subjects")
    .insert({ name })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Erro ao criar subject "${name}": ${error?.message}`);
  return data.id;
}

// ─── Reclassificação por área ────────────────────────────────────────────────
async function reclassifyArea(
  aggName: string,
  area: EnemArea,
  aggId: string,
  subjectMap: Record<string, string>
) {
  console.log(`\n📚 ${aggName} → ${AREA_TO_SUBJECTS[area].join(" / ")}`);

  const { data: rows, error } = await supabase
    .from("questions")
    .select("id, question_text, supporting_text")
    .eq("subject_id", aggId)
    .limit(LIMIT);

  if (error) {
    console.error(`  ⚠️ erro ao buscar questões: ${error.message}`);
    return { moved: 0, unclassified: 0 };
  }

  const questions = rows ?? [];
  console.log(`  ${questions.length} questões a processar${DRY ? " (dry-run)" : ""}`);

  const tally: Record<string, number> = {};
  let moved = 0;
  let unclassified = 0;

  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);

    let results: { id: string; subject: string }[];
    try {
      results = await classifyBatch(batch, area, { client: openai });
    } catch (e) {
      console.error(`\n  ⚠️ erro no lote ${i}: ${(e as Error).message}`);
      continue;
    }

    const bySubject: Record<string, string[]> = {};
    const classified = new Set<string>();
    for (const r of results) {
      classified.add(r.id);
      (bySubject[r.subject] ??= []).push(r.id);
      tally[r.subject] = (tally[r.subject] ?? 0) + 1;
    }
    unclassified += batch.length - classified.size;

    for (const [subject, ids] of Object.entries(bySubject)) {
      if (DRY) {
        moved += ids.length;
        continue;
      }
      const { error: upErr } = await supabase
        .from("questions")
        .update({ subject_id: subjectMap[subject], enem_discipline: area })
        .in("id", ids);
      if (upErr) console.error(`\n  ⚠️ update ${subject}: ${upErr.message}`);
      else moved += ids.length;
    }

    process.stdout.write(
      `\r  processadas ${Math.min(i + BATCH, questions.length)}/${questions.length} · movidas ${moved} · sem classe ${unclassified}`
    );
  }

  console.log(
    `\n  ✔ ${aggName}: ${DRY ? "(dry) " : ""}${moved} movidas, ${unclassified} sem classificação`
  );
  const dist = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s} ${n}`)
    .join(" · ");
  if (dist) console.log(`     distribuição: ${dist}`);
  return { moved, unclassified };
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

  const targets =
    AREA_ARG === "all"
      ? ["Ciências da Natureza", "Ciências Humanas", "Linguagens e Códigos"]
      : [AREA_ARG_TO_SUBJECT[AREA_ARG]];

  if (targets.some((t) => !t)) {
    console.error(`❌ --area inválido: "${AREA_ARG}". Use natureza | humanas | linguagens | all`);
    process.exit(1);
  }

  console.log(`🎯 Reclassificação por matéria (IA) — ${DRY ? "DRY-RUN" : "APLICANDO"}`);
  console.log(`   áreas: ${targets.join(", ")} · lote ${BATCH} · limite/área ${LIMIT}`);

  const subjectMap = await fetchSubjectMap();

  // Garante que as matérias finas candidatas existam.
  const candidates = new Set(Object.values(AREA_TO_SUBJECTS).flat());
  for (const name of candidates) {
    if (!subjectMap[name]) {
      if (DRY) {
        console.log(`   (dry) subject ausente seria criado: "${name}"`);
      } else {
        subjectMap[name] = await ensureSubject(name);
        console.log(`   + subject criado: "${name}"`);
      }
    }
  }

  let totalMoved = 0;
  let totalUnclassified = 0;

  for (const aggName of targets) {
    const area = AGGREGATE_SUBJECT_TO_AREA[aggName];
    const aggId = subjectMap[aggName];
    if (!aggId) {
      console.warn(`\n⏭  subject "${aggName}" não existe no banco — pulando.`);
      continue;
    }
    const { moved, unclassified } = await reclassifyArea(aggName, area, aggId, subjectMap);
    totalMoved += moved;
    totalUnclassified += unclassified;
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`🏁 ${DRY ? "DRY-RUN concluído (nada escrito)" : "Reclassificação concluída"}`);
  console.log(`   ✅ ${totalMoved} questões ${DRY ? "seriam movidas" : "movidas"}`);
  console.log(`   ❔ ${totalUnclassified} sem classificação (permanecem na área)`);
  if (DRY) console.log(`\n💡 Rode sem --dry para aplicar.`);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
