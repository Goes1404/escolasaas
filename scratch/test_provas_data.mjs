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

async function inspectProvasData() {
  console.log("Fetching a sample question from exam_questions...");
  const { data, error } = await supabase
    .from("exam_questions")
    .select("questions(id, correct_answer, options)")
    .limit(3);

  if (error) {
    console.error("Error fetching exam questions:", error.message);
    return;
  }

  data.forEach((row, idx) => {
    const q = row.questions;
    console.log(`\n--- Question ${idx + 1} ---`);
    console.log("Correct Answer in DB:", q.correct_answer);
    console.log("Options Type:", typeof q.options);
    
    let opts = q.options;
    if (typeof opts === 'string') {
      try {
        opts = JSON.parse(opts);
      } catch (e) {
        opts = [];
      }
    }
    
    if (Array.isArray(opts)) {
      console.log("Options keys in DB:", opts.map(o => o.key));
    } else {
      console.log("Options object:", opts);
    }
  });
}

inspectProvasData();
