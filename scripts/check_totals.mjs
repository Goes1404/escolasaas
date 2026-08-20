import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qjdcexrirortchemezij.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGNleHJpcm9ydGNoZW1lemlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4ODQzOSwiZXhwIjoyMDg1OTY0NDM5fQ.vWXpOAs-T1WP20ERdZnRpFS81eKnzHPO-zUML5BL--o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Quantos alunos temos no banco?
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("profile_type", "student");

  if (error) { console.error(error); process.exit(1); }

  console.log(`\n📊 Total de alunos cadastrados no banco: ${profiles.length}`);
  console.log(`\nPrimeiros 20 nomes no banco:`);
  profiles.slice(0, 20).forEach(p => console.log(`  - "${p.name}" (${p.email})`));

  // Quantos estao no PDF?
  const students = JSON.parse(fs.readFileSync('parsed_students.json', 'utf8'));
  console.log(`\n📄 Total de alunos no PDF: ${students.length}`);
  console.log(`\nPrimeiros 20 nomes no PDF:`);
  students.slice(0, 20).forEach(s => console.log(`  - "${s.name}"`));
}

run().catch(console.error);
