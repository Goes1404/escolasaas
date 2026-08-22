"use client";

/**
 * Landing v2 — arcade, mobile-first, na paleta real da plataforma
 * (ciano #4CCCED · amarelo #EDE04C · rosa #ED3474 sobre #09090f).
 *
 * Efeitos: skew por velocidade de scroll, ScrambleText nos labels, formas da
 * paleta em parallax, cursor custom (desktop), botões arcade com sombra dura,
 * marquee duplo cruzado, cards com clip-path no scroll (mobile) e trilho
 * pinado (desktop), bloco rosa de stats com squash-and-stretch, linha de
 * fluxo que acende os passos, CTA em bloco ciano com zoom por scrub e selo
 * circular girando. As "demos em vídeo" continuam sendo timelines GSAP.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { TextPlugin } from "gsap/TextPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { LogoDali } from "@/components/LogoDali";

gsap.registerPlugin(ScrollTrigger, SplitText, TextPlugin, ScrambleTextPlugin, useGSAP);

/* ── Conteúdo ──────────────────────────────────────────────────────────────── */

const BAND_A = ["Simulados ENEM", "Provas ETEC", "Redação com IA", "Flashcards", "Desafio diário", "Aulas ao vivo"];
const BAND_B = ["Ranking semanal", "Mascote 3D", "Mensalidades", "Portal do responsável", "Rematrícula digital", "XP no servidor"];

const MODULES = [
  {
    num: "01",
    tone: "cyan",
    title: "Simulados de verdade",
    body: "Provas ENEM e ETEC no padrão real: 3,5 minutos por questão, navegação por grade, nota TRI e revisão comentada.",
    meta: "Aluno",
  },
  {
    num: "02",
    tone: "pink",
    title: "Redação em minutos",
    body: "Correção nas cinco competências com devolutiva na hora — e o professor refina por cima, sem começar do zero.",
    meta: "Aluno · Professor",
  },
  {
    num: "03",
    tone: "yellow",
    title: "Estudo que vira jogo",
    body: "XP por acerto, ofensiva de dias, ranking com premiação e um mascote que evolui com o estudo — e nunca morre.",
    meta: "Aluno",
  },
  {
    num: "04",
    tone: "cyan",
    title: "Financeiro sem planilha",
    body: "Planos de mensalidade, bolsas, cobrança em um clique, painel de inadimplência e recibo na hora.",
    meta: "Secretaria",
  },
  {
    num: "05",
    tone: "pink",
    title: "Portal do responsável",
    body: "Boletim, frequência, financeiro e comunicados com confirmação de leitura — num link seguro, sem senha.",
    meta: "Família",
  },
  {
    num: "06",
    tone: "yellow",
    title: "Rematrícula digital",
    body: "Contrato com aceite eletrônico auditável e vaga do próximo ano garantida em dois cliques.",
    meta: "Secretaria · Família",
  },
];

const FLOW_STEPS = [
  { num: "01", title: "O aluno estuda", body: "Simulados, flashcards, redação e desafio diário — tudo no celular, até em rede ruim." },
  { num: "02", title: "O estudo vira progresso", body: "Cada acerto rende XP no servidor. A ofensiva cresce, o mascote evolui, o ranking esquenta." },
  { num: "03", title: "A família acompanha", body: "O responsável abre um link e vê frequência, boletim e mensalidades — sem instalar nada." },
  { num: "04", title: "A escola gerencia", body: "Matrícula, documentos, chamada, cobrança e rematrícula no mesmo painel da secretaria." },
];

const STATS = [
  { value: 730, suffix: "+", label: "estudantes na rede" },
  { value: 1600, suffix: "+", label: "contas ativas" },
  { value: 5, suffix: "", label: "perfis de acesso" },
  { value: 24, suffix: "/7", label: "no celular do aluno" },
];

const SCRAMBLE_CHARS = "▮▯#%&@01XZ";

/** Chave própria: a escolha aqui não mexe no tema do dashboard. */
const THEME_KEY = "landing-theme";

/* Ícones do toggle — desenhados à mão, na mesma linguagem de traço grosso */
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1.5v2.6M12 19.9v2.6M22.5 12h-2.6M4.1 12H1.5M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8M19.4 19.4l-1.8-1.8M6.4 6.4L4.6 4.6" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M20.5 14.3A8.8 8.8 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8Z" />
    </svg>
  );
}

