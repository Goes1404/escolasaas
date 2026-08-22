
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ClipboardCheck, Loader2, RefreshCw, Copy, X,
  MonitorPlay, Users, CheckCircle2, XCircle, AlertCircle,
  UserPlus, UserMinus, Search, UsersRound, Sparkles, Inbox,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHECKIN_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CHECKIN_CHARSET[Math.floor(Math.random() * CHECKIN_CHARSET.length)];
  }
  return code;
}

function expiryFor(sessionDateISO: string): string {
  const base = new Date(sessionDateISO + "T00:00:00");
  base.setHours(17, 0, 0, 0);
  return base.toISOString();
}

type AttendanceStatus = "presente" | "ausente" | "justificado";

export default function AttendanceSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<any>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, { status: AttendanceStatus; justification: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [sessionRes, studentsRes, recordsRes] = await Promise.all([
        supabase.from("class_sessions").select("*").eq("id", id).single(),
        supabase.from("profiles").select("id, name, institution, exam_target").eq("role", "student").order("name"),
        supabase.from("attendance_records").select("*").eq("session_id", id),
      ]);

      if (sessionRes.data) {
        setSession(sessionRes.data);
        if (sessionRes.data.checkin_code_expires_at) {
          const remaining = Math.max(0, Math.floor((new Date(sessionRes.data.checkin_code_expires_at).getTime() - Date.now()) / 1000));
          setCountdown(remaining);
        }
      }
      if (studentsRes.data) setAllStudents(studentsRes.data);
      if (recordsRes.data) {
        const initial: Record<string, { status: AttendanceStatus; justification: string }> = {};
        recordsRes.data.forEach((r: any) => { initial[r.student_id] = { status: r.status, justification: r.justification || "" }; });
        setRecords(initial);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (countdown <= 0) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => { if (prev <= 1) { clearInterval(timerRef.current!); return 0; } return prev - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  async function handleGenerateCode() {
    if (!session) return;
    setGeneratingCode(true);
    const code = generateCode();
    const expiresAt = expiryFor(session.session_date);
    const remainingSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    if (remainingSec <= 0) {
      toast({ title: "Janela encerrada", description: "A janela de check-in vai até as 17h00 do dia da aula.", variant: "destructive" });
      setGeneratingCode(false);
      return;
    }
    const { error } = await supabase.from("class_sessions").update({ checkin_code: code, checkin_code_expires_at: expiresAt }).eq("id", session.id);
    if (error) {
      toast({ title: "Erro ao gerar código", description: error.message, variant: "destructive" });
    } else {
      setSession((prev: any) => ({ ...prev, checkin_code: code, checkin_code_expires_at: expiresAt }));
      setCountdown(remainingSec);
      toast({ title: `Token ${code}`, description: "Válido até as 17h00 do dia da aula." });
    }
    setGeneratingCode(false);
  }

  async function handleInvalidateCode() {
    if (!session) return;
    const { error } = await supabase.from("class_sessions").update({ checkin_code: null, checkin_code_expires_at: null }).eq("id", session.id);
    if (!error) { setSession((prev: any) => ({ ...prev, checkin_code: null, checkin_code_expires_at: null })); setCountdown(0); }
  }

  async function handleAddStudent(studentId: string) {
    setAddingId(studentId);
    const { error } = await supabase.from("attendance_records").insert({ session_id: id, student_id: studentId, status: "ausente" });
    if (error) {
      toast({ title: "Erro ao adicionar aluno", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) => ({ ...prev, [studentId]: { status: "ausente", justification: "" } }));
    }
    setAddingId(null);
  }

  async function handleRemoveStudent(studentId: string) {
    setRemovingId(studentId);
    const { error } = await supabase.from("attendance_records").delete().eq("session_id", id).eq("student_id", studentId);
    if (error) {
      toast({ title: "Erro ao remover aluno", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) => { const { [studentId]: _, ...rest } = prev; return rest; });
    }
    setRemovingId(null);
  }

  async function handleAddAll() {
    const toAdd = allStudents.filter((s) => !records[s.id]);
    if (toAdd.length === 0) { toast({ title: "Todos os alunos já estão na lista." }); return; }
    setAddingAll(true);
    const payload = toAdd.map((s) => ({ session_id: id, student_id: s.id, status: "ausente" }));
    const { error } = await supabase.from("attendance_records").upsert(payload, { onConflict: "session_id,student_id" });
    if (error) {
      toast({ title: "Erro ao adicionar todos", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) => { const next = { ...prev }; toAdd.forEach((s) => { next[s.id] = { status: "ausente", justification: "" }; }); return next; });
      toast({ title: `${toAdd.length} alunos adicionados.` });
      setShowAddPanel(false);
    }
    setAddingAll(false);
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
  }

  function setJustification(studentId: string, text: string) {
    setRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], justification: text } }));
  }

  async function handleSaveAll() {
    if (!session) return;
    setSaving(true);
    const payload = Object.entries(records).map(([studentId, rec]) => ({
      session_id: session.id,
      student_id: studentId,
      status: rec.status,
      justification: rec.justification || null,
    }));
    if (payload.length === 0) { toast({ title: "A lista está vazia.", variant: "destructive" }); setSaving(false); return; }
    const { error } = await supabase.from("attendance_records").upsert(payload, { onConflict: "session_id,student_id" });
    if (error) {
      toast({ title: "Erro ao salvar chamada", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chamada salva!", description: "Frequência registrada com sucesso." });
    }
    setSaving(false);
  }

  const rosterStudents = allStudents.filter((s) => records[s.id] !== undefined);
  const availableStudents = allStudents.filter((s) => records[s.id] === undefined && (!addSearch || s.name?.toLowerCase().includes(addSearch.toLowerCase())));

  const stats = {
    presentes: Object.values(records).filter((r) => r.status === "presente").length,
    ausentes: Object.values(records).filter((r) => r.status === "ausente").length,
    justificados: Object.values(records).filter((r) => r.status === "justificado").length,
    total: rosterStudents.length,
  };
  const pct = stats.total > 0 ? Math.round((stats.presentes / stats.total) * 100) : 0;

  const codeActive = session?.checkin_code && countdown > 0;
  const countdownHr = Math.floor(countdown / 3600);
  const countdownMin = Math.floor((countdown % 3600) / 60);
  const countdownSec = countdown % 60;
  const countdownLabel = countdownHr > 0
    ? `${countdownHr}h ${String(countdownMin).padStart(2, "0")}min`
    : countdownMin > 0
    ? `${countdownMin}min ${String(countdownSec).padStart(2, "0")}s`
    : `${countdownSec}s`;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 text-orange-400 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Carregando chamada...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-white/70">Sessão não encontrada.</p>
        <Link href="/dashboard/teacher/attendance" className="text-orange-400 font-bold text-sm mt-2 block">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-card overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(34,197,94,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-start gap-3 mb-4">
            <Link
              href="/dashboard/teacher/attendance"
              className="h-8 w-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/8 transition-all shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <ClipboardCheck className="h-3 w-3 text-orange-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">Chamada</p>
                {session.session_type === "live" ? (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-full px-2 py-0.5">Live</span>
                ) : (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full px-2 py-0.5">Presencial</span>
                )}
                {session.subject && (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-white/5 text-white/70 border border-white/10 rounded-full px-2 py-0.5">{session.subject}</span>
                )}
                {session.class_label && (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full px-2 py-0.5">Turma {session.class_label}</span>
                )}
              </div>
              <h1 className="text-xl font-black italic tracking-tight text-white leading-none">{session.title}</h1>
              <p className="text-white/70 text-xs font-semibold mt-0.5">
                {format(new Date(session.session_date + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {session.start_time && ` — ${session.start_time.slice(0, 5)}`}
              </p>
            </div>
            {session.live_id && (
              <Link
                href={`/dashboard/teacher/live/${session.live_id}`}
                className="h-9 shrink-0 flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/25 text-purple-400 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider hover:bg-purple-500/20 transition-all"
              >
                <MonitorPlay className="h-3.5 w-3.5" />
                Live
              </Link>
            )}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center bg-emerald-500/10 border border-emerald-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-emerald-400 leading-none">{stats.presentes}</span>
              <span className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-wider mt-0.5">Presentes</span>
            </div>
            <div className="flex flex-col items-center bg-red-500/10 border border-red-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-red-400 leading-none">{stats.ausentes}</span>
              <span className="text-[8px] font-bold text-red-400/80 uppercase tracking-wider mt-0.5">Ausentes</span>
            </div>
            <div className="flex flex-col items-center bg-amber-500/10 border border-amber-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-amber-400 leading-none">{stats.justificados}</span>
              <span className="text-[8px] font-bold text-amber-400/80 uppercase tracking-wider mt-0.5">Justif.</span>
            </div>
            <div className="flex flex-col items-center bg-blue-500/10 border border-blue-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-blue-400 leading-none">{pct}%</span>
              <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-wider mt-0.5">Freq.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Check-in Code ── */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-orange-400/85" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">Auto Check-in</p>
          </div>
          {codeActive && (
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              Ativo · {countdownLabel} restantes
            </span>
          )}
        </div>
        <div className="p-4">
          {codeActive ? (
            <div className="space-y-3">
              <div className="bg-[#4CCCED]/8 border border-[#4CCCED]/20 rounded-2xl p-4 text-center">
                <p className="text-6xl font-black tracking-[0.5em] text-orange-400 font-mono leading-none pl-[0.5em]">
                  {session.checkin_code}
                </p>
                <p className="text-[9px] font-bold text-orange-400/70 uppercase tracking-widest mt-2">
                  Encerra às 17h00 do dia da aula
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(session.checkin_code); toast({ title: "Código copiado!" }); }}
                  className="h-10 flex items-center justify-center gap-1.5 bg-white shadow-sm border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-all touch-manipulation active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" />Copiar
                </button>
                <button
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="h-10 flex items-center justify-center gap-1.5 bg-white shadow-sm border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-all touch-manipulation active:scale-95 disabled:opacity-50"
                >
                  {generatingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Novo
                </button>
                <button
                  onClick={handleInvalidateCode}
                  className="h-10 flex items-center justify-center gap-1.5 bg-red-500/8 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/15 transition-all touch-manipulation active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />Invalidar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-600">
                {session.checkin_code && countdown === 0 ? "Código expirado." : "Gere um código para os alunos confirmarem presença."}
              </p>
              <button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="shrink-0 h-11 px-5 flex items-center gap-2 bg-[#4CCCED] hover:bg-orange-600 text-slate-800 font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all touch-manipulation active:scale-95 disabled:opacity-50"
              >
                {generatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Gerar Código
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Student Roster ── */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-400/85" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              Chamada ({rosterStudents.length})
            </p>
          </div>
          <button
            onClick={() => { setShowAddPanel((v) => !v); setAddSearch(""); }}
            className="h-8 flex items-center gap-1.5 bg-[#4CCCED]/15 border border-[#4CCCED]/25 text-orange-400 rounded-xl px-3 text-[9px] font-black uppercase tracking-wider hover:bg-[#4CCCED]/20 transition-all touch-manipulation active:scale-95"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>

        {/* Add student panel */}
        {showAddPanel && (
          <div className="border-b border-slate-100 p-4 space-y-3 bg-white/2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-800 italic">Adicionar à chamada</p>
              <button
                onClick={handleAddAll}
                disabled={addingAll || allStudents.filter((s) => !records[s.id]).length === 0}
                className="h-7 flex items-center gap-1.5 bg-white shadow-sm border border-slate-200 rounded-lg px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-800 transition-all disabled:opacity-40"
              >
                {addingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <UsersRound className="h-3 w-3" />}
                Todos ({allStudents.filter((s) => !records[s.id]).length})
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar aluno pelo nome..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
                className="w-full h-10 bg-white shadow-sm border border-slate-200 rounded-xl pl-9 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
              />
            </div>
            {availableStudents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">
                {allStudents.filter((s) => !records[s.id]).length === 0 ? "Todos os alunos já estão na lista." : `Nenhum resultado para "${addSearch}".`}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto scrollbar-hide space-y-1">
                {availableStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white shadow-sm border border-slate-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{student.name || "Sem nome"}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{student.institution || student.exam_target || "—"}</p>
                    </div>
                    <button
                      onClick={() => handleAddStudent(student.id)}
                      disabled={addingId === student.id}
                      className="ml-3 h-8 flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-lg px-2.5 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-all disabled:opacity-50 touch-manipulation active:scale-95"
                    >
                      {addingId === student.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Roster list */}
        <div className="divide-y divide-white/5">
          {rosterStudents.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3">
              <Inbox className="h-8 w-8 text-white/15" />
              <div className="text-center">
                <p className="font-black italic text-xs text-slate-500 uppercase tracking-widest">Lista vazia</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Use "Adicionar" para montar a chamada</p>
              </div>
            </div>
          ) : (
            rosterStudents.map((student) => {
              const rec = records[student.id];
              const statusBg = rec.status === "presente" ? "bg-emerald-500/8 border-l-emerald-500" : rec.status === "justificado" ? "bg-amber-500/5 border-l-amber-500" : "border-l-transparent";
              return (
                <div key={student.id} className={`relative flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-l-2 transition-colors ${statusBg}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{student.name || "Aluno sem nome"}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{student.institution || student.exam_target || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* P / A / J Toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                      {(["presente", "ausente", "justificado"] as AttendanceStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(student.id, s)}
                          className={`px-4 py-2 text-xs font-black uppercase transition-colors touch-manipulation ${
                            rec.status === s
                              ? s === "presente" ? "bg-emerald-500 text-slate-800" : s === "justificado" ? "bg-amber-500 text-slate-800" : "bg-red-500 text-slate-800"
                              : "bg-white shadow-sm text-slate-400 hover:bg-white/6 hover:text-slate-800/80"
                          }`}
                        >
                          {s === "presente" ? "P" : s === "ausente" ? "A" : "J"}
                        </button>
                      ))}
                    </div>
                    {rec.status === "justificado" && (
                      <input
                        className="h-9 w-32 bg-white shadow-sm border border-slate-200 rounded-lg px-3 text-xs font-medium text-slate-800 placeholder:text-slate-500 outline-none focus:border-amber-500/40 transition-all"
                        placeholder="Motivo..."
                        value={rec.justification}
                        onChange={(e) => setJustification(student.id, e.target.value)}
                      />
                    )}
                    <button
                      onClick={() => handleRemoveStudent(student.id)}
                      disabled={removingId === student.id}
                      className="h-9 w-9 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center touch-manipulation active:scale-95 disabled:opacity-50"
                    >
                      {removingId === student.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Save ── */}
      <button
        onClick={handleSaveAll}
        disabled={saving || rosterStudents.length === 0}
        className="w-full h-13 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99] transition-all"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        {saving ? "Salvando..." : "Salvar Chamada"}
      </button>
    </div>
  );
}
