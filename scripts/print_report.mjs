import fs from 'fs';
const r = JSON.parse(fs.readFileSync('matching_report.json', 'utf8'));

console.log('\n=== MATCHES EXATOS ===');
r.exactMatches.forEach(m => {
  console.log(`  PDF: "${m.pdf}" => DB: "${m.db}" (${m.email})`);
});

console.log('\n=== MATCHES PARCIAIS (PROVÁVEIS) ===');
r.partialMatches.forEach(m => {
  const s = m.score;
  console.log(`  PDF: "${m.pdf}"`);
  console.log(`    => DB: "${m.db}" (${m.email})`);
  console.log(`    Score: ${s.total} | Primeiro Nome: ${s.firstNameMatch ? '✅' : '❌'} | Último Nome: ${s.lastNameMatch ? '✅' : '❌'} | Cobertura: ${(s.coverage*100).toFixed(0)}%`);
});

console.log('\n=== NÃO ENCONTRADOS ===');
r.noMatch.forEach(m => {
  console.log(`  PDF: "${m.pdf}" (sim1: ${m.simulado1}, sim2: ${m.simulado2})`);
  if (m.topCandidates && m.topCandidates.length > 0) {
    const top = m.topCandidates[0];
    console.log(`    Melhor candidato: "${top.db}" (${top.email}) score:${top.score.total}`);
  }
});
