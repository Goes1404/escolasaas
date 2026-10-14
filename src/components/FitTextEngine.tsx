'use client';

import { useEffect } from 'react';

/**
 * Rede de segurança de tipografia para o celular.
 *
 * Em 360px, a Boldonse (u-display / u-page-title / u-num) e os rótulos em
 * caixa alta com tracking largo não cabem nas colunas estreitas. O navegador
 * então fazia uma de duas coisas feias: quebrava a palavra no meio
 * ("PERFORMANC/E", "ENVIO/S", "26/04" num número) ou empurrava o texto para
 * fora do card.
 *
 * Regra nova: texto curto (título, número, rótulo, botão) nunca é partido no
 * meio — se não cabe, este motor reduz a fonte só daquele elemento, só o
 * necessário. Texto longo (parágrafo) continua quebrando linha normalmente.
 * Em tela larga, onde tudo já cabe, nada muda.
 *
 * - Fora: `[data-nofit]` (e o que estiver dentro), o letreiro `.animate-marquee`,
 *   `truncate` (reticências já resolvem) e texto de leitor de tela.
 * - Só escreve `style.fontSize` e `data-fit-*`; o MutationObserver não observa
 *   atributos, então o ajuste não se realimenta.
 * - Lê tudo, depois escreve tudo: uma única recomputação de layout por passada.
 */
const DISPLAY = '.u-page-title, .u-display, .u-num, .font-display, .tabular-nums, [data-fit]';
const TEXTUAL = 'h1, h2, h3, h4, h5, h6, p, span, a, label, button, strong, b, small, li, dt, dd, div, td, th';
const MAX_SHORT_CHARS = 40;
const MIN_RATIO = 0.5;
const MIN_PX = 9;

function isShortText(el: HTMLElement) {
  const t = (el.textContent || '').trim();
  if (!t || t.length > MAX_SHORT_CHARS) return false;
  return t.split(/\s+/).length <= 5;
}

function skip(el: HTMLElement, cs: CSSStyleDeclaration) {
  if (cs.display === 'inline' || cs.display === 'none' || cs.display === 'contents') return true;
  if (cs.textOverflow === 'ellipsis') return true;
  if (el.clientWidth < 4) return true; // sr-only e afins
  return !!el.closest('[data-nofit], .animate-marquee, .sr-only, [contenteditable="true"]');
}

function isScrollableX(el: Element) {
  const ox = getComputedStyle(el).overflowX;
  return ox === 'auto' || ox === 'scroll';
}

/** Quanto o elemento passa da largura que tem (ou da área útil do card). */
function excessOf(el: HTMLElement, vw: number): number {
  let excess = el.scrollWidth - el.clientWidth;
  // Número em flex/grid sem `min-w-0` não estoura a si mesmo: alarga o pai e
  // é o card acima que passa da borda. Mede quanto o PRÓPRIO elemento sai da
  // área de conteúdo de cada ancestral — vizinho largo não faz encolher quem
  // não tem culpa. Para em carrossel (rolagem lateral é intencional).
  const r = el.getBoundingClientRect();
  let p = el.parentElement;
  for (let i = 0; i < 5 && p && p.tagName !== 'MAIN' && p !== document.body; i++) {
    if (isScrollableX(p)) return excess;
    const pr = p.getBoundingClientRect();
    const ps = getComputedStyle(p);
    const right = pr.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth);
    const left = pr.left + parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth);
    const out = Math.max(0, r.right - right) + Math.max(0, left - r.left);
    if (out > excess) excess = out;
    p = p.parentElement;
  }
  const offscreen = Math.max(0, r.right - vw) + Math.max(0, -r.left);
  return Math.max(excess, offscreen);
}

