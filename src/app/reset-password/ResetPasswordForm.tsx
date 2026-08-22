
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isLongEnough = password.length >= 8;
  const allMet = hasUpperCase && hasNumber && hasSpecial && isLongEnough;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    let failTimer: ReturnType<typeof setTimeout>;

    // Tenta sessão existente primeiro (caso o token já tenha sido processado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthChecked(true);
        return;
      }
      // Supabase processa o hash da URL de forma assíncrona via onAuthStateChange.
      // Se em 6s nenhum evento PASSWORD_RECOVERY chegar, o link é inválido/expirado.
      failTimer = setTimeout(() => setAuthFailed(true), 6000);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        clearTimeout(failTimer);
        setAuthChecked(true);
        setAuthFailed(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(failTimer);
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (!allMet) {
      toast({ title: "A senha não atende aos requisitos", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Promise.race garante que a chamada nunca trave indefinidamente
      // (ex.: service worker antigo interceptando o fetch ou rede lenta),
      // o que deixava a tela "salvando" para sempre.
      // `must_change_password: false` junto com a senha: o aluno acabou de
      // escolher uma senha nova aqui, então forçá-lo à tela de primeiro acesso
      // logo em seguida seria pedir a mesma coisa duas vezes. Antes isso não
      // aparecia porque a tela de primeiro acesso era inalcançável.
      const { error } = await Promise.race([
        supabase.auth.updateUser({
          password,
          data: { must_change_password: false },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Tempo esgotado. Verifique sua conexão e tente novamente.")),
            12_000
          )
        ),
      ]);
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push("/login?message=password-reset-success"), 2500);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar senha", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ── Estado: validando token ── */
  if (!authChecked && !authFailed) {
    return (
      <div className="flex flex-col items-center gap-8 text-center animate-in fade-in duration-500">
        <div className="relative">
          <div className="h-24 w-24 rounded-card bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl">
            <KeyRound className="h-12 w-12 text-accent" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent animate-ping" />
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent" />
        </div>
        <div className="space-y-2">
          <p className="text-white font-black text-xl italic uppercase tracking-widest">
            Validando Acesso Seguro
          </p>
          <p className="text-white/30 text-xs font-bold tracking-wider">
            Autenticando token de segurança...
          </p>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Estado: link inválido/expirado ── */
  if (authFailed) {
    return (
      <div className="w-full max-w-sm space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="h-24 w-24 rounded-card bg-red-500/10 border border-red-400/20 flex items-center justify-center mx-auto shadow-2xl">
          <XCircle className="h-12 w-12 text-red-400" />
        </div>
        <div className="space-y-3">
          <p className="text-white font-black text-3xl italic uppercase tracking-tight">
            Link Expirado
          </p>
          <p className="text-white/40 text-sm font-medium leading-relaxed max-w-xs mx-auto">
            Este link já foi utilizado ou o prazo de 1 hora expirou. Solicite um novo link ao administrador.
          </p>
        </div>
        <Button
          onClick={() => router.push("/login")}
          className="bg-white/10 text-white border border-white/10 hover:bg-white/15 rounded-2xl h-12 px-10 font-black uppercase tracking-widest text-xs backdrop-blur-md transition-all"
        >
          Voltar ao Login
        </Button>
      </div>
    );
  }

  /* ── Estado: senha atualizada ── */
  if (success) {
    return (
      <div className="w-full max-w-sm space-y-8 text-center animate-in zoom-in duration-500">
        <div className="h-24 w-24 rounded-card bg-green-500/15 border border-green-400/25 flex items-center justify-center mx-auto shadow-2xl">
          <CheckCircle2 className="h-12 w-12 text-green-400" />
        </div>
        <div className="space-y-2">
          <p className="text-white font-black text-3xl italic uppercase">Senha Atualizada!</p>
          <p className="text-white/40 text-sm font-medium">Redirecionando para o login...</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-accent mx-auto" />
      </div>
    );
  }

  /* ── Estado: formulário ── */
  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="relative mx-auto w-fit">
          <div className="h-20 w-20 rounded-[1.75rem] bg-white/8 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-2xl">
            <Lock className="h-10 w-10 text-accent" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
            <ShieldCheck className="h-3 w-3 text-accent" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tight leading-none">
            Nova Senha
          </h1>
          <p className="text-white/35 text-sm font-bold mt-2 tracking-wide">
            Crie uma credencial forte para sua conta
          </p>
        </div>
      </div>

      {/* Card do formulário */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-card p-8 space-y-6 shadow-2xl">
        <form onSubmit={handleReset} className="space-y-5">
          {/* Campo senha */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/35 px-1">
              Nova Senha
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl font-bold pr-12 focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent/40"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Campo confirmação */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/35 px-1">
              Confirmar Senha
            </label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl font-bold focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent/40 transition-colors ${
                confirmPassword.length > 0
                  ? passwordsMatch
                    ? "border-green-500/30"
                    : "border-red-400/30"
                  : ""
              }`}
              required
            />
          </div>

          {/* Requisitos de segurança */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "8+ caracteres", check: isLongEnough },
              { label: "Maiúscula (A-Z)", check: hasUpperCase },
              { label: "Número (0-9)", check: hasNumber },
              { label: "Símbolo (!@#...)", check: hasSpecial },
            ].map((req) => (
              <div
                key={req.label}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                  req.check
                    ? "bg-green-500/10 border-green-500/25"
                    : "bg-white/3 border-white/8"
                }`}
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 transition-colors duration-300 ${
                    req.check ? "text-green-400" : "text-white/15"
                  }`}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-wide transition-colors duration-300 ${
                    req.check ? "text-green-300" : "text-white/25"
                  }`}
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>

          {/* Botão */}
          <Button
            type="submit"
            disabled={loading || !allMet || !passwordsMatch}
            className="w-full h-14 bg-accent text-accent-foreground font-black rounded-2xl shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-[transform,box-shadow] uppercase tracking-widest text-xs border-none disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                Gravar Nova Senha <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      </div>

      <p className="text-center text-white/15 text-[10px] font-black uppercase tracking-widest">
        Plataforma · Acesso Seguro · {new Date().getFullYear()}
      </p>
    </div>
  );
}
