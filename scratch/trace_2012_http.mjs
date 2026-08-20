import http from 'http';

function checkHttpUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', (err) => {
      resolve(`Error: ${err.message}`);
    });
  });
}

async function test() {
  const urls = [
    'http://download.inep.gov.br/educacao_basica/enem/provas/2012/dia1_azul.pdf',
    'http://download.inep.gov.br/educacao_basica/enem/provas/2012/dia2_azul.pdf',
    'http://download.inep.gov.br/educacao_basica/enem/provas/2012/caderno_1_azul.pdf',
    'http://download.inep.gov.br/educacao_basica/enem/provas/2012/caderno_7_azul.pdf'
  ];
  
  for (const url of urls) {
    const status = await checkHttpUrl(url);
    console.log(`${url} -> Status: ${status}`);
  }
}

test();
