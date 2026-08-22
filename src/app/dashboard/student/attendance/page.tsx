
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldAlert,
  AlertTriangle,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { medir, TempoEsgotado } from "@/lib/perf";
import { trackAcao, trackFalha } from "@/lib/telemetry";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trackMissionProgress } from "@/lib/missions";

export default function StudentAttendancePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [myRecords, setMyRecords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [checkinCode, setCheckinCode] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  const [impactOpen, setImpactOpen] = useState(false);
  const [confirmoInput, setConfirmoInput] = useState("");

  const otpRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  const handleOtpChange = (idx: number, raw: string) => {
    const val = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const chars = checkinCode.padEnd(4, " ").split("");
    chars[idx] = val || " ";
    const next = chars.join("").trimEnd();
    setCheckinCode(next);
    if (val && idx < 3) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const chars = checkinCode.padEnd(4, " ").split("");
      if (chars[idx] && chars[idx] !== " ") {
        chars[idx] = " ";
        setCheckinCode(chars.join("").trimEnd());
      } else if (idx > 0) {
        chars[idx - 1] = " ";
        setCheckinCode(chars.join("").trimEnd());
        otpRefs.current[idx - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && idx < 3) {
      otpRefs.current[idx + 1]?.focus();
      e.preventDefault();
    } else if (e.key === "Enter" && checkinCode.length === 4) {
      handleOpenImpact();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    setCheckinCode(pasted);
    setTimeout(() => otpRefs.current[Math.min(pasted.length, 3)]?.focus(), 0);
  };

  async function fetchData() {
    if (!user) return;
    setLoading(true);
    try {
      const [sessionsRes, recordsRes] = await Promise.all([
        (() => {
          const q = supabase
            .from("class_sessions")
            .select("id, title, subject, session_date, session_type, teacher_name")
            .order("session_date", { ascending: false });
          return profile?.course ? q.eq("class_label", profile.course) : q;
        })(),
        supabase
          .from("attendance_records")
          .select("session_id, status")
          .eq("student_id", user.id),
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (recordsRes.data) {
        const map: Record<string, string> = {};
        recordsRes.data.forEach((r: any) => { map[r.session_id] = r.status; });
        setMyRecords(map);
      }
    } catch (err) {
      trackFalha("presenca_falha_carregar", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [user]);

  function handleOpenImpact() {
    const code = checkinCode.trim().toUpperCase();
    if (code.length < 4 || code.length > 6) {
      toast({ title: "Código inválido", description: "O token tem 4 caracteres (ex: A7X9).", variant: "destructive" });
      return;
    }
    setConfirmoInput("");
    setImpactOpen(true);
  }

  async function handleConfirmedCheckin() {
    const code = checkinCode.trim().toUpperCase();
    if (confirmoInput.trim().toUpperCase() !== "CONFIRMO") {
      toast({ title: "Digite CONFIRMO para prosseguir", variant: "destructive" });
      return;
    }
    setCheckingIn(true);
    try {
      // Check-in acontece no fim da aula, com a turma inteira no wi-fi da
      // escola ao mesmo tempo. É onde a rede mais aperta — e o aluno costuma
      // ter poucos minutos para registrar presença antes do código expirar.
      const res = await medir(
        "checkin_presenca",
        () => fetch("/api/attendance/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, confirmed: true }),
        }),
        { timeoutMs: 15_000 },
      );
      const data = await res.json();
      if (!res.ok) {
        trackFalha("checkin_recusado", data.error ?? "sem detalhe");
        toast({ title: "Erro no check-in", description: data.error || "Código inválido ou expirado.", variant: "destructive" });
      } else {
        trackAcao("checkin_ok");
        toast({ title: "Presença registrada!", description: `Aula: ${data.session_title}` });
        if (user) {
          trackMissionProgress(supabase, user.id, 'checkin', 1).then(() => {});
        }
        setCheckinCode("");
        setImpactOpen(false);
        setConfirmoInput("");
        fetchData();
      }
    } catch (e) {
      trackFalha("checkin_falhou", e);
      const demorou = e instanceof TempoEsgotado;
      toast({
        title: demorou ? "A rede não respondeu" : "Erro de conexão",
        description: demorou
          ? "Seu código continua válido. Tente de novo — se insistir, avise o professor."
          : "Não conseguimos registrar sua presença. Tente de novo.",
        variant: "destructive",
      });
    } finally {
      setCheckingIn(false);
    }
  }

  const totalSessions = sessions.length;
  const presentes = sessions.filter((s) => myRecords[s.id] === "presente").length;
  const ausentes = sessions.filter((s) => myRecords[s.id] === "ausente" || !myRecords[s.id]).length;
  const pct = totalSessions > 0 ? Math.round((presentes / totalSessions) * 100) : 0;
  const atRisk = pct < 75 && totalSessions > 0;
  const isStellar = pct >= 90 && totalSessions > 0;

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className={`relative rounded-card overflow-hidden p-6 shadow-2xl ${
        isStellar
          ? "bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 shadow-emerald-200"
          : "bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 shadow-orange-200"
      }`}>
        <div className="absolute top-[-10%] right-[-5%] w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            {isStellar && <Sparkles className="h-3 w-3 text-white/80 animate-pulse" />}
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
              {isStellar ? "Frequência exemplar" : "Aluno"}
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none mb-4">
            Minha Frequência
          </h1>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Aulas", value: totalSessions, color: "text-white" },
              { label: "Presente", value: presentes, color: "text-emerald-200" },
              { label: "Ausente", value: ausentes, color: "text-red-200" },
              { label: "Taxa", value: `${pct}%`, color: atRisk ? "text-red-200" : "text-emerald-200" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={`flex flex-col items-center rounded-2xl py-3 px-2 border ${
                  kpi.label === "Taxa" && atRisk
                    ? "bg-red-500/25 border-red-300/30"
                    : "bg-white/15 border-white/20"
                }`}
              >
                <span className={`text-xl font-black leading-none ${kpi.color}`}>{kpi.value}</span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider mt-1">{kpi.label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[9px] font-black text-white/70 uppercase">
              <span>Frequência geral</span>
              <span className={atRisk ? "text-red-200" : "text-emerald-200"}>{pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${atRisk ? "bg-red-300" : "bg-white"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Alert: at risk ── */}
      {atRisk && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-red-700 leading-relaxed">
            Sua frequência está abaixo de 75%. Entre em contato com seu professor para regularizar a situação.
          </p>
        </div>
      )}

      {/* ── Check-in (OTP-style) ── */}
      <div className="bg-white border border-orange-200 shadow-sm rounded-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <p className="font-black text-primary text-sm italic">Check-in da Aula</p>
            <p className="text-[10px] text-slate-500 font-medium">
              Digite o token exibido na lousa
            </p>
          </div>
        </div>

        {/* OTP boxes */}
        <div className="flex justify-center gap-2 py-1">
          {[0, 1, 2, 3].map((idx) => {
            const char = checkinCode[idx] || "";
            const filled = !!char;
            return (
              <input
                key={idx}
                ref={(el) => { otpRefs.current[idx] = el; }}
                type="text"
                inputMode="text"
                autoComplete="off"
                maxLength={1}
                value={char}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                onFocus={(e) => e.target.select()}
                className={`h-14 w-12 sm:w-14 rounded-xl border-2 text-center text-2xl font-black italic font-mono uppercase outline-none transition-all touch-manipulation ${
                  filled
                    ? "bg-orange-100 border-orange-400 text-orange-700 shadow-lg shadow-orange-200"
                    : "bg-slate-50 border-slate-200 text-slate-400 focus:border-orange-400 focus:bg-white"
                }`}
              />
            );
          })}
        </div>

        <Button
          onClick={handleOpenImpact}
          disabled={checkingIn || checkinCode.length < 4}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-xl shadow-orange-500/30 disabled:opacity-40 disabled:shadow-none uppercase tracking-widest"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Confirmar Presença
        </Button>
      </div>

      {/* ── History ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <CalendarDays className="h-4 w-4 text-orange-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Histórico de Aulas</p>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Carregando...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 border border-dashed border-slate-200 rounded-card">
            <ClipboardCheck className="h-8 w-8 text-slate-300" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma aula registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, idx) => {
              const status = myRecords[session.id];
              const isPresente = status === "presente";
              const isJustificado = status === "justificado";
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 bg-white border border-slate-100 hover:border-slate-200 shadow-sm rounded-2xl p-4 transition-all animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                  style={{ animationDelay: `${Math.min(idx * 40, 400)}ms`, animationDuration: "400ms" }}
                >
                  {/* Status dot */}
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isPresente
                        ? "bg-emerald-100 border border-emerald-200"
                        : isJustificado
                        ? "bg-amber-100 border border-amber-200"
                        : "bg-red-100 border border-red-200"
                    }`}
                  >
                    {isPresente ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isJustificado ? (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-primary italic truncate leading-tight">
                      {session.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-bold">
                        {format(new Date(session.session_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {session.subject && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[10px] text-slate-500 font-bold">{session.subject}</span>
                        </>
                      )}
                      {session.teacher_name && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[10px] text-slate-500 font-bold">{session.teacher_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      className={`border-none font-black text-[8px] uppercase px-2 h-5 ${
                        isPresente
                          ? "bg-emerald-100 text-emerald-700"
                          : isJustificado
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isPresente ? "Presente" : isJustificado ? "Justificado" : "Ausente"}
                    </Badge>
                    <Badge
                      className={`border-none font-bold text-[8px] uppercase px-2 h-4 ${
                        session.session_type === "live"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {session.session_type === "live" ? "Live" : "Presencial"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Anti-fraud Dialog ── */}
      <Dialog
        open={impactOpen}
        onOpenChange={(v) => { if (!v) { setImpactOpen(false); setConfirmoInput(""); } }}
      >
        <DialogContent className="sm:max-w-lg rounded-card border-none shadow-2xl p-0 overflow-hidden bg-[#131316]">
          <DialogHeader className="p-6 pb-4 border-b border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-red-400 leading-none italic uppercase tracking-tighter">
                  Aviso de Fraude
                </DialogTitle>
                <DialogDescription className="text-[10px] mt-0.5 font-bold text-red-400/80">
                  Leia com atenção antes de confirmar
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-500/8 border border-red-500/15 rounded-2xl">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs font-bold leading-relaxed">
                O token só pode ser digitado por você, fisicamente dentro da sala de aula.
              </p>
            </div>

            <ul className="space-y-2 text-white/50 text-xs font-medium">
              {[
                "Compartilhar o token com colegas que faltaram caracteriza fraude documental.",
                "Alunos detectados em fraude perdem a vaga no cursinho imediatamente.",
                "A lista de papel é cruzada com os check-ins do app pela secretaria.",
                "Divergências entre lista física e app geram auditoria.",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-red-500 font-black shrink-0">·</span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px] font-black uppercase text-white/55 tracking-widest ml-1">
                Digite <span className="text-red-400">CONFIRMO</span> para prosseguir
              </Label>
              <input
                type="text"
                placeholder="CONFIRMO"
                value={confirmoInput}
                onChange={(e) => setConfirmoInput(e.target.value.toUpperCase())}
                autoComplete="off"
                className="w-full h-12 bg-white/5 border-2 border-red-500/20 focus:border-red-500/50 rounded-xl px-4 text-center text-lg font-black tracking-[0.3em] text-white placeholder:text-white/45 outline-none transition-all"
              />
              <p className="text-[10px] text-white/55 font-medium text-center">
                Esta ação é registrada e seu nome ficará vinculado a este check-in.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setImpactOpen(false); setConfirmoInput(""); }}
                className="flex-1 h-12 rounded-2xl font-black text-xs bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmedCheckin}
                disabled={checkingIn || confirmoInput.trim().toUpperCase() !== "CONFIRMO"}
                className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl border-none text-xs disabled:opacity-40 shadow-lg shadow-red-500/20"
              >
                {checkingIn ? (
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Registrar ({checkinCode})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
