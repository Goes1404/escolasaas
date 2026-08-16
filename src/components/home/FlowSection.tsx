"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import {
  BarChart3,
  Palette,
  Rocket,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef } from "react";
import type { ReactElement } from "react";

interface FlowStep {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
}

const FLOW_STEPS: readonly FlowStep[] = [
  {
    icon: ShieldCheck,
    step: "01",
    title: "Conversa inicial",
    description:
      "Entendemos o tamanho da sua instituição, quantas turmas e quais módulos fazem sentido pra você — sem contrato genérico.",
  },
  {
    icon: Palette,
    step: "02",
    title: "Sua marca, seu domínio",
    description:
      "Configuramos logo, cores e nome da sua instituição na plataforma. Cada escola tem seu próprio ambiente, isolado das demais.",
  },
  {
    icon: Upload,
    step: "03",
    title: "Importação de alunos e turmas",
    description:
      "Trazemos sua base de alunos e professores pra dentro da plataforma — sem trabalho manual de cadastro um por um.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Uso do dia a dia",
    description:
      "Simulados, redação corrigida por IA, trilhas de estudo e dashboards de desempenho — tudo já funcionando pros seus alunos.",
  },
  {
    icon: Rocket,
    step: "05",
    title: "Acompanhamento contínuo",
    description:
      "Suporte e evolução da plataforma junto com sua instituição — novos módulos, novos ciclos letivos, sem dor de cabeça técnica.",
  },
];

/**
 * Linha do tempo scroll-driven do fluxo do aluno: a barra de progresso
 * cresce conforme o usuário rola e cada etapa revela em cascata.
 */
export function FlowSection(): ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 75%", "end 55%"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });

  return (
    <section
      id="metodologia"
      className="relative overflow-hidden bg-white py-24 scroll-mt-20 border-t border-gray-100"
    >
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-primary/5 blur-[100px] rounded-full pointer-events-none hidden md:block" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-blue-500/5 blur-[80px] rounded-full pointer-events-none hidden md:block" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px] bg-primary/5 px-4 py-1.5 rounded-full border border-primary/20">
            <Rocket className="h-4 w-4" /> Como funciona
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter leading-tight italic">
            Do primeiro contato ao ar
          </h2>
          <p className="text-gray-500 font-medium leading-relaxed">
            O caminho completo pra colocar sua instituição na plataforma — sem precisar de
            equipe técnica própria.
          </p>
        </div>

        <div ref={trackRef} className="relative">
          {/* Trilho + progresso scroll-driven */}
          <div className="absolute left-6 md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-px bg-gray-200">
            <motion.div
              className="absolute inset-x-0 top-0 origin-top bg-gradient-to-b from-primary to-amber-400 shadow-[0_0_12px_rgba(76,204,237,0.5)]"
              style={{ scaleY: reduceMotion ? 1 : progress, height: "100%" }}
            />
          </div>

          <div className="space-y-12 md:space-y-16">
            {FLOW_STEPS.map((item, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={item.step}
                  initial={reduceMotion ? false : { opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className={`relative flex md:w-1/2 pl-16 md:pl-0 ${
                    isLeft ? "md:pr-14 md:text-right" : "md:ml-auto md:pl-14"
                  }`}
                >
                  {/* Nó na linha */}
                  <span
                    className={`absolute top-1 left-6 md:left-auto -translate-x-1/2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-primary/25 text-primary shadow-lg shadow-primary/10 ${
                      isLeft ? "md:right-0 md:translate-x-1/2" : "md:left-0 md:-translate-x-1/2"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">
                      Etapa {item.step}
                    </span>
                    <h3 className="text-2xl font-black italic tracking-tighter text-gray-900">
                      {item.title}
                    </h3>
                    <p className="text-sm font-medium leading-relaxed text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
