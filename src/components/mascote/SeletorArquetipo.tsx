'use client';

import type { Arquetipo } from '@/lib/mascote';
import { ARQUETIPOS } from '@/lib/mascote';
import { MascoteRetrato } from './MascoteRetrato';

/**
 * A escolha do arquétipo — todos numa grade só.
 *
 * Antes os quatro do pedido ficavam em cima e os clássicos escondidos num
 * acordeão de "bichinhos clássicos". A separação deixou de fazer sentido quando
 * capivara e tucano ganharam arte renderizada igual à dos novos: o aluno
 * escolhe pelo bicho que quer, não pela data em que ele entrou no sistema.
 */
export function SeletorArquetipo({
  valor, onChange, compacto = false,
}: {
  valor: Arquetipo;
  onChange: (a: Arquetipo) => void;
  /** Grade apertada, para dentro do cartão da home. */
  compacto?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compacto ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 gap-3'}`}>
      {ARQUETIPOS.map(a => {
        const ativo = valor === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            aria-pressed={ativo}
            className={`rounded-card border-2 transition-all overflow-hidden ${
              compacto ? 'p-1.5' : 'p-2.5'
            } ${
              ativo
                ? 'border-orange-500 bg-orange-50 scale-105 shadow-lg'
                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <MascoteRetrato
              especie={a.id}
              expressao={ativo ? 'feliz' : 'normal'}
              className={`w-full ${compacto ? 'h-14' : 'h-20'}`}
            />
            <p className={`font-black text-slate-700 text-center leading-tight ${
              compacto ? 'text-[9px] uppercase tracking-wide' : 'text-[11px] mt-1'
            }`}>
              {a.nome}
            </p>
          </button>
        );
      })}
    </div>
  );
}
