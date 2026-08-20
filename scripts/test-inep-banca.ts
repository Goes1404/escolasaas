/**
 * Testes do protocolo de banca do INEP.
 * `npx tsx scripts/test-inep-banca.ts`
 */
import {
  aplicarProtocoloInep, motivosDeDiscrepancia, snapCompetency, total,
} from '../src/lib/inep-banca';

let falhas = 0;
let testes = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  testes++;
  if (condicao) console.log(`  ✓ ${nome}`);
  else { falhas++; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); }
}

const v = (...n: number[]) => ({ vetor: n });

console.log('\nsnapCompetency');
{
  checar('160 continua 160', snapCompetency(160) === 160);
  checar('150 vira 160', snapCompetency(150) === 160, String(snapCompetency(150)));
  checar('100 vira 80 ou 120', [80, 120].includes(snapCompetency(100)), String(snapCompetency(100)));
  checar('valor absurdo alto satura em 200', snapCompetency(999) === 200);
  checar('negativo vira 0', snapCompetency(-40) === 0);
  checar('lixo vira 0', snapCompetency('abc') === 0);
}

console.log('\nDetecção de discrepância (regra oficial)');
{
  checar('sem diferença: não há discrepância',
    motivosDeDiscrepancia([160, 160, 160, 160, 160], [160, 160, 160, 160, 160]).length === 0);

  // 800 vs 720: diferença total de 80, com cada competência diferindo no
  // máximo 40. Abaixo dos dois limiares, então não é discrepância.
  checar('diferença total de 80 não é discrepância',
    motivosDeDiscrepancia([160, 160, 160, 160, 160], [120, 120, 160, 160, 160]).length === 0,
    JSON.stringify(motivosDeDiscrepancia([160, 160, 160, 160, 160], [120, 120, 160, 160, 160])));

  checar('diferença total de 120 é discrepância',
    motivosDeDiscrepancia([200, 200, 200, 200, 200], [200, 200, 200, 160, 120]).length > 0);

  // Competência: "superior a 80". 80 exato não conta; 120 conta.
  checar('diferença de 80 numa competência não é discrepância',
    motivosDeDiscrepancia([160, 0, 0, 0, 0], [80, 0, 0, 0, 0]).length === 0);
  checar('diferença de 120 numa competência é discrepância',
    motivosDeDiscrepancia([200, 0, 0, 0, 0], [80, 0, 0, 0, 0]).length > 0);
  // Aqui as duas regras disparam ao mesmo tempo (total 200 vs 80 = 120, e C1
  // difere 120), então o motivo de C1 não é necessariamente o primeiro da lista.
  checar('algum motivo cita a competência divergente',
    motivosDeDiscrepancia([200, 0, 0, 0, 0], [80, 0, 0, 0, 0]).some(m => m.includes('C1')),
    JSON.stringify(motivosDeDiscrepancia([200, 0, 0, 0, 0], [80, 0, 0, 0, 0])));

  // Diferenças de nota total são sempre múltiplos de 40, porque cada
  // competência é. Não existe diferença de exatamente 100 — o limiar oficial
  // de "mais de 100" equivale, na prática, a "120 ou mais".
  checar('limiar de 100 equivale a 120 na prática',
    motivosDeDiscrepancia([160, 160, 160, 160, 160], [120, 120, 120, 160, 160])
      .some(m => m.includes('120 pontos')),
    JSON.stringify(motivosDeDiscrepancia([160, 160, 160, 160, 160], [120, 120, 120, 160, 160])));
}

console.log('\nCombinação sem discrepância');
{
  const r = aplicarProtocoloInep([v(160, 160, 120, 160, 120), v(160, 120, 120, 160, 160)]);
  checar('não marca discrepância', !r.houveDiscrepancia);
  checar('usa as duas correções', r.usadas.length === 2);
  checar('total bate com a soma', r.total === total(r.vetor));
  checar('não pede banca', !r.precisouBanca);

  // A média NÃO é arredondada para múltiplo de 40: C2 = média de 160 e 120 =
  // 140, e é assim que fica. Arredondar dava viés para baixo — ver mediaFinal.
  checar('média de 160 e 120 dá 140, não 120', r.vetor[1] === 140, JSON.stringify(r.vetor));
  checar('média de 120 e 160 dá 140 em C5', r.vetor[4] === 140, JSON.stringify(r.vetor));

  // Este é o caso real que revelou o bug: dois corretores em 800 e 760, e a
  // nota final saía 720 — abaixo do MENOR dos dois.
  const real = aplicarProtocoloInep([v(160, 200, 160, 120, 160), v(160, 160, 200, 120, 120)]);
  checar('nota final fica entre as duas correções',
    real.total >= 760 && real.total <= 800, `total=${real.total}`);
  checar('nota final é a média exata dos totais', real.total === 780, `total=${real.total}`);
}

console.log('\nDiscrepância com terceiro corretor');
{
  // A=1000, B=600 (discrepante), C=960 → as duas mais próximas são A e C.
  const A = v(200, 200, 200, 200, 200);
  const B = v(120, 120, 120, 120, 120);
  const C = v(200, 200, 160, 200, 200);
  const r = aplicarProtocoloInep([A, B, C]);

  checar('marca discrepância', r.houveDiscrepancia);
  checar('descarta o corretor destoante', !r.usadas.includes(1), JSON.stringify(r.usadas));
  checar('usa 1º e 3º', r.usadas.includes(0) && r.usadas.includes(2), JSON.stringify(r.usadas));
  checar('nota final fica perto das duas próximas, não da média geral',
    r.total >= 960, `total=${r.total}`);
  checar('não pede banca', !r.precisouBanca);
}

console.log('\nEquidistância → banca de três');
{
  // A=1000, B=600, C=800: |A-C| = 200 e |B-C| = 200 → equidistante.
  const A = v(200, 200, 200, 200, 200);
  const B = v(120, 120, 120, 120, 120);
  const C = v(160, 160, 160, 160, 160);
  const r = aplicarProtocoloInep([A, B, C]);

  checar('detecta equidistância', r.precisouBanca, `totais=${[total(A.vetor), total(B.vetor), total(C.vetor)]}`);
  checar('recomenda revisão humana',
    r.motivos.some(m => m.includes('revisão humana')), JSON.stringify(r.motivos));
  checar('usa as três correções', r.usadas.length === 3);
}

console.log('\nCasos de borda');
{
  const uma = aplicarProtocoloInep([v(160, 160, 160, 160, 160)]);
  checar('uma correção só devolve ela mesma', uma.total === 800, `total=${uma.total}`);

  // Discrepância detectada mas 3ª correção indisponível (ex.: a chamada falhou).
  const semTerceira = aplicarProtocoloInep([v(200, 200, 200, 200, 200), v(40, 40, 40, 40, 40)]);
  checar('sinaliza discrepância sem arbitragem', semTerceira.houveDiscrepancia);
  checar('ainda devolve uma nota', semTerceira.total > 0, `total=${semTerceira.total}`);

  let lancou = false;
  try { aplicarProtocoloInep([]); } catch { lancou = true; }
  checar('lista vazia lança erro', lancou);
}

console.log(`\n${testes - falhas}/${testes} testes passaram.`);
if (falhas > 0) { console.error(`${falhas} FALHA(S).`); process.exit(1); }
