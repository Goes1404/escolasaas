'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCw, Hand } from 'lucide-react';
import type { Bichinho } from '@/lib/bichinho';
import {
  arquetipo, calcularCP, calcularHP, corDoAnel, expressaoDoHumor,
  animacaoDoHumor, iluminacaoDoHumor, CENARIOS,
} from '@/lib/mascote';
import { Mascote } from './Mascote';
import type { MascoteControle } from './controle';

/**
 * A arena — o boneco dentro da moldura de Pokémon GO.
 *
 * A referência que motivou o pedido é uma tela de captura: nome em cima, CP ao
 * lado, barra de HP embaixo, cenário desfocado atrás. É um vocabulário que o
 * aluno já sabe ler sem manual, e é por isso que ele foi aproveitado.
 *
 * O que ele *significa* aqui é outra coisa: o CP não é força de combate, é
 * quanto o aluno estudou (nível + dias, ambos monotônicos); o HP não é dano, é
 * o humor do bicho, que enche de volta com um dia de estudo. A moldura é
 * emprestada; os números são os do banco.
 */

export type TamanhoArena = 'cartao' | 'pagina';

interface ArenaMascoteProps {
  bicho: Bichinho;
  tamanho?: TamanhoArena;
  /** Botões de girar e fazer carinho. Fora na home, dentro na página do bicho. */
  controles?: boolean;
  className?: string;
}

const ANEL: Record<ReturnType<typeof corDoAnel>, string> = {
  green: '#4ADE80',
  yellow: '#FACC15',
  red: '#F87171',
};

