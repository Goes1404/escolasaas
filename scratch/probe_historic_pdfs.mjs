import https from 'https';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      resolve(res.statusCode);
    });
    
    req.on('error', (err) => {
      resolve(null);
    });
    
    req.end();
  });
}

const years = [2012, 2011, 2010];

const day1Candidates = [
  'caderno_1_azul_1_dia.pdf',
  'caderno_1_azul_1_dia.pdf',
  'caderno_azul_1_dia.pdf',
  'caderno1_azul_dia1.pdf',
  'caderno_1_azul.pdf',
  'caderno1_azul.pdf',
  'prova_caderno_1_azul_1_dia.pdf',
  'prova_azul_dia1.pdf',
  'caderno_1_dia1_azul.pdf',
  'D1_caderno_azul.pdf',
  'D1_azul.pdf',
  '2012_PV_impresso_D1_CD1.pdf',
  '2011_PV_impresso_D1_CD1.pdf',
  '2010_PV_impresso_D1_CD1.pdf'
];

const day2Candidates = [
  'caderno_7_azul_2_dia.pdf',
  'caderno_azul_2_dia.pdf',
  'caderno7_azul_dia2.pdf',
  'caderno_7_azul.pdf',
  'caderno7_azul.pdf',
  'prova_caderno_7_azul_2_dia.pdf',
  'prova_azul_dia2.pdf',
  'caderno_7_dia2_azul.pdf',
  'D2_caderno_azul.pdf',
  'D2_azul.pdf',
  '2012_PV_impresso_D2_CD7.pdf',
  '2011_PV_impresso_D2_CD7.pdf',
  '2010_PV_impresso_D2_CD7.pdf'
];

async function probe() {
  console.log("Probing historic ENEM PDF URLs...");
  
  for (const year of years) {
    console.log(`\n=== Year ${year} ===`);
    
    // Test Day 1
    console.log("  Testing Day 1:");
    let foundD1 = false;
    for (const cand of day1Candidates) {
      const filename = cand.replace(/2012|2011|2010/g, year);
      const url = `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/${filename}`;
      const status = await checkUrl(url);
      if (status === 200) {
        console.log(`    [FOUND D1] -> ${url}`);
        foundD1 = true;
        break;
      }
    }
    if (!foundD1) console.log("    [NOT FOUND D1]");
    
    // Test Day 2
    console.log("  Testing Day 2:");
    let foundD2 = false;
    for (const cand of day2Candidates) {
      const filename = cand.replace(/2012|2011|2010/g, year);
      const url = `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/${filename}`;
      const status = await checkUrl(url);
      if (status === 200) {
        console.log(`    [FOUND D2] -> ${url}`);
        foundD2 = true;
        break;
      }
    }
    if (!foundD2) console.log("    [NOT FOUND D2]");
  }
}

probe();
