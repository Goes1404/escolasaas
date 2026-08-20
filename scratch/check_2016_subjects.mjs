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

async function check2016() {
  const { data: exam } = await supabase
    .from("exams")
    .select("id, title")
    .eq("year", 2016)
    .eq("exam_type", "enem")
    .like("title", "ENEM 2016%")
    .limit(1)
    .maybeSingle();

  if (!exam) {
    console.log("ENEM 2016 not found");
    return;
  }

  const { data, error } = await supabase
    .from("exam_questions")
    .select("questions(subjects(name))")
    .eq("exam_id", exam.id);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  const subjects = new Set();
  data.forEach(row => {
    if (row.questions?.subjects?.name) {
      subjects.add(row.questions.subjects.name);
    }
  });

  console.log("ENEM 2016 Subjects:", Array.from(subjects));
}

check2016();
