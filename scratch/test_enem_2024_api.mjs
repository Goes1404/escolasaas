import { execSync } from 'child_process';

function fetchPS(url) {
  const escaped = url.replace(/'/g, "''");
  const cmd = `powershell -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $r=Invoke-WebRequest -Uri '${escaped}' -UseBasicParsing; [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())"`;
  try {
    return JSON.parse(execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
  } catch (e) {
    console.error("Fetch failed:", e.message);
    return null;
  }
}

async function testApi() {
  console.log("Testing api.enem.dev for 2024 questions...");
  const json = fetchPS('https://api.enem.dev/v1/exams/2024/questions?limit=2');
  console.log("Response:", JSON.stringify(json, null, 2));
}

testApi();
