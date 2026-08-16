"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  BrainCircuit,
  GraduationCap,
  LineChart,
  Target,
  ChevronDown,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  // Evita re-cálculos do pin quando a barra de endereço do celular esconde/aparece
  ScrollTrigger.config({ ignoreMobileResize: true });
}

const PILLARS = [
  {
    icon: BrainCircuit,
    title: "Aurora IA",
    desc: "Tutoria 24/7 que mapeia seus gaps e monta seu plano de estudo.",
  },
  {
    icon: GraduationCap,
    title: "Docentes Elite",
    desc: "Especialistas nas bancas do ENEM e da ETEC, do seu lado.",
  },
  {
    icon: LineChart,
    title: "Dados que Aprovam",
    desc: "Dashboard preditivo mostrando sua evolução real, semana a semana.",
  },
  {
    icon: Target,
    title: "Simulados Reais",
    desc: "Padrão oficial de prova: do tempo por questão à grade de respostas.",
  },
];

/**
 * Hero scrollytelling: um livro 3D fechado que se abre conforme o scroll.
 *
 * Mobile-first: a página interna fica sempre em tamanho cheio e centralizada;
 * a capa gira para fora da tela (clip via overflow-hidden), como abrir um
 * caderno segurando só a folha da direita. No desktop (≥768px) a cena desliza
 * meia largura para a direita e o verso da capa vira a página esquerda.
 */
