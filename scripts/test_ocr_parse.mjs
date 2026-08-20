import fs from 'fs';

const transcriptPath = 'C:\\Users\\eduar\\.gemini\\antigravity-ide\\brain\\301115dc-628e-442e-9a48-3070195e0cef\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);

let ocrText = '';
for (const line of lines) {
  const obj = JSON.parse(line);
  if (obj.type === 'USER_INPUT' && obj.content.includes('==Start of OCR')) {
    ocrText = obj.content;
    break;
  }
}

if (!ocrText) {
  console.log('No OCR text found');
  process.exit(1);
}

const pages = ocrText.split('==Start of OCR for page').slice(1);
console.log(`Found ${pages.length} pages`);

const results = [];

for (const page of pages) {
  const pageNum = page.match(/^ \d+==/)?.[0] || 'unknown';
  const blocks = page.split('________________________________________________________________________________________________________________');
  
  const scoreBlocks = [];
  for (const block of blocks) {
    const simuladosMatch = block.match(/SIMULADOS\s+([^\s]+)\s+([^\s]+)/);
    if (simuladosMatch) {
      scoreBlocks.push({
        sim1: simuladosMatch[1],
        sim2: simuladosMatch[2]
      });
    }
  }

  // Find names. They are usually camel case strings with 2+ words.
  // Actually, we can look for VESTIBULINHO ETEC and grab the lines around it.
  const lines = page.split('\n');
  const names = [];
  for (let i = 0; i < lines.length; i++) {
    // A name usually doesn't have 1º SEM, NOTAS, MATÉRIA, BOLETIM, etc.
    const l = lines[i].trim();
    if (l.match(/^[A-Z][a-z]+(?: [A-Z][a-z]+)+(?: [a-z]+)*$/)) {
      // Looks like a name, e.g. "Adriane Maria da Silva"
      // But wait, there are also school names like "Helena Chaves"
      // Let's filter out known non-student names or use a better heuristic.
    }
  }
  
  // A better heuristic: We know from our db or the OCR that students are listed in alphabetical order.
  // Actually, the easiest way is to read the students from the `students_data.json` or Firebase and match them!
}

console.log('Done');
