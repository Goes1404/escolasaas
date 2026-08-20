import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const supabaseUrl = 'https://qjdcexrirortchemezij.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGNleHJpcm9ydGNoZW1lemlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4ODQzOSwiZXhwIjoyMDg1OTY0NDM5fQ.vWXpOAs-T1WP20ERdZnRpFS81eKnzHPO-zUML5BL--o';

const supabase = createClient(supabaseUrl, supabaseKey);



function normalizeName(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

async function ensureExam(title, year) {
  const { data: existing } = await supabase
    .from("exams")
    .select("id")
    .eq("title", title)
    .eq("year", year)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("exams")
    .insert({ title, year, exam_type: "simulado_importado" })
    .select("id")
    .single();

  if (error) throw new Error(`Erro ao criar exame: ${error.message}`);
  return created.id;
}

async function run() {
  console.log('Loading parsed students...');
  const students = JSON.parse(fs.readFileSync('parsed_students.json', 'utf8'));

  console.log('Ensuring exams...');
  const exam1Id = await ensureExam("1º Simulado ENEM 2026", 2026);
  const exam2Id = await ensureExam("2º Simulado ENEM 2026", 2026);

  console.log('Fetching profiles...');
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("profile_type", "student");

  if (error) {
    console.error("Error fetching profiles", error);
    process.exit(1);
  }

  const profileList = (profiles || []).map((p) => ({
    id: p.id,
    name: p.name ?? "",
    norm: normalizeName(p.name ?? ""),
  }));

  let updated = 0;
  let skipped = 0;

  for (const student of students) {
    const normRow = normalizeName(student.name);
    let profileId = null;

    // exact match
    const exact = profileList.find((p) => p.norm === normRow);
    if (exact) {
      profileId = exact.id;
    } else {
      // partial match (first 2 words)
      const tokens = normRow.split(" ").slice(0, 2);
      const partial = profileList.filter((p) => tokens.every((t) => p.norm.includes(t)));
      if (partial.length > 0) {
        profileId = partial[0].id; // taking first match
      }
    }

    if (!profileId) {
      console.log(`Skipped (not found): ${student.name}`);
      skipped++;
      continue;
    }

    // Insert score 1
    if (student.simulado1 && student.simulado1 !== 'N/A' && student.simulado1 !== '#N/D') {
      const scoreMatch = student.simulado1.match(/^(\d+)/);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);
        await supabase.from("exam_attempts").upsert({
          user_id: profileId,
          exam_id: exam1Id,
          score: score,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,exam_id" });
      }
    }

    // Insert score 2
    if (student.simulado2 && student.simulado2 !== 'N/A' && student.simulado2 !== '#N/D') {
      const scoreMatch = student.simulado2.match(/^(\d+)/);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);
        await supabase.from("exam_attempts").upsert({
          user_id: profileId,
          exam_id: exam2Id,
          score: score,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,exam_id" });
      }
    }

    updated++;
    if (updated % 50 === 0) console.log(`Updated ${updated} students...`);
  }

  console.log(`Finished. Updated: ${updated}, Skipped: ${skipped}`);
}

run().catch(console.error);
