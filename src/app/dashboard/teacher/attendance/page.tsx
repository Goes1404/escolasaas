
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Plus,
  Eye,
  Trash2,
  Loader2,
  CalendarDays,
  TrendingUp,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/EmptyState";
import { toDate, fmtDate } from "@/lib/format";

export default function TeacherAttendancePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);

  async function fetchData() {
    if (!user) return;
    setLoading(true);
    try {
      const [sessionsRes, studentsRes] = await Promise.all([
        supabase
          .from("class_sessions")
          .select("*, attendance_records(status)")
          .eq("teacher_id", user.id)
          .order("session_date", { ascending: false }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student"),
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (studentsRes.count !== null) setTotalStudents(studentsRes.count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("class_sessions").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chamada excluída." });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
    setDeletingId(null);
  }

  function getSessionStats(session: any) {
    const records: any[] = session.attendance_records || [];
    const presentes = records.filter((r) => r.status === "presente").length;
    const total = totalStudents || records.length;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
    return { presentes, total, pct };
  }

  const now = new Date();
  const thisMonth = sessions.filter((s) => {
    const d = toDate(s.session_date);
    return !!d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const avgPct =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((acc, s) => acc + getSessionStats(s).pct, 0) / sessions.length
        )
      : 0;

  return (
    <div className="pb-24 space-y-6">

      {/* ── Cabeçalho (nível médio) ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" /> Professor · chamadas</p>
          <h1 className="u-page-title text-3xl mt-1">Frequência</h1>
          <p className="text-muted-foreground text-sm mt-2">Registre e acompanhe a presença dos alunos em cada aula.</p>
        </div>
        <Button asChild variant="arcade" className="h-11 rounded-control font-bold w-full sm:w-auto">
          <Link href="/dashboard/teacher/attendance/new">
            <Plus className="h-4 w-4 mr-2" />
            Nova chamada
          </Link>
        </Button>
      </div>

      {/* ── Indicadores ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="u-surface p-3 sm:p-5">
          <p className="u-label">Chamadas</p>
          <p className="u-num text-xl sm:text-2xl mt-2">{sessions.length}</p>
        </div>
        <div className="u-surface p-3 sm:p-5">
          <p className="u-label">Presença média</p>
          {/* Cor como sinal: verde a partir de 75% de presença. */}
          <p className={`u-num text-xl sm:text-2xl mt-2 ${avgPct >= 75 ? "text-emerald-600" : ""}`}>{avgPct}%</p>
        </div>
        <div className="u-surface p-3 sm:p-5">
          <p className="u-label">Neste mês</p>
          <p className="u-num text-xl sm:text-2xl mt-2">{thisMonth.length}</p>
        </div>
      </div>

      {/* ── Histórico ── */}
      <div className="space-y-3">
        <p className="u-label flex items-center gap-2 px-1"><CalendarDays className="h-3.5 w-3.5" /> Histórico de chamadas</p>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="u-label">Carregando chamadas…</p>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Você ainda não fez nenhuma chamada"
            description="Crie uma chamada para a aula de hoje e marque quem está presente."
            action={{ label: "Nova chamada", href: "/dashboard/teacher/attendance/new", icon: Plus }}
          />
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const stats = getSessionStats(session);
              const d = toDate(session.session_date);
              const dayNum = d ? String(d.getDate()).padStart(2, "0") : "—";
              const monthShort = fmtDate(session.session_date, "MMM", "").replace(".", "");
              const isLive = session.session_type === "live";

              return (
                <div key={session.id} className="u-surface p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center justify-center min-w-[48px] py-1.5 px-2 border border-border rounded-control shrink-0">
                      <span className="u-num text-xl leading-none">{dayNum}</span>
                      <span className="u-label mt-1">{monthShort}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug truncate">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="font-semibold text-[10px] px-1.5 h-5 rounded-control">
                          {isLive ? "Ao vivo" : "Presencial"}
                        </Badge>
                        {session.subject && (
                          <Badge variant="outline" className="font-semibold text-[10px] px-1.5 h-5 rounded-control">
                            {session.subject}
                          </Badge>
                        )}
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${stats.pct >= 75 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          <TrendingUp className="h-3 w-3" />
                          <span className="tabular-nums">{stats.presentes}/{stats.total} · {stats.pct}%</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-border">
                    <Button asChild variant="outline" size="sm" className="h-8 rounded-control text-xs font-semibold">
                      <Link href={`/dashboard/teacher/attendance/${session.id}`}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Abrir
                      </Link>
                    </Button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      disabled={deletingId === session.id}
                      className="h-8 w-8 rounded-control flex items-center justify-center text-red-600 border border-border hover:bg-red-500/10 transition-colors disabled:opacity-40 touch-manipulation"
                      title="Excluir chamada"
                      aria-label="Excluir chamada"
                    >
                      {deletingId === session.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
