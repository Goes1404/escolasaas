"use client";

/**
 * Landing page — experiência única com GSAP + ScrollTrigger + Lenis.
 *
 * Direção de arte: editorial escuro (ver landing.css). As "demos em vídeo"
 * são mocks animados por timeline (contadores, barras, digitação) dentro de
 * uma janela em perspectiva 3D que reage ao mouse — nada de vídeo real para
 * não pesar na rede móvel do aluno.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { TextPlugin } from "gsap/TextPlugin";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText, TextPlugin, useGSAP);

/* ── Conteúdo ──────────────────────────────────────────────────────────────── */

const MARQUEE_ITEMS = [
  "Simulados ENEM",
  "Provas ETEC",
  "Redação com IA",
  "Flashcards",
  "Ranking semanal",
  "Mascote 3D",
  "Mensalidades",
  "Portal do responsável",
  "Rematrícula digital",
  "Aulas ao vivo",
  "Caderno com wikilinks",
];

const MODULES = [
  {
    num: "01",
    title: "Simulados de verdade",
    body: "Provas ENEM e ETEC no padrão real: 3,5 minutos por questão, navegação por grade, nota TRI e revisão comentada.",
    meta: "Aluno",
  },
  {
    num: "02",
    title: "Redação em minutos",
    body: "Correção nas cinco competências com devolutiva na hora — e o professor refina por cima, sem começar do zero.",
    meta: "Aluno · Professor",
  },
  {
    num: "03",
    title: "Estudo que vira jogo",
    body: "XP por acerto, ofensiva de dias, ranking semanal com premiação e um mascote que evolui com o estudo — e nunca morre.",
    meta: "Aluno",
  },
  {
    num: "04",
    title: "Financeiro sem planilha",
    body: "Planos de mensalidade, bolsas, geração de cobranças em um clique, painel de inadimplência e recibo na hora.",
    meta: "Secretaria",
  },
  {
    num: "05",
    title: "Portal do responsável",
    body: "Boletim, frequência, financeiro e comunicados com confirmação de leitura — num link seguro, sem senha para decorar.",
    meta: "Família",
  },
  {
    num: "06",
    title: "Rematrícula digital",
    body: "Contrato com aceite eletrônico auditável e vaga do próximo ano garantida em dois cliques, pelo aluno ou pelo responsável.",
    meta: "Secretaria · Família",
  },
];

