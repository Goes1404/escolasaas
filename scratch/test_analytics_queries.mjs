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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("\n--- Querying profiles ---");
  const { data: pData, error: pError } = await supabase
    .from("profiles")
    .select("id, name, email, role, profile_type, course, institution, exam_target, last_access, is_financial_aid_eligible, xp_points, phone, created_at")
    .eq("role", "student")
    .limit(1);
    
  if (pError) {
    console.error("Profiles Query Error:", pError);
  } else {
    console.log("Profiles query OK, returned:", pData);
  }

  console.log("\n--- Querying student_question_answers ---");
  const { data: aData, error: aError } = await supabase
    .from("student_question_answers")
    .select(`
      id,
      is_correct,
      answered_at,
      student_id,
      selected_option,
      questions (
        id,
        subjects (
          id,
          name
        )
      )
    `)
    .limit(1);

  if (aError) {
    console.error("Answers Query Error:", aError);
  } else {
    console.log("Answers query OK, returned:", aData);
  }

  console.log("\n--- Querying user_progress ---");
  const { data: prData, error: prError } = await supabase
    .from("user_progress")
    .select("user_id, percentage")
    .limit(1);

  if (prError) {
    console.error("Progress Query Error:", prError);
  } else {
    console.log("Progress query OK, returned:", prData);
  }
}

runTest();