/* Selo circular girando (SVG com textPath) */
function Seal({ className, text }: { className?: string; text: string }) {
  const id = useRef(`seal-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <svg viewBox="0 0 120 120" className={`l-seal ${className ?? ""}`} aria-hidden="true">
      <defs>
        <path id={id} d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
      </defs>
      <text fontSize="9" letterSpacing="2" fill="currentColor" fontFamily="'Space Mono', monospace" fontWeight="700">
        <textPath href={`#${id}`}>{text}</textPath>
      </text>
      <circle cx="60" cy="60" r="6" fill="currentColor" />
    </svg>
  );
}

export default function LandingExperience() {
  const root = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loaderDone, setLoaderDone] = useState(false);
  /* O tema real já foi aplicado no <html> pelo script inline de page.tsx
     (antes do paint, para não piscar). Aqui só espelhamos para o ícone. */
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const themeIconRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const current = document.documentElement.getAttribute("data-landing-theme");
    if (current === "light") setTheme("light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const apply = () => {
      document.documentElement.setAttribute("data-landing-theme", next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* modo privado / storage bloqueado: o tema vale só nesta visita */
      }
      setTheme(next);
    };

    if (reduced) {
      apply();
      return;
    }

    /* Cortina varrendo a tela: a troca não é seca, é um "corte" de cena. */
    const wipe = document.getElementById("l-theme-wipe");
    gsap.timeline()
      .set(wipe, { display: "block", yPercent: 100 })
      .to(wipe, { yPercent: 0, duration: 0.32, ease: "power3.in" })
      .add(apply)
      .to(wipe, { yPercent: -100, duration: 0.4, ease: "power3.out" })
      .set(wipe, { display: "none" });

    gsap.fromTo(
      themeIconRef.current,
      { rotate: -90, scale: 0.4, autoAlpha: 0 },
      { rotate: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2)", delay: 0.3 }
    );
  };

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* ── Lenis + ScrollTrigger ─────────────────────────────────────────── */
      let lenis: Lenis | null = null;
      const lenisRaf = (time: number) => lenis?.raf(time * 1000);
      if (!reduced) {
        lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(lenisRaf);
        gsap.ticker.lagSmoothing(0);
      }

      /* ── Skew por velocidade de scroll (assinatura, funciona no touch) ───
         Aplicado POR SEÇÃO (.l-skew) e nunca num wrapper da seção pinada:
         transform em ancestral quebra o position:fixed do pin. */
      if (!reduced) {
        const proxy = { skew: 0 };
        const skewSetter = gsap.quickSetter(".l-skew", "skewY", "deg");
        const clamp = gsap.utils.clamp(-3, 3);
        ScrollTrigger.create({
          onUpdate: (self) => {
            const skew = clamp(self.getVelocity() / -280);
            if (Math.abs(skew) > Math.abs(proxy.skew)) {
              proxy.skew = skew;
              gsap.to(proxy, {
                skew: 0,
                duration: 0.7,
                ease: "power3",
                overwrite: true,
                onUpdate: () => skewSetter(proxy.skew),
              });
            }
          },
        });
      }

      /* ── Preloader: contador + cortina dupla rosa/ciano ────────────────── */
      const counter = { v: 0 };
      const intro = gsap.timeline({ onComplete: () => setLoaderDone(true) });
      if (!reduced) {
        intro
          .to(counter, {
            v: 100,
            duration: 1,
            ease: "power2.inOut",
            onUpdate: () => {
              const el = document.getElementById("l-counter");
              if (el) el.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          })
          .to("#l-preloader", { yPercent: -100, duration: 0.6, ease: "power4.inOut" })
          .to("#l-curtain-a", { yPercent: -100, duration: 0.6, ease: "power4.inOut" }, "-=0.42")
          .to("#l-curtain-b", { yPercent: -100, duration: 0.6, ease: "power4.inOut" }, "-=0.44");
      } else {
        intro.set(["#l-preloader", "#l-curtain-a", "#l-curtain-b"], { display: "none" });
      }

      /* Fontes: nunca segurar o reveal por mais de 1,5s */
      const fontsReady = Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1500)),
      ]);

      /* ── Hero ──────────────────────────────────────────────────────────── */
      fontsReady.then(() => {
        /* "words" junto com "chars": sem isso o navegador quebra linha no meio
           da palavra (os chars viram inline-block soltos). */
        const split = SplitText.create(".l-hero-title", {
          type: "lines,words,chars",
          linesClass: "split-line",
          mask: "lines",
        });
        intro
          .from(
            split.chars,
            {
              yPercent: 120,
              rotation: () => gsap.utils.random(-14, 14),
              duration: 0.9,
              stagger: { each: 0.018, from: "start" },
              ease: "back.out(1.6)",
            },
            reduced ? 0 : "-=0.3"
          )
          .from(
            ".l-hero-fade",
            { y: 26, autoAlpha: 0, duration: 0.6, stagger: 0.07, ease: "power3.out" },
            "-=0.5"
          )
          .from(
            windowRef.current,
            { rotateY: -24, rotateX: 12, y: 70, autoAlpha: 0, duration: 1.1, ease: "power3.out" },
            "-=0.5"
          );

        /* Onda contínua sutil nos caracteres da headline */
        if (!reduced) {
          gsap.to(split.chars, {
            y: -4,
            duration: 1.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: { each: 0.045, yoyo: true, repeat: -1 },
            delay: 3,
          });
        }
      });

      /* ── ScrambleText nos labels ao entrar ─────────────────────────────── */
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>("[data-scramble]").forEach((el) => {
          const original = el.textContent ?? "";
          gsap.to(el, {
            scrambleText: { text: original, chars: SCRAMBLE_CHARS, speed: 0.6 },
            duration: 1.1,
            scrollTrigger: { trigger: el, start: "top 90%" },
          });
        });
      }

      /* ── Formas flutuantes: loop + parallax por scroll ─────────────────── */
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>(".l-shape").forEach((el, i) => {
          gsap.to(el, {
            y: () => gsap.utils.random(-16, 16),
            x: () => gsap.utils.random(-10, 10),
            rotation: () => gsap.utils.random(-30, 30),
            duration: gsap.utils.random(2.2, 3.6),
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: i * 0.2,
          });
          gsap.to(el, {
            yPercent: gsap.utils.random(-120, 120),
            ease: "none",
            scrollTrigger: {
              trigger: el.closest("section") ?? el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.2,
            },
          });
        });
      }

      /* ── Tilt da janela: mouse no desktop, loop automático no mobile ───── */
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        if (!windowRef.current || !sceneRef.current) return;
        const rx = gsap.quickTo(windowRef.current, "rotationX", { duration: 0.6, ease: "power3" });
        const ry = gsap.quickTo(windowRef.current, "rotationY", { duration: 0.6, ease: "power3" });
        const onMove = (e: MouseEvent) => {
          const r = sceneRef.current!.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 16);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
        };
        const onLeave = () => {
          ry(-7);
          rx(4);
        };
        sceneRef.current.addEventListener("mousemove", onMove);
        sceneRef.current.addEventListener("mouseleave", onLeave);
        gsap.set(windowRef.current, { rotationY: -7, rotationX: 4 });
        return () => {
          sceneRef.current?.removeEventListener("mousemove", onMove);
          sceneRef.current?.removeEventListener("mouseleave", onLeave);
        };
      });
      mm.add("(max-width: 899px) and (prefers-reduced-motion: no-preference)", () => {
        if (!windowRef.current) return;
        gsap.to(windowRef.current, {
          rotationY: 7,
          rotationX: -4,
          duration: 3.2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
        gsap.set(windowRef.current, { rotationY: -7, rotationX: 4 });
      });

      /* ── Demo em loop dentro da janela ─────────────────────────────────── */
      if (!reduced) {
        const kpi = { xp: 0, acertos: 0 };
        const demo = gsap.timeline({ repeat: -1, repeatDelay: 1, delay: 2.4 });
        demo
          .to(kpi, {
            xp: 3485,
            acertos: 87,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
              const a = document.getElementById("l-kpi-xp");
              const b = document.getElementById("l-kpi-acertos");
              if (a) a.textContent = Math.round(kpi.xp).toLocaleString("pt-BR");
              if (b) b.textContent = `${Math.round(kpi.acertos)}%`;
            },
          })
          .fromTo(
            "#l-hpfill",
            { scaleX: 0.1 },
            { scaleX: 0.87, duration: 1.2, ease: "power2.out" },
            "<"
          )
          .fromTo(
            ".l-bar",
            { scaleY: 0.1 },
            { scaleY: 1, duration: 0.7, stagger: 0.07, ease: "back.out(1.7)", transformOrigin: "bottom" },
            "-=1"
          )
          .to("#l-typing", {
            text: "Corrigindo sua redação… competência 5 fechada em 180.",
            duration: 2,
            ease: "none",
          })
          .to({}, { duration: 1.3 })
          .to("#l-typing", { text: "", duration: 0.25, ease: "none" })
          .set(kpi, { xp: 0, acertos: 0 });
      }

      /* ── Módulos ───────────────────────────────────────────────────────── */
      /* Desktop: trilho horizontal pinado */
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const track = document.getElementById("l-mod-track");
        if (!track) return;
        gsap.to(track, {
          x: () => -(track.scrollWidth - window.innerWidth),
          ease: "none",
          scrollTrigger: {
            trigger: "#l-modules",
            start: "top top",
            end: () => `+=${track.scrollWidth - window.innerWidth + 240}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        gsap.fromTo(
          "#l-mod-ghost",
          { xPercent: 6 },
          {
            xPercent: -32,
            ease: "none",
            scrollTrigger: {
              trigger: "#l-modules",
              start: "top top",
              end: () => `+=${track.scrollWidth - window.innerWidth + 240}`,
              scrub: 1,
            },
          }
        );
        /* tilt no hover (só desktop) */
        gsap.utils.toArray<HTMLElement>(".l-card").forEach((card) => {
          const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3" });
          const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3" });
          const move = (e: MouseEvent) => {
            const r = card.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 10);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
          };
          const leave = () => {
            rx(0);
            ry(0);
          };
          card.addEventListener("mousemove", move);
          card.addEventListener("mouseleave", leave);
        });
      });
      /* Mobile: cada card entra com clip-path + rotação alternada, por scrub */
      mm.add("(max-width: 899px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>(".l-card").forEach((card, i) => {
          gsap.fromTo(
            card,
            {
              clipPath: "inset(0% 0% 100% 0%)",
              rotation: i % 2 === 0 ? -4 : 4,
              y: 60,
            },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              rotation: 0,
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                start: "top 95%",
                end: "top 55%",
                scrub: 0.6,
              },
            }
          );
        });
      });

      /* ── Reveals genéricos ─────────────────────────────────────────────── */
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 44,
          autoAlpha: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      /* ── Stats: count-up com squash-and-stretch ────────────────────────── */
      gsap.utils.toArray<HTMLElement>(".l-stat-value").forEach((el) => {
        const target = Number(el.dataset.value ?? "0");
        const state = { v: 0 };
        const tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
        tl.to(state, {
          v: target,
          duration: 1.4,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = Math.round(state.v).toLocaleString("pt-BR");
          },
        }).fromTo(
          el.parentElement,
          { scaleX: 1.15, scaleY: 0.85 },
          { scaleX: 1, scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" },
          "-=0.25"
        );
      });

      /* ── Fluxo: linha desenha e cada passo acende ao passar ────────────── */
      gsap.fromTo(
        "#l-thread-line",
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "top",
          ease: "none",
          scrollTrigger: { trigger: "#l-flow-list", start: "top 70%", end: "bottom 55%", scrub: 1 },
        }
      );
      gsap.utils.toArray<HTMLElement>(".l-flow-step").forEach((step) => {
        gsap.fromTo(
          step,
          { opacity: 0.28, x: -14 },
          {
            opacity: 1,
            x: 0,
            ease: "none",
            scrollTrigger: { trigger: step, start: "top 78%", end: "top 55%", scrub: 0.6 },
          }
        );
      });

      /* ── CTA: chars sobem + zoom por scrub ─────────────────────────────── */
      fontsReady.then(() => {
        const ctaSplit = SplitText.create("#l-cta-title", { type: "words,chars" });
        gsap.from(ctaSplit.chars, {
          yPercent: 130,
          autoAlpha: 0,
          rotation: () => gsap.utils.random(-10, 10),
          duration: 0.7,
          stagger: 0.03,
          ease: "back.out(1.8)",
          scrollTrigger: { trigger: "#l-cta-title", start: "top 88%" },
        });
      });
      if (!reduced) {
        gsap.fromTo(
          "#l-cta-block",
          { scale: 0.88 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: "#l-cta-block", start: "top bottom", end: "center 55%", scrub: 1 },
          }
        );
      }

      /* ── Cursor custom (desktop) ───────────────────────────────────────── */
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const dot = document.getElementById("l-cursor-dot");
        const ring = document.getElementById("l-cursor-ring");
        if (!dot || !ring) return;
        const dx = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2" });
        const dy = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2" });
        const rxq = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power2" });
        const ryq = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power2" });
        const move = (e: MouseEvent) => {
          dx(e.clientX);
          dy(e.clientY);
          rxq(e.clientX);
          ryq(e.clientY);
          const hot = (e.target as HTMLElement).closest("a, button");
          ring.classList.toggle("is-hot", !!hot);
        };
        window.addEventListener("mousemove", move);
        return () => window.removeEventListener("mousemove", move);
      });

      return () => {
        gsap.ticker.remove(lenisRaf);
        lenis?.destroy();
      };
    },
    { scope: root }
  );

  /* Botão magnético (desktop; no touch não interfere) */
  const magnetic = (el: HTMLElement | null) => {
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 900px)").matches) return;
    const x = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const y = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
    el.onmousemove = (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.3);
      y((e.clientY - (r.top + r.height / 2)) * 0.3);
    };
    el.onmouseleave = () => {
      x(0);
      y(0);
    };
  };

  const go = (path: string) => router.push(path);

  return (
    <div ref={root} className="landing landing-noise min-h-screen relative">
      {/* Fontes da landing (React 19 sobe os <link> para o <head>) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Boldonse&family=Space+Mono:wght@400;700&display=swap"
      />

      {/* Cursor custom */}
      <div id="l-cursor-dot" className="l-cursor-dot" aria-hidden="true" />
      <div id="l-cursor-ring" className="l-cursor-ring" aria-hidden="true" />

      {/* Cortina da troca de tema */}
      <div
        id="l-theme-wipe"
        aria-hidden="true"
        className="fixed inset-0 z-[110] hidden bg-[var(--yellow)]"
      />

      {/* Preloader + cortinas */}
      {!loaderDone && (
        <>
          <div id="l-curtain-b" className="l-curtain l-curtain-b" aria-hidden="true" />
          <div id="l-curtain-a" className="l-curtain l-curtain-a" aria-hidden="true" />
          <div id="l-preloader" className="l-preloader" aria-hidden="true">
            <span className="l-label !text-[var(--paper)]">
              <LogoDali className="inline-block h-3 w-3 mr-1 align-[-1px] text-[var(--cyan-text)]" /> Dalí carregando fase
            </span>
            <span id="l-counter" className="l-display text-6xl md:text-8xl text-[var(--yellow-text)]">
              000
            </span>
          </div>
        </>
      )}

      <div>
        {/* ── Nav ── */}
        <header className="relative z-20 flex items-center justify-between px-5 md:px-12 py-5">
          <span className="l-label !text-[var(--paper)] !text-[0.72rem]">
            <LogoDali className="inline-block h-4 w-4 mr-1.5 align-[-3px] text-[var(--pink-text)]" />Dalí
          </span>
          <nav className="flex items-center gap-6">
            <a
              href="#l-modules"
              className="l-underline l-label hidden md:inline-block cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("l-modules")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Módulos
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              className="l-theme-btn"
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              <span ref={themeIconRef} className="flex items-center justify-center">
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </span>
            </button>
            <button ref={magnetic} onClick={() => go("/login")} className="l-btn l-btn-cyan !py-2.5 !px-5">
              Entrar
            </button>
          </nav>
        </header>

        {/* ── Hero ── */}
        <section className="l-skew l-dots relative z-10 px-5 md:px-12 pt-8 md:pt-16 pb-20 md:pb-28 max-w-[1500px] mx-auto">
          {/* formas da paleta */}
          <span className="l-shape l-shape-ring w-14 h-14 top-[8%] right-[6%]" />
          <span className="l-shape l-shape-dot w-4 h-4 top-[30%] left-[3%]" />
          <span className="l-shape l-shape-cross w-8 h-8 bottom-[6%] left-[44%] hidden md:block" />
          <span className="l-shape l-shape-dot w-2.5 h-2.5 bottom-[30%] right-[12%] !bg-[var(--yellow)]" />

          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-16 items-center">
            <div className="relative">
              <p className="l-label mb-5 l-hero-fade" data-scramble>
                Plataforma ENEM · ETEC — nível: escola inteira
              </p>
              <h1 className="l-hero-title l-display text-[clamp(2.1rem,8.5vw,5rem)]">
                Estudar virou <span className="text-[var(--yellow-text)]">jogo</span>. Gerir virou{" "}
                <span className="text-[var(--cyan-text)]">simples</span>.
              </h1>

              <div className="flex flex-wrap gap-3 mt-8 l-hero-fade">
                <span className="l-chip">
                  <i className="h-2.5 w-2.5 rounded-full bg-[var(--cyan)]" /> XP <b className="text-[var(--cyan-text)]">+5</b>
                </span>
                <span className="l-chip">
                  <i className="h-2.5 w-2.5 bg-[var(--pink)]" /> Ofensiva <b className="text-[var(--pink-text)]">6d</b>
                </span>
                <span className="l-chip">
                  <i className="h-2.5 w-2.5 rotate-45 bg-[var(--yellow)]" /> Ranking <b className="text-[var(--yellow-text)]">#1</b>
                </span>
              </div>

              <p className="text-sm md:text-base text-[var(--muted)] mt-7 max-w-lg leading-relaxed l-hero-fade">
                Do simulado à mensalidade: alunos, professores, secretaria e famílias
                na mesma plataforma — feita para o celular de quem estuda.
              </p>

              <div className="flex flex-wrap items-center gap-5 mt-9 l-hero-fade">
                <button ref={magnetic} onClick={() => go("/login")} className="l-btn l-btn-pink">
                  Acessar a plataforma
                </button>
                <a
                  href="#l-flow"
                  className="l-underline l-label cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("l-flow")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Como funciona
                </a>
              </div>

              <Seal
                text="INSERT COIN • COMEÇAR AGORA • INSERT COIN • "
                className="hidden md:block absolute -top-6 right-0 w-28 h-28 text-[var(--pink-text)]"
              />
            </div>

            {/* Janela demo 3D */}
            <div ref={sceneRef} className="l-scene relative">
              <span className="l-shape l-shape-ring w-10 h-10 -top-5 -left-4 !border-[var(--yellow)]" />
              <div ref={windowRef} className="l-window">
                <div className="l-window-bar flex items-center justify-between px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 border-2 border-[var(--paper)] bg-[var(--pink)]" />
                    <span className="h-3 w-3 border-2 border-[var(--paper)] bg-[var(--yellow)]" />
                    <span className="h-3 w-3 border-2 border-[var(--paper)] bg-[var(--cyan)]" />
                  </div>
                  <span className="l-label !text-[0.52rem]">app.compromisso — fase 3: painel</span>
                </div>

                <div className="p-4 md:p-6 grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border-2 border-[var(--paper)] p-3 md:p-4">
                      <p className="l-label !text-[0.5rem] mb-2">XP acumulado</p>
                      <p className="l-display text-2xl md:text-3xl text-[var(--cyan-text)]">
                        <span id="l-kpi-xp">0</span>
                      </p>
                    </div>
                    <div className="border-2 border-[var(--paper)] p-3 md:p-4">
                      <p className="l-label !text-[0.5rem] mb-2">Acertos hoje</p>
                      <p className="l-display text-2xl md:text-3xl text-[var(--yellow-text)]">
                        <span id="l-kpi-acertos">0%</span>
                      </p>
                    </div>
                  </div>

                  <div className="border-2 border-[var(--paper)] p-3 md:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="l-label !text-[0.5rem]">Nível do mascote</p>
                      <p className="l-label !text-[0.5rem] !text-[var(--cyan-text)]">lv. 4</p>
                    </div>
                    <div className="l-hpbar">
                      <i id="l-hpfill" />
                    </div>
                  </div>

                  <div className="border-2 border-[var(--paper)] p-3 md:p-4">
                    <p className="l-label !text-[0.5rem] mb-3">Desempenho por matéria</p>
                    <div className="flex items-end gap-1.5 md:gap-2 h-16 md:h-20">
                      {[62, 84, 45, 92, 71, 56, 88].map((h, i) => (
                        <div
                          key={i}
                          className="l-bar flex-1"
                          style={{
                            height: `${h}%`,
                            background:
                              i % 3 === 0 ? "var(--cyan)" : i % 3 === 1 ? "var(--pink)" : "var(--yellow)",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-3 items-stretch">
                    <div className="border-2 border-[var(--paper)] p-3 min-h-[3.4rem]">
                      <p className="text-[0.62rem] md:text-[0.7rem] font-mono text-[var(--muted)]">
                        <span id="l-typing"></span>
                        <span className="l-caret" />
                      </p>
                    </div>
                    <div className="border-2 border-[var(--pink)] px-3 flex items-center gap-2.5">
                      <span className="l-eq">
                        <span /><span /><span /><span />
                      </span>
                      <span className="l-label !text-[0.5rem] !text-[var(--pink-text)]">ao vivo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Marquee duplo cruzado ── */}
        <div className="l-skew relative z-10 py-6 overflow-hidden" aria-hidden="true">
          <div className="l-band l-band-cyan">
            {[0, 1].map((t) => (
              <div key={t} className="l-band-track">
                {BAND_A.map((item) => (
                  <span key={item} className="flex items-center gap-8 whitespace-nowrap font-bold text-xs md:text-sm uppercase tracking-[0.18em]">
                    {item} <span className="l-display">✳</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="l-band l-band-yellow -mt-1">
            {[0, 1].map((t) => (
              <div key={t} className="l-band-track is-reverse">
                {BAND_B.map((item) => (
                  <span key={item} className="flex items-center gap-8 whitespace-nowrap font-bold text-xs md:text-sm uppercase tracking-[0.18em]">
                    {item} <span className="l-display">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Módulos ── */}
        <section id="l-modules" className="l-dots relative z-10 overflow-hidden">
          <div
            id="l-mod-ghost"
            aria-hidden="true"
            className="l-display l-stroke-paper absolute top-6 left-0 text-[26vw] md:text-[20vw] leading-none whitespace-nowrap pointer-events-none select-none opacity-40"
          >
            Módulos Módulos
          </div>

          <div className="px-5 md:px-12 pt-24 md:pt-36 pb-8 md:pb-10 relative z-10">
            <p className="l-label mb-4" data-scramble>
              Selecione sua fase
            </p>
            <h2 className="l-display text-[clamp(1.5rem,6vw,3rem)]" data-reveal>
              Seis módulos, <span className="text-[var(--pink-text)]">uma escola</span>
            </h2>
          </div>

          <div
            id="l-mod-track"
            className="relative z-10 flex flex-col gap-6 px-5 md:px-12 pb-20 md:pb-24
                       min-[900px]:flex-row min-[900px]:items-center min-[900px]:w-max min-[900px]:pr-[18vw]"
          >
            {MODULES.map((m) => (
              <article
                key={m.num}
                data-tone={m.tone}
                className="l-card p-6 md:p-9 min-[900px]:w-[400px] min-[900px]:shrink-0"
              >
                <div className="flex items-start justify-between mb-8 md:mb-10">
                  <span className="l-card-num text-5xl md:text-7xl">{m.num}</span>
                  <span className="l-label !text-[0.52rem] border-2 border-[var(--line)] px-2 py-1">
                    {m.meta}
                  </span>
                </div>
                <h3 className="l-display text-lg md:text-2xl mb-4">{m.title}</h3>
                <p className="text-sm md:text-base text-[var(--muted)] leading-relaxed">{m.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Stats em bloco ROSA ── */}
        <section className="l-skew l-block-pink relative z-10 py-16 md:py-24 my-8">
          <span className="l-shape l-shape-cross w-10 h-10 top-8 right-[8%] opacity-70" />
          <span className="l-shape l-shape-dot w-5 h-5 bottom-10 left-[5%] !bg-[var(--yellow)]" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 max-w-[1400px] mx-auto px-5 md:px-12">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="l-display text-[clamp(2.2rem,9vw,4.5rem)] text-[var(--yellow)] origin-bottom">
                  <span className="l-stat-value" data-value={s.value}>
                    0
                  </span>
                  <span className="text-[var(--on-pink)]">{s.suffix}</span>
                </p>
                <p className="l-label mt-3 !text-[var(--on-pink)]/80" data-scramble>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Fluxo ── */}
        <section id="l-flow" className="l-skew l-dots relative z-10 px-5 md:px-12 py-20 md:py-32">
          <span className="l-shape l-shape-ring w-16 h-16 top-[15%] right-[4%] !border-[var(--cyan)]" />
          <div className="max-w-[1100px] mx-auto">
            <div className="mb-14 md:mb-20">
              <p className="l-label mb-4" data-scramble>
                Modo história
              </p>
              <h2 className="l-display text-[clamp(1.5rem,6vw,3rem)]" data-reveal>
                Do primeiro login à <span className="text-[var(--yellow-text)]">aprovação</span>
              </h2>
            </div>

            <div id="l-flow-list" className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-[3px] bg-[var(--line)]">
                <div id="l-thread-line" className="absolute inset-0 bg-[var(--yellow)]" />
              </div>

              <ol className="space-y-14 md:space-y-20">
                {FLOW_STEPS.map((step, i) => (
                  <li key={step.num} className="l-flow-step relative pl-10 md:pl-16">
                    <span className="l-thread-dot absolute left-0 top-1.5 h-[17px] w-[17px] border-2 border-[var(--paper)] bg-[var(--yellow)]" />
                    <div className="grid md:grid-cols-[110px_1fr] gap-3 md:gap-10 items-baseline">
                      <span
                        className={`l-display text-4xl md:text-5xl ${
                          i % 3 === 0 ? "text-[var(--cyan-text)]" : i % 3 === 1 ? "text-[var(--pink-text)]" : "text-[var(--yellow-text)]"
                        }`}
                      >
                        {step.num}
                      </span>
                      <div>
                        <h3 className="l-display text-base md:text-xl mb-3">{step.title}</h3>
                        <p className="text-sm md:text-lg text-[var(--muted)] max-w-2xl leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── CTA em bloco CIANO ── */}
        <section id="l-cta-block" className="l-skew l-block-cyan relative z-10 py-20 md:py-32 text-center overflow-hidden">
          <Seal
            text="SEM VÍRUS • SEM LOOTBOX • SÓ ESTUDO • "
            className="absolute top-6 left-5 md:left-12 w-24 h-24 md:w-32 md:h-32 text-[var(--on-cyan)] opacity-80"
          />
          <span className="l-shape l-shape-dot w-6 h-6 bottom-[18%] right-[10%] !bg-[var(--pink)]" />
          <p className="l-label mb-6 !text-[var(--on-cyan)]/70" data-scramble>
            Pressione start
          </p>
          <h2
            id="l-cta-title"
            className="l-display text-[clamp(2.4rem,12vw,8rem)] leading-none text-[var(--on-cyan)]"
            aria-label="Começar agora"
          >
            Começar agora
          </h2>
          <div className="mt-10 md:mt-12">
            <button ref={magnetic} onClick={() => go("/login")} className="l-btn l-btn-pink !text-sm !px-9 !py-4">
              Entrar na plataforma
            </button>
          </div>
        </section>

        {/* ── Rodapé ── */}
        <footer className="relative z-10 px-5 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="l-label">
            <LogoDali className="inline-block h-3 w-3 mr-1 align-[-1px] text-[var(--pink-text)]" />Dalí — Santana de Parnaíba, SP
          </span>
          <div className="flex items-center gap-8">
            <button onClick={() => go("/login")} className="l-underline l-label">
              Entrar
            </button>
            <button onClick={() => go("/primeiro-acesso")} className="l-underline l-label">
              Primeiro acesso
            </button>
          </div>
          <span className="l-label !text-[0.52rem]">
            © {new Date().getFullYear()} — feito para quem vai passar
          </span>
        </footer>
      </div>
    </div>
  );
}
