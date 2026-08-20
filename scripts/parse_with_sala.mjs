import fs from 'fs';

// School names that appear in the PDF as column headers, not students
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

function isSchoolName(name) {
  return SCHOOL_NAMES.has(name);
}

function isLikelyName(line) {
  if (!line || line.length < 4) return false;
  if (SCHOOL_NAMES.has(line)) return false;
  if (line === line.toUpperCase()) return false;
  if (/^[\d\/N\/Ax]+$/.test(line)) return false;
  const skip = ['VESTIBULINHO ETEC', 'MATÉRIA', 'NOTAS', 'BOLETIM ESCOLAR 2026',
    '1º SEM', '2º SEM', 'CURSO', 'SALA', 'ALUNO', 'Periodo', 'Tarde', 'Manhã',
    'COLÉGIO', 'FALTAS/ATEST.', 'SAIDAS ANTEC.', 'Classificatorias',
    '1º Simulado', '2º Simulado', '3º Simulado', 'SIMULADOS'];
  if (skip.includes(line)) return false;
  // Must start with capital, have at least one space
  return /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç\.]+(\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\.]+)+$/.test(line);
}

function parseScore(s) {
  if (!s || s === 'N/A' || s === '#N/D') return null;
  const m = String(s).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parse() {
  const text = fs.readFileSync('pdf_text.txt', 'utf16le');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Split into blocks by separator line
  const separator = '________________________________________________________________________________________________________________';
  const blocks = [];
  let currentBlock = [];
  for (const line of lines) {
    if (line.includes(separator.substring(0, 40))) {
      blocks.push(currentBlock);
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }
  blocks.push(currentBlock);

  // Extract per-block: sala, periodo, simulado1, simulado2
  const studentBlocks = [];
  for (const block of blocks) {
    const salaIdx = block.indexOf('SALA');
    const simIdx = block.indexOf('SIMULADOS');
    if (salaIdx === -1 || simIdx === -1) continue;

    const sala = block[salaIdx + 1] ?? '';
    const periodo = block.find(l => l === 'Tarde' || l === 'Manhã') ?? '';
    const sim1 = block[simIdx + 1] ?? null;
    const sim2 = block[simIdx + 2] ?? null;

    studentBlocks.push({
      sala: `sala ${sala}`,
      periodo: periodo.toLowerCase(),
      simulado1: parseScore(sim1),
      simulado2: parseScore(sim2),
    });
  }

  // Extract names from pages (bottom of each 4-student group)
  // Names appear in the last block of each group of 4
  const nameGroups = [];
  for (let i = 3; i < blocks.length; i += 4) {
    const block = blocks[i];
    const names = [];
    for (const line of block) {
      if (isLikelyName(line)) names.push(line);
    }
    names.sort();
    nameGroups.push(names);
  }

  // Flatten: each group of 4 blocks has 4 names (alphabetical)
  const allNames = [];
  for (const group of nameGroups) {
    for (const n of group) allNames.push(n);
  }

  // Match names to blocks
  const students = [];
  let blockIdx = 0;
  let nameIdx = 0;
  for (let g = 0; g < nameGroups.length; g++) {
    const names = nameGroups[g];
    for (let k = 0; k < names.length && k < 4; k++) {
      const name = names[k];
      const blockData = studentBlocks[blockIdx + k] ?? {};
      students.push({
        name,
        sala: blockData.sala,
        periodo: blockData.periodo,
        simulado1: blockData.simulado1,
        simulado2: blockData.simulado2,
      });
    }
    blockIdx += 4;
  }

  // Filter out school names and duplicates
  const seen = new Set();
  const filtered = students.filter(s => {
    if (isSchoolName(s.name)) return false;
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });

  fs.writeFileSync('students_with_sala.json', JSON.stringify(filtered, null, 2));
  console.log(`✅ ${filtered.length} alunos únicos parseados com sala e notas`);
  console.log('\nAmostra:');
  filtered.slice(0, 10).forEach(s => {
    console.log(`  ${s.name} | ${s.sala} | ${s.periodo} | Sim1: ${s.simulado1} | Sim2: ${s.simulado2}`);
  });
}

parse();
