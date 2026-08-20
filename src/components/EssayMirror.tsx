'use client';

/**
 * Espelho de correção: mostra ao aluno a redação dele com os desvios grifados
 * no lugar onde foram escritos, e como a nota foi formada.
 *
 * Por que isso importa: hoje as correções aparecem numa lista separada
 * ("original → sugestão") e o aluno precisa caçar o trecho no próprio texto.
 * O professor, no papel, circula o erro onde ele está. Dos corretores de IA
 * pesquisados, nenhum marca o texto — CorrigeAI e RedaAI entregam nota por
 * competência e comentários soltos.
 */

import { useState } from 'react';
import { AlertCircle, Scale, ChevronDown, ChevronUp } from 'lucide-react';

export type TrechoCorrigido = {
  original?: string;
  suggestion?: string;
  reason?: string;
  start?: number | null;
  end?: number | null;
};

type Fatia =
  | { tipo: 'texto'; conteudo: string }
  | { tipo: 'marca'; conteudo: string; indice: number; correcao: TrechoCorrigido };

/**
 * Corta o texto nos intervalos marcados. Ignora trechos sem posição (o modelo
 * citou algo que não está literalmente na redação) e os que se sobrepõem.
 */
export function fatiar(texto: string, correcoes: TrechoCorrigido[]): Fatia[] {
  const marcas = correcoes
    .map((c, indice) => ({ ...c, indice }))
    .filter(c => typeof c.start === 'number' && typeof c.end === 'number' && c.end! > c.start!)
    .sort((a, b) => a.start! - b.start!);

  const fatias: Fatia[] = [];
  let cursor = 0;

  for (const m of marcas) {
    if (m.start! < cursor) continue;  // sobreposta
    if (m.start! > cursor) fatias.push({ tipo: 'texto', conteudo: texto.slice(cursor, m.start!) });
    fatias.push({
      tipo: 'marca',
      conteudo: texto.slice(m.start!, m.end!),
      indice: m.indice,
      correcao: m,
    });
    cursor = m.end!;
  }
  if (cursor < texto.length) fatias.push({ tipo: 'texto', conteudo: texto.slice(cursor) });

  return fatias;
}

/** Redação com os desvios grifados; tocar num grifo abre a explicação. */
export function EssayHighlightedText({
  texto,
  correcoes,
}: {
  texto: string;
  correcoes: TrechoCorrigido[];
}) {
  const [aberto, setAberto] = useState<number | null>(null);
  const fatias = fatiar(texto, correcoes);
  const marcados = fatias.filter(f => f.tipo === 'marca').length;

  return (
    <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-amber-50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <h3 className="text-sm font-black italic text-amber-700 uppercase tracking-wide">
            Sua redação corrigida
          </h3>
        </div>
        <p className="text-[11px] font-medium text-amber-700/70 mt-1.5">
          {marcados > 0
            ? `${marcados} ${marcados === 1 ? 'trecho grifado' : 'trechos grifados'} — toque para ver a explicação.`
            : 'Nenhum desvio de norma culta foi marcado neste texto.'}
        </p>
      </div>

      <div className="p-5">
        <p className="text-sm leading-[2] text-slate-700 whitespace-pre-wrap">
          {fatias.map((f, i) =>
            f.tipo === 'texto' ? (
              <span key={i}>{f.conteudo}</span>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setAberto(aberto === f.indice ? null : f.indice)}
                className={`rounded px-0.5 underline decoration-wavy decoration-red-400 underline-offset-4 transition-colors ${
                  aberto === f.indice ? 'bg-red-200' : 'bg-red-50 hover:bg-red-100'
                }`}
                aria-expanded={aberto === f.indice}
              >
                {f.conteudo}
              </button>
            ),
          )}
        </p>

        {aberto !== null && correcoes[aberto] && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/60 p-4 space-y-1.5">
            <p className="text-xs font-black text-slate-700">
              <span className="line-through opacity-60">{correcoes[aberto].original}</span>
              {' → '}
              <span className="text-emerald-700">{correcoes[aberto].suggestion}</span>
            </p>
            <p className="text-[11px] font-medium italic text-slate-600 leading-relaxed">
              {correcoes[aberto].reason}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export type BancaInfo = {
  corretores?: { vetor: number[]; total: number }[];
  houveDiscrepancia?: boolean;
  motivos?: string[];
  precisouBanca?: boolean;
  usadas?: number[];
  revisaoRecomendada?: boolean;
  anulada?: boolean;
  motivo?: string;
};

/**
 * Como a nota foi formada. O aluno vê que houve mais de uma correção e que a
 * nota final saiu do protocolo, não de um chute — e vê quando o próprio
 * sistema reconhece que o caso é limítrofe.
 */
export function BancaMirror({ banca }: { banca: BancaInfo }) {
  const [aberto, setAberto] = useState(false);
  const corretores = banca.corretores ?? [];
  if (corretores.length === 0) return null;

  return (
    <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="w-full p-5 flex items-center gap-2 text-left"
      >
        <div className="h-7 w-7 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
          <Scale className="h-3.5 w-3.5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black italic text-indigo-700 uppercase tracking-wide">
            Como esta nota foi formada
          </h3>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            {corretores.length} {corretores.length === 1 ? 'correção independente' : 'correções independentes'}
            {banca.houveDiscrepancia ? ' · houve divergência' : ' · sem divergência'}
          </p>
        </div>
        {aberto ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {aberto && (
        <div className="px-5 pb-5 space-y-3">
          <div className="space-y-1.5">
            {corretores.map((c, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  banca.usadas?.includes(i)
                    ? 'border-indigo-200 bg-indigo-50'
                    : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-20 shrink-0">
                  Corretor {i + 1}
                </span>
                <span className="text-[11px] font-mono text-slate-600 flex-1">
                  {c.vetor.join(' · ')}
                </span>
                <span className="text-sm font-black text-slate-800">{c.total}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
            {banca.houveDiscrepancia
              ? `As correções divergiram além do limite do INEP (${banca.motivos?.join('; ')}), então uma terceira correção foi feita e a nota final é a média das duas mais próximas — destacadas acima.`
              : 'As correções ficaram dentro do limite de divergência do INEP, então a nota final é a média entre elas.'}
          </p>

          {banca.revisaoRecomendada && (
            <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed">
              Este caso é limítrofe. Vale pedir a um professor que confira a nota — a correção automática é uma
              estimativa de treino, não a nota oficial do ENEM.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Aviso de redação anulada, com o motivo em linguagem de aluno. */
export function AnulacaoAviso({ motivo, explicacao }: { motivo: string; explicacao: string }) {
  const rotulos: Record<string, string> = {
    texto_insuficiente: 'Texto insuficiente',
    copia: 'Cópia dos textos motivadores',
    fuga_ao_tema: 'Fuga ao tema',
    tipo_textual: 'Não é um texto dissertativo-argumentativo',
    parte_desconectada: 'Parte desconectada do tema',
  };

  return (
    <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
        <h3 className="text-sm font-black italic text-red-700 uppercase tracking-wide">
          Redação anulada · {rotulos[motivo] ?? motivo}
        </h3>
      </div>
      <p className="text-xs font-medium text-red-900/80 leading-relaxed">{explicacao}</p>
      <p className="text-[11px] font-medium text-red-900/60 leading-relaxed">
        No ENEM, essas situações são verificadas antes da avaliação das competências — por isso todas ficam
        com zero, mesmo que o texto esteja bem escrito.
      </p>
    </div>
  );
}
