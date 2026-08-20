import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qjdcexrirortchemezij.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZGNleHJpcm9ydGNoZW1lemlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4ODQzOSwiZXhwIjoyMDg1OTY0NDM5fQ.vWXpOAs-T1WP20ERdZnRpFS81eKnzHPO-zUML5BL--o';
const supabase = createClient(supabaseUrl, supabaseKey);

const SCHOOL_NAMES = new Set([
  'Paulo Botelho', 'Paulo Freire', 'Abelardo Marques', 'Ricarda dos Santos',
  'Helena Chaves', 'Ana Aparecida', 'Ruth de Azevedo', 'Sebastião Florêncio',
  'Padre Anacleto', 'Benedita Odette', 'Teotônio Vilela', 'Ullysses Guimarães',
  'Reinaldo Santos', 'Tancredo Neves', 'Carlos Alberto', 'Manoel Jacob',
  'Alba de Mello', 'Hortência', 'J.K', 'Leda Caira', 'Celina',
  'João José de Oliveira', 'Imídeo Giuseppe', 'Aurélio', 'Maria Fernandes',
  'Tom Jobim', 'Papa João', 'Daisy Moraes', 'Álvaro Ribeiro',
  'Chácara das Garças', 'Holmes Villar', 'Georgina de Andrade', 'Aldonio Ramos Teixeira',
]);

