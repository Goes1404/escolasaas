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
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
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
      {/* ── Outer glow ring ── */}
      <div className="border-prism rounded-card">
        <div className="glass-login rounded-card p-8 md:p-10 relative overflow-hidden">

          {/* Inner shimmer top */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400/40 to-transparent pointer-events-none" />

          {/* Subtle inner orb */}
          <div
            className="absolute top-[-40px] right-[-40px] w-[180px] h-[180px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(76,204,237,0.12) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />

          {/* ── Logo ── */}
          <div className="flex justify-center mb-6">
            <div className="relative w-44 h-14">
              <Image src={logoUrl} alt="Logo" fill unoptimized priority className="object-contain drop-shadow-[0_0_12px_rgba(76,204,237,0.5)]" />
            </div>
          </div>

          {/* ── Heading (contém o H1 = elemento LCP; sem fade pra pintar já) ── */}
          <div className="text-center mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full mb-1">
              <Sparkles className="h-3 w-3 text-orange-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-400">Plataforma Educacional</span>
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter text-white leading-tight">
              Portal do <span className="text-gradient-fire">Aluno</span>
            </h1>
            <p className="text-xs text-white/40 font-semibold">
              Acesse sua jornada de alto desempenho.
            </p>
          </div>

          {/* ── Form ── */}
          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 ml-1">
                E-mail de Acesso
              </label>
              <div className={`relative transition-all duration-200 ${focused === 'email' ? 'drop-shadow-[0_0_8px_rgba(76,204,237,0.25)]' : ''}`}>
                <input
                  id="email"
                  type="email"
                  placeholder="seu.nome@compromisso.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  className="input-dark w-full h-12 rounded-xl px-4 text-sm font-semibold"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 ml-1">
                Senha
              </label>
              <div className={`relative transition-all duration-200 ${focused === 'password' ? 'drop-shadow-[0_0_8px_rgba(76,204,237,0.25)]' : ''}`}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  className="input-dark w-full h-12 rounded-xl px-4 pr-12 text-sm font-semibold"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-orange-400 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Sessão expirada — informativo, não é erro do aluno */}
            {aviso && !authError && (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300">
                <ShieldCheck className="h-4 w-4 text-amber-300 shrink-0" />
                <p className="text-amber-200 text-xs font-bold">{aviso}</p>
              </div>
            )}

            {/* Error */}
            {authError && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/25 p-3.5 rounded-xl animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-300">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-xs font-bold">{authError}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-orange-neon w-full h-14 rounded-xl text-white font-black text-sm uppercase tracking-wider italic mt-2 transition-transform active:scale-[0.975] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Autenticando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar no Portal
                  <span className="text-white/60">→</span>
                </span>
              )}
            </button>

            {/* Esqueci minha senha */}
            <div className="text-center pt-1">
              <Link
                href="/forgot-password"
                className="text-[11px] font-bold text-white/40 hover:text-orange-400 transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          {/* ── Trust badge ── */}
          <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-white/20" />
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
              Acesso seguro · Dados criptografados
            </span>
          </div>

          {/* Bottom shimmer line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400/20 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
