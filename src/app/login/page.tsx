import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden aurora-login grain">

      {/* ── Dot grid overlay ── */}
      <div className="absolute inset-0 dot-grid opacity-25 pointer-events-none" />

      {/* ── Animated orbs ── */}
      <div
        className="absolute top-[-15%] right-[-8%] w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,100,0,0.22) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float-y 9s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,60,0,0.16) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "float-y 12s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute top-[40%] left-[35%] w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,160,0,0.10) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "float-y 7s ease-in-out infinite 2s",
        }}
      />

      {/* ── Back button ── */}
      <div className="absolute top-5 left-5 z-20">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white/80 transition-colors bg-white/5 hover:bg-white/10 border border-white/8 px-4 py-2 rounded-full backdrop-blur-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Voltar
        </Link>
      </div>

      {/* ── Center content ── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-16">
        {/* Suspense por causa do `useSearchParams` no formulário: sem ele, o
            Next arrasta esta rota estática inteira para renderização no
            cliente, e a tela de login é a primeira coisa que o aluno carrega. */}
        <Suspense fallback={<div className="h-[420px]" />}>
          <LoginForm />
        </Suspense>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-4 text-center">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
          © 2026 Plataforma EAD
        </p>
        <div className="flex items-center justify-center gap-4 mt-1.5">
          <Link href="#" className="text-[9px] text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest">Privacidade</Link>
          <span className="text-white/15">·</span>
          <Link href="#" className="text-[9px] text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest">Acessibilidade</Link>
        </div>
      </footer>
    </div>
  );
}
