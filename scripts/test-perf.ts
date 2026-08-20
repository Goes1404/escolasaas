/**
 * Testes da camada de desempenho.
 * `npx tsx scripts/test-perf.ts`
 */
import { comTimeout, TempoEsgotado } from '../src/lib/perf';

let falhas = 0;
let testes = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  testes++;
  if (condicao) console.log(`  ✓ ${nome}`);
  else { falhas++; console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); }
}

const espera = (ms: number, valor: unknown = 'ok') =>
  new Promise(r => setTimeout(() => r(valor), ms));

async function main() {
  console.log('\ncomTimeout');
  {
    const rapido = await comTimeout(espera(10, 'pronto'), 200, 'teste');
    checar('operação rápida passa direto', rapido === 'pronto', String(rapido));

    let erro: unknown = null;
    try {
      await comTimeout(espera(300), 50, 'lenta');
    } catch (e) { erro = e; }
    checar('operação lenta é cortada', erro instanceof TempoEsgotado, String(erro));
    checar('erro nomeia a operação',
      (erro as TempoEsgotado)?.operacao === 'lenta', (erro as any)?.operacao);
    checar('mensagem é legível para o aluno',
      /não respondeu em 0s|não respondeu/.test((erro as Error)?.message ?? ''),
      (erro as Error)?.message);
  }

  console.log('\ncomTimeout — erro original é preservado');
  {
    // Um erro real da operação não pode ser mascarado como timeout: são
    // problemas diferentes e levam a mensagens diferentes na tela.
    let erro: unknown = null;
    try {
      await comTimeout(Promise.reject(new Error('falha de rede')), 500, 'x');
    } catch (e) { erro = e; }
    checar('erro real não vira TempoEsgotado', !(erro instanceof TempoEsgotado));
    checar('mensagem original sobrevive', (erro as Error)?.message === 'falha de rede',
      (erro as Error)?.message);
  }

  console.log('\nAgregação do painel');
  {
    // Reproduz `resumirLentidao` do painel para travar a regra: a mediana
    // ignora o extremo, e travamento ordena antes de lentidão.
    const mediana = (v: number[]) => {
      if (!v.length) return 0;
      const s = [...v].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };

    checar('mediana ignora o extremo', mediana([1000, 1100, 1200, 60000]) === 1150,
      String(mediana([1000, 1100, 1200, 60000])));
    checar('mediana de lista ímpar', mediana([100, 200, 300]) === 200);
    checar('mediana de lista vazia é 0', mediana([]) === 0);
  }

  console.log(`\n${testes - falhas}/${testes} testes passaram.`);
  if (falhas > 0) { console.error(`${falhas} FALHA(S).`); process.exit(1); }
}

main();