function normalize(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function parseScore(s) {
  if (!s || s === 'N/A' || s === '#N/D') return null;
  const m = String(s).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function generateEmail(name, usedEmails) {
  const tokens = normalize(name).replace(/[^a-z\s]/g, '').split(' ').filter(Boolean);
  const first = tokens[0] || 'aluno';
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : '';
  let base = last ? `${first}${last}` : first;
  base = base.replace(/[^a-z]/g, '').substring(0, 20);
  let email = `${base}@compromisso.com`;
  let count = 2;
  while (usedEmails.has(email)) {
    email = `${base}${count}@compromisso.com`;
    count++;
  }
  usedEmails.add(email);
  return email;
}

// ── Parse PDF to get sala per block (group of 4 = 1 page) ─────────────────────
function parseSalaFromPDF() {
  const text = fs.readFileSync('pdf_text.txt', 'utf16le');
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const blocks = [];
  let cur = [];
  for (const line of rawLines) {
    if (line.startsWith('_') && line.length > 40) {
      blocks.push(cur); cur = [];
    } else { cur.push(line); }
  }
  blocks.push(cur);

  // Each block: SALA is at index 1 (after CURSO), number at index 2
  // Periodo is at index 5
  return blocks.map(block => {
    const salaIdx = block.indexOf('SALA');
    const sala = salaIdx >= 0 ? (block[salaIdx + 1] ?? '?') : '?';
    const periodo = block.find(l => l === 'Tarde' || l === 'Manhã' || l === 'Manh├ú') ?? '';
    const simIdx = block.indexOf('SIMULADOS');
    const sim1 = simIdx >= 0 ? parseScore(block[simIdx + 1]) : null;
    const sim2 = simIdx >= 0 ? parseScore(block[simIdx + 2]) : null;
    return {
      sala: `sala ${sala}`,
      periodo: periodo.includes('Manh') || periodo.includes('manh') ? 'manhã' : 'tarde',
      sim1, sim2
    };
  });
}

async function ensureExam(title, year) {
  const { data: existing } = await supabase.from("exams").select("id").eq("title", title).eq("year", year).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from("exams").insert({ title, year, exam_type: "simulado_importado" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function run() {
  console.log('📄 Carregando dados...');

  // Use the already-parsed students (452 total, with names matched to blocks in order)
  const pdfStudents = JSON.parse(fs.readFileSync('parsed_students.json', 'utf8'));
  const salaBlocks = parseSalaFromPDF();

  // The parsed_students are matched 1:1 with salaBlocks in groups of 4 (sorted alphabetically per page)
  // Re-add sala info by matching index
  const studentsWithSala = pdfStudents.map((s, i) => ({
    ...s,
    sala: salaBlocks[i]?.sala ?? 'sala ?',
    periodo: salaBlocks[i]?.periodo ?? 'tarde',
  }));

  console.log(`  ${studentsWithSala.length} alunos no PDF`);
  console.log('  Amostra com sala:');
  studentsWithSala.slice(0, 5).forEach(s => console.log(`    ${s.name} | ${s.sala} | ${s.periodo}`));

  console.log('\n🔎 Buscando alunos já cadastrados...');
  const { data: profiles } = await supabase.from("profiles").select("id, name, email").eq("profile_type", "student");
  const profileList = (profiles || []).map(p => ({ ...p, norm: normalize(p.name ?? '') }));

  const existingEmails = new Set(profileList.map(p => p.email?.toLowerCase()).filter(Boolean));
  const usedEmails = new Set(existingEmails);

  // Find students not in DB
  const seenNames = new Set();
  const notInDB = [];

  for (const s of studentsWithSala) {
    if (SCHOOL_NAMES.has(s.name)) continue;
    if (seenNames.has(s.name)) continue;
    seenNames.add(s.name);

    const normName = normalize(s.name);
    const tokens = normName.split(' ').filter(t => t.length > 2).slice(0, 2);
    const found = profileList.find(p =>
      p.norm === normName ||
      (tokens.length >= 2 && tokens.every(t => p.norm.includes(t)))
    );
    if (!found) {
      notInDB.push(s);
    }
  }

  console.log(`\n⚠️  ${notInDB.length} alunos únicos NÃO cadastrados`);

  if (notInDB.length === 0) { console.log('Nada a fazer!'); return; }

  console.log('\nAmostra dos primeiros 15:');
  notInDB.slice(0, 15).forEach(s => {
    const s1 = s.simulado1 ?? s.sim1;
    const s2 = s.simulado2 ?? s.sim2;
    console.log(`  ${s.name} | ${s.sala} | ${s.periodo} | Sim1: ${s1} | Sim2: ${s2}`);
  });

  const exam1Id = await ensureExam("1º Simulado ENEM 2026", 2026);
  const exam2Id = await ensureExam("2º Simulado ENEM 2026", 2026);

  const PASS = 'compromisso2026';
  const created = [];
  let ok = 0, fail = 0;

  console.log(`\n🚀 Criando ${notInDB.length} contas...`);

  for (const s of notInDB) {
    const email = generateEmail(s.name, usedEmails);
    const sim1 = parseScore(s.simulado1) ?? s.sim1;
    const sim2 = parseScore(s.simulado2) ?? s.sim2;

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: s.name, must_change_password: false },
    });

    if (authErr) {
      // Already exists? try to find and skip
      if (authErr.message.includes('already') || authErr.message.includes('exist')) {
        console.log(`  ⚠️  Pulado (já existe): ${s.name}`);
      } else {
        console.error(`  ❌ Erro ao criar ${s.name}: ${authErr.message}`);
        fail++;
      }
      continue;
    }

    const userId = authData.user.id;

    await supabase.from('profiles').upsert({
      id: userId,
      name: s.name,
      full_name: s.name,
      email,
      sala: s.sala,
      periodo: s.periodo,
      role: 'student',
      profile_type: 'student',
      exam_target: 'ETEC',
      course: 'ETEC',
      status: 'active',
    });

    if (sim1 !== null) {
      await supabase.from('exam_attempts').upsert({
        user_id: userId, exam_id: exam1Id, score: sim1,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,exam_id' });
    }
    if (sim2 !== null) {
      await supabase.from('exam_attempts').upsert({
        user_id: userId, exam_id: exam2Id, score: sim2,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,exam_id' });
    }

    created.push({ name: s.name, email, password: PASS, sala: s.sala, periodo: s.periodo, sim1, sim2 });
    ok++;
    if (ok % 20 === 0) console.log(`  ${ok}/${notInDB.length} criados...`);
  }

  fs.writeFileSync('new_accounts.json', JSON.stringify(created, null, 2));
  console.log(`\n=== RESULTADO ===`);
  console.log(`✅ Criados com sucesso: ${ok}`);
  console.log(`❌ Erros: ${fail}`);
  console.log(`📄 Credenciais salvas em new_accounts.json`);
}

run().catch(console.error);
