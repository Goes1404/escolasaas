const pdf = require('pdf-parse');
const fs = require('fs');

async function extract() {
  let dataBuffer = fs.readFileSync('C:/Users/eduar/.gemini/antigravity-ide/brain/301115dc-628e-442e-9a48-3070195e0cef/media__1783985741186.pdf');
  try {
    const data = await pdf(dataBuffer);
    fs.writeFileSync('pdf_dump.txt', data.text);
    console.log('Success, wrote to pdf_dump.txt');
  } catch (e) {
    console.error('Error parsing:', e);
  }
}

extract();
