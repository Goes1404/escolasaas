import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qjdcexrirortchemezij.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGNleHJpcm9ydGNoZW1lemlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4ODQzOSwiZXhwIjoyMDg1OTY0NDM5fQ.vWXpOAs-T1WP20ERdZnRpFS81eKnzHPO-zUML5BL--o';
const supabase = createClient(supabaseUrl, supabaseKey);

function normalize(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function tokenize(name) {
  return normalize(name).split(" ");
}

// Score based on how many tokens match, weighted by position
function matchScore(pdfName, dbName) {
  const pdfTokens = tokenize(pdfName);
  const dbTokens = tokenize(dbName);

  let hits = 0;
  for (const pt of pdfTokens) {
    if (pt.length < 2) continue; // ignore single chars
    if (dbTokens.some(dt => dt === pt || dt.startsWith(pt) || pt.startsWith(dt))) hits++;
  }

  // Bonus: first name match
  const firstNameMatch = pdfTokens[0] === dbTokens[0] ? 1 : 0;
  // Bonus: last name match
  const pdfLast = pdfTokens[pdfTokens.length - 1];
  const dbLast = dbTokens[dbTokens.length - 1];
  const lastNameMatch = pdfLast === dbLast ? 1 : 0;

  return {
    hits,
    firstNameMatch,
    lastNameMatch,
    total: hits + firstNameMatch * 2 + lastNameMatch * 2,
    coverage: hits / Math.max(pdfTokens.filter(t => t.length > 1).length, 1),
  };
}

async function run() {
  console.log('Loading students...');
  const students = JSON.parse(fs.readFileSync('parsed_students.json', 'utf8'));

  console.log('Fetching profiles...');
  const { data: profiles, error } = await supabase.from("profiles").select("id, name, email").eq("profile_type", "student");
  if (error) { console.error(error); process.exit(1); }

  const profileList = (profiles || []).map(p => ({
    id: p.id,
    name: p.name ?? "",
    email: p.email ?? "",
    norm: normalize(p.name ?? ""),
  }));

  const exactMatches = [];
  const partialMatches = [];
  const noMatch = [];

  for (const student of students) {
    const normRow = normalize(student.name);
    const pdfTokens = tokenize(student.name);

    // 1. Exact match
    const exact = profileList.find(p => p.norm === normRow);
    if (exact) {
      exactMatches.push({ pdf: student.name, db: exact.name, email: exact.email, profileId: exact.id, scores: { total: 999 } });
      continue;
    }

    // 2. Score all profiles
    const scored = profileList.map(p => ({
      ...p,
      score: matchScore(student.name, p.name),
    })).sort((a, b) => b.score.total - a.score.total);

    const best = scored[0];
    const secondBest = scored[1];

    const isGoodPartial =
      best &&
      best.score.firstNameMatch === 1 &&
      best.score.total >= 4 &&
      best.score.coverage >= 0.6 &&
      (!secondBest || best.score.total > secondBest.score.total);

    if (isGoodPartial) {
      partialMatches.push({
        pdf: student.name,
        db: best.name,
        email: best.email,
        profileId: best.id,
        simulado1: student.simulado1,
        simulado2: student.simulado2,
        score: best.score,
      });
    } else {
      noMatch.push({
        pdf: student.name,
        simulado1: student.simulado1,
        simulado2: student.simulado2,
        topCandidates: scored.slice(0, 3).map(s => ({ db: s.name, email: s.email, id: s.id, score: s.score })),
      });
    }
  }

  const report = { exactMatches, partialMatches, noMatch };
  fs.writeFileSync('matching_report.json', JSON.stringify(report, null, 2));

  console.log(`\n=== RELATÓRIO DE MATCHING ===`);
  console.log(`✅ Exato:   ${exactMatches.length} alunos`);
  console.log(`🟡 Parcial: ${partialMatches.length} alunos (prováveis, aguardando confirmação)`);
  console.log(`❌ Não encontrado: ${noMatch.length} alunos`);
  console.log(`\nRelatório salvo em matching_report.json`);
}

run().catch(console.error);
