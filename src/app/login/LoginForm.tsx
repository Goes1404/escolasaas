'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, AlertCircle, Sparkles, ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/app/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { useTenant } from "@/components/TenantProvider";

export function LoginForm() {
  const { tenant } = useTenant();
  const logoUrl = tenant.branding.logoUrl;

  // O placeholder trazia `seu.nome@compromisso.com` fixo no código: numa
  // plataforma white-label, a segunda escola veria o domínio de outra no
  // próprio campo de login.
  //
  // Também não dá para derivá-lo de `contactEmail` — o e-mail de SUPORTE da
  // escola não é o domínio de LOGIN dos alunos, e mostrar um domínio errado é
  // pior do que não mostrar nenhum. Quem não sabe o próprio e-mail tem a tela
  // de primeiro acesso, que existe exatamente para isso.
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [aviso, setAviso]       = useState<string | null>(null);
  const params = useSearchParams();

  // O middleware manda `?sessao=expirada` quando encontra um cookie de sessão
  // que não vale mais. Sem esta mensagem, o aluno é devolvido ao login sem
  // explicação e conclui que errou a senha — foram 20 ocorrências em produção
  // entre junho e agosto.
  useEffect(() => {
    if (params?.get('sessao') === 'expirada') {
      setAviso('Sua sessão expirou por inatividade. Entre novamente para continuar.');
    }
  }, [params]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!isSupabaseConfigured) {
      setAuthError("Conexão com banco de dados não configurada.");
      return;
    }
    if (!email || !password) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) {
        setLoading(false);
        setAuthError("E-mail ou senha inválidos. Tente novamente.");
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setLoading(false);
      setAuthError("Falha crítica na autenticação. Tente novamente.");
    }
  };

  return (
    // Entrada só por transform (slide/zoom) — SEM fade de opacity: o H1 é o
    // elemento LCP e um fade a partir de opacity:0 adia o LCP até o fim da
    // animação (~720ms). Transform é compositor-only e não atrasa o LCP.
    <div className="w-full max-w-[420px] animate-in slide-in-from-bottom-4 zoom-in-95 duration-500 ease-out">
      {/* O card era vidro: `backdrop-filter: blur(28px) saturate(160%)` sobre
          uma superfície de 420px, mais uma borda-prisma em gradiente. Blur de
          fundo é dos efeitos mais caros que existem, e esta é a primeira tela
          que o aparelho do aluno pinta. Agora é superfície sólida com a borda
          e a sombra do sistema. */}
      <div className="rounded-card border-2 border-white/15 bg-[#0d0d12] p-8 md:p-10 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-[0.06] pointer-events-none" />

          {/* ── Logo ── */}
          <div className="relative flex justify-center mb-6">
            <div className="relative w-32 h-14">
              <Image src={logoUrl} alt="Logo" fill unoptimized priority className="object-contain" />
            </div>
          </div>

          {/* ── Heading (contém o H1 = elemento LCP; sem fade pra pintar já) ── */}
          {/* Dizia "Portal do Aluno", mas professor, secretaria e admin entram
              por aqui também — três dos cinco papéis liam um título que não era
              deles e ficavam em dúvida se estavam na tela certa. */}
          <div className="relative text-center mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 border-2 border-white/20 px-3 py-1 rounded-control mb-1">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="u-label !text-white/70">{tenant.branding.appName}</span>
            </div>
            <h1 className="u-page-title text-2xl text-white leading-[1.2]">
              Entrar na <span className="text-accent">plataforma</span>
            </h1>
            <p className="text-xs text-white/40 font-semibold">
              Alunos, professores e equipe usam o mesmo acesso.
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleLogin} className="relative space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="u-label !text-white/40 ml-1">
                E-mail de acesso
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder="seu e-mail de acesso"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 rounded-control border-2 border-white/20 bg-white/[0.04] px-4 text-sm font-semibold text-white placeholder:text-white/30 outline-none transition-colors focus:border-primary"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="u-label !text-white/40 ml-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-control border-2 border-white/20 bg-white/[0.04] px-4 pr-12 text-sm font-semibold text-white placeholder:text-white/30 outline-none transition-colors focus:border-primary"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-primary transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Sessão expirada — informativo, não é erro do aluno */}
            {aviso && !authError && (
              <div className="flex items-center gap-3 border-2 border-accent/40 bg-accent/10 p-3.5 rounded-control animate-in fade-in slide-in-from-top-1 duration-300">
                <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
                <p className="text-accent text-xs font-bold">{aviso}</p>
              </div>
            )}

            {/* Error */}
            {authError && (
              <div className="flex items-center gap-3 border-2 border-red-500/50 bg-red-500/10 p-3.5 rounded-control animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-300">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-xs font-bold">{authError}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-control bg-primary text-primary-foreground border-2 border-primary-foreground/80 shadow-hard-accent font-black text-sm uppercase tracking-wider mt-2 transition-all active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Autenticando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar
                  <span className="opacity-60">→</span>
                </span>
              )}
            </button>

            {/* Esqueci minha senha */}
            <div className="text-center pt-1">
              <Link
                href="/forgot-password"
                className="text-[11px] font-bold text-white/50 hover:text-primary transition-colors underline underline-offset-4 decoration-white/20"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          {/* ── Trust badge ── */}
          <div className="relative mt-8 pt-5 border-t-2 border-white/10 flex items-center justify-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-white/35 shrink-0" />
            <span className="u-label !text-[8px] !tracking-[0.16em] !text-white/35 whitespace-nowrap">
              Acesso seguro · dados criptografados
            </span>
          </div>
      </div>
    </div>
  );
}
