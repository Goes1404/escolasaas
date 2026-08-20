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
      resolve(`Error: ${err.message}`);
    });
    
    req.end();
  });
}

async function testAll() {
  const YEARS = [2012, 2011, 2010];
  console.log("Testing diaX_azul.pdf pattern for 2012, 2011, 2010...");
  
  for (const year of YEARS) {
    const url1 = `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/dia1_azul.pdf`;
    const url2 = `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/dia2_azul.pdf`;
    
    const status1 = await checkUrl(url1);
    const status2 = await checkUrl(url2);
    
    console.log(`Year ${year}:`);
    console.log(`  Day 1: ${url1} -> Status: ${status1}`);
    console.log(`  Day 2: ${url2} -> Status: ${status2}`);
  }
}

testAll();
