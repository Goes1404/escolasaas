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

async function checkAllSubjects() {
  const YEARS = [2023, 2022, 2021, 2020, 2019];
  console.log(`Checking subjects for years: ${YEARS.join(", ")}`);

  for (const year of YEARS) {
    const { data: exam } = await supabase
      .from("exams")
      .select("id, title")
      .eq("year", year)
      .eq("exam_type", "enem")
      .like("title", `ENEM ${year}%`)
      .limit(1)
      .maybeSingle();

    if (!exam) {
      console.log(`Exam for ${year} not found`);
      continue;
    }

    const { data, error } = await supabase
      .from("exam_questions")
      .select("questions(subjects(name))")
      .eq("exam_id", exam.id);

    if (error) {
      console.error(`Error for ${year}:`, error.message);
      continue;
    }

    const subjects = new Set();
    data.forEach(row => {
      if (row.questions?.subjects?.name) {
        subjects.add(row.questions.subjects.name);
      }
    });

    console.log(`- ENEM ${year} Subjects:`, Array.from(subjects));
  }
}

checkAllSubjects();
