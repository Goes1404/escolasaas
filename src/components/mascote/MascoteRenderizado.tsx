'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Humor } from '@/lib/bichinho';
import { arquetipo, falaDeCarinho, type Arquetipo, type EstadoAnimacao } from '@/lib/mascote';
import type { MascoteControle } from './controle';

/**
 * O bichinho como arte renderizada.
 *
 * ── O que muda em relação ao rig em SVG ────────────────────────────────────
 *
 * Uma imagem é uma face só. Não dá para girar 360° nela: a 90° some, e a 180°
 * não existe nada atrás. Então a interação é outra — a mesma que jogos 2D usam
 * para dar corpo a um sprite:
 *
 * - **Arrastar inclina**, não gira. O `rotateY` fica preso a ±22°, o suficiente
 *   para o bicho "olhar" na direção do dedo e para a sombra correr junto. Além
 *   disso a imagem começa a parecer uma carta virando.
 * - **Girar 360° vira pirueta.** Uma volta rápida em 0,75 s: a 90° a imagem
 *   fica de perfil por um ou dois quadros, rápido demais para o olho reclamar,
 *   e o que se lê é o bicho rodopiando de alegria.
 * - **Carinho é o corpo inteiro.** No rig só a cabeça inclinava, porque a
 *   cabeça era uma camada; aqui o boneco é indivisível, então ele se encolhe e
 *   balança inteiro.
 *
 * O resto do vocabulário é o mesmo — pulo, respiração, soneca — e as keyframes
 * são literalmente as mesmas do rig, porque já operavam sobre o boneco todo.
 */

const GRAUS_POR_PX = 0.35;
const INCLINACAO_MAX = 22;
/** Abaixo disto, o gesto foi um toque (carinho), não um arrasto. */
const LIMIAR_ARRASTO = 8;

export interface MascoteRenderizadoProps {
  src: string;
  especie: Arquetipo | null;
  estado: EstadoAnimacao;
  interativo?: boolean;
  onCarinho?: (fala: string) => void;
  humorParaFala?: Humor;
  controle?: React.RefObject<MascoteControle | null>;
  /** Avisa quando a imagem falhar em carregar, para o pai cair no vetor. */
  onFalha?: () => void;
  className?: string;
}

/** As mesmas animações de corpo do rig — elas já agiam sobre o boneco inteiro. */
const RITMO: Record<EstadoAnimacao, string> = {
  idle_bounce: 'mascote-respira 3s',
  happy_jump: 'mascote-pulo 1.15s',
  ar_capture_ring: 'mascote-respira 2.2s',
  power_up: 'mascote-power 1.1s',
  carinho: 'mascote-img-carinho 0.9s',
  soneca: 'mascote-soneca 4.4s',
};

interface Coracao { id: number; emoji: string; x: number }

