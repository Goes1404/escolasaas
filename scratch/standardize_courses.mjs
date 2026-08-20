import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, course')
    .eq('profile_type', 'student');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log(`Fetched ${data.length} student profiles.`);
  let updatedCount = 0;

  for (const student of data) {
    if (!student.course) continue;
    const original = student.course.trim();
    let standardized = original;

    // Convert "Sala X" to "XX"
    const salaMatch = original.match(/^Sala\s+([0-9]+)$/i);
    if (salaMatch) {
      const num = parseInt(salaMatch[1], 10);
      standardized = String(num).padStart(2, '0');
    } else if (original.match(/^[0-9]+$/)) {
      // Pad numbers to double digits if between 1 and 12
      const num = parseInt(original, 10);
      if (num >= 1 && num <= 12) {
        standardized = String(num).padStart(2, '0');
      }
    }

    if (standardized !== original) {
      console.log(`Standardizing ${student.name} (${student.id}): '${original}' -> '${standardized}'`);
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ course: standardized })
        .eq('id', student.id);

      if (updateErr) {
        console.error(`Error updating student ${student.id}:`, updateErr);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Successfully standardized ${updatedCount} profiles.`);
}

run();
