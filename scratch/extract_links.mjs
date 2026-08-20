import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = 'C:/Users/User/.gemini/antigravity-ide/brain/31f55d1f-7f81-434f-8177-418cfc26aa12/.system_generated/steps/470/content.md';

if (!fs.existsSync(filePath)) {
  console.error("File not found:", filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
let match;
const links = [];

while ((match = linkRegex.exec(content)) !== null) {
  links.push({ text: match[1], url: match[2] });
}

console.log(`Extracted ${links.length} links:`);
links.forEach((link) => {
  if (link.url.includes("pdf") || link.url.includes("download") || link.url.includes("provas") || link.url.includes("gabaritos")) {
    console.log(`- [${link.text.trim()}]: ${link.url}`);
  }
});
