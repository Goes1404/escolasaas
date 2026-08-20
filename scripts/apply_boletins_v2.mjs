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

function matchScore(pdfName, dbName) {
  const pdfTokens = tokenize(pdfName);
  const dbTokens = tokenize(dbName);

  let hits = 0;
  for (const pt of pdfTokens) {
    if (pt.length < 2) continue;
    if (dbTokens.some(dt => dt === pt || dt.startsWith(pt) || pt.startsWith(dt))) hits++;
  }

  const firstNameMatch = pdfTokens[0] === dbTokens[0] ? 1 : 0;
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

function parseScore(s) {
  if (!s || s === 'N/A' || s === '#N/D') return null;
  const m = String(s).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function ensureExam(title, year) {
  const { data: existing } = await supabase.from("exams").select("id").eq("title", title).eq("year", year).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase.from("exams").insert({ title, year, exam_type: "simulado_importado" }).select("id").single();
  if (error) throw new Error(`Erro ao criar exame: ${error.message}`);
  return created.id;
}

async function upsertScore(profileId, examId, score) {
  if (score === null) return;
  const { error } = await supabase.from("exam_attempts").upsert({
    user_id: profileId,
    exam_id: examId,
    score,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id,exam_id" });
  if (error) console.error(`  Erro ao salvar nota: ${error.message}`);
}

async function run() {
  console.log('Carregando alunos do PDF...');
  const students = JSON.parse(fs.readFileSync('parsed_students.json', 'utf8'));

  console.log('Buscando perfis no banco...');
  const { data: profiles, error } = await supabase.from("profiles").select("id, name, email").eq("profile_type", "student");
  if (error) { console.error(error); process.exit(1); }

  const profileList = (profiles || []).map(p => ({
    id: p.id,
    name: p.name ?? "",
    email: p.email ?? "",
    norm: normalize(p.name ?? ""),
  }));

  const exam1Id = await ensureExam("1º Simulado ENEM 2026", 2026);
  const exam2Id = await ensureExam("2º Simulado ENEM 2026", 2026);

  // ── Categorias ────────────────────────────────────────────────────────────────
  const HIGH_CONF = [];    // score >= 7 OU cobertuna >= 0.8 E primeiro nome bate
  const MEDIUM_CONF = [];  // score >= 4 e primeiro nome bate
  const LOW_CONF = [];     // resto

  for (const student of students) {
    const normRow = normalize(student.name);

    // Exato
    const exact = profileList.find(p => p.norm === normRow);
    if (exact) {
      HIGH_CONF.push({ student, profile: exact, reason: 'exact' });
      continue;
    }

    const scored = profileList.map(p => ({ ...p, score: matchScore(student.name, p.name) }))
      .sort((a, b) => b.score.total - a.score.total);

    const best = scored[0];
    const second = scored[1];
    const margin = second ? best.score.total - second.score.total : 999;

    if (!best) { LOW_CONF.push({ student, candidates: [] }); continue; }

    const s = best.score;

    // ALTA: primeiro nome + último nome + boa cobertura + margem clara
    if (s.firstNameMatch && s.lastNameMatch && s.coverage >= 0.6 && margin >= 1) {
      HIGH_CONF.push({ student, profile: best, reason: 'first+last' });
    }
    // ALTA: muito alto score mesmo sem último nome exato (ex: typo simples)
    else if (s.firstNameMatch && s.total >= 7 && margin >= 2) {
      HIGH_CONF.push({ student, profile: best, reason: 'high-score' });
    }
    // MÉDIA: primeiro nome bate + score razoável
    else if (s.firstNameMatch && s.total >= 4 && margin >= 1) {
      MEDIUM_CONF.push({ student, profile: best, score: s, second: scored[1] });
    }
    else {
      LOW_CONF.push({ student, candidates: scored.slice(0, 3).map(c => ({ name: c.name, email: c.email, score: c.score })) });
    }
  }

  // ── Aplicar HIGH automaticamente ─────────────────────────────────────────────
  console.log(`\n✅ Aplicando ${HIGH_CONF.length} matches de ALTA confiança...`);
  let applied = 0;
  for (const m of HIGH_CONF) {
    const s1 = parseScore(m.student.simulado1);
    const s2 = parseScore(m.student.simulado2);
    await upsertScore(m.profile.id, exam1Id, s1);
    await upsertScore(m.profile.id, exam2Id, s2);
    applied++;
    if (applied % 20 === 0) console.log(`  ${applied}/${HIGH_CONF.length} aplicados...`);
  }
  console.log(`  Concluído! ${applied} alunos atualizados.`);

  // ── Relatório MÉDIO ───────────────────────────────────────────────────────────
  console.log(`\n🟡 ${MEDIUM_CONF.length} matches de MÉDIA confiança (revisar manualmente):`);
  const medReport = MEDIUM_CONF.map(m => ({
    pdf: m.student.name,
    db_sugerido: m.profile.name,
    email: m.profile.email,
    profileId: m.profile.id,
    simulado1: m.student.simulado1,
    simulado2: m.student.simulado2,
    score: m.score,
  }));
  fs.writeFileSync('medium_confidence.json', JSON.stringify(medReport, null, 2));
  medReport.forEach(m => {
    console.log(`  PDF: "${m.pdf}"  =>  DB: "${m.db_sugerido}" (${m.email})`);
    console.log(`         Score: ${m.score.total} | 1º Nome: ${m.score.firstNameMatch ? '✅' : '❌'} | Últ. Nome: ${m.score.lastNameMatch ? '✅' : '❌'}`);
  });

  // ── Relatório BAIXO ───────────────────────────────────────────────────────────
  console.log(`\n❌ ${LOW_CONF.length} não encontrados (nomes provavelmente não estão cadastrados):`);
  const lowReport = LOW_CONF.map(m => ({ pdf: m.student.name, simulado1: m.student.simulado1, simulado2: m.student.simulado2, topCandidate: m.candidates[0] ?? null }));
  fs.writeFileSync('low_confidence.json', JSON.stringify(lowReport, null, 2));
  lowReport.forEach(m => {
    const top = m.topCandidate;
    console.log(`  "${m.pdf}"${top ? ` => melhor: "${top.name}" (score ${top.score.total})` : ''}`);
  });

  console.log('\n=== RESUMO ===');
  console.log(`✅ Alta confiança  (aplicados):  ${HIGH_CONF.length}`);
  console.log(`🟡 Média confiança (medium_confidence.json): ${MEDIUM_CONF.length}`);
  console.log(`❌ Não encontrados (low_confidence.json):     ${LOW_CONF.length}`);
}

run().catch(console.error);
