"use client";

import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { DEMO_WHATSAPP_URL } from "@/lib/site-contact";

export interface FluidAccessSectionProps {
  /** Navega para uma rota interna (ex.: /login) exibindo o overlay de transição. */
  onNavigate: (path: string) => void;
}

/**
 * Seção de acesso fluido: painel de vidro com CTA de contato pra escolas que
 * ainda não são clientes, mais os atalhos reais pra quem já é (login,
 * primeiro acesso, recuperação de senha).
 */
export function FluidAccessSection({ onNavigate }: FluidAccessSectionProps): ReactElement {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gray-950 py-24 border-t border-white/5">
      <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-0 noise pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/15 blur-[120px] rounded-full pointer-events-none hidden md:block" />

      <div className="relative z-10 max-w-3xl mx-auto px-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="gradient-border relative rounded-[2.5rem] bg-white/[0.04] backdrop-blur-2xl p-8 md:p-12 shadow-2xl noise"
        >
          <div className="text-center space-y-4 mb-8">
            <div className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px] bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" /> Pronto pra começar?
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter italic leading-tight">
              Vamos conhecer sua escola
            </h2>
            <p className="text-sm text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
              Fale com a gente e veja em poucos minutos como a plataforma fica com a cara da
              sua instituição.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              asChild
              className="btn-shimmer h-14 px-10 bg-primary hover:bg-[#0f7a95] text-white font-black text-sm rounded-full glow-orange-strong border-none transition-[transform,box-shadow] active:scale-95 group"
            >
              <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                Falar com a gente
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-center">
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Já é cliente?</span>
            <button
              onClick={() => onNavigate("/login")}
              className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" /> Entrar na plataforma
            </button>
            <Link
              href="/primeiro-acesso"
              className="text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors"
            >
              Primeiro acesso
            </Link>
            <Link
              href="/forgot-password"
              className="text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors"
            >
              Esqueci minha senha
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
