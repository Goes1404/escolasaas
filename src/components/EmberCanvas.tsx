"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo vivo "brasas" — partículas laranja/âmbar subindo com flicker e bokeh,
 * desenhadas em um único <canvas> (sem vídeo, sem asset externo).
 * - DPR limitado a 2 e densidade proporcional à área (mobile-friendly)
 * - Pausa quando a aba fica oculta
 * - Com prefers-reduced-motion: renderiza um frame estático
 */

type Ember = {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  phase: number;
  alpha: number;
  hue: number;
  bokeh: boolean;
};

export function EmberCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let embers: Ember[] = [];
    let raf = 0;
    let running = !reduceMotion;

    const spawn = (randomY = false): Ember => {
      const bokeh = Math.random() < 0.12;
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : height + 12,
        r: bokeh ? 2.4 + Math.random() * 2.6 : 0.6 + Math.random() * 1.4,
        vy: 0.1 + Math.random() * 0.45,
        drift: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.22 + Math.random() * 0.5,
        hue: 18 + Math.random() * 24,
        bokeh,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(80, Math.round((width * height) / 14000));
      embers = Array.from({ length: target }, () => spawn(true));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const e of embers) {
        const sway = Math.sin(t / 1600 + e.phase) * e.drift * 14;
        const flicker = 0.75 + Math.sin(t / 240 + e.phase * 3) * 0.25;
        ctx.beginPath();
        ctx.arc(e.x + sway, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${e.hue}, 100%, ${e.bokeh ? 64 : 58}%, ${e.alpha * flicker})`;
        ctx.shadowColor = `hsla(${e.hue}, 100%, 55%, 0.9)`;
        ctx.shadowBlur = e.bokeh ? 18 : 7;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const tick = (t: number) => {
      if (!running) return;
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.y -= e.vy;
        if (e.y < -14) embers[i] = spawn();
      }
      draw(t);
      raf = requestAnimationFrame(tick);
    };

    resize();
    if (reduceMotion) draw(0);
    else raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (visible && !running && !reduceMotion) {
        running = true;
        raf = requestAnimationFrame(tick);
      } else if (!visible && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