export function HeroBook() {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const insideRef = useRef<HTMLDivElement>(null);
  const pillarsRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const lenisCleanup = useRef<(() => void) | null>(null);

  /* ── Lenis smooth scroll (wheel no desktop; toque continua nativo) ── */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({ duration: 1.1 });
      lenis.on("scroll", ScrollTrigger.update);

      const ticker = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);

      lenisCleanup.current = () => {
        gsap.ticker.remove(ticker);
        lenis.destroy();
      };
    });

    return () => {
      cancelled = true;
      lenisCleanup.current?.();
    };
  }, []);

  /* ── Coreografia GSAP: pin + scrub ── */
  useGSAP(
    () => {
      const cover = coverRef.current;
      const scene = sceneRef.current;
      const inside = insideRef.current;
      const pillars = pillarsRef.current;
      if (!cover || !scene || !inside || !pillars) return;

      // No desktop a cena desliza meia largura do livro para centralizar a
      // dupla de páginas; no mobile fica parada (capa abre para fora da tela)
      const openShift = () =>
        window.innerWidth >= 768 ? (bookRef.current?.offsetWidth ?? 0) / 2 : 0;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(cover, { rotateY: -180 });
        gsap.set(scene, { x: openShift() });
        gsap.set([inside, ...Array.from(pillars.children)], { opacity: 1, y: 0 });
        gsap.set(shadeRef.current, { opacity: 0 });
        gsap.set(cueRef.current, { opacity: 0 });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=250%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      /* 1 — dica de scroll some assim que o usuário rola */
      tl.to(cueRef.current, { opacity: 0, duration: 0.06, ease: "none" }, 0);

      /* 2 — capa abre (rotateY negativo = dobradiça na lombada esquerda) */
      tl.to(cover, { rotateY: -180, duration: 0.6, ease: "none" }, 0.06);
      tl.to(scene, { x: openShift, duration: 0.6, ease: "none" }, 0.06);

      /* 3 — a sombra que a capa projeta na página vai clareando */
      tl.to(shadeRef.current, { opacity: 0, duration: 0.45, ease: "none" }, 0.12);

      /* 4 — conteúdo interno respira para dentro */
      tl.fromTo(
        inside,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        0.36,
      );

      /* 5 — pilares entram em cascata */
      tl.fromTo(
        Array.from(pillars.children),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.1, stagger: 0.06, ease: "power2.out" },
        0.5,
      );

      /* 6 — pausa para leitura antes de soltar o pin */
      tl.to({}, { duration: 0.2 });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="home"
      aria-label="Apresentação da plataforma"
      className="relative h-[100svh] overflow-hidden bg-gray-950"
    >
      {/* ── Atmosfera ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-black pointer-events-none" />
      <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-0 noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 110%, rgba(76,204,237,0.13) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 pt-14">
        {/* ── Cena 3D ── */}
        <div ref={sceneRef} style={{ perspective: "1800px" }}>
          <div
            ref={bookRef}
            className="relative"
            style={{
              width: "min(76vw, 350px)",
              height: "min(108vw, 490px)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Sombra no chão */}
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: "-26px",
                left: "6%",
                width: "88%",
                height: "30px",
                background: "radial-gradient(ellipse, rgba(0,0,0,0.8), transparent 70%)",
                filter: "blur(8px)",
              }}
            />

            {/* ════ PÁGINA INTERNA (sempre tamanho cheio) ════ */}
            <div
              className="absolute inset-0 overflow-hidden rounded-r-2xl rounded-l-md"
              style={{
                background: "linear-gradient(155deg, #faf4e8 0%, #f3e8d2 60%, #ecdcbe 100%)",
                boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
              }}
            >
              {/* Costura da lombada */}
              <div
                className="absolute inset-y-0 left-0 w-7 pointer-events-none"
                style={{ background: "linear-gradient(to right, rgba(60,30,0,0.28), transparent)" }}
              />
              {/* Borda de folhas empilhadas à direita */}
              <div className="absolute inset-y-1 right-0 flex pointer-events-none">
                {[0.5, 0.34, 0.2].map((op, i) => (
                  <div
                    key={i}
                    className="h-full w-[2px] mr-[2px] rounded-r-sm"
                    style={{ background: `rgba(180,140,80,${op})` }}
                  />
                ))}
              </div>

              {/* Conteúdo (revelado conforme a capa abre) */}
              <div
                ref={insideRef}
                className="relative z-[1] flex h-full flex-col opacity-0"
                style={{ padding: "clamp(22px, 6vw, 32px) clamp(22px, 6vw, 32px) clamp(16px, 4vw, 24px) clamp(26px, 7vw, 38px)" }}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#b05c0e]/80">
                  Capítulo 01 · Bem-vindo
                </p>

                <h2
                  className="mt-2 font-black italic tracking-tighter text-[#241300] leading-[1.1]"
                  style={{ fontSize: "clamp(20px, 5.6vw, 27px)" }}
                >
                  Toda aprovação começa numa{" "}
                  <span className="text-[#e25b00]">página em branco.</span>
                </h2>

                <p
                  className="mt-2 italic text-[#5b3a10]/70 leading-relaxed"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(11px, 3vw, 13px)" }}
                >
                  Aqui, a gente escreve a sua junto com você.
                </p>

                <div className="my-[clamp(12px,3vw,20px)] h-px bg-[#8a5a20]/20" />

                {/* Pilares */}
                <div ref={pillarsRef} className="flex flex-col gap-[clamp(10px,2.8vw,15px)]">
                  {PILLARS.map((p) => (
                    <div key={p.title} className="flex items-start gap-3">
                      <div className="shrink-0 h-8 w-8 rounded-lg bg-[#e25b00]/10 border border-[#e25b00]/25 text-[#c14e00] flex items-center justify-center">
                        <p.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-black uppercase tracking-wide text-[#2a1500] leading-tight">
                          {p.title}
                        </p>
                        <p className="mt-0.5 text-[10.5px] font-semibold leading-snug text-[#5b3a10]/75">
                          {p.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé da página */}
                <div className="mt-auto pt-3 flex items-end justify-between">
                  <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#8a5a20]/50">
                    Edição 2026
                  </p>
                  <p
                    className="text-[11px] italic text-[#b05c0e]/50"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    — 01 —
                  </p>
                </div>
              </div>

              {/* Sombra projetada pela capa (clareia ao abrir) */}
              <div
                ref={shadeRef}
                className="absolute inset-0 z-[2] pointer-events-none"
                style={{ background: "linear-gradient(to right, rgba(15,8,0,0.5), rgba(15,8,0,0.32))" }}
              />
            </div>

            {/* ════ CAPA (gira -180° na dobradiça esquerda) ════ */}
            <div
              ref={coverRef}
              className="absolute inset-0 z-10"
              style={{
                transformOrigin: "left center",
                transformStyle: "preserve-3d",
                willChange: "transform",
              }}
            >
              {/* FRENTE */}
              <div
                className="absolute inset-0 flex flex-col rounded-r-2xl rounded-l-md overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  background:
                    "linear-gradient(155deg, #1c1d22 0%, #101116 45%, #17181d 75%, #0a0b0f 100%)",
                  boxShadow:
                    "0 22px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,140,40,0.12), inset -1px 0 0 rgba(255,140,40,0.06)",
                }}
              >
                <div className="absolute inset-0 noise pointer-events-none" />

                {/* Lombada (vinco + relevo) */}
                <div
                  className="absolute inset-y-0 left-0 w-5 pointer-events-none"
                  style={{ background: "linear-gradient(to right, rgba(0,0,0,0.6), transparent)" }}
                />
                <div className="absolute inset-y-4 left-[7px] w-px bg-[#4CCCED]/20 pointer-events-none" />

                {/* Moldura em relevo */}
                <div className="absolute inset-4 rounded-xl border border-[#4CCCED]/25 pointer-events-none" />
                <div className="absolute inset-[22px] rounded-lg border border-[#4CCCED]/10 pointer-events-none" />

                {/* Brilho âmbar inferior */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 90% 80% at 50% 115%, rgba(76,204,237,0.16), transparent 70%)",
                  }}
                />

                {/* Conteúdo da capa */}
                <div className="relative flex-1 flex flex-col items-center justify-center text-center px-7">
                  <div className="relative w-[58%] max-w-[180px] h-14 mb-5">
                    <Image
                      src="/images/default-logo.png"
                      alt="Logo"
                      fill
                      priority
                      className="object-contain drop-shadow-[0_0_16px_rgba(76,204,237,0.55)]"
                      sizes="180px"
                    />
                  </div>

                  <p className="text-[9px] font-black uppercase tracking-[0.5em] text-orange-400/60 mb-3">
                    Cursinho Pré-Vestibular
                  </p>

                  <h1
                    className="font-black italic tracking-tighter text-white leading-[1.12]"
                    style={{
                      fontSize: "clamp(22px, 6vw, 30px)",
                      textShadow: "0 0 40px rgba(76,204,237,0.35)",
                    }}
                  >
                    Sua aprovação é o nosso{" "}
                    <span className="text-gradient-brand">Objetivo.</span>
                  </h1>

                  <div className="mt-5 h-px w-12 bg-[#4CCCED]/40" />

                  <p className="mt-4 text-[9px] font-black uppercase tracking-[0.4em] text-white/30">
                    ENEM · ETEC · 2026
                  </p>
                </div>

                {/* Pé da capa */}
                <p
                  className="relative pb-5 text-center text-[8px] italic text-white/25"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  Edição 2026
                </p>
              </div>

              {/* VERSO (vira a página esquerda no desktop) */}
              <div
                className="absolute inset-0 rounded-l-2xl rounded-r-md overflow-hidden flex items-center justify-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: "linear-gradient(205deg, #faf4e8 0%, #f1e5cd 60%, #e9d8b8 100%)",
                }}
              >
                <div
                  className="absolute inset-y-0 right-0 w-7 pointer-events-none"
                  style={{ background: "linear-gradient(to left, rgba(60,30,0,0.25), transparent)" }}
                />
                <blockquote
                  className="px-9 text-center italic text-[#4a2e08]/75 leading-relaxed"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(13px, 1.6vw, 17px)" }}
                >
                  “Toda grande história começa quando alguém decide virar a página.”
                  <footer className="mt-4 text-[9px] font-black uppercase tracking-[0.35em] not-italic text-[#b05c0e]/60">
                    — Equipe Pedagógica, 2026
                  </footer>
                </blockquote>
              </div>
            </div>
          </div>
        </div>

        {/* ── Dica de scroll ── */}
        <div
          ref={cueRef}
          className="mt-9 flex flex-col items-center gap-1.5 pointer-events-none"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/35">
            Role para abrir
          </p>
          <ChevronDown className="h-4 w-4 text-orange-400/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
