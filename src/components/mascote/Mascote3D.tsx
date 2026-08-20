'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Humor } from '@/lib/bichinho';
import {
  arquetipo, falaDeCarinho,
  type Arquetipo, type EstadoAnimacao, type Expressao,
} from '@/lib/mascote';
import {
  Acessorio, Asas, Cabeca, Cauda, CAMADAS, Chapeu, Corpo, Efeito, Focinho,
  Olhos, Orelhas, PROFUNDIDADE,
} from './arte';
import type { Camada, Vista } from './arte';
import type { MascoteControle } from './controle';

/**
 * O bichinho em 3D — gira 360°, aceita carinho e reage ao humor.
 *
 * ── Como a rotação funciona ────────────────────────────────────────────────
 *
 * Nove camadas empilhadas, cada uma numa profundidade `z`. Girar θ desloca cada
 * camada horizontalmente em `z · sen(θ)` e a aproxima/afasta em `z · cos(θ)`.
 * O resultado é paralaxe real: a 90° a cauda foi para um lado e o focinho para
 * o outro — o bicho está de perfil, montado sozinho a partir das peças.
 * Passando de 90°, entra a arte de costas com um cross-fade curto.
 *
 * O ângulo mora num ref e é escrito direto no DOM dentro de um rAF. Passar por
 * `useState` custaria um render por frame de arrasto, e o celular do aluno é o
 * aparelho onde isso apareceria primeiro.
 *
 * ── Carinho ────────────────────────────────────────────────────────────────
 *
 * Tocar a cabeça fecha os olhos em `^ ^`, faz o bicho encostar no dedo e solta
 * corações. Não dá XP de propósito: XP vem de estudar, e a régua de 11/08 já
 * tirou pontos de tudo que não fosse estudo. Carinho é afeto, não moeda — se
 * pagasse, viraria mais uma tarefa.
 */

const GRAUS_POR_PX = 0.55;
/** Abaixo disto, o gesto foi um toque (carinho), não um arrasto (girar). */
const LIMIAR_ARRASTO = 8;
/**
 * Teto da inércia, em graus por quadro.
 *
 * Sem teto, um dedo rápido (ou um `pointermove` que pulou vários pixels, o que
 * acontece quando a aba engasga) largava o bicho girando quase uma volta
 * inteira depois de um arrasto curto. Com o teto, o empurrão forte ainda roda
 * ~100°, que é o suficiente para ser divertido, e o arrasto devagar para onde
 * o dedo parou.
 */
const INERCIA_MAX = 8;

export interface Mascote3DProps {
  especie: Arquetipo | null;
  /** 1 a 8 — muda o tamanho do boneco e libera o capelo. */
  nivel: number;
  expressao: Expressao;
  estado: EstadoAnimacao;
  /** Aceita carinho e arrasto. Desligue em retratos pequenos e estáticos. */
  interativo?: boolean;
  /** Chamado a cada carinho, com a fala que o bicho soltou. */
  onCarinho?: (fala: string) => void;
  /** Para a fala de carinho combinar com o humor. */
  humorParaFala?: Humor;
  /**
   * Preenchido com os comandos do boneco.
   *
   * O ângulo mora num ref para não renderizar a cada frame, então um botão de
   * fora não teria como mexer nele por prop sem desfazer justamente isso.
   */
  controle?: React.RefObject<MascoteControle | null>;
  className?: string;
}

/** Ritmo das animações de repouso por estado. */
const RITMO: Record<EstadoAnimacao, { corpo: string; cabeca: string; cauda: string }> = {
  idle_bounce:     { corpo: 'mascote-respira 3s',   cabeca: 'mascote-cabeca 3s',    cauda: 'mascote-cauda 1.9s' },
  happy_jump:      { corpo: 'mascote-pulo 1.15s',   cabeca: 'mascote-cabeca 1.15s', cauda: 'mascote-cauda 0.5s' },
  ar_capture_ring: { corpo: 'mascote-respira 2.2s', cabeca: 'mascote-espia 3.4s',   cauda: 'mascote-cauda 1.2s' },
  power_up:        { corpo: 'mascote-power 1.1s',   cabeca: 'mascote-cabeca 1.1s',  cauda: 'mascote-cauda 0.6s' },
  carinho:         { corpo: 'mascote-respira 1.6s', cabeca: 'mascote-carinho 1.6s', cauda: 'mascote-cauda 0.4s' },
  soneca:          { corpo: 'mascote-soneca 4.4s',  cabeca: 'mascote-soneca 4.4s',  cauda: 'mascote-cauda 4.4s' },
};

