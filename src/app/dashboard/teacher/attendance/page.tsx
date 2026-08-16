
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
      toast({ title: "Sessão excluída com sucesso." });
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
    const d = new Date(s.session_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const avgPct =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((acc, s) => acc + getSessionStats(s).pct, 0) / sessions.length
        )
      : 0;

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(16,185,129,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-3 w-3 text-orange-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
              Staff · Chamadas
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Frequência
          </h1>
          <p className="text-white/70 text-xs font-semibold mt-1">
            Gerencie a presença dos alunos
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl py-2.5">
              <span className="text-lg font-black text-white leading-none">{sessions.length}</span>
              <span className="text-[8px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Sessões</span>
            </div>
            <div
              className={`flex flex-col items-center rounded-2xl py-2.5 border ${
                avgPct >= 75
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : avgPct > 0
                  ? "bg-amber-500/10 border-amber-500/20"
                  : "bg-white/5 border-white/8"
              }`}
            >
              <span
                className={`text-lg font-black leading-none ${
                  avgPct >= 75 ? "text-emerald-400" : avgPct > 0 ? "text-amber-400" : "text-white/60"
                }`}
              >
                {avgPct}%
              </span>
              <span className="text-[8px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Média</span>
            </div>
            <div className="flex flex-col items-center bg-blue-500/10 border border-blue-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-blue-400 leading-none">{thisMonth.length}</span>
              <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-wider mt-0.5">Mês</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <Link href="/dashboard/teacher/attendance/new" className="block">
        <Button className="w-full h-12 bg-[#4CCCED] hover:bg-orange-600 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/20 text-xs uppercase tracking-widest border-none">
          <Plus className="h-4 w-4 mr-2" />
          Nova Sessão de Chamada
        </Button>
      </Link>

      {/* ── Sessions list ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <CalendarDays className="h-4 w-4 text-orange-400/80" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
            Histórico de Sessões
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-[1.5rem]">
            <Inbox className="h-8 w-8 mx-auto mb-2 text-white/15" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Nenhuma sessão criada
            </p>
            <p className="text-[10px] font-medium text-slate-400 mt-1">
              Clique em "Nova Sessão" para começar
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const stats = getSessionStats(session);
              const d = new Date(session.session_date);
              const dayNum = d.getDate();
              const monthShort = d
                .toLocaleDateString("pt-BR", { month: "short" })
                .replace(".", "")
                .toUpperCase();
              const isLive = session.session_type === "live";
              const pctTone =
                stats.pct >= 75
                  ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25"
                  : stats.pct > 0
                  ? "text-amber-400 bg-amber-500/15 border-amber-500/25"
                  : "text-slate-600 bg-white shadow-sm border-slate-200";

              return (
                <div
                  key={session.id}
                  className="group bg-white shadow-sm border border-slate-200 hover:border-[#4CCCED]/20 rounded-2xl p-3.5 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {/* Date anchor */}
                    <div className="flex flex-col items-center justify-center min-w-[44px] py-1 px-2 bg-white shadow-sm border border-slate-200 rounded-xl shrink-0">
                      <span className="text-xl font-black italic leading-none text-slate-800">
                        {String(dayNum).padStart(2, "0")}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-orange-400/85 mt-0.5">
                        {monthShort}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 italic leading-snug truncate">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge
                          className={`border font-black text-[8px] uppercase px-1.5 h-4 ${
                            isLive
                              ? "bg-purple-500/15 text-purple-400 border-purple-500/25"
                              : "bg-blue-500/15 text-blue-400 border-blue-500/25"
                          }`}
                        >
                          {isLive ? "Live" : "Presencial"}
                        </Badge>
                        {session.subject && (
                          <Badge className="bg-white shadow-sm text-slate-600 border border-slate-200 font-black text-[8px] uppercase px-1.5 h-4">
                            {session.subject}
                          </Badge>
                        )}
                        <span
                          className={`border font-black text-[8px] uppercase tracking-widest px-2 h-4 rounded-full flex items-center gap-1 ${pctTone}`}
                        >
                          <TrendingUp className="h-2 w-2" />
                          {stats.presentes}/{stats.total} · {stats.pct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    <Link
                      href={`/dashboard/teacher/attendance/${session.id}`}
                      className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-400 bg-[#4CCCED]/10 hover:bg-[#4CCCED]/20 transition-all active:scale-95 touch-manipulation"
                    >
                      <Eye className="h-3 w-3" />
                      Abrir
                    </Link>
                    <button
                      onClick={() => handleDelete(session.id)}
                      disabled={deletingId === session.id}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-40 touch-manipulation"
                      title="Excluir"
                    >
                      {deletingId === session.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
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
