/**
 * upload-special-simulado-pdf.ts
 *
 * Sobe o PDF do Simulado Especial dos Professores direto pro Supabase Storage
 * (bucket "exam_pdfs") usando a service role key, sem precisar do professor
 * fazer upload manual pela tela /dashboard/teacher/exams.
 *
 * Uso:
 *   npx tsx scripts/upload-special-simulado-pdf.ts "C:\caminho\para\simulado.pdf"
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXAM_TITLE = "Simulado Especial dos Professores";
const EXAM_YEAR = 2026;

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("❌ Informe o caminho do PDF. Ex.: npx tsx scripts/upload-special-simulado-pdf.ts \"C:\\provas\\simulado.pdf\"");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log(`🔎 Localizando exame "${EXAM_TITLE}" (${EXAM_YEAR})...`);
  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id, pdf_url")
    .eq("title", EXAM_TITLE)
    .eq("year", EXAM_YEAR)
    .maybeSingle();

  if (examErr) throw new Error(`Erro ao buscar exame: ${examErr.message}`);
  if (!exam) {
    console.error(`❌ Exame "${EXAM_TITLE}" não encontrado. Rode antes: npx tsx scripts/seed-special-simulado.ts`);
    process.exit(1);
  }

  console.log(`📤 Enviando PDF (${path.basename(filePath)}) para o bucket "exam_pdfs"...`);
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `${exam.id}/${Date.now()}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("exam_pdfs")
    .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: true });

  if (upErr) throw new Error(`Erro no upload: ${upErr.message}`);

  const { data: urlData } = supabase.storage.from("exam_pdfs").getPublicUrl(storagePath);

  const { error: updErr } = await supabase
    .from("exams")
    .update({ pdf_url: urlData.publicUrl })
    .eq("id", exam.id);

  if (updErr) throw new Error(`Erro ao atualizar exame: ${updErr.message}`);

  console.log("✨ PDF vinculado com sucesso!");
  console.log(`   - pdf_url: ${urlData.publicUrl}`);
}

main().catch(err => {
  console.error("❌ Ocorreu um erro fatal:", err.message);
  process.exit(1);
});
