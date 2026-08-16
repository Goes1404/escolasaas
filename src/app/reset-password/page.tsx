
import ResetPasswordForm from "./ResetPasswordForm";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Redefinir Senha | Plataforma",
  description: "Crie sua nova senha de acesso à plataforma.",
};

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-login-gradient flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4 bg-white/10 backdrop-blur-md p-10 rounded-3xl border border-white/20">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <p className="text-[10px] font-black uppercase text-white/50 tracking-widest animate-pulse">
            Carregando Formulário Seguro...
          </p>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