const FLOW_STEPS = [
  { num: "01", title: "O aluno estuda", body: "Simulados, flashcards com repetição espaçada, redação e desafio diário — tudo no celular." },
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

/* ── Componente ────────────────────────────────────────────────────────────── */

export default function LandingExperience() {
  const root = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loaderDone, setLoaderDone] = useState(false);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* Scroll suave (Lenis) sincronizado com o ScrollTrigger */
      let lenis: Lenis | null = null;
      const lenisRaf = (time: number) => lenis?.raf(time * 1000);
      if (!reduced) {
        lenis = new Lenis({ duration: 1.15, smoothWheel: true });
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(lenisRaf);
        gsap.ticker.lagSmoothing(0);
      }

      /* ── Preloader: contador + cortina ─────────────────────────────────── */
      const counter = { v: 0 };
      const intro = gsap.timeline({
        onComplete: () => setLoaderDone(true),
      });

      if (!reduced) {
        intro
          .to(counter, {
            v: 100,
            duration: 1.1,
            ease: "power2.inOut",
            onUpdate: () => {
              const el = document.getElementById("l-counter");
              if (el) el.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          })
          .to("#l-preloader", {
            clipPath: "inset(0% 0% 100% 0%)",
            duration: 0.9,
            ease: "power4.inOut",
          });
      } else {
        intro.set("#l-preloader", { display: "none" });
      }

      /* Fontes web podem falhar em rede ruim — nunca segurar o reveal por
         mais de 1,5s (o SplitText mede com a fonte fallback e segue o baile). */
      const fontsReady = Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1500)),
      ]);

      /* ── Hero: headline por linhas + janela 3D ─────────────────────────── */
      fontsReady.then(() => {
        const split = SplitText.create(".l-hero-title", {
          type: "lines",
          linesClass: "split-line",
          mask: "lines",
        });
        intro
          .from(
            split.lines,
            { yPercent: 110, duration: 1, stagger: 0.09, ease: "power4.out" },
            reduced ? 0 : "-=0.35"
          )
          .from(
            ".l-hero-fade",
            { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" },
            "-=0.6"
          )
          .from(
            windowRef.current,
            {
              rotateY: -26,
              rotateX: 14,
              y: 80,
              autoAlpha: 0,
              duration: 1.2,
              ease: "power3.out",
            },
            "-=0.7"
          );
      });

      /* Tilt da janela seguindo o mouse (desktop) */
      if (!reduced && windowRef.current && sceneRef.current) {
        const rx = gsap.quickTo(windowRef.current, "rotationX", { duration: 0.6, ease: "power3" });
        const ry = gsap.quickTo(windowRef.current, "rotationY", { duration: 0.6, ease: "power3" });
        const onMove = (e: MouseEvent) => {
          const r = sceneRef.current!.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          ry(px * 14);
          rx(-py * 10);
        };
        const onLeave = () => {
          ry(-8);
          rx(4);
        };
        sceneRef.current.addEventListener("mousemove", onMove);
        sceneRef.current.addEventListener("mouseleave", onLeave);
        /* pose de descanso, levemente girada — nunca "flat" */
        gsap.set(windowRef.current, { rotationY: -8, rotationX: 4 });
      }

      /* ── Mock animado ("vídeo") dentro da janela ───────────────────────── */
      if (!reduced) {
        const demo = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 2.2 });
        const kpi = { xp: 0, acertos: 0 };
        demo
          .to(kpi, {
            xp: 3485,
            acertos: 87,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: () => {
              const a = document.getElementById("l-kpi-xp");
              const b = document.getElementById("l-kpi-acertos");
              if (a) a.textContent = Math.round(kpi.xp).toLocaleString("pt-BR");
              if (b) b.textContent = `${Math.round(kpi.acertos)}%`;
            },
          })
          .fromTo(
            ".l-bar",
            { scaleY: 0.12 },
            { scaleY: 1, duration: 0.8, stagger: 0.08, ease: "back.out(1.6)", transformOrigin: "bottom" },
            "-=1.2"
          )
          .to("#l-typing", {
            text: "Corrigindo sua redação… competência 5 fechada em 180.",
            duration: 2.2,
            ease: "none",
          })
          .to({}, { duration: 1.4 })
          .to("#l-typing", { text: "", duration: 0.3, ease: "none" })
          .to(kpi, {
            xp: 0,
            acertos: 0,
            duration: 0.01,
            onUpdate: () => {
              const a = document.getElementById("l-kpi-xp");
              const b = document.getElementById("l-kpi-acertos");
              if (a) a.textContent = "0";
              if (b) b.textContent = "0%";
            },
          });
      }

      /* ── Módulos: trilho horizontal com pin (desktop) ──────────────────── */
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const track = document.getElementById("l-mod-track");
        if (!track) return;
        const getX = () => -(track.scrollWidth - window.innerWidth);
        gsap.to(track, {
          x: getX,
          ease: "none",
          scrollTrigger: {
            trigger: "#l-modules",
            start: "top top",
            end: () => `+=${track.scrollWidth - window.innerWidth + 200}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        /* número gigante de fundo acompanha em parallax */
        gsap.fromTo(
          "#l-mod-ghost",
          { xPercent: 10 },
          {
            xPercent: -30,
            ease: "none",
            scrollTrigger: {
              trigger: "#l-modules",
              start: "top top",
              end: () => `+=${track.scrollWidth - window.innerWidth + 200}`,
              scrub: 1,
            },
          }
        );
      });

      /* Tilt 3D dos cards de módulo */
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>(".l-card").forEach((card) => {
          const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3" });
          const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3" });
          card.addEventListener("mousemove", (e) => {
            const r = card.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 10);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
          });
          card.addEventListener("mouseleave", () => {
            rx(0);
            ry(0);
          });
        });
      }

      /* ── Reveals genéricos por seção ───────────────────────────────────── */
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 48,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      /* ── Números: contadores ao entrar ─────────────────────────────────── */
      gsap.utils.toArray<HTMLElement>(".l-stat-value").forEach((el) => {
        const target = Number(el.dataset.value ?? "0");
        const state = { v: 0 };
        gsap.to(state, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
          onUpdate: () => {
            el.textContent = Math.round(state.v).toLocaleString("pt-BR");
          },
        });
      });

      /* ── Fluxo: linha desenhando com scrub ─────────────────────────────── */
      gsap.fromTo(
        "#l-thread-line",
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "top",
          ease: "none",
          scrollTrigger: {
            trigger: "#l-flow",
            start: "top 70%",
            end: "bottom 60%",
            scrub: 1,
          },
        }
      );

      /* ── CTA final: caracteres sobem ───────────────────────────────────── */
      fontsReady.then(() => {
        const ctaSplit = SplitText.create("#l-cta-title", {
          type: "chars",
          charsClass: "l-cta-char",
        });
        gsap.from(ctaSplit.chars, {
          yPercent: 120,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.035,
          ease: "back.out(1.7)",
          scrollTrigger: { trigger: "#l-cta-title", start: "top 85%" },
        });
      });

      return () => {
        gsap.ticker.remove(lenisRaf);
        lenis?.destroy();
      };
    },
    { scope: root }
  );

  /* Botão magnético (nav + CTA) */
  const magnetic = (el: HTMLElement | null) => {
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
      {/* Fontes próprias da landing (React 19 sobe os <link> para o <head>) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Boldonse&family=EB+Garamond:ital,wght@1,400;1,500&family=Space+Mono:wght@400;700&display=swap"
      />

      {/* Colunas de grade ao fundo */}
      <div className="landing-grid-cols" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={i > 3 ? "hidden md:block" : ""} />
        ))}
      </div>

      {/* ── Preloader ── */}
      {!loaderDone && (
        <div id="l-preloader" className="l-preloader" aria-hidden="true">
          <span className="l-label">Compromisso — plataforma</span>
          <span id="l-counter" className="l-display text-5xl md:text-7xl">
            000
          </span>
        </div>
      )}

      {/* ── Nav ── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <span className="l-label !text-[var(--paper)]">
          Compromisso<span className="text-[var(--cyan)]">*</span>
        </span>
        <nav className="flex items-center gap-8">
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
            ref={magnetic}
            onClick={() => go("/login")}
            className="l-cta border border-[var(--paper)] px-6 py-2.5 l-label !text-[var(--paper)] hover:!text-[var(--ink)] hover:bg-[var(--paper)] transition-colors"
          >
            Entrar
          </button>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 px-6 md:px-12 pt-10 md:pt-20 pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-16 items-center max-w-[1500px] mx-auto">
        <div>
          <p className="l-label mb-6 l-hero-fade">
            Plataforma ENEM · ETEC — estudo + gestão escolar
          </p>
          <h1 className="l-hero-title l-display l-mask-lines text-[clamp(2.6rem,7vw,5.8rem)]">
            Estudar virou jogo. Gerir virou simples.
          </h1>
          <p className="l-serif text-xl md:text-2xl text-[var(--muted)] mt-8 max-w-xl l-hero-fade">
            Do simulado à mensalidade: alunos, professores, secretaria e famílias
            na mesma plataforma — feita para o celular de quem estuda.
          </p>
          <div className="flex flex-wrap items-center gap-5 mt-10 l-hero-fade">
            <button
              ref={magnetic}
              onClick={() => go("/login")}
              className="l-cta bg-[var(--blue)] text-white px-8 py-4 l-label !text-white !tracking-[0.2em]"
            >
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
        </div>

        {/* Janela 3D com o "vídeo" do produto */}
        <div ref={sceneRef} className="l-scene">
          <div ref={windowRef} className="l-window">
            <div className="l-window-bar flex items-center justify-between px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--warm)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--cyan)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--blue)]" />
              </div>
              <span className="l-label !text-[0.55rem]">app.compromisso — painel do aluno</span>
            </div>

            <div className="p-5 md:p-6 grid gap-4">
              {/* KPIs animados */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-[var(--line)] p-4">
                  <p className="l-label !text-[0.55rem] mb-2">XP acumulado</p>
                  <p className="l-display text-3xl text-[var(--cyan)]">
                    <span id="l-kpi-xp">0</span>
                  </p>
                </div>
                <div className="border border-[var(--line)] p-4">
                  <p className="l-label !text-[0.55rem] mb-2">Acertos hoje</p>
                  <p className="l-display text-3xl text-[var(--paper)]">
                    <span id="l-kpi-acertos">0%</span>
                  </p>
                </div>
              </div>

              {/* Gráfico de barras animado */}
              <div className="border border-[var(--line)] p-4">
                <p className="l-label !text-[0.55rem] mb-3">Desempenho por matéria</p>
                <div className="flex items-end gap-2 h-20">
                  {[62, 84, 45, 92, 71, 56, 88].map((h, i) => (
                    <div
                      key={i}
                      className="l-bar flex-1"
                      style={{
                        height: `${h}%`,
                        background: i === 3 ? "var(--cyan)" : "var(--blue)",
                        opacity: i === 3 ? 1 : 0.55,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Linha "IA corrigindo" com digitação + aula ao vivo */}
              <div className="grid grid-cols-[1fr_auto] gap-4 items-stretch">
                <div className="border border-[var(--line)] p-4 min-h-[3.6rem]">
                  <p className="text-[0.7rem] font-mono text-[var(--muted)]">
                    <span id="l-typing"></span>
                    <span className="l-caret" />
                  </p>
                </div>
                <div className="border border-[var(--warm)]/40 px-4 flex items-center gap-3">
                  <span className="l-eq">
                    <span /><span /><span /><span />
                  </span>
                  <span className="l-label !text-[0.55rem] !text-[var(--warm)]">ao vivo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="l-marquee relative z-10" aria-hidden="true">
        {[0, 1].map((t) => (
          <div key={t} className="l-marquee-track">
            {MARQUEE_ITEMS.map((item) => (
              <span key={item} className="flex items-center gap-12 whitespace-nowrap">
                <span className="l-label !text-sm !text-[var(--paper)]">{item}</span>
                <span className="text-[var(--blue)]">✳</span>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* ── Módulos (trilho horizontal com pin no desktop) ── */}
      <section id="l-modules" className="relative z-10 overflow-hidden">
        <div
          id="l-mod-ghost"
          aria-hidden="true"
          className="l-display l-outline-text absolute top-8 left-0 text-[22vw] leading-none whitespace-nowrap pointer-events-none select-none"
        >
          Módulos Módulos
        </div>

        <div className="px-6 md:px-12 pt-28 md:pt-36 pb-10" data-reveal>
          <p className="l-label mb-4">O que vive aqui dentro</p>
          <h2 className="l-display text-[clamp(1.8rem,4vw,3.2rem)] max-w-3xl">
            Seis módulos, uma escola
          </h2>
        </div>

        <div
          id="l-mod-track"
          className="flex flex-col md:min-h-[60vh] gap-6 px-6 md:px-12 pb-24
                     min-[900px]:flex-row min-[900px]:items-center min-[900px]:w-max min-[900px]:pr-[20vw]"
        >
          {MODULES.map((m) => (
            <article
              key={m.num}
              className="l-card p-8 md:p-10 min-[900px]:w-[420px] min-[900px]:shrink-0"
            >
              <div className="flex items-start justify-between mb-10">
                <span className="l-card-num text-6xl md:text-7xl">{m.num}</span>
                <span className="l-label !text-[0.55rem] border border-[var(--line)] px-2 py-1">
                  {m.meta}
                </span>
              </div>
              <h3 className="l-display text-xl md:text-2xl mb-4">{m.title}</h3>
              <p className="l-serif text-lg text-[var(--muted)] leading-relaxed">{m.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Números ── */}
      <section className="relative z-10 border-t border-[var(--line-strong)]">
        <div className="grid grid-cols-2 lg:grid-cols-4 max-w-[1500px] mx-auto">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              data-reveal
              className={`px-6 md:px-12 py-14 ${i > 0 ? "border-l border-[var(--line)]" : ""}`}
            >
              <p className="l-display text-4xl md:text-6xl text-[var(--paper)]">
                <span className="l-stat-value" data-value={s.value}>
                  0
                </span>
                <span className="text-[var(--cyan)]">{s.suffix}</span>
              </p>
              <p className="l-label mt-4">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fluxo ── */}
      <section id="l-flow" className="relative z-10 border-t border-[var(--line-strong)] px-6 md:px-12 py-28 md:py-36">
        <div className="max-w-[1100px] mx-auto">
          <div data-reveal className="mb-20">
            <p className="l-label mb-4">Como funciona</p>
            <h2 className="l-display text-[clamp(1.8rem,4vw,3.2rem)]">
              Do primeiro login à aprovação
            </h2>
          </div>

          <div className="relative">
            {/* linha que desenha com o scroll */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--line)]">
              <div id="l-thread-line" className="absolute inset-0 bg-[var(--cyan)]" />
            </div>

            <ol className="space-y-16 md:space-y-20">
              {FLOW_STEPS.map((step) => (
                <li key={step.num} data-reveal className="relative pl-12 md:pl-16">
                  <span className="l-thread-dot absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full bg-[var(--cyan)]" />
                  <div className="grid md:grid-cols-[110px_1fr] gap-4 md:gap-10 items-baseline">
                    <span className="l-display l-outline-text text-4xl md:text-5xl">{step.num}</span>
                    <div>
                      <h3 className="l-display text-lg md:text-xl mb-3">{step.title}</h3>
                      <p className="l-serif text-lg md:text-xl text-[var(--muted)] max-w-2xl leading-relaxed">
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

      {/* ── CTA final ── */}
      <section className="relative z-10 border-t border-[var(--line-strong)] px-6 md:px-12 py-28 md:py-40 text-center overflow-hidden">
        <p className="l-label mb-8" data-reveal>
          Sua escola, seu jogo
        </p>
        <h2
          id="l-cta-title"
          className="l-display text-[clamp(3rem,11vw,9rem)] leading-none"
          aria-label="Começar agora"
        >
          Começar agora
        </h2>
        <div className="mt-12" data-reveal>
          <button
            ref={magnetic}
            onClick={() => go("/login")}
            className="l-cta bg-[var(--paper)] text-[var(--ink)] px-10 py-5 l-label !text-[var(--ink)] !tracking-[0.25em] font-bold"
          >
            Entrar na plataforma
          </button>
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="relative z-10 border-t border-[var(--line-strong)] px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="l-label">
          Compromisso<span className="text-[var(--cyan)]">*</span> — Santana de Parnaíba, SP
        </span>
        <div className="flex items-center gap-8">
          <button onClick={() => go("/login")} className="l-underline l-label">
            Entrar
          </button>
          <button onClick={() => go("/primeiro-acesso")} className="l-underline l-label">
            Primeiro acesso
          </button>
        </div>
        <span className="l-label !text-[0.55rem]">
          © {new Date().getFullYear()} — feito para quem vai passar
        </span>
      </footer>
    </div>
  );
}