function candidates(): HTMLElement[] {
  const set = new Set<HTMLElement>();
  // Só o conteúdo da página. Menu lateral, gavetas, diálogos e a barra
  // inferior ficam de fora: eles entram deslizando (fora da tela por um
  // instante) e o motor os encolhia por engano.
  const root = document.querySelector<HTMLElement>('main main') || document.querySelector<HTMLElement>('main') || document.body;
  const outside = (el: HTMLElement) => !!el.closest('[data-sidebar], [role="dialog"], [data-radix-popper-content-wrapper], nav, header, [data-floating]');
  root.querySelectorAll<HTMLElement>(DISPLAY).forEach((el) => { if (!outside(el)) set.add(el); });
  root.querySelectorAll<HTMLElement>(TEXTUAL).forEach((el) => {
    if (outside(el)) return;
    // Só quem segura o texto diretamente (um nó de texto filho), curto —
    // ex.: título com ícone ao lado. Invólucros sem texto próprio ficam fora,
    // senão a fonte encolheria em cascata pelo card inteiro.
    if (el.children.length > 3 || !isShortText(el)) return;
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim()) { set.add(el); return; }
    }
  });
  // Ordem do documento: pai antes do filho.
  return [...set].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

function fitAll(reset = true) {
  const els = candidates();

  // 1) Escrita: volta ao tamanho da classe e proíbe quebra no meio da palavra.
  for (const el of els) {
    if (!reset) break;
    if (el.dataset.fitPx) {
      el.style.fontSize = '';
      delete el.dataset.fitPx;
    }
    if (!el.hasAttribute('data-fit-short')) el.setAttribute('data-fit-short', '');
  }

  // 2) Leitura: quem passou da largura, e quanto.
  const vw = document.documentElement.clientWidth;
  const plan: [HTMLElement, number][] = [];
  for (const el of els) {
    const cs = getComputedStyle(el);
    if (skip(el, cs)) continue;
    const width = el.scrollWidth;
    if (!width) continue;
    const excess = excessOf(el, vw);
    if (excess <= 1) continue;
    const base = parseFloat(cs.fontSize);
    const ratio = Math.max(MIN_RATIO, (width - excess) / width) * 0.96;
    plan.push([el, Math.max(MIN_PX, base * ratio)]);
  }

  // 2b) Leitura: título em Boldonse que quebrou em duas linhas ou mais com
  // entrelinha apertada (abaixo de ~1.4 o acento da Boldonse encosta na linha de cima) — o til e a cedilha de uma linha
  // batiam na de baixo ("LAB DE / REDAÇÃO"). Em uma linha só fica como está.
  const loosen: HTMLElement[] = [];
  if (reset) {
    document.querySelectorAll<HTMLElement>('.u-page-title, .u-display, .font-display').forEach((el) => {
      if (el.dataset.fitLh) { el.style.lineHeight = ''; delete el.dataset.fitLh; }
    });
    document.querySelectorAll<HTMLElement>('.u-page-title, .u-display, .font-display').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.display === 'none') return;
      const fs = parseFloat(cs.fontSize);
      const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
      if (!fs || lh / fs >= 1.4) return;
      if (el.getBoundingClientRect().height > lh * 1.6) loosen.push(el);
    });
  }

  // 3) Escrita: aplica. Cada um recebe o próprio tamanho em px, então um
  // filho não encolhe duas vezes junto com o pai.
  for (const [el, px] of plan) {
    el.style.fontSize = `${px}px`;
    el.dataset.fitPx = String(px);
  }
  for (const el of loosen) {
    el.style.lineHeight = '1.42';
    el.dataset.fitLh = '1';
  }
}

export function FitTextEngine() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      fitAll(true);
      // Passada de refino, sem desfazer a anterior: pega arredondamento de
      // letter-spacing em em e quem só estourou depois do vizinho encolher.
      requestAnimationFrame(() => fitAll(false));
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      // Espera a tela parar (contadores animados mudam o texto a cada frame).
      timer = setTimeout(() => requestAnimationFrame(run), 140);
    };

    schedule();
    document.fonts?.ready.then(schedule).catch(() => {});
    // A Boldonse chega depois do primeiro paint (font-display: swap): mede de
    // novo quando qualquer fonte termina de carregar.
    document.fonts?.addEventListener?.('loadingdone', schedule);

    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });

    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return; // barra do navegador do celular não conta
      lastW = window.innerWidth;
      schedule();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', schedule);

    return () => {
      if (timer) clearTimeout(timer);
      mo.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', schedule);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);

  return null;
}
