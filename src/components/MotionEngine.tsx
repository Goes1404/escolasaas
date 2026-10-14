'use client';

import { useEffect } from 'react';

/**
 * Acabamento de movimento e mídia, para a plataforma inteira, sem tocar tela
 * por tela:
 *
 * 1. Imagens: entram com um fade curto quando terminam de carregar (em vez de
 *    "pintar" aos pedaços), e uma imagem com link quebrado some — fica o fundo
 *    do card (`.media-placeholder` / cor do contêiner), nunca o ícone de
 *    imagem quebrada com o texto alternativo por cima do layout.
 * 2. Números em `u-num` contam até o valor quando entram na tela (uma vez por
 *    elemento). Se o React trocar o texto no meio da contagem, a contagem
 *    para na hora e o valor do React vale.
 *
 * Tudo é passivo e barato: um MutationObserver só de nós adicionados, um
 * IntersectionObserver, e escrita só de `opacity` (camada composta) e texto.
 */
const NUM_RE = /^(\D{0,3}?)(\d{1,3}(?:\.\d{3})+|\d{1,7})(%|º|°|\s?pts|\s?xp|\s?XP|\s?min|h|d)?$/;
const COUNT_MS = 900;

function prefersReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function prepareImage(img: HTMLImageElement) {
  if (img.dataset.media) return;
  img.dataset.media = '1';
  if (!img.getAttribute('decoding')) img.decoding = 'async';
  if (img.complete) {
    if (img.naturalWidth === 0 && img.getAttribute('src')) img.dataset.broken = '';
    return; // já carregada (cache): aparece direto, sem piscar
  }
  img.dataset.fade = 'pending';
  const done = () => { img.dataset.fade = 'in'; };
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', () => { img.dataset.broken = ''; img.dataset.fade = 'in'; }, { once: true });
}

function prepareVideo(v: HTMLVideoElement) {
  if (v.dataset.media) return;
  v.dataset.media = '1';
  // Baixa só o necessário para mostrar a capa; o vídeo vem ao dar play.
  if (!v.getAttribute('preload') && !v.autoplay) v.preload = 'metadata';
  v.playsInline = true; // iOS: toca na página, sem forçar tela cheia
}

function prepareIframe(f: HTMLIFrameElement) {
  if (f.dataset.media) return;
  f.dataset.media = '1';
  if (!f.getAttribute('loading')) f.setAttribute('loading', 'lazy');
}

function countUp(el: HTMLElement) {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  if (el.children.length) return;
  const text = (el.textContent || '').trim();
  const m = text.match(NUM_RE);
  if (!m) return;
  const grouped = m[2].includes('.');
  const target = parseInt(m[2].replace(/\./g, ''), 10);
  if (!Number.isFinite(target) || target < 2) return;
  const fmt = (n: number) => (grouped ? n.toLocaleString('pt-BR') : String(n));
  const prefix = m[1] || '';
  const suffix = m[3] || '';
  // Reserva a largura final: o número crescendo não empurra o layout.
  const w = el.getBoundingClientRect().width;
  if (w) el.style.minWidth = `${Math.ceil(w)}px`;
  let last = `${prefix}${fmt(0)}${suffix}`;
  el.textContent = last;
  const start = performance.now();
  const step = (t: number) => {
    if (el.textContent !== last) { el.style.minWidth = ''; return; } // React assumiu
    const p = Math.min(1, (t - start) / COUNT_MS);
    const eased = 1 - Math.pow(1 - p, 3);
    last = `${prefix}${fmt(Math.round(target * eased))}${suffix}`;
    el.textContent = last;
    if (p < 1) requestAnimationFrame(step);
    else el.style.minWidth = '';
  };
  requestAnimationFrame(step);
}

export function MotionEngine() {
  useEffect(() => {
    const reduced = prefersReduced();

    const io = reduced || !('IntersectionObserver' in window)
      ? null
      : new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io?.unobserve(e.target);
            countUp(e.target as HTMLElement);
          }
        }, { threshold: 0.6 });

    const scan = (root: ParentNode) => {
      root.querySelectorAll<HTMLImageElement>('img').forEach(prepareImage);
      root.querySelectorAll<HTMLVideoElement>('video').forEach(prepareVideo);
      root.querySelectorAll<HTMLIFrameElement>('iframe').forEach(prepareIframe);
      if (io) {
        root.querySelectorAll<HTMLElement>('main .u-num:not([data-counted])').forEach((el) => {
          if (el.closest('.animate-marquee, [data-nocount]')) return;
          io.observe(el);
        });
      }
    };

    scan(document);

    let pending: Node[] = [];
    let raf = 0;
    const flush = () => {
      raf = 0;
      const nodes = pending; pending = [];
      for (const n of nodes) {
        if (!(n instanceof Element) || !n.isConnected) continue;
        if (n instanceof HTMLImageElement) prepareImage(n);
        else if (n instanceof HTMLVideoElement) prepareVideo(n);
        else if (n instanceof HTMLIFrameElement) prepareIframe(n);
        else scan(n);
      }
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => pending.push(n));
      if (pending.length && !raf) raf = requestAnimationFrame(flush);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Erro de imagem que chegou antes do listener (captura no documento).
    const onError = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLImageElement) { t.dataset.broken = ''; t.dataset.fade = 'in'; }
    };
    document.addEventListener('error', onError, true);

    return () => {
      mo.disconnect();
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('error', onError, true);
    };
  }, []);

  return null;
}
