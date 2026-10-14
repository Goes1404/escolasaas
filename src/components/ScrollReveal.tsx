'use client';

import { useEffect } from 'react';

/**
 * Entrada suave das seções conforme chegam à tela.
 *
 * Só marca os blocos de primeiro nível da página (filhos diretos da raiz da
 * rota) que estão ABAIXO da dobra — o que já aparece ao abrir a tela nunca
 * pisca nem some. Quem já tem `anim-*` (entrada própria) fica de fora, e,
 * terminada a transição, o atributo sai: o bloco volta a ser exatamente o que
 * era, sem `transform` preso que atrapalhe hover ou `sticky` dentro dele.
 */
export function ScrollReveal({ routeKey, root }: { routeKey: string; root: () => HTMLElement | null }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let io: IntersectionObserver | null = null;
    const cleanups: Array<() => void> = [];

    // Espera a página montar o conteúdo (muitas carregam dados primeiro).
    const timer = setTimeout(() => {
      const main = root();
      if (!main) return;
      const page = main.querySelector<HTMLElement>('.route-enter > *');
      if (!page) return;

      const vh = main.clientHeight || window.innerHeight;
      const blocks = Array.from(page.children).filter((el): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false;
        if (/\banim-/.test(el.className)) return false;
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.top > vh * 0.92;
      });
      if (!blocks.length) return;

      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          io?.unobserve(el);
          el.dataset.reveal = 'in';
          // A cascata dos cards de dentro dura mais que o bloco: só limpa o
          // atributo quando todos terminaram (12 × 45ms + 600ms, com folga).
          const t = setTimeout(() => { delete el.dataset.reveal; }, 1400);
          cleanups.push(() => clearTimeout(t));
        }
      }, { root: main, rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

      for (const el of blocks) {
        el.dataset.reveal = 'pending';
        // Cards de uma grade entram em cascata, um depois do outro.
        el.querySelectorAll<HTMLElement>(':scope .grid').forEach((grid, gi) => {
          if (gi > 1) return;
          Array.from(grid.children).slice(0, 12).forEach((c, i) => {
            (c as HTMLElement).style.setProperty('--ri', String(i));
          });
        });
        io.observe(el);
      }
      cleanups.push(() => blocks.forEach((el) => { delete el.dataset.reveal; }));
    }, 450);

    return () => {
      clearTimeout(timer);
      io?.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, [routeKey, root]);

  return null;
}
