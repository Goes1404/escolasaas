import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] grain">

      {/* ── Fundo ──
          Rodavam aqui três orbes laranja de 260 a 480px, cada uma com blur de
          50 a 80px e `float-y` em loop infinito. Laranja não existe na paleta,
          e três elementos borrados desse tamanho animando ao mesmo tempo são
          caros justamente no aparelho mais fraco que abre esta tela.
          No lugar entram formas chapadas da paleta, paradas — a mesma
          linguagem da landing. */}
      <div className="absolute inset-0 dot-grid opacity-25 pointer-events-none" />
      <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/15 pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-brand-pink/10 pointer-events-none" />

      {/* ── Voltar ── */}
      <div className="absolute top-5 left-5 z-20">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 u-label !text-white/50 hover:!text-white border-2 border-white/15 hover:border-white/40 px-3 py-2 rounded-control transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Voltar
        </Link>
      </div>

      {/* ── Conteúdo ── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-16">
        {/* Suspense por causa do `useSearchParams` no formulário: sem ele, o
            Next arrasta esta rota estática inteira para renderização no
            cliente, e a tela de login é a primeira coisa que o aluno carrega. */}
        <Suspense fallback={<div className="h-[420px]" />}>
          <LoginForm />
        </Suspense>
      </div>

      {/* ── Rodapé ── */}
      <footer className="relative z-10 border-t-2 border-white/10 py-4 text-center">
        <p className="u-label !text-white/30">© 2026 Dalí</p>
      </footer>
    </div>
  );
}
