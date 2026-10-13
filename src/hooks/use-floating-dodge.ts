'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Botão flutuante "maleável": sai da frente do conteúdo em vez de cobri-lo.
 *
 * - Enquanto a pessoa rola a tela, o botão recolhe para a borda (meio fora da
 *   tela, translúcido) — rolando é quando ele mais passa por cima de cards.
 * - Quando a rolagem para, ele só volta inteiro se não houver nada clicável ou
 *   texto embaixo dele. Se houver, continua recolhido como uma "aba" na borda.
 * - Tocar na aba recolhida primeiro traz o botão de volta (sem acionar a ação);
 *   o segundo toque já é o clique normal. Depois de alguns segundos sem uso, a
 *   regra de sobreposição volta a valer.
 *
 * Uso: `const { ref, tucked, onPointerDownCapture, onClickCapture } = useFloatingDodge<HTMLDivElement>()`
 * e ligar as classes de recolhido em `tucked`.
 */
/** Classe do estado recolhido — definida em globals.css, fora de @layer
 *  (hooks/ fica fora do content do Tailwind). */
export const TUCKED_CLASSES = 'floating-tucked';

const CONTENT_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [role="tab"], h1, h2, h3, h4, p, img, svg, video, table';

export function useFloatingDodge<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [tucked, setTucked] = useState(false);
  const pinnedUntil = useRef(0); // depois de um toque, fica aberto um tempo
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swallowNextClick = useRef(false);

  const overlapsContent = useCallback(() => {
    const el = ref.current;
    if (!el) return false;
    // Mede na posição de repouso (sem o recolhimento), senão o botão
    // recolhido "não vê" o que cobriria e ficaria abrindo e fechando.
    const wasTucked = el.classList.contains(TUCKED_CLASSES);
    if (wasTucked) el.classList.remove(TUCKED_CLASSES);
    const prevTransition = el.style.transition;
    el.style.transition = 'none';
    const r = el.getBoundingClientRect();
    if (wasTucked) el.classList.add(TUCKED_CLASSES);
    el.style.transition = prevTransition;
    if (!r.width) return false;
    // Amostra o centro e os quatro cantos internos do botão.
    const pts: [number, number][] = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 6, r.top + 6],
      [r.right - 6, r.top + 6],
      [r.left + 6, r.bottom - 6],
      [r.right - 6, r.bottom - 6],
    ];
    for (const [x, y] of pts) {
      for (const under of document.elementsFromPoint(x, y)) {
        if (el.contains(under)) continue;
        // Outras camadas fixas (barra inferior, outro botão flutuante) não contam.
        if ((under as HTMLElement).closest?.('[data-floating], nav')) break;
        const main = (under as HTMLElement).closest?.('main');
        if (!main || under === main) break;
        if ((under as HTMLElement).closest(CONTENT_SELECTOR)) return true;
        // Um card (superfície menor que a coluna) também é conteúdo; só o
        // fundo vazio da página — da largura do <main> — deixa o botão aberto.
        const mw = main.getBoundingClientRect().width;
        if (under.getBoundingClientRect().width < mw - 40) return true;
        break; // só a camada imediatamente abaixo importa
      }
    }
    return false;
  }, []);

  const settle = useCallback(() => {
    if (Date.now() < pinnedUntil.current) {
      setTucked(false);
      return;
    }
    setTucked(overlapsContent());
  }, [overlapsContent]);

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < pinnedUntil.current) return;
      setTucked(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(settle, 700);
    };
    // O dashboard rola dentro do <main>, não na janela: escuta em captura.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', settle);
    const first = setTimeout(settle, 1200);
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', settle);
      clearTimeout(first);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [settle]);

  /** Primeiro toque num botão recolhido só o traz de volta. */
  const onPointerDownCapture = useCallback(() => {
    if (tucked) swallowNextClick.current = true;
    pinnedUntil.current = Date.now() + 5000;
    setTucked(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(settle, 5100);
  }, [tucked, settle]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (swallowNextClick.current) {
      swallowNextClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return { ref, tucked, onPointerDownCapture, onClickCapture };
}