export function ArenaMascote({ bicho, tamanho = 'pagina', controles = false, className = '' }: ArenaMascoteProps) {
  const def = arquetipo(bicho.especie);
  const cp = calcularCP(bicho);
  const { hp, hpMax } = calcularHP(bicho);
  const luz = iluminacaoDoHumor(bicho.humor);
  const cenario = CENARIOS[luz];
  const anel = ANEL[corDoAnel(bicho.humor)];
  const estado = animacaoDoHumor(bicho.humor);
  const nome = bicho.nome?.trim() || def.nome;
  const grande = tamanho === 'pagina';

  const controle = useRef<MascoteControle | null>(null);
  const [fala, setFala] = useState<string | null>(null);
  const falaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function aoAcariciar(texto: string) {
    setFala(texto);
    if (falaTimer.current) clearTimeout(falaTimer.current);
    falaTimer.current = setTimeout(() => setFala(null), 2200);
  }

  useEffect(() => () => { if (falaTimer.current) clearTimeout(falaTimer.current); }, []);

  return (
    <div className={className}>
      <div
        className={`relative overflow-hidden rounded-[2.5rem] ${grande ? 'aspect-[4/5]' : 'aspect-square'}`}
        style={{ background: cenario.ceu }}
      >
        {/* Cenário desfocado: bokeh de fundo, como a profundidade de campo de
            uma câmera. Puramente decorativo. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {[
            { l: '8%', t: '10%', s: 74 }, { l: '72%', t: '6%', s: 96 },
            { l: '46%', t: '16%', s: 54 }, { l: '18%', t: '30%', s: 42 },
            { l: '86%', t: '26%', s: 60 },
          ].map((b, i) => (
            <div
              key={i}
              className="absolute rounded-full blur-xl"
              style={{
                left: b.l, top: b.t, width: b.s, height: b.s,
                background: cenario.luz,
                opacity: luz === 'neon_city' ? 0.22 : 0.4,
              }}
            />
          ))}
          {/* Luz do sol atravessando: dá a sensação de "estar lá fora". */}
          <div
            className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-1/2 h-full blur-2xl"
            style={{ background: cenario.luz, opacity: luz === 'neon_city' ? 0.14 : 0.3 }}
          />
        </div>

        {/* Cabeçalho, no lugar exato onde a referência põe o nome. */}
        <div className="absolute top-5 inset-x-0 text-center px-6 z-20 pointer-events-none">
          <p
            className="text-2xl md:text-3xl font-black italic tracking-tight text-white leading-none truncate"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,.45)' }}
          >
            {nome.toUpperCase()}
          </p>
          {/* Só quando acrescenta informação: quem chamou o lobinho de
              "Lobinho" veria a palavra duas vezes, uma embaixo da outra. */}
          {nome.toLowerCase() !== def.nome.toLowerCase() && (
            <p
              className="text-[10px] font-black uppercase tracking-[0.32em] text-white/85 mt-0.5"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,.5)' }}
            >
              {def.nome}
            </p>
          )}
        </div>

        {/* Placa de CP e HP. */}
        <div className="absolute top-[4.6rem] inset-x-0 px-6 z-20 pointer-events-none">
          <div className="mx-auto max-w-[19rem] rounded-full bg-black/35 backdrop-blur-sm px-4 py-2 border border-white/15">
            <div className="flex items-baseline justify-center gap-2 text-white leading-none">
              <span className="text-base font-black italic truncate max-w-[9rem]">{nome}</span>
              <span className="text-white/30" aria-hidden>|</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/70">CP</span>
              <span className="text-xl font-black tabular-nums">{cp}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/70">HP</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(hp / hpMax) * 100}%`, background: anel }}
                />
              </div>
              <span className="text-[9px] font-black tabular-nums text-white/70">{hp}/{hpMax}</span>
            </div>
          </div>
        </div>

        {/* Anel de captura: só quando o bicho ainda está esperando o primeiro
            dia de estudo — é o convite, não um enfeite permanente. */}
        {estado === 'ar_capture_ring' && (
          <div className="absolute left-1/2 top-[58%] z-0 pointer-events-none" aria-hidden>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute rounded-full border-[3px]"
                style={{
                  width: grande ? 210 : 168, height: grande ? 210 : 168,
                  borderColor: anel,
                  left: 0, top: 0,
                  animation: `mascote-anel 2.4s ease-out ${i * 0.8}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* O boneco. */}
        {/* `pb` generoso: a arte renderizada vem com as patas na borda de baixo
            do arquivo (é o que o README pede), então sem folga o bicho encosta
            na moldura e pisa em cima da dica de gesto. */}
        <div className="absolute inset-x-0 bottom-0 top-[20%] flex items-end justify-center px-4 pb-[9%] z-10">
          <Mascote
            especie={bicho.especie}
            nivel={bicho.nivel}
            expressao={expressaoDoHumor(bicho.humor)}
            estado={estado}
            humorParaFala={bicho.humor}
            onCarinho={aoAcariciar}
            controle={controle}
            className="w-full max-w-[19rem]"
          />
        </div>

        {/* Balão de fala do carinho. */}
        {fala && (
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[31%] z-30 pointer-events-none"
            style={{ animation: 'mascote-balao 2.2s ease-out forwards' }}
          >
            <div className="relative rounded-2xl bg-white px-4 py-2 shadow-xl">
              <p className="text-sm font-black text-slate-800 whitespace-nowrap">{fala}</p>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white rotate-45" />
            </div>
          </div>
        )}

        {/* Dica de gesto: sem isto ninguém descobre que dá para girar. */}
        {controles && (
          <p className="absolute bottom-3 inset-x-0 text-center text-[10px] font-black uppercase tracking-widest text-white/70 z-20 pointer-events-none">
            Arraste para girar · toque para fazer carinho
          </p>
        )}
      </div>

      {controles && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            onClick={() => controle.current?.girar360()}
            className="h-12 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-700 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <RotateCw className="h-4 w-4" /> Girar 360°
          </button>
          <button
            type="button"
            onClick={() => controle.current?.fazerCarinho()}
            className="h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Hand className="h-4 w-4" /> Fazer carinho
          </button>
        </div>
      )}
    </div>
  );
}
