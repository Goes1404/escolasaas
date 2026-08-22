/**
 * Celebração compartilhada das telas de "nível alto" (ranking, resultado de
 * simulado, desafio diário, conquistas do bichinho).
 *
 * Extraído de `student/simulados/page.tsx`, onde vivia como função local. Três
 * diferenças em relação ao original:
 *   1. Cores da paleta real do produto (antes eram indigo/verde/âmbar, que não
 *      são cores desta plataforma).
 *   2. Respeita `prefers-reduced-motion` — o original animava sempre.
 *   3. Cria o próprio <canvas> quando a página não declara um, então qualquer
 *      tela chama `celebrate()` sem precisar montar markup.
 */

/** Paleta do produto: ciano (--primary), amarelo (--accent) e rosa do tenant. */
const CONFETTI_COLORS = ['#4CCCED', '#EDE04C', '#ED3474', '#63D8B4', '#FFFFFF'];

const CANVAS_ID = 'confetti-canvas';

interface Particle {
  x: number;
  y: number;
  r: number;
  d: number;
  color: string;
  tilt: number;
  tiltAngleIncremental: number;
  tiltAngle: number;
}

function getCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById(CANVAS_ID);
  if (existing instanceof HTMLCanvasElement) return existing;

  // A tela não declarou um <canvas>: cria um por cima de tudo, sem capturar
  // cliques, e some sozinho quando a animação acaba.
  const canvas = document.createElement('canvas');
  canvas.id = CANVAS_ID;
  canvas.dataset.ephemeral = 'true';
  canvas.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:10000';
  document.body.appendChild(canvas);
  return canvas;
}

/**
 * Dispara o confete. Devolve uma função que cancela a animação — útil para
 * chamar no cleanup de um useEffect e não deixar rAF órfão ao desmontar.
 */
export function celebrate(): () => void {
  const noop = () => {};
  if (typeof window === 'undefined') return noop;

  // Quem pediu menos movimento no sistema não recebe chuva de partículas.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return noop;

  const canvas = getCanvas();
  if (!canvas) return noop;
  const ctx = canvas.getContext('2d');
  if (!ctx) return noop;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Particle[] = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 5 + 3,
    d: Math.random() * canvas.height,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    tilt: Math.random() * 8 - 4,
    tiltAngleIncremental: Math.random() * 0.05 + 0.02,
    tiltAngle: 0,
  }));

  let frameId = 0;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frameId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Só remove o canvas que este módulo criou — nunca o da própria página.
    if (canvas.dataset.ephemeral === 'true') canvas.remove();
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    for (const p of particles) {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2.5;
      p.x += Math.sin(p.tiltAngle);
      p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 12;

      if (p.y < canvas.height) active = true;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    }

    if (active) frameId = requestAnimationFrame(draw);
    else cleanup();
  };

  draw();
  return cleanup;
}

/**
 * Celebra no máximo uma vez por chave, por aba. Evita que a festa se repita a
 * cada refresh de uma tela que celebra ao carregar (ranking, por exemplo).
 */
export function celebrateOnce(key: string): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    if (sessionStorage.getItem(`celebrated:${key}`)) return () => {};
    sessionStorage.setItem(`celebrated:${key}`, '1');
  } catch {
    // Modo privado / storage bloqueado: celebra assim mesmo.
  }
  return celebrate();
}

/** Vibração curta de feedback. Silencioso onde a API não existe (desktop/iOS). */
export function haptic(pattern: number | number[] = 15): void {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Alguns navegadores lançam se a aba não teve interação do usuário.
  }
}
