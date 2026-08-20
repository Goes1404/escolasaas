'use client';

/**
 * Medição de desempenho percebido: telas lentas e ações que não respondem.
 *
 * O que motivou: a telemetria de eventos diz *onde* o aluno parou, mas não
 * *por quê*. As duas causas mais comuns de abandono numa plataforma usada por
 * celular em rede ruim não deixam rastro de erro nenhum — a tela demora tanto
 * que a pessoa desiste, ou o botão fica girando para sempre porque a promessa
 * nunca resolveu nem rejeitou.
 *
 * Medido em produção antes de escrever isto: a correção de redação leva 6-7s
 * quando os dois corretores concordam e 18s quando é preciso chamar o terceiro.
 * Isso num servidor com rede boa — no 4G do aluno, some a latência dele. A tela
 * mostra "Sincronizando Auditoria..." sem barra de progresso e o `fetch` não
 * tinha timeout: se a rota travasse, o botão girava indefinidamente.
 */

import { trackAcao, trackFalha } from '@/lib/telemetry';

/** Acima disto a operação é registrada como lenta. */
export const LIMIAR_LENTO_MS = 3000;
/** Sem resposta por este tempo, consideramos travado e desistimos. */
export const TIMEOUT_PADRAO_MS = 20000;

export class TempoEsgotado extends Error {
  constructor(readonly operacao: string, readonly ms: number) {
    super(`A operação "${operacao}" não respondeu em ${Math.round(ms / 1000)}s.`);
    this.name = 'TempoEsgotado';
  }
}

/**
 * Corta uma promessa que nunca resolve.
 *
 * `Promise.race` não cancela a operação original — ela continua em segundo
 * plano. O ganho é a interface poder sair do estado de carregamento e dizer
 * algo ao aluno, em vez de girar para sempre.
 */
export function comTimeout<T>(promessa: Promise<T>, ms: number, operacao: string): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TempoEsgotado(operacao, ms)), ms),
    ),
  ]);
}

type OpcoesMedicao = {
  /** Corta e reporta como travada depois deste tempo. 0 desliga o corte. */
  timeoutMs?: number;
  /** Acima disto registra como lenta, mesmo tendo concluído. */
  limiarLentoMs?: number;
  /** Propriedades extras — passam pelo mesmo saneamento da telemetria. */
  props?: Record<string, unknown>;
};

/**
 * Cronometra uma operação e registra o que aconteceu com ela.
 *
 * Três desfechos, todos registrados:
 *   - concluiu rápido → nada (não polui a telemetria com o caso normal)
 *   - concluiu devagar → `acao_lenta`
 *   - estourou o tempo ou falhou → `acao_travada` / `acao_falhou`
 *
 * Repassa o erro adiante: quem chamou continua responsável por mostrar a
 * mensagem ao aluno. Esta função observa, não decide.
 */
export async function medir<T>(
  nome: string,
  operacao: () => Promise<T>,
  opcoes: OpcoesMedicao = {},
): Promise<T> {
  const {
    timeoutMs = TIMEOUT_PADRAO_MS,
    limiarLentoMs = LIMIAR_LENTO_MS,
    props = {},
  } = opcoes;

  const inicio = Date.now();
  try {
    const promessa = operacao();
    const resultado = timeoutMs > 0 ? await comTimeout(promessa, timeoutMs, nome) : await promessa;

    const ms = Date.now() - inicio;
    if (ms > limiarLentoMs) {
      trackAcao('acao_lenta', { ...props, operacao: nome, ms });
    }
    return resultado;
  } catch (erro) {
    const ms = Date.now() - inicio;
    if (erro instanceof TempoEsgotado) {
      trackFalha('acao_travada', erro, { ...props, operacao: nome, ms });
    } else {
      trackFalha('acao_falhou', erro, { ...props, operacao: nome, ms });
    }
    throw erro;
  }
}

/**
 * Métricas de carregamento de tela, via PerformanceObserver nativo.
 *
 * Sem biblioteca: `web-vitals` resolveria o mesmo com mais precisão, mas são
 * ~2KB e uma dependência a mais num bundle que o aluno baixa no 4G — o oposto
 * do que estamos tentando medir.
 *
 * - LCP: quando o maior conteúdo apareceu. É o "quando a tela ficou útil".
 * - INP: pior atraso entre o toque e a resposta visual. É o "cliquei e não
 *   aconteceu nada" medido em milissegundos.
 */
export function observarDesempenhoDaTela() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    // LCP: reportado no fim da visita, porque o valor pode ser revisado para
    // cima até o usuário interagir.
    let ultimoLcp = 0;
    const obsLcp = new PerformanceObserver(lista => {
      const entradas = lista.getEntries();
      const ultima = entradas[entradas.length - 1] as any;
      if (ultima) ultimoLcp = Math.round(ultima.renderTime || ultima.loadTime || ultima.startTime);
    });
    obsLcp.observe({ type: 'largest-contentful-paint', buffered: true });

    // INP: só interessa o pior caso da visita — a média esconde exatamente o
    // travamento que faz o aluno desistir.
    let piorInp = 0;
    try {
      const obsInp = new PerformanceObserver(lista => {
        for (const e of lista.getEntries() as any[]) {
          const atraso = Math.round(e.duration ?? 0);
          if (atraso > piorInp) piorInp = atraso;
        }
      });
      obsInp.observe({ type: 'event', buffered: true, durationThreshold: 200 } as any);
    } catch {
      // Safari antigo não suporta o tipo 'event'. LCP sozinho já ajuda.
    }

    const reportar = () => {
      if (ultimoLcp > 0 || piorInp > 0) {
        trackAcao('desempenho_tela', {
          lcp_ms: ultimoLcp,
          inp_ms: piorInp,
          // Classificação do Web Vitals, para agrupar sem recalcular no SQL.
          lcp_ruim: ultimoLcp > 4000,
          inp_ruim: piorInp > 500,
        });
        ultimoLcp = 0;
        piorInp = 0;
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reportar();
    });
    window.addEventListener('pagehide', reportar);
  } catch {
    // Observador indisponível: seguimos sem métrica de tela.
  }
}

/**
 * Mede o tempo até a tela sair do estado de carregamento.
 *
 * O LCP mede quando os pixels apareceram; isto mede quando os DADOS chegaram,
 * que é o que faz a diferença numa tela cujo esqueleto renderiza rápido e a
 * lista demora. Chamado pelas telas que carregam dados ao montar.
 */
export function medirCarregamentoDeTela(tela: string, inicioMs: number) {
  const ms = Date.now() - inicioMs;
  if (ms > LIMIAR_LENTO_MS) {
    trackAcao('tela_lenta', { tela, ms });
  }
}