export function MascoteRenderizado({
  src, especie, estado, interativo = true, onCarinho,
  humorParaFala = 'feliz', controle, onFalha, className = '',
}: MascoteRenderizadoProps) {
  const def = arquetipo(especie);

  const inclinaRef = useRef<HTMLDivElement>(null);
  const sombraRef = useRef<HTMLDivElement>(null);
  const giro = useRef(0);
  const arrastando = useRef(false);
  const ultimoX = useRef(0);
  const percorrido = useRef(0);

  const [carinho, setCarinho] = useState(false);
  const [pirueta, setPirueta] = useState(false);
  const [coracoes, setCoracoes] = useState<Coracao[]>([]);
  const [semMovimento, setSemMovimento] = useState(false);
  const fimDoCarinho = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ler = () => setSemMovimento(mq.matches);
    ler();
    mq.addEventListener('change', ler);
    return () => mq.removeEventListener('change', ler);
  }, []);

  // ── Inclinação, escrita direto no DOM ────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    function quadro() {
      // Solto, volta ao centro sozinho. É o que faz a inclinação parecer peso
      // do bicho e não uma alavanca que fica onde o dedo deixou.
      if (!arrastando.current && giro.current !== 0) {
        giro.current *= 0.86;
        if (Math.abs(giro.current) < 0.05) giro.current = 0;
      }
      const g = giro.current;
      if (inclinaRef.current) {
        inclinaRef.current.style.transform = `rotateY(${g.toFixed(2)}deg) translateX(${(g * 0.12).toFixed(2)}%)`;
      }
      // A sombra corre para o lado oposto: é ela que denuncia que o bicho tem
      // volume e está apoiado em alguma coisa.
      if (sombraRef.current) {
        sombraRef.current.style.transform =
          `translateX(calc(-50% + ${(-g * 0.22).toFixed(2)}px)) scaleX(${(1 - Math.abs(g) / 160).toFixed(3)})`;
      }
      raf = requestAnimationFrame(quadro);
    }
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Carinho ──────────────────────────────────────────────────────────────
  const fazerCarinho = useCallback(() => {
    setCarinho(true);
    if (fimDoCarinho.current) clearTimeout(fimDoCarinho.current);
    fimDoCarinho.current = setTimeout(() => setCarinho(false), 1800);

    const id = Date.now() + Math.random();
    const emoji = ['💛', '💖', '✨'][Math.floor(Math.random() * 3)];
    setCoracoes(c => [...c, { id, emoji, x: 34 + Math.random() * 34 }].slice(-6));
    setTimeout(() => setCoracoes(c => c.filter(h => h.id !== id)), 1500);

    onCarinho?.(falaDeCarinho(humorParaFala));
  }, [onCarinho, humorParaFala]);

  useEffect(() => () => { if (fimDoCarinho.current) clearTimeout(fimDoCarinho.current); }, []);

  const girar360 = useCallback(() => {
    giro.current = 0;
    setPirueta(true);
  }, []);

  useEffect(() => {
    if (!controle) return;
    controle.current = { girar360, fazerCarinho };
    return () => { controle.current = null; };
  }, [controle, girar360, fazerCarinho]);

  // ── Gestos ───────────────────────────────────────────────────────────────
  function aoPressionar(e: React.PointerEvent<HTMLDivElement>) {
    if (!interativo) return;
    arrastando.current = true;
    ultimoX.current = e.clientX;
    percorrido.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!interativo || !arrastando.current) return;
    const d = e.clientX - ultimoX.current;
    ultimoX.current = e.clientX;
    percorrido.current += Math.abs(d);
    // Preso a ±22°: passando disso, a imagem plana começa a se anunciar como
    // plana.
    giro.current = Math.max(-INCLINACAO_MAX, Math.min(INCLINACAO_MAX, giro.current + d * GRAUS_POR_PX));
  }

  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    if (!interativo || !arrastando.current) return;
    arrastando.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (percorrido.current < LIMIAR_ARRASTO) fazerCarinho();
  }

  const estadoEfetivo: EstadoAnimacao = carinho ? 'carinho' : estado;

  return (
    <div className={`relative select-none ${className}`}>
      <div
        className={`relative w-full aspect-square ${interativo ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ perspective: '1000px', touchAction: interativo ? 'pan-y' : undefined }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        {/* Pirueta — camada própria para não brigar com a inclinação do dedo. */}
        <div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            animation: pirueta && !semMovimento ? 'mascote-pirueta 0.75s ease-in-out' : undefined,
          }}
          onAnimationEnd={() => setPirueta(false)}
        >
          <div ref={inclinaRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
            <div
              className="absolute inset-0 flex items-end justify-center"
              style={{
                transformOrigin: '50% 92%',
                animation: semMovimento ? undefined : `${RITMO[estadoEfetivo] ?? RITMO.idle_bounce} ease-in-out ${estadoEfetivo === 'carinho' ? '' : 'infinite'}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={def.nome}
                draggable={false}
                onError={onFalha}
                className="w-full h-full object-contain pointer-events-none"
                style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.28))' }}
              />
            </div>
          </div>
        </div>

        {/* Sombra de contato no chão. O `drop-shadow` da imagem acompanha o
            contorno do bicho; esta aqui é a mancha que o prende ao chão.
            Dois níveis porque a animação de respiração e o deslocamento da
            inclinação disputariam o mesmo `transform` — e a animação venceria,
            deixando o acompanhamento do dedo sem efeito nenhum. */}
        <div
          ref={sombraRef}
          className="absolute left-1/2 pointer-events-none"
          style={{ bottom: '5%', width: '46%', height: '5.5%', willChange: 'transform' }}
        >
          <div
            className="w-full h-full rounded-[50%] bg-black/25 blur-[4px]"
            style={{
              animation: semMovimento
                ? undefined
                : `mascote-sombra-plana ${estadoEfetivo === 'happy_jump' ? '1.15s' : '3s'} ease-in-out infinite`,
            }}
          />
        </div>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {coracoes.map(h => (
            <span
              key={h.id}
              className="absolute text-2xl"
              style={{ left: `${h.x}%`, top: '30%', animation: 'mascote-coracao 1.5s ease-out forwards' }}
              aria-hidden
            >
              {h.emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
