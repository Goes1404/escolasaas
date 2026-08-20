import fs from 'fs';

const transcriptPath = 'C:\\Users\\eduar\\.gemini\\antigravity-ide\\brain\\301115dc-628e-442e-9a48-3070195e0cef\\.system_generated\\logs\\transcript_full.jsonl';

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);

let ocrText = '';
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT' && obj.content && obj.content.includes('==Start of OCR')) {
      ocrText = obj.content;
      break;
    }
  } catch (e) {}
}

if (!ocrText) {
  console.log('No OCR text found in transcript_full');
  process.exit(1);
}

const pages = ocrText.split('==Start of OCR for page').slice(1);
console.log(`Found ${pages.length} pages`);

const results = [];

// For now let's just write the OCR text to a local file so it's easier to process
fs.writeFileSync('C:\\Users\\eduar\\Desktop\\Eu\\Documentos\\testecompromisso\\ocr_dump.txt', ocrText);
console.log('Saved ocr_dump.txt');
