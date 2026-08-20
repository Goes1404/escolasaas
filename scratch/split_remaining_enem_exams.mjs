import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envLocalPath = join(__dirname, '../.env.local');

if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const DAY2_SUBJECTS_POST_2017 = ['Matemática', 'Química', 'Física', 'Biologia', 'Ciências da Natureza'];
const DAY2_SUBJECTS_PRE_2017 = ['Português', 'Literatura', 'Arte', 'Educação Física', 'Espanhol', 'Inglês', 'Linguagens e Códigos', 'Matemática'];

async function splitRemainingExams() {
  const YEARS = [2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
  console.log(`Starting the split process for ENEM historic years: ${YEARS.join(", ")}...\n`);

  for (const year of YEARS) {
    console.log(`----------------------------------------------`);
    console.log(`Processing ENEM ${year}...`);

    // 1. Find the existing unified exam "ENEM {Year}"
    const { data: exam, error: fetchErr } = await supabase
      .from("exams")
      .select("id, title")
      .eq("year", year)
      .eq("exam_type", "enem")
      .eq("title", `ENEM ${year}`)
      .maybeSingle();

    if (fetchErr) {
      console.error(`Error fetching exam for ${year}:`, fetchErr.message);
      continue;
    }

    if (!exam) {
      console.log(`Unified exam "ENEM ${year}" not found. Skipping.`);
      continue;
    }

    console.log(`Found unified exam "${exam.title}" (ID: ${exam.id})`);

    // 2. Fetch all linked questions
    const { data: links, error: linksErr } = await supabase
      .from("exam_questions")
      .select("id, question_id, questions(id, subjects(name))")
      .eq("exam_id", exam.id);

    if (linksErr) {
      console.error(`Error fetching questions for ${exam.title}:`, linksErr.message);
      continue;
    }

    console.log(`Fetched ${links.length} questions linked.`);

    // 3. Separate questions based on year boundary
    const isPost2017 = year >= 2017;
    const day2Subjects = isPost2017 ? DAY2_SUBJECTS_POST_2017 : DAY2_SUBJECTS_PRE_2017;
    
    const day1Links = [];
    const day2QuestionIds = [];

    links.forEach(link => {
      const q = link.questions;
      if (!q) return;
      const sName = q.subjects?.name || "";
      if (day2Subjects.includes(sName)) {
        day2QuestionIds.push(q.id);
      } else {
        day1Links.push(link);
      }
    });

    console.log(`Classification (using ${isPost2017 ? 'Post' : 'Pre'}-2017 rules): Day 1 = ${day1Links.length} | Day 2 = ${day2QuestionIds.length}.`);

    if (day2QuestionIds.length === 0) {
      console.log(`No Day 2 questions found. Skipping split.`);
      continue;
    }

    // 4. Determine PDF URLs
    let day1PdfUrl = null;
    let day2PdfUrl = null;

    if (year >= 2014) {
      day1PdfUrl = `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/${year}_PV_impresso_D1_CD1.pdf`;
      day2PdfUrl = `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/${year}_PV_impresso_D2_CD7.pdf`;
    } else if (year === 2013) {
      day1PdfUrl = `https://download.inep.gov.br/educacao_basica/enem/provas/2013/caderno_1_azul_1_dia.pdf`;
      day2PdfUrl = `https://download.inep.gov.br/educacao_basica/enem/provas/2013/caderno_7_azul_2_dia.pdf`;
    } // For 2010, 2011, 2012, URLs remain null.

    // 5. Update the existing exam to represent "Dia 1"
    const day1Title = `ENEM ${year} - Dia 1 (Azul)`;
    console.log(`Renaming exam ID ${exam.id} to "${day1Title}" and setting PDF...`);
    const { error: updateErr } = await supabase
      .from("exams")
      .update({
        title: day1Title,
        pdf_url: day1PdfUrl
      })
      .eq("id", exam.id);

    if (updateErr) {
      console.error(`Failed to update Day 1 exam:`, updateErr.message);
      continue;
    }

    // 6. Delete Day 2 links from the Day 1 exam
    console.log(`Removing Day 2 questions from "${day1Title}"...`);
    const { error: deleteErr } = await supabase
      .from("exam_questions")
      .delete()
      .eq("exam_id", exam.id)
      .in("question_id", day2QuestionIds);

    if (deleteErr) {
      console.error(`Failed to remove Day 2 links:`, deleteErr.message);
      continue;
    }

    // 7. Create the new exam record for "Dia 2"
    const day2Title = `ENEM ${year} - Dia 2 (Azul)`;
    console.log(`Creating new exam record "${day2Title}"...`);
    const { data: newExam, error: insertErr } = await supabase
      .from("exams")
      .insert({
        title: day2Title,
        year: year,
        exam_type: "enem",
        pdf_url: day2PdfUrl,
        description: `Prova do 2º dia do ENEM ${year}`
      })
      .select("id")
      .single();

    if (insertErr || !newExam) {
      console.error(`Failed to create Day 2 exam:`, insertErr?.message || "No data returned");
      continue;
    }

    console.log(`Created Day 2 exam with ID: ${newExam.id}`);

    // 8. Insert the links for Day 2 questions in exam_questions
    console.log(`Linking ${day2QuestionIds.length} questions to "${day2Title}"...`);
    const newLinks = day2QuestionIds.map((question_id, idx) => ({
      exam_id: newExam.id,
      question_id: question_id,
      order_index: idx + 1
    }));

    const { error: linkErr } = await supabase
      .from("exam_questions")
      .insert(newLinks);

    if (linkErr) {
      console.error(`Failed to link Day 2 questions:`, linkErr.message);
      continue;
    }

    console.log(`Successfully completed split for ENEM ${year}!`);
  }

  console.log(`\n==============================================`);
  console.log(`All operations finished.`);
}

splitRemainingExams();
