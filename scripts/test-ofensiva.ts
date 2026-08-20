/**
 * Testes dos estados da ofensiva.
 *
 *   npx tsx scripts/test-ofensiva.ts
 *
 * O caso que motivou: `isStreakAtRisk` dizia "em risco" quando a ofensiva já
 * tinha morrido, e o widget prometia "estude hoje para não perder seus 3 dias"
 * para quem ia recomeçar do 1 de qualquer jeito.
 */
import { estadoOfensivaPorData as estadoOfensiva, isStreakAtRisk, hojeNoBrasil } from '../src/lib/streak';

let ok = 0;
let falhou = 0;

function teste(nome: string, obtido: unknown, esperado: unknown) {
  if (obtido === esperado) { ok++; console.log(`  ✓ ${nome}`); }
  else { falhou++; console.log(`  ✗ ${nome} — esperado ${esperado}, obtido ${obtido}`); }
}

/** Data no fuso de São Paulo, N dias atrás. */
function diasAtras(n: number): string {
  const [y, m, d] = hojeNoBrasil().split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d) - n * 86_400_000);
  return base.toISOString().slice(0, 10);
}

console.log('\nEstados da ofensiva:');

teste('estudou hoje → mantida',
  estadoOfensiva({ last_activity_date: diasAtras(0), current_streak: 5, protections: 0 }), 'mantida');

teste('estudou ontem → último dia para manter',
  estadoOfensiva({ last_activity_date: diasAtras(1), current_streak: 5, protections: 0 }), 'ultimo_dia');

teste('faltou 1 dia com 1 proteção → protegida',
  estadoOfensiva({ last_activity_date: diasAtras(2), current_streak: 5, protections: 1 }), 'protegida');

teste('faltou 1 dia sem proteção → perdida',
  estadoOfensiva({ last_activity_date: diasAtras(2), current_streak: 5, protections: 0 }), 'perdida');

teste('faltou 2 dias com 2 proteções → protegida',
  estadoOfensiva({ last_activity_date: diasAtras(3), current_streak: 5, protections: 2 }), 'protegida');

teste('faltou 2 dias com 1 proteção → perdida',
  estadoOfensiva({ last_activity_date: diasAtras(3), current_streak: 5, protections: 1 }), 'perdida');

teste('sumiu 10 dias, 2 proteções não cobrem → perdida',
  estadoOfensiva({ last_activity_date: diasAtras(10), current_streak: 12, protections: 2 }), 'perdida');

teste('nunca estudou → nenhuma',
  estadoOfensiva({ last_activity_date: null, current_streak: 0, protections: 2 }), 'nenhuma');

teste('ofensiva zerada → nenhuma',
  estadoOfensiva({ last_activity_date: diasAtras(30), current_streak: 0, protections: 2 }), 'nenhuma');

console.log('\nRisco (o bug original):');

teste('estudou ontem → em risco de verdade (hoje é o último dia)',
  isStreakAtRisk(diasAtras(1)), true);

// Este é o caso que a versão antiga marcava como "em risco" e prometia salvar.
teste('faltou 2 dias → NÃO é risco, já passou',
  isStreakAtRisk(diasAtras(3)), false);

teste('estudou hoje → não é risco',
  isStreakAtRisk(diasAtras(0)), false);

teste('nunca estudou → não é risco',
  isStreakAtRisk(null), false);

console.log('\nFuso:');
const hoje = hojeNoBrasil();
teste('hojeNoBrasil devolve AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(hoje), true);
// Às 21h BRT o UTC já virou o dia seguinte. As duas datas podem divergir, e é
// exatamente essa divergência que inflava a ofensiva de quem estuda à noite.
const utc = new Date().toISOString().slice(0, 10);
console.log(`  · São Paulo ${hoje} · UTC ${utc}${hoje !== utc ? '  (divergem agora — é o caso que quebrava)' : ''}`);

console.log(`\n${ok} passaram · ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
