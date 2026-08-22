"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertOctagon, X, Shield } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { trackFalha } from '@/lib/telemetry';
import { useAuth } from "@/lib/AuthProvider";

export function UrgentNotice() {
  const { user, profile } = useAuth();
  const [notice, setNotice] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback((id: string) => {
    setVisible(false);
    setTimeout(() => {
      setNotice(null);
      localStorage.setItem(`seen_urgent_${id}`, "true");
    }, 300);
  }, []);

  useEffect(() => {
    if (!user) return;

    async function fetchUrgent() {
      try {
        let query = supabase
          .from("announcements")
          .select("*")
          .eq("priority", "high")
          // Comunicados só para responsáveis não aparecem no mural do aluno.
          .neq("audience", "guardians")
          .order("created_at", { ascending: false })
          .limit(1);

        if (profile) {
          // Sanitiza: vírgula/parênteses/asterisco são caracteres de controle
          // do PostgREST e valores vazios não devem virar condição.
          const audience = (profile.exam_target || "").toLowerCase().trim();
          const targets = ["all", profile.profile_type, audience, profile.class_id]
            .filter(Boolean)
            .map((t) => `target_group.eq.${String(t).replace(/[(),*]/g, "")}`);
          query = query.or(targets.join(","));
        }

        let { data, error } = await query;

        if (error || !data?.length) {
          const fb = await supabase
            .from("announcements")
            .select("*")
            .eq("priority", "high")
            .neq("audience", "guardians")
            .order("created_at", { ascending: false })
            .limit(1);
          data = fb.data;
          error = fb.error;
        }

        if (!error && data && data.length > 0) {
          const latest = data[0];
          const diffHour =
            (Date.now() - new Date(latest.created_at).getTime()) / 3_600_000;
          if (diffHour < 24 && !localStorage.getItem(`seen_urgent_${latest.id}`)) {
            setNotice(latest);
            setTimeout(() => setVisible(true), 50);
          }
        }
      } catch (e) {
        // Comunicado urgente que não carrega não avisa ninguém, e ninguém
        // fica sabendo que não avisou.
        trackFalha('aviso_urgente_falhou', e);
      }
    }

    fetchUrgent();
  }, [user, profile]);

  if (!notice) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col bg-[#040406] overflow-hidden transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* ── Background glow ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[200%] aspect-square rounded-full blur-[120px] animate-pulse"
          style={{ background: "radial-gradient(ellipse, rgba(220,38,38,0.18) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[160%] aspect-square rounded-full blur-[80px]"
          style={{ background: "radial-gradient(ellipse, rgba(239,68,68,0.07) 0%, transparent 70%)" }}
        />
        {/* Scanlines texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)",
          }}
        />
        {/* Pulsing inset border */}
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            boxShadow: "inset 0 0 0 2px rgba(239,68,68,0.35), inset 0 0 60px rgba(239,68,68,0.06)",
          }}
        />
      </div>

      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex items-center justify-between px-4 pt-4 shrink-0"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <p className="text-[9px] font-black uppercase tracking-[0.35em] text-red-400/70">
            Ao vivo
          </p>
        </div>

        {/* Secondary dismiss */}
        <button
          onClick={() => dismiss(notice.id)}
          className="h-9 w-9 rounded-xl bg-white/5 border border-white/8 text-white/35 hover:text-white/70 flex items-center justify-center transition-all active:scale-90 touch-manipulation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10">
        {/* Pulsing rings + icon */}
        <div className="relative mb-8 flex items-center justify-center">
          <div
            className="absolute rounded-full border border-red-500/20 animate-ping"
            style={{ width: 120, height: 120 }}
          />
          <div
            className="absolute rounded-full border border-red-500/12 animate-ping"
            style={{ width: 160, height: 160, animationDelay: "0.4s" }}
          />
          <div className="relative h-20 w-20 rounded-full bg-red-500/12 border border-red-500/35 flex items-center justify-center">
            <AlertOctagon className="h-9 w-9 text-red-400" strokeWidth={2.5} />
          </div>
        </div>

        {/* Label row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-transparent to-red-500/40" />
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-400/75">
            Comunicado Urgente
          </p>
          <div className="h-px flex-1 max-w-[40px] bg-gradient-to-l from-transparent to-red-500/40" />
        </div>

        {/* Title — mobile-first sizing */}
        <h1 className="text-[2.2rem] leading-[0.95] sm:text-5xl md:text-6xl font-black italic tracking-tighter text-white mb-5 max-w-[320px] sm:max-w-2xl">
          {notice.title}
        </h1>

        {/* Message */}
        <div className="max-w-[290px] sm:max-w-md">
          <p className="text-sm sm:text-base font-medium text-white/60 leading-relaxed">
            {notice.message}
          </p>
        </div>

        {/* Hint de fechamento manual */}
        <div className="mt-7 flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-full px-3 py-1.5">
          <Shield className="h-2.5 w-2.5 text-white/30" />
          <p className="text-[8px] font-black uppercase tracking-widest text-white/35">
            Toque em &quot;Li e entendi&quot; para fechar
          </p>
        </div>
      </div>

      {/* ── Bottom dismiss area ── */}
      <div
        className="relative z-10 px-4 pt-3 shrink-0"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        {/* Primary dismiss button — large, centered, thumb-accessible */}
        <button
          onClick={() => dismiss(notice.id)}
          className="w-full h-14 rounded-2xl bg-red-500/12 hover:bg-red-500/20 border border-red-500/25 text-white font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 touch-manipulation active:scale-[0.97] transition-all"
        >
          <X className="h-4 w-4 text-red-400/70" />
          Li e entendi
        </button>
      </div>
    </div>
  );
}
