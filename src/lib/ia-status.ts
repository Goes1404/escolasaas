/**
 * Classificação e registro de falhas da IA.
 *
 * Motivo: entre 30/07 e 10/08 de 2026 a chave da OpenAI ficou sem crédito e
 * QUATRO funcionalidades pararam ao mesmo tempo — chat da Aurora, resumo
 * semanal, geração de tema e transcrição de redação. Cada rota devolvia
 * "Falha na comunicação com a API de IA" com status 500, e cada tela traduzia
 * isso para "erro de conexão". O aluno concluía que a internet dele estava
 * ruim; ninguém do outro lado ficou sabendo que a plataforma estava sem IA por
 * onze dias.
 *
 * Duas coisas mudam aqui:
 *   1. Falta de crédito e limite de uso viram 503 com mensagem honesta, em vez
 *      de 500 genérico. São estados temporários do serviço, não erro do aluno.
 *   2. O incidente é gravado, para aparecer no painel do admin. É o alerta —
 *      sem depender de ninguém abrir o log da Vercel por acaso.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export type TipoFalhaIA = 'sem_credito' | 'limite_uso' | 'chave_invalida' | 'indisponivel' | 'outro';

/** Extrai o essencial de um erro da OpenAI, direto ou embrulhado pelo AI SDK. */
function detalhes(erro: unknown): { status?: number; code?: string; mensagem: string } {
  const e = erro as any;
  // O Vercel AI SDK embrulha o erro original em `lastError`.
  const raiz = e?.lastError ?? e?.cause ?? e;
  return {
    status: Number(raiz?.status ?? raiz?.statusCode) || undefined,
    code: raiz?.code ?? raiz?.error?.code,
    mensagem: String(raiz?.message ?? e?.message ?? ''),
  };
}

export function classificarFalhaIA(erro: unknown): TipoFalhaIA {
  const { status, code, mensagem } = detalhes(erro);
  const texto = `${code ?? ''} ${mensagem}`.toLowerCase();

  if (texto.includes('credit_balance_exhausted') ||
      texto.includes('insufficient_quota') ||
      texto.includes('no credits remaining')) {
    return 'sem_credito';
  }
  if (status === 429) return 'limite_uso';
  if (status === 401 || texto.includes('invalid_api_key')) return 'chave_invalida';
  if (status === 503 || status === 502 || texto.includes('overloaded')) return 'indisponivel';
  return 'outro';
}

/** Mensagem para o aluno. Diz o que houve e o que fazer, sem culpar a conexão dele. */
export function mensagemParaAluno(tipo: TipoFalhaIA): string {
  switch (tipo) {
    case 'sem_credito':
    case 'chave_invalida':
      return 'As funções de inteligência artificial estão temporariamente indisponíveis. A equipe já foi avisada — tente de novo mais tarde.';
    case 'limite_uso':
      return 'Muita gente usando a inteligência artificial agora. Espere um minuto e tente de novo.';
    case 'indisponivel':
      return 'O serviço de inteligência artificial está instável neste momento. Tente de novo em alguns minutos.';
    default:
      return 'Não foi possível concluir agora. Tente de novo em instantes.';
  }
}

/**
 * Registra o incidente para o painel do admin.
 *
 * Silencioso por dentro: se o registro falhar, a rota ainda precisa responder
 * ao aluno. Um alerta que derruba a requisição é pior que nenhum alerta.
 */
export async function registrarIncidenteIA(rota: string, tipo: TipoFalhaIA, erro: unknown) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const { mensagem, status, code } = detalhes(erro);
    await createClient(url, key).from('ia_incidentes').insert({
      rota,
      tipo,
      // Truncado: é rótulo de diagnóstico, não corpo de resposta.
      detalhe: `${code ?? status ?? ''} ${mensagem}`.trim().slice(0, 200),
    });
  } catch {
    // Sem propagar: o alerta é secundário à resposta ao aluno.
  }
}

/**
 * Resposta padronizada para falha de IA.
 *
 * 503 e não 500 para os casos temporários: o serviço está indisponível, a
 * requisição não está malformada. `indisponivel: true` permite à tela mostrar
 * o aviso certo em vez de "erro de conexão".
 */
export async function respostaFalhaIA(rota: string, erro: unknown) {
  const tipo = classificarFalhaIA(erro);
  const temporario = tipo !== 'outro';

  if (temporario) await registrarIncidenteIA(rota, tipo, erro);
  console.error(`[IA:${rota}] ${tipo}`, erro);

  return NextResponse.json(
    {
      success: false,
      indisponivel: temporario,
      tipo,
      error: mensagemParaAluno(tipo),
    },
    { status: temporario ? 503 : 500 },
  );
}
