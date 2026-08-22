"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  BarChart3,
  Bot,
  Flame,
  LayoutDashboard,
  Network,
  Route,
  Timer,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

/* ────────────────────────────────────────────────────────────── */

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

interface BentoCardProps {
  icon: LucideIcon;
  tagline: string;
  title: string;
  description: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Card de vidro com spotlight radial que segue o cursor (CSS vars --spot-x/--spot-y).
 * O mesmo estado visual do hover também ativa sozinho quando o card cruza a
 * faixa central da viewport durante o scroll — essencial no touch, onde não
 * existe hover de mouse.
 */
function BentoCard({
  icon: Icon,
  tagline,
  title,
  description,
  className = "",
  children,
}: BentoCardProps): ReactElement {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const isScrollActive = useInView(cardRef, {
    amount: 0.5,
    margin: "-15% 0px -15% 0px",
  });

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.div
      ref={cardRef}
      variants={cardVariants}
      onMouseMove={handleMouseMove}
      className={`group relative flex flex-col overflow-hidden rounded-card border border-white/10 bg-white/[0.03] backdrop-blur-xl p-7 md:p-8 shadow-2xl transition-[border-color,transform] duration-300 hover:border-primary/40 hover:-translate-y-1 noise ${
        isScrollActive ? `is-active border-primary/40 ${reduceMotion ? "" : "-translate-y-1"}` : ""
      } ${className}`}
    >
      {/* Spotlight que segue o mouse */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 group-[.is-active]:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(76,204,237,0.12), transparent 65%)",
        }}
      />
      {/* Brilho na borda superior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 group-[.is-active]:opacity-100 transition-opacity duration-500"
      />

      <div className="relative z-10 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary/80">
          {tagline}
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary transition-all duration-500 group-hover:bg-primary group-[.is-active]:bg-primary group-hover:text-white group-[.is-active]:text-white group-hover:rotate-6 group-[.is-active]:rotate-6 group-hover:shadow-[0_0_25px_rgba(76,204,237,0.5)] group-[.is-active]:shadow-[0_0_25px_rgba(76,204,237,0.5)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="relative z-10 mt-4 space-y-2">
        <h3 className="text-xl md:text-2xl font-black italic tracking-tighter text-white group-hover:text-primary group-[.is-active]:text-primary transition-colors duration-500">
          {title}
        </h3>
        <p className="text-sm font-medium leading-relaxed text-gray-400 group-hover:text-gray-200 group-[.is-active]:text-gray-200 transition-colors duration-500">
          {description}
        </p>
      </div>

      {children ? <div className="relative z-10 mt-auto pt-6">{children}</div> : null}
    </motion.div>
  );
}

/* ── Micro-demos ─────────────────────────────────────────────── */

function PortalDemo(): ReactElement {
  const widgets: readonly { label: string; pct: number }[] = [
    { label: "Simulados", pct: 78 },
    { label: "Redações", pct: 92 },
    { label: "Flashcards", pct: 64 },
    { label: "Metas", pct: 85 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {widgets.map((w, i) => (
        <div
          key={w.label}
          className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 transition-colors duration-500 group-hover:border-primary/25 group-[.is-active]:border-primary/25"
        >
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            {w.label}
          </p>
          <p className="mt-1 text-lg font-black text-white">{w.pct}%</p>
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 origin-left scale-x-50 group-hover:scale-x-100 group-[.is-active]:scale-x-100 transition-transform duration-700 ease-out"
              style={{ width: `${w.pct}%`, transitionDelay: `${i * 90}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AuroraDemo(): ReactElement {
  return (
    <div className="space-y-2.5">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/10 px-3.5 py-2.5">
        <p className="text-[11px] font-medium text-gray-300">
          Aurora, como resolvo essa função do 2º grau?
        </p>
      </div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 border border-primary/25 px-3.5 py-2.5">
        <p className="text-[11px] font-medium text-white">
          Vamos por partes: primeiro identifique o Δ… ✨
        </p>
      </div>
      <div className="flex items-center gap-1.5 pl-1 pt-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/70 motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
        <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
          Aurora digitando…
        </span>
      </div>
    </div>
  );
}

function SimuladosDemo(): ReactElement {
  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-md border text-center transition-colors duration-500 ${
              i < 7
                ? "bg-primary/20 border-primary/40 group-hover:bg-primary group-[.is-active]:bg-primary group-hover:border-primary group-[.is-active]:border-primary"
                : "bg-white/[0.04] border-white/10"
            }`}
            style={{ transitionDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500">
        <Timer className="h-3 w-3 text-primary" /> 3,5 min por questão · padrão ENEM
      </div>
    </div>
  );
}

function TrilhasDemo(): ReactElement {
  const steps: readonly string[] = ["Base", "Avanço", "Revisão", "Prova"];
  return (
    <div className="flex items-center">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 rounded-full border-2 border-primary/40 bg-primary/15 transition-all duration-500 group-hover:bg-primary group-[.is-active]:bg-primary group-hover:border-primary group-[.is-active]:border-primary group-hover:shadow-[0_0_12px_rgba(76,204,237,0.7)] group-[.is-active]:shadow-[0_0_12px_rgba(76,204,237,0.7)]"
              style={{ transitionDelay: `${i * 120}ms` }}
            />
            <span className="text-[8px] font-black uppercase tracking-wider text-gray-500">
              {step}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span className="mx-1 mb-4 h-px flex-1 bg-white/10 relative overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 w-full bg-primary origin-left scale-x-0 group-hover:scale-x-100 group-[.is-active]:scale-x-100 transition-transform duration-500"
                style={{ transitionDelay: `${i * 120 + 60}ms` }}
              />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DesempenhoDemo(): ReactElement {
  const bars: readonly number[] = [45, 62, 55, 78, 92];
  return (
    <div className="flex h-16 items-end gap-2">
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-lg bg-gradient-to-t from-primary/40 to-primary origin-bottom scale-y-[0.45] group-hover:scale-y-100 group-[.is-active]:scale-y-100 transition-transform duration-700 ease-out"
          style={{ height: `${height}%`, transitionDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function GamificacaoDemo(): ReactElement {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/25 text-amber-400 transition-transform duration-700 group-hover:rotate-[360deg] group-[.is-active]:rotate-[360deg] group-hover:scale-110 group-[.is-active]:scale-110">
        <Trophy className="h-6 w-6" />
      </span>
      <div>
        <div className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-primary motion-safe:group-hover:animate-pulse motion-safe:group-[.is-active]:animate-pulse" />
          <span className="text-lg font-black text-white leading-none">12 dias</span>
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">
          Streak · Top 5 do ranking
        </p>
      </div>
    </div>
  );
}

function GraphDemo(): ReactElement {
  const nodes: readonly { cx: number; cy: number; r: number }[] = [
    { cx: 40, cy: 40, r: 7 },
    { cx: 120, cy: 18, r: 5 },
    { cx: 150, cy: 58, r: 6 },
    { cx: 230, cy: 30, r: 5 },
    { cx: 265, cy: 62, r: 4 },
  ];
  return (
    <svg viewBox="0 0 300 80" className="w-full h-16" aria-hidden="true">
      <g stroke="rgba(76,204,237,0.3)" strokeWidth="1.5" className="transition-all duration-500 group-hover:stroke-[rgba(76,204,237,0.7)] group-[.is-active]:stroke-[rgba(76,204,237,0.7)]">
        <line x1="40" y1="40" x2="120" y2="18" />
        <line x1="40" y1="40" x2="150" y2="58" />
        <line x1="120" y1="18" x2="230" y2="30" />
        <line x1="150" y1="58" x2="230" y2="30" />
        <line x1="230" y1="30" x2="265" y2="62" />
      </g>
      {nodes.map((node, i) => (
        <circle
          key={i}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          className="fill-primary/50 transition-all duration-500 group-hover:fill-primary group-[.is-active]:fill-primary"
          style={{ transitionDelay: `${i * 100}ms` }}
        />
      ))}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────── */

/**
 * Bento Grid da vitrine: 7 cards assimétricos com spotlight no hover e
 * entrada em cascata dirigida por scroll (whileInView + stagger).
 */
export function FeatureBentoGrid(): ReactElement {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="funcionalidades"
      className="relative overflow-hidden bg-gray-950 py-24 scroll-mt-20 border-t border-white/5"
    >
      <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none hidden md:block" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px] bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
            <LayoutDashboard className="h-4 w-4" /> O que seus alunos recebem
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter leading-tight italic">
            Um ecossistema completo
          </h2>
          <p className="text-gray-400 font-medium leading-relaxed">
            Tudo isso já pronto, com a marca da sua instituição — sem precisar construir ou
            manter nada.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial={reduceMotion ? "visible" : "hidden"}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:auto-rows-fr"
        >
          <BentoCard
            icon={LayoutDashboard}
            tagline="Central"
            title="Portal do Aluno"
            description="Seu QG de estudos: simulados, redações, flashcards, metas e boletim — tudo protegido por login e organizado por perfil."
            className="md:col-span-2 lg:row-span-2"
          >
            <PortalDemo />
          </BentoCard>

          <BentoCard
            icon={Bot}
            tagline="IA 24/7"
            title="Aurora IA"
            description="Tire dúvidas a qualquer hora e receba correção de redação com nota e feedback na hora."
            className="lg:row-span-2"
          >
            <AuroraDemo />
          </BentoCard>

          <BentoCard
            icon={Timer}
            tagline="Treino real"
            title="Simulados ENEM/ETEC"
            description="Provas oficiais com navegação por grade, cronômetro e revisão."
          >
            <SimuladosDemo />
          </BentoCard>

          <BentoCard
            icon={Route}
            tagline="Fluxos de curso"
            title="Trilhas de Aprendizagem"
            description="Jornadas guiadas por objetivo, do nivelamento à véspera da prova."
          >
            <TrilhasDemo />
          </BentoCard>

          <BentoCard
            icon={BarChart3}
            tagline="Dados"
            title="Desempenho & Analytics"
            description="Dashboards que mostram sua evolução por matéria e seus erros recorrentes."
          >
            <DesempenhoDemo />
          </BentoCard>

          <BentoCard
            icon={Trophy}
            tagline="Motivação"
            title="Gamificação & Ranking"
            description="Badges, streaks de estudo e ranking semanal para manter o ritmo."
          >
            <GamificacaoDemo />
          </BentoCard>

          <BentoCard
            icon={Network}
            tagline="Conhecimento"
            title="Caderno Inteligente + Graph View"
            description="Notas em blocos com wikilinks e um grafo que conecta tudo o que você aprende."
            className="md:col-span-2"
          >
            <GraphDemo />
          </BentoCard>
        </motion.div>
      </div>
    </section>
  );
}
