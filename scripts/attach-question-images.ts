/**
 * Liga as imagens já enviadas ao bucket às questões correspondentes,
 * preenchendo `questions.image_url`.
 *
 * Uso:
 *   npx tsx scripts/attach-question-images.ts --manifest /tmp/etec/imagens.json --dry-run
 *   npx tsx scripts/attach-question-images.ts --manifest /tmp/etec/imagens.json --prefix "ETEC "
 *
 * Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * O manifesto vem de `scripts/extract-pdf-images.ts` no formato
 * `{ "2024-1": { "12": "https://.../q12.png" } }`.
 *
 * O casamento é exato, não heurístico: a chave do manifesto é o número impresso
 * da questão, e `exam_questions.order_index` guarda esse mesmo número. Não
 * envolve IA — serve enquanto a estruturação de novas questões estiver parada.
 *
 * Só preenche questões que ainda não têm imagem; nunca sobrescreve o que um
 * professor tenha ajustado à mão.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
function strFlag(name: string, def = ""): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const MANIFEST = strFlag("--manifest");
/** Prefixo do título da prova no banco. "2024-1" no manifesto → "ETEC 2024-1". */
const PREFIX = strFlag("--prefix", "ETEC ");
const DRY = args.includes("--dry-run");

let _db: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _db;
}

async function main() {
  if (!MANIFEST || !fs.existsSync(MANIFEST)) {
    console.error(
      "Uso: npx tsx scripts/attach-question-images.ts --manifest <arquivo.json> [--prefix 'ETEC '] [--dry-run]"
    );
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }

  const manifest: Record<string, Record<string, string>> = JSON.parse(
    fs.readFileSync(MANIFEST, "utf8")
  );
  const rotulos = Object.keys(manifest).sort();
  console.log(
    `🔗 ${rotulos.length} provas no manifesto${DRY ? "  (SIMULAÇÃO — nada será gravado)" : ""}`
  );

  let ligadas = 0;
  let semProva = 0;
  let semQuestao = 0;
  let jaTinha = 0;

  for (const rotulo of rotulos) {
    const imagens = manifest[rotulo];
    const titulo = `${PREFIX}${rotulo}`;

    const { data: prova } = await db()
      .from("exams")
      .select("id")
      .eq("title", titulo)
      .maybeSingle();

    if (!prova) {
      semProva++;
      console.log(`  ⏭  ${titulo}: prova não existe no banco (${Object.keys(imagens).length} imagens sem uso)`);
      continue;
    }

    // Número impresso da questão → id, via order_index.
    const { data: vinculos, error } = await db()
      .from("exam_questions")
      .select("question_id, order_index, questions(image_url)")
      .eq("exam_id", (prova as any).id);
    if (error) throw new Error(`vínculos de ${titulo}: ${error.message}`);

    const porNumero = new Map<number, { id: string; temImagem: boolean }>();
    for (const v of (vinculos ?? []) as any[]) {
      porNumero.set(Number(v.order_index), {
        id: v.question_id,
        temImagem: !!v.questions?.image_url,
      });
    }

    let nesta = 0;
    let faltando = 0;
    for (const [numStr, url] of Object.entries(imagens)) {
      const alvo = porNumero.get(Number(numStr));
      if (!alvo) { faltando++; continue; }
      if (alvo.temImagem) { jaTinha++; continue; }

      if (!DRY) {
        const { error: upErr } = await db()
          .from("questions")
          .update({ image_url: url })
          .eq("id", alvo.id);
        if (upErr) {
          console.error(`  ⚠️  q${numStr} de ${titulo}: ${upErr.message}`);
          continue;
        }
      }
      nesta++;
    }

    ligadas += nesta;
    semQuestao += faltando;
    console.log(
      `  ✔ ${titulo}: ${nesta} ${DRY ? "seriam ligadas" : "ligadas"}` +
        (faltando > 0 ? ` · ${faltando} sem questão correspondente` : "")
    );
  }

  console.log(`\n${"─".repeat(56)}`);
  console.log(`🏁 ${ligadas} imagens ${DRY ? "seriam ligadas" : "ligadas"} a questões`);
  if (jaTinha > 0) console.log(`   ${jaTinha} questões já tinham imagem — preservadas`);
  if (semQuestao > 0) console.log(`   ${semQuestao} imagens sem questão no banco (questão não importada)`);
  if (semProva > 0) console.log(`   ${semProva} provas do manifesto ainda não importadas`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌", e.message);
    process.exit(1);
  });
}
