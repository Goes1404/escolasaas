import fs from 'fs';

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

function isSchoolName(name) { return SCHOOL_NAMES.has(name); }

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

  // Split into blocks
  const separator = '_____';
  const blocks = [];
  let currentBlock = [];
  for (const line of lines) {
    if (line.startsWith(separator) && line.length > 40) {
      blocks.push(currentBlock);
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }
  blocks.push(currentBlock);

  // Debug: show structure of first few blocks
  console.log(`Total blocks: ${blocks.length}`);
  console.log('\nBlock 0 lines:');
  blocks[0].forEach((l, i) => console.log(`  [${i}] "${l}"`));
  console.log('\nBlock 1 lines:');
  blocks[1]?.forEach((l, i) => console.log(`  [${i}] "${l}"`));
  console.log('\nBlock 3 lines (last of first page):');
  blocks[3]?.forEach((l, i) => console.log(`  [${i}] "${l}"`));
}

parse();
