'use client';

import { useEffect, useState } from 'react';

/**
 * Botões flutuantes que saem da frente enquanto a pessoa rola a tela.
 *
 * Rolando para baixo OU para cima, os botões descem e somem por inteiro.
 * Quando a rolagem para (o dedo solta e a inércia acaba), eles voltam.
 * No topo da página ficam sempre visíveis.
 *
 * O dashboard rola dentro do <main>, não na janela: o listener é em captura,
 * no documento, e lê o scrollTop de quem rolou.
 */
const DELTA = 6;        // ignora tremidas do dedo
const SHOW_AFTER = 650; // ms parado até os botões voltarem

export function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    let raf = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;

    const onScroll = (e: Event) => {
      const el = (e.target === document ? document.scrollingElement : e.target) as HTMLElement | null;
      if (!el || typeof el.scrollTop !== 'number') return;
      // Só a rolagem da página conta; carrossel horizontal e listas internas não.
      if (el.scrollHeight - el.clientHeight < 200) return;

      // A cada evento de rolagem, adia a volta: só reaparece quando parar.
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => setHidden(false), SHOW_AFTER);

      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = el.scrollTop;
        const prev = last.get(el) ?? y;
        const atTop = y < 80;
        if (atTop) setHidden(false);
        else if (Math.abs(y - prev) > DELTA) setHidden(true);
        last.set(el, y);
      });
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      if (raf) cancelAnimationFrame(raf);
      if (idle) clearTimeout(idle);
    };
  }, []);

  return hidden;
}
