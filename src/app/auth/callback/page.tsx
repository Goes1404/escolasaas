
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      const code = searchParams.get("code");
      // Segurança: só permitimos redirecionar para caminhos internos (mesma origem).
      // Bloqueia open-redirect via ?next=//site-malicioso.com ou ?next=https://...
      const rawNext = searchParams.get("next") ?? "/dashboard";
      const next =
        rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
          ? rawNext
          : "/dashboard";

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          router.push(next);
        } catch (err: any) {
          console.error("[AUTH_CALLBACK_CLIENT_ERROR]", err);
          setError(err.message || "Falha na troca de código de autenticação.");
          setTimeout(() => router.push("/login?error=auth-callback-failed"), 3000);
        }
      } else {
        const hash = window.location.hash;
        if (hash) {
            setTimeout(() => router.push(next), 1000);
        } else {
            router.push("/login");
        }
      }
    }

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-10 text-center gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full scale-150 animate-pulse" />
        <Loader2 className="h-16 w-16 text-accent animate-spin relative z-10" />
      </div>
      
      <div className="space-y-4 relative z-10 max-w-sm">
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
            {error ? "Ops! Algo deu errado" : "Validando seu acesso"}
        </h2>
        <p className="text-white/60 text-xs font-bold uppercase tracking-widest leading-relaxed italic">
            {error ? error : "Estamos confirmando sua identidade em nossa base de inteligência. Em instantes você poderá continuar."}
        </p>
      </div>
    </div>
  );
}
