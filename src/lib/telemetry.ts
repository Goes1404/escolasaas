'use client';

/**
 * Telemetria de produto: onde o aluno passa e onde ele trava.
 *
 * Duas regras que governam todo este arquivo:
 *
 * 1. NUNCA quebrar a aplicação. Telemetria que derruba a tela do aluno é pior
 *    que telemetria nenhuma. Toda função aqui engole os próprios erros.
 * 2. NUNCA vazar PII. Alunos são majoritariamente menores. Não entra nome,
 *    e-mail, telefone nem texto escrito por eles — só rota normalizada, nome do
 *    evento e propriedades numéricas/booleanas.
 *
 * Por que existe: em 11/08/2026, de 733 alunos reais, 373 voltaram à plataforma
 * mais de uma vez e apenas 86 chegaram a usar alguma ferramenta de estudo. Não
 * havia como saber onde eles paravam — `activity_logs` tinha 21 linhas em cinco
 * meses. Os dois defeitos achados na redação falhavam em silêncio; sem registro
 * de falha, cada correção vira aposta.
 */

import { supabase } from '@/app/lib/supabase';

type Kind = 'tela' | 'acao' | 'falha';

type Evento = {
  user_id: string;
  session_id: string;
  kind: Kind;
  screen: string | null;
  name: string;
  props: Record<string, unknown> | null;
};

/** Envia em lote a cada 10 eventos ou 5 segundos, o que vier primeiro. */
const LOTE_MAXIMO = 10;
const INTERVALO_MS = 5000;

let fila: Evento[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let usuarioAtual: string | null = null;
let listenersInstalados = false;

/** Identifica a visita. Só agrupa eventos; não é credencial nem identificador estável. */
function sessionId(): string {
  if (typeof sessionStorage === 'undefined') return 'sem-sessao';
  try {
    let id = sessionStorage.getItem('telemetry_sid');
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('telemetry_sid', id);
    }
    return id;
  } catch {
    // Navegador com storage bloqueado (aba anônima em alguns aparelhos).
    return 'sem-sessao';
  }
}

/**
 * Normaliza a rota removendo ids: `/dashboard/student/provas/9f8e-…` vira
 * `/dashboard/student/provas/[id]`.
 *
 * Sem isso, cada prova viraria uma "tela" diferente e nenhum agrupamento
 * funcionaria — além de gravar identificadores de conteúdo sem necessidade.
 */
export function normalizarRota(path: string): string {
  return path
    .split('/')
    .map(seg => {
      if (!seg) return seg;
      // UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return '[id]';
      // Número puro ou token longo sem vogal (hash/slug gerado)
      if (/^\d+$/.test(seg)) return '[id]';
      if (seg.length >= 16 && !/[aeiou]/i.test(seg)) return '[id]';
      return seg;
    })
    .join('/');
}

/**
 * Remove qualquer coisa que possa ser PII das propriedades.
 *
 * Aceita número, booleano e string curta. Strings longas são texto livre —
 * podem conter o que o aluno escreveu — e são descartadas. Chaves com nome
 * suspeito caem mesmo que o valor pareça inofensivo.
 */
const CHAVES_PROIBIDAS = /nome|name|email|mail|phone|telefone|cpf|senha|password|token|texto|content|conteudo|feedback/i;

export function sanitizarProps(props?: Record<string, unknown>): Record<string, unknown> | null {
  if (!props) return null;
  const saida: Record<string, unknown> = {};

  for (const [chave, valor] of Object.entries(props)) {
    if (CHAVES_PROIBIDAS.test(chave)) continue;
    if (typeof valor === 'number' && Number.isFinite(valor)) saida[chave] = valor;
    else if (typeof valor === 'boolean') saida[chave] = valor;
    else if (typeof valor === 'string' && valor.length <= 60) saida[chave] = valor;
    // Objetos, arrays, strings longas e null são descartados de propósito.
  }

  return Object.keys(saida).length > 0 ? saida : null;
}

async function enviar(lote: Evento[]) {
  if (lote.length === 0) return;
  try {
    await supabase.from('app_events').insert(lote);
  } catch {
    // Silêncio proposital: telemetria que falha não pode virar erro na tela,
    // nem gerar um novo evento de falha (laço infinito).
  }
}

function agendarFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, INTERVALO_MS);
}

/** Descarrega a fila agora. Chamado ao sair da página e a cada lote cheio. */
export async function flush() {
  if (fila.length === 0) return;
  const lote = fila;
  fila = [];
  if (timer) { clearTimeout(timer); timer = null; }
  await enviar(lote);
}

/** Informa de quem são os eventos. Sem usuário, nada é gravado. */
export function identificar(userId: string | null) {
  usuarioAtual = userId;
  if (userId) instalarListenersGlobais();
}

function registrar(kind: Kind, name: string, props?: Record<string, unknown>, screen?: string) {
  try {
    if (!usuarioAtual) return;  // deslogado: não há a quem atribuir

    fila.push({
      user_id: usuarioAtual,
      session_id: sessionId(),
      kind,
      screen: screen ?? (typeof location !== 'undefined' ? normalizarRota(location.pathname) : null),
      name: name.slice(0, 80),
      props: sanitizarProps(props),
    });

    if (fila.length >= LOTE_MAXIMO) void flush();
    else agendarFlush();
  } catch {
    // idem: telemetria nunca propaga erro
  }
}

/** Tela aberta. */
export function trackTela(rota: string) {
  registrar('tela', 'tela_aberta', undefined, normalizarRota(rota));
}

/** Ação concluída pelo aluno: enviou redação, iniciou simulado, respondeu questão. */
export function trackAcao(name: string, props?: Record<string, unknown>) {
  registrar('acao', name, props);
}

/**
 * Falha. É o evento mais importante: é exatamente o que faltava quando a
 * redação parava de salvar sem ninguém saber.
 *
 * A mensagem do erro é truncada e passa pelo mesmo saneamento — mensagens de
 * banco podem embutir valores da linha que falhou.
 */
export function trackFalha(name: string, erro?: unknown, props?: Record<string, unknown>) {
  const mensagem =
    erro instanceof Error ? erro.message :
    typeof erro === 'string' ? erro :
    (erro as any)?.message ?? '';

  registrar('falha', name, {
    ...props,
    // `erro` é rótulo curto de diagnóstico, não texto do aluno; 60 caracteres
    // bastam para distinguir "violates check constraint" de "network error".
    erro: String(mensagem).slice(0, 60),
  });
}

/**
 * Captura o que ninguém tratou: exceção solta e promise rejeitada.
 *
 * Os defeitos que mais custaram até agora foram justamente os que não geravam
 * erro visível. Estes dois listeners pegam a outra metade — o que estoura e
 * some no console de um celular que ninguém vai inspecionar.
 */
function instalarListenersGlobais() {
  if (listenersInstalados || typeof window === 'undefined') return;
  listenersInstalados = true;

  window.addEventListener('error', (e) => {
    trackFalha('erro_nao_tratado', e.message, { origem: 'window.error' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    trackFalha('promise_rejeitada', (e as PromiseRejectionEvent).reason, { origem: 'unhandledrejection' });
  });

  // `pagehide` cobre o fechamento de aba no mobile, onde `beforeunload` é
  // pouco confiável. Sem isso, a última tela de cada visita se perderia —
  // justamente a tela onde o aluno desistiu.
  window.addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
