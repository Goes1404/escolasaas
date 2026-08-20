"use client";

import { useEffect, useRef } from "react";

/**
 * FlameEmberCanvas
 * 
 * Componente de partículas de alto desempenho que renderiza um efeito
 * de fogo/brasas subindo a partir da base do container.
 * Utiliza cores quentes (vermelho, laranja, amarelo) e reduz o raio
 * das partículas à medida que sobem, imitando a dissipação de chamas reais.
 */

type FireParticle = {
  x: number;
  y: number;
  r: number;
  initialR: number;
  vy: number;
  vx: number;
  alpha: number;
  hue: number;
  decay: number;
};

export function FlameEmberCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let particles: FireParticle[] = [];
    let raf = 0;
    let running = !reduceMotion;

    const spawn = (randomY = false): FireParticle => {
      const initialR = 1.2 + Math.random() * 2.2;
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : height + 10,
        r: initialR,
        initialR,
        vy: 0.4 + Math.random() * 0.9, // Mais rápidas que o EmberCanvas
        vx: (Math.random() - 0.5) * 0.4,
        alpha: 0.5 + Math.random() * 0.5,
        hue: Math.random() < 0.3 ? 0 + Math.random() * 12 : 12 + Math.random() * 28, // 0-12 (Vermelho), 12-40 (Laranja/Amarelo)
        decay: 0.008 + Math.random() * 0.012, // Desaparecimento conforme sobem
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

      // Quantidade de chamas proporcional à largura
      const targetCount = Math.min(50, Math.round(width / 6));
      particles = Array.from({ length: targetCount }, () => spawn(true));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        
        // Intensifica o brilho quanto mais perto da base e do centro
        const brightness = p.hue > 20 ? 65 : 55;
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${brightness}%, ${p.alpha})`;
        
        // Brilho de neon
        ctx.shadowColor = `hsla(${p.hue}, 100%, 55%, 0.85)`;
        ctx.shadowBlur = p.r * 5;
        
        ctx.fill();
      }
      ctx.shadowBlur = 0; // Reseta para performance
    };

    const tick = () => {
      if (!running) return;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.vy;
        p.x += p.vx;
        
        // Encolhe a partícula conforme ela sobe para imitar a ponta da chama
        const progress = Math.max(0, p.y / height);
        p.r = p.initialR * progress;
        p.alpha -= p.decay;

        // Se a partícula subir demais, encolher ou ficar transparente, renasce embaixo
        if (p.y < -10 || p.r <= 0.2 || p.alpha <= 0) {
          particles[i] = spawn();
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    resize();
    if (reduceMotion) {
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

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
