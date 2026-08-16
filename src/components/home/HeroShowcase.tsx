"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Award,
  Bot,
  Palette,
  Play,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { DEMO_WHATSAPP_URL } from "@/lib/site-contact";

const DynamicDashboardMockup = dynamic(
  () => import("@/components/home/DashboardMockup").then((mod) => mod.DashboardMockup),
  { ssr: false }
);

interface HeroStat {
  value: string;
  label: string;
  icon: LucideIcon;
}

const HERO_STATS: readonly HeroStat[] = [
  { value: "100%", label: "Sua marca, seu domínio", icon: Palette },
  { value: "24/7", label: "Mentoria com IA", icon: Bot },
  { value: "Multi", label: "Turmas e unidades", icon: Users },
  { value: "LGPD", label: "Dado isolado por escola", icon: ShieldCheck },
];

export interface HeroShowcaseProps {
  /** Navega para uma rota interna (ex.: /login) exibindo o overlay de transição. */
  onNavigate: (path: string) => void;
  /** Rola suavemente até uma âncora da página (ex.: #funcionalidades). */
  onScrollTo: (anchorId: string) => void;
}

/**
 * Hero da vitrine: texto renderizado estático (CSS-first, protege o LCP) e
 * mockup 3D do dashboard carregado sob demanda apenas em telas grandes.
 */
export function HeroShowcase({ onNavigate, onScrollTo }: HeroShowcaseProps): ReactElement {
  return (
    <section
      id="home"
      className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-gray-950 pt-20 md:pt-0"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black pointer-events-none" />
      <div className="absolute inset-0 dot-grid opacity-70 pointer-events-none" />
      <div className="absolute inset-0 noise pointer-events-none" />

      {/* Efeitos de luz */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 hidden md:block">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center relative z-10 w-full pt-6 md:pt-10">
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-left duration-1000">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary font-black px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] rounded-full">
            <Award className="h-3 w-3" /> Plataforma White-Label para Escolas
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tighter">
            A plataforma da<br />
            <span className="text-gradient-brand italic">sua instituição.</span>
          </h1>

          <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-md">
            Gestão pedagógica, simulados, redação corrigida por IA, trilhas de estudo e
            gamificação — com{" "}
            <strong className="text-white">sua marca, suas cores</strong> e{" "}
            <strong className="text-white hover:text-primary transition-colors">
              dados isolados por instituição
            </strong>
            . Leve sua escola pro digital sem construir nada do zero.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              asChild
              className="btn-shimmer h-11 px-8 bg-primary hover:bg-[#0f7a95] text-white font-black text-sm rounded-full glow-orange-strong border-none transition-[transform,box-shadow] active:scale-95 group"
            >
              <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                Falar com a gente{" "}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 px-8 bg-transparent text-white font-black text-sm rounded-full border border-white/20 hover:bg-white/5 transition-all"
            >
              <a
                href="#funcionalidades"
                onClick={(e) => {
                  e.preventDefault();
                  onScrollTo("#funcionalidades");
                }}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4 text-primary fill-primary" /> Ver funcionalidades
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/5">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="group">
                <p className="text-2xl font-black text-white leading-none group-hover:text-primary transition-colors">
                  {stat.value}
                </p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mockup 3D do dashboard — desktop only */}
        <div className="relative hidden lg:block h-[62vh] max-h-[520px] min-h-[420px]">
          <DynamicDashboardMockup />
        </div>
      </div>
    </section>
  );
}