const CAMADAS_DA_CABECA: Camada[] = ['orelhas', 'cabeca', 'focinho', 'olhos'];
const FACES: Vista[] = ['frente', 'costas'];

interface Coracao { id: number; emoji: string; x: number }

export function Mascote3D({
  especie, nivel, expressao, estado,
  interativo = true, onCarinho, humorParaFala = 'feliz', controle, className = '',
}: Mascote3DProps) {
  const def = arquetipo(especie);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const palcoRef = useRef<HTMLDivElement>(null);
  const camadasRef = useRef<Map<Camada, HTMLDivElement>>(new Map());
  const frenteRef = useRef<HTMLDivElement>(null);
  const costasRef = useRef<HTMLDivElement>(null);

  const theta = useRef(0);
  const velocidade = useRef(0);
  const arrastando = useRef(false);
  const ultimoX = useRef(0);
  const percorrido = useRef(0);
  const giroAte = useRef<number | null>(null);

  // O bicho cresce de verdade a cada nível: 1.0 no filhote, ~1.35 no imortal.
  // Vive num ref porque quem aplica a escala é o laço de animação, não o render.
  const escala = useRef(1);
  escala.current = def.escala * (1 + (Math.max(1, nivel) - 1) * 0.05);

  const [carinho, setCarinho] = useState(false);
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

  // ── O laço que escreve a rotação no DOM ──────────────────────────────────
  useEffect(() => {
    let raf = 0;

    function pintar() {
      const rad = (theta.current * Math.PI) / 180;
      const sen = Math.sin(rad);
      const cos = Math.cos(rad);
      const s = escala.current;

      // O corpo é mais estreito de perfil do que de frente — sem esta
      // compressão o bicho gira parecendo uma placa.
      if (palcoRef.current) {
        const largura = (0.74 + 0.26 * Math.abs(cos)) * s;
        palcoRef.current.style.transform = `scale(${largura.toFixed(4)}, ${s.toFixed(4)})`;
      }

      camadasRef.current.forEach((el, camada) => {
        const z = PROFUNDIDADE[camada];
        // `z · sen(θ)` em unidades do viewBox (200 de largura); como a camada
        // ocupa a caixa inteira, dividir por 2 converte para % da própria
        // largura.
        const dx = (z * sen) / 2;
        const perto = 1 + (z * cos) / 900;
        el.style.transform = `translateX(${dx.toFixed(3)}%) scale(${perto.toFixed(4)})`;
      });

      // Cross-fade estreito em volta de 90°: sem ele a troca frente/costas
      // aparece como um piscar.
      const opFrente = Math.min(1, Math.max(0, (cos + 0.12) / 0.24));
      if (frenteRef.current) frenteRef.current.style.opacity = String(opFrente);
      if (costasRef.current) costasRef.current.style.opacity = String(1 - opFrente);
    }

    function quadro() {
      // Giro programado (o botão "Girar 360°") tem prioridade sobre a inércia.
      if (giroAte.current != null) {
        const falta = giroAte.current - theta.current;
        if (Math.abs(falta) < 0.6) {
          theta.current = giroAte.current;
          giroAte.current = null;
          velocidade.current = 0;
        } else {
          theta.current += falta * 0.12;
        }
      } else if (!arrastando.current && velocidade.current !== 0) {
        theta.current += velocidade.current;
        velocidade.current *= 0.92;
        if (Math.abs(velocidade.current) < 0.03) velocidade.current = 0;
      }
      pintar();
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

  /** Uma volta inteira a partir de onde o bicho está agora. */
  const girar360 = useCallback(() => {
    velocidade.current = 0;
    giroAte.current = theta.current + 360;
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
    velocidade.current = 0;
    giroAte.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!interativo || !arrastando.current) return;
    const d = e.clientX - ultimoX.current;
    ultimoX.current = e.clientX;
    percorrido.current += Math.abs(d);
    const graus = d * GRAUS_POR_PX;
    theta.current += graus;
    velocidade.current = Math.max(-INERCIA_MAX, Math.min(INERCIA_MAX, graus));
  }

  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    if (!interativo || !arrastando.current) return;
    arrastando.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // Mal saiu do lugar: era carinho, não giro.
    if (percorrido.current < LIMIAR_ARRASTO) {
      velocidade.current = 0;
      fazerCarinho();
    } else if (semMovimento) {
      velocidade.current = 0;
    }
  }

  // ── Montagem das camadas ─────────────────────────────────────────────────
  const estadoEfetivo: EstadoAnimacao = carinho ? 'carinho' : estado;
  const expressaoEfetiva: Expressao = carinho ? 'amado' : expressao;
  const ritmo = RITMO[estadoEfetivo] ?? RITMO.idle_bounce;

  function peca(camada: Camada, vista: Vista) {
    const comum = { p: def.paleta, uid: `${uid}-${vista}` };
    switch (camada) {
      case 'cauda':     return <Cauda {...comum} variante={def.cauda} vista={vista} />;
      case 'asas':      return def.asas ? <Asas {...comum} /> : null;
      case 'orelhas':   return <Orelhas {...comum} variante={def.orelha} vista={vista} />;
      case 'corpo':     return <Corpo {...comum} vista={vista} />;
      case 'cabeca':    return <Cabeca {...comum} vista={vista} />;
      case 'acessorio': return <Acessorio {...comum} vista={vista} />;
      case 'chapeu':    return <Chapeu nivel={nivel} />;
      case 'focinho':   return vista === 'frente' ? <Focinho {...comum} variante={def.focinho} expressao={expressaoEfetiva} /> : null;
      case 'olhos':     return vista === 'frente' ? <Olhos {...comum} expressao={expressaoEfetiva} /> : null;
      case 'efeito':    return <Efeito {...comum} variante={def.efeito} />;
      default:          return null;
    }
  }

  function animacaoDa(camada: Camada): string | undefined {
    if (semMovimento) return undefined;
    if (camada === 'cauda') return `${ritmo.cauda} ease-in-out infinite`;
    if (camada === 'asas') return 'mascote-asa 0.7s ease-in-out infinite';
    if (CAMADAS_DA_CABECA.includes(camada)) return `${ritmo.cabeca} ease-in-out infinite`;
    return undefined;
  }

  return (
    <div className={`relative select-none ${className}`}>
      <div
        className={`relative w-full aspect-square ${interativo ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ touchAction: interativo ? 'pan-y' : undefined }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        {/* Palco: escala do nível e compressão horizontal do giro. */}
        <div
          ref={palcoRef}
          className="absolute inset-0"
          // Origem nas patas (y=180 de 200): crescendo de nível o bicho sobe,
          // não afunda. Com a origem no meio, o nível 8 empurrava os pés para
          // fora da moldura da arena.
          style={{ transformOrigin: '50% 90%', willChange: 'transform' }}
        >
          {/* Rig: a animação do corpo inteiro (pulo, respiração, soneca). */}
          <div
            className="absolute inset-0"
            style={{
              transformOrigin: '50% 88%',
              animation: semMovimento ? undefined : `${ritmo.corpo} ease-in-out infinite`,
            }}
          >
            {FACES.map(vista => (
              <div
                key={vista}
                ref={vista === 'frente' ? frenteRef : costasRef}
                className="absolute inset-0"
                style={{ opacity: vista === 'frente' ? 1 : 0 }}
              >
                {CAMADAS.map(camada => (
                  <div
                    key={camada}
                    ref={el => {
                      // Só a face da frente comanda o transform: as duas faces
                      // ocupam a mesma posição, e registrar as duas faria a
                      // segunda sobrescrever a primeira no mesmo Map.
                      if (vista !== 'frente') return;
                      if (el) camadasRef.current.set(camada, el);
                      else camadasRef.current.delete(camada);
                    }}
                    className="absolute inset-0"
                    style={{ willChange: 'transform' }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{ animation: animacaoDa(camada), transformOrigin: '50% 70%' }}
                    >
                      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible" aria-hidden>
                        {/* Visto por trás, esquerda e direita trocam. */}
                        <g transform={vista === 'costas' ? 'translate(200 0) scale(-1 1)' : undefined}>
                          {peca(camada, vista)}
                        </g>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Sombra no chão: acompanha o pulo, e é o que assenta o bicho no
            cenário em vez de deixá-lo flutuando. */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-black/25 blur-[3px] pointer-events-none"
          style={{
            bottom: '7%', width: '42%', height: '6%',
            animation: semMovimento
              ? undefined
              : `mascote-sombra ${estadoEfetivo === 'happy_jump' ? '1.15s' : '3s'} ease-in-out infinite`,
          }}
        />

        {/* Corações do carinho. */}
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
