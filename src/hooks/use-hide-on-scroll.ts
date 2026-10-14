'use client';

import { useEffect, useState } from 'react';

/**
 * Botões flutuantes que saem da frente quando a pessoa está lendo.
 *
 * Rolando para baixo (lendo), os botões descem e somem por inteiro — nada de
 * botão cortado na borda. Rolando para cima, parando no topo ou chegando ao
 * fim da página, eles voltam. É o mesmo padrão dos apps nativos.
 *
 * O dashboard rola dentro do <main>, não na janela: o listener é em captura,
 * no documento, e lê o scrollTop de quem rolou.
 */
const DELTA = 6; // ignora tremidas do dedo

export function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    let raf = 0;

    const onScroll = (e: Event) => {
      const el = (e.target === document ? document.scrollingElement : e.target) as HTMLElement | null;
      if (!el || typeof el.scrollTop !== 'number') return;
      // Só a rolagem da página conta; carrossel horizontal e listas internas não.
      if (el.scrollHeight - el.clientHeight < 200) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = el.scrollTop;
        const prev = last.get(el) ?? 0;
        const atTop = y < 80;
        const atEnd = el.scrollHeight - el.clientHeight - y < 40;
        if (atTop || atEnd) setHidden(false);
        else if (y - prev > DELTA) setHidden(true);
        else if (prev - y > DELTA) setHidden(false);
        last.set(el, y);
      });
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return hidden;
}
