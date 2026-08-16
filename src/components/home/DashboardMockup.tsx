"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  BarChart3,
  BookOpen,
  Flame,
  Home,
  MessageCircle,
  PenTool,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent, ReactElement } from "react";

interface SidebarItem {
  icon: LucideIcon;
  active: boolean;
}

const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { icon: Home, active: true },
  { icon: BookOpen, active: false },
  { icon: PenTool, active: false },
  { icon: BarChart3, active: false },
  { icon: Trophy, active: false },
];

const SUBJECT_BARS: readonly { label: string; pct: number }[] = [
  { label: "Matemática", pct: 82 },
  { label: "Linguagens", pct: 91 },
  { label: "C. Natureza", pct: 68 },
];

/**
 * Réplica estilizada (HTML/CSS puro) do dashboard do aluno, flutuando em 3D.
 * Reage ao mouse com tilt suave e respeita prefers-reduced-motion.
 */
export function DashboardMockup(): ReactElement {
  const reduceMotion = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), {
    stiffness: 140,
    damping: 18,
  });

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = (): void => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      className="relative h-full w-full [perspective:1400px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-full w-full"
      >
        {/* Janela principal */}
        <div className="gradient-border relative h-full w-full rounded-[2rem] bg-gray-900/70 backdrop-blur-2xl shadow-[0_0_80px_-15px_rgba(76,204,237,0.45)] overflow-hidden noise">
          {/* Barra da janela */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            <span className="ml-3 text-[9px] font-black uppercase tracking-[0.25em] text-gray-500">
              Portal do Aluno
            </span>
          </div>

          <div className="flex h-full">
            {/* Sidebar */}
            <div className="flex flex-col items-center gap-4 border-r border-white/5 px-3 py-5">
              {SIDEBAR_ITEMS.map((item, i) => (
                <span
                  key={i}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    item.active
                      ? "bg-primary text-white shadow-[0_0_18px_rgba(76,204,237,0.5)]"
                      : "bg-white/5 text-gray-500"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
              ))}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white tracking-tight">
                    Bom dia, Aluno! 👋
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">
                    Rumo à aprovação
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-1.5">
                  <Flame className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black text-primary">12 dias</span>
                </div>
              </div>

              {/* Gráfico de evolução */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Evolução nos Simulados
                </p>
                <svg viewBox="0 0 288 72" className="w-full h-16" aria-hidden="true">
                  <defs>
                    <linearGradient id="mockup-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(76,204,237,0.35)" />
                      <stop offset="100%" stopColor="rgba(76,204,237,0)" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="0,64 32,58 64,60 96,48 128,52 160,38 192,40 224,26 256,30 288,16 288,72 0,72"
                    fill="url(#mockup-area)"
                  />
                  <motion.polyline
                    points="0,64 32,58 64,60 96,48 128,52 160,38 192,40 224,26 256,30 288,16"
                    fill="none"
                    stroke="#4CCCED"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.6, delay: 0.5, ease: "easeInOut" }}
                  />
                  <motion.circle
                    cx="288"
                    cy="16"
                    r="4"
                    fill="#4CCCED"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 2, type: "spring" }}
                  />
                </svg>
              </div>

              {/* Barras por matéria */}
              <div className="space-y-2.5">
                {SUBJECT_BARS.map((bar, i) => (
                  <div key={bar.label} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      {bar.label}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.pct}%` }}
                        transition={{ duration: 1, delay: 0.8 + i * 0.2, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-[9px] font-black text-white">{bar.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chip flutuante: Aurora IA */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1, duration: 0.7 }}
          style={{ transform: "translateZ(50px)" }}
          className="absolute -right-4 top-16 animate-float rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-3 shadow-2xl"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gradient-brand">
                Aurora IA
              </p>
              <p className="text-[10px] font-bold text-white/90">Dúvida resolvida ✓</p>
            </div>
          </div>
        </motion.div>

        {/* Chip flutuante: Redação */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4, duration: 0.7 }}
          style={{ transform: "translateZ(40px)" }}
          className="absolute -left-5 bottom-14 animate-float [animation-delay:1.5s] rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-3 shadow-2xl"
        >
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
            Redação corrigida
          </p>
          <p className="text-lg font-black text-white leading-none mt-0.5">
            920 <span className="text-[10px] text-green-400">▲ +80</span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
