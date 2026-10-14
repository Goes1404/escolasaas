
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
import { fmtDate } from '@/lib/format';
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

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
      toast({ title: `Código ${code}`, description: "Válido até as 17h00 do dia da aula." });
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
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="u-label">Carregando chamada…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-10">
        <EmptyState
          icon={AlertCircle}
          title="Chamada não encontrada"
          description="Ela pode ter sido excluída. Volte para a lista e abra outra chamada."
          action={{ label: "Voltar para as chamadas", href: "/dashboard/teacher/attendance", icon: ArrowLeft }}
        />
      </div>
    );
  }

  const tag = "inline-flex items-center text-[10px] font-semibold border border-border rounded-control px-2 py-0.5 text-muted-foreground";
  const missingCount = allStudents.filter((s) => !records[s.id]).length;

  return (
    <div className="pb-24 space-y-6">

      {/* ── Cabeçalho (nível médio) ── */}
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/teacher/attendance"
          className="h-9 w-9 rounded-control border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 mt-1"
          aria-label="Voltar para as chamadas"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="u-label flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" /> Professor · chamada</p>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mt-1 break-words">{session.title}</h1>
          <p className="text-muted-foreground text-sm mt-1 first-letter:uppercase">
            {fmtDate(session.session_date, "EEEE, dd 'de' MMMM")}
            {session.start_time && ` — ${session.start_time.slice(0, 5)}`}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className={tag}>{session.session_type === "live" ? "Ao vivo" : "Presencial"}</span>
            {session.subject && <span className={tag}>{session.subject}</span>}
            {session.class_label && <span className={tag}>Turma {session.class_label}</span>}
          </div>
        </div>
        {session.live_id && (
          <Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-control text-xs font-semibold">
            <Link href={`/dashboard/teacher/live/${session.live_id}`}>
              <MonitorPlay className="h-3.5 w-3.5 mr-1.5" />
              Aula ao vivo
            </Link>
          </Button>
        )}
      </div>

      {/* ── Indicadores (cor só como sinal) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label !text-emerald-600">Presentes</p>
          <p className="u-num text-xl sm:text-2xl mt-1.5 text-emerald-600">{stats.presentes}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label !text-red-600">Ausentes</p>
          <p className="u-num text-xl sm:text-2xl mt-1.5 text-red-600">{stats.ausentes}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Justificados</p>
          <p className="u-num text-xl sm:text-2xl mt-1.5">{stats.justificados}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Frequência</p>
          <p className="u-num text-xl sm:text-2xl mt-1.5">{pct}%</p>
        </div>
      </div>

      {/* ── Código de presença ── */}
      <div className="u-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <p className="u-label flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Código de presença</p>
          {codeActive && (
            <span className="text-[11px] font-semibold text-emerald-600">
              Ativo · faltam {countdownLabel}
            </span>
          )}
        </div>
        <div className="p-4">
          {codeActive ? (
            <div className="space-y-3">
              <div className="border border-border rounded-control p-4 text-center bg-muted/30">
                <p className="text-5xl sm:text-6xl font-bold tracking-[0.4em] text-foreground font-mono leading-none pl-[0.4em]">
                  {session.checkin_code}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Os alunos digitam este código para confirmar presença. Vale até as 17h00 do dia da aula.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(session.checkin_code); toast({ title: "Código copiado!" }); }}
                  className="h-10 rounded-control text-xs font-semibold"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="h-10 rounded-control text-xs font-semibold"
                >
                  {generatingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}Novo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleInvalidateCode}
                  className="h-10 rounded-control text-xs font-semibold text-red-600 hover:text-red-600 hover:bg-red-500/10"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />Encerrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {session.checkin_code && countdown === 0 ? "O código expirou. Gere um novo se ainda for o dia da aula." : "Gere um código para os alunos confirmarem presença pelo celular."}
              </p>
              <Button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="shrink-0 h-10 px-4 rounded-control text-xs font-semibold"
              >
                {generatingCode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                Gerar código
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Lista da chamada ── */}
      <div className="u-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <p className="u-label flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Alunos na chamada · <span className="tabular-nums">{rosterStudents.length}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowAddPanel((v) => !v); setAddSearch(""); }}
            className="h-8 rounded-control text-xs font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            {showAddPanel ? "Fechar" : "Adicionar"}
          </Button>
        </div>

        {showAddPanel && (
          <div className="border-b border-border p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">Adicionar à chamada</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAll}
                disabled={addingAll || missingCount === 0}
                className="h-8 rounded-control text-xs font-semibold"
              >
                {addingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <UsersRound className="h-3.5 w-3.5 mr-1.5" />}
                Adicionar todos ({missingCount})
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar aluno pelo nome…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
                className="w-full h-10 bg-background border border-border rounded-control pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
            {availableStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {missingCount === 0 ? "Todos os alunos já estão na lista." : `Nenhum aluno encontrado para "${addSearch}".`}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto scrollbar-hide space-y-1">
                {availableStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between gap-2 p-2.5 rounded-control bg-background border border-border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{student.name || "Sem nome"}</p>
                      <p className="text-[11px] text-muted-foreground">{student.institution || student.exam_target || "—"}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddStudent(student.id)}
                      disabled={addingId === student.id}
                      className="h-8 rounded-control text-xs font-semibold shrink-0"
                    >
                      {addingId === student.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
                      Incluir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="divide-y divide-border">
          {rosterStudents.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={Inbox}
                title="A lista da chamada está vazia"
                description="Inclua os alunos desta aula para marcar presença."
                action={{ label: "Adicionar alunos", onClick: () => { setShowAddPanel(true); setAddSearch(""); }, icon: UserPlus }}
              />
            </div>
          ) : (
            rosterStudents.map((student) => {
              const rec = records[student.id];
              // Faixa à esquerda = sinal do estado (verde presente, vermelho ausente).
              const statusBar = rec.status === "presente" ? "border-l-emerald-500" : rec.status === "ausente" ? "border-l-red-500" : "border-l-border";
              return (
                <div key={student.id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-l-2 ${statusBar}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{student.name || "Aluno sem nome"}</p>
                    <p className="text-[11px] text-muted-foreground">{student.institution || student.exam_target || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-control overflow-hidden border border-border" role="group" aria-label="Situação do aluno">
                      {(["presente", "ausente", "justificado"] as AttendanceStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(student.id, s)}
                          title={s === "presente" ? "Presente" : s === "ausente" ? "Ausente" : "Falta justificada"}
                          aria-pressed={rec.status === s}
                          className={`px-4 py-2 text-xs font-bold transition-colors touch-manipulation ${
                            rec.status === s
                              ? s === "presente" ? "bg-emerald-600 text-white" : s === "ausente" ? "bg-red-600 text-white" : "bg-foreground text-background"
                              : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {s === "presente" ? "P" : s === "ausente" ? "A" : "J"}
                        </button>
                      ))}
                    </div>
                    {rec.status === "justificado" && (
                      <input
                        className="h-9 flex-1 min-w-[8rem] sm:flex-none sm:w-40 bg-background border border-border rounded-control px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                        placeholder="Motivo da falta…"
                        value={rec.justification}
                        onChange={(e) => setJustification(student.id, e.target.value)}
                      />
                    )}
                    <button
                      onClick={() => handleRemoveStudent(student.id)}
                      disabled={removingId === student.id}
                      title="Tirar da chamada"
                      aria-label="Tirar da chamada"
                      className="h-9 w-9 rounded-control border border-border text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors flex items-center justify-center touch-manipulation disabled:opacity-50"
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

      {/* ── Salvar: CTA primário da tela ── */}
      <Button
        variant="arcade"
        onClick={handleSaveAll}
        disabled={saving || rosterStudents.length === 0}
        className="w-full h-12 rounded-control font-bold"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
        {saving ? "Salvando…" : "Salvar chamada"}
      </Button>
    </div>
  );
}
