"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Loader2,
  Activity,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ClipboardCheck,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { LineChartPremium, BarChartPremium } from "@/components/charts/premium";

/* ── types ────────────────────────────────────────────────────── */

interface KpiData {
  totalStudents: number;
  activeStudents: number;
  attendancePct: number;
  docsApprovedPct: number;
  incomeExceeded: number;
  attendanceTrend: { week: string; pct: number }[];
  byClass: { turma: string; total: number }[];
  docsByStatus: { pendente: number; aprovado: number; rejeitado: number };
  topAbsentees: { id: string; name: string; course: string; absences: number }[];
  incomePending: number;
  checklistAvgPct: number;
}

/* ── helpers ──────────────────────────────────────────────────── */

const INCOME_THRESHOLD = 2431.5;

function isoWeekLabel(date: Date) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ── page ─────────────────────────────────────────────────────── */

export default function SecretaryKPIPage() {
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData>({
    totalStudents: 0,
    activeStudents: 0,
    attendancePct: 0,
    docsApprovedPct: 0,
    incomeExceeded: 0,
    attendanceTrend: [],
    byClass: [],
    docsByStatus: { pendente: 0, aprovado: 0, rejeitado: 0 },
    topAbsentees: [],
    incomePending: 0,
    checklistAvgPct: 0,
  });

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace(userRole === "teacher" ? "/dashboard/teacher/home" : "/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    try {
      /* ── 1. Profiles ── */
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, course, status, income_per_capita")
        .eq("role", "student");

      const students = profiles || [];
      const totalStudents = students.length;
      const activeStudents = students.filter((s: any) => s.status !== "suspended").length;

      // income distribution
      let incomeExceeded = 0;
      let incomePending = 0;
      students.forEach((s: any) => {
        if (!s.income_per_capita || s.income_per_capita === 0) incomePending++;
        else if (s.income_per_capita > INCOME_THRESHOLD) incomeExceeded++;
      });

      // by class
      const classMap: Record<string, number> = {};
      students.forEach((s: any) => {
        const key = s.course || "Sem Turma";
        classMap[key] = (classMap[key] || 0) + 1;
      });
      const byClass = Object.entries(classMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([turma, total]) => ({ turma, total }));

      /* ── 2. Attendance (last 8 weeks) ── */
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const { data: sessions } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .gte("session_date", eightWeeksAgo.toISOString().split("T")[0]);

      const sessionIds = (sessions || []).map((s: any) => s.id);

      let attendancePct = 0;
      let attendanceTrend: { week: string; pct: number }[] = [];
      let topAbsentees: { id: string; name: string; course: string; absences: number }[] = [];

      if (sessionIds.length > 0) {
        const { data: attRecs } = await supabase
          .from("attendance_records")
          .select("session_id, student_id, status, profiles(name, course)")
          .in("session_id", sessionIds);

        const records = attRecs || [];

        // global rate
        const present = records.filter((r: any) => r.status === "presente").length;
        attendancePct = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

        // weekly trend
        const sessionDateMap: Record<string, string> = {};
        (sessions || []).forEach((s: any) => {
          sessionDateMap[s.id] = s.session_date;
        });

        const weekMap: Record<string, { present: number; total: number; date: Date }> = {};
        records.forEach((r: any) => {
          const dateStr = sessionDateMap[r.session_id];
          if (!dateStr) return;
          const weekStart = startOfWeek(new Date(dateStr));
          const weekKey = weekStart.toISOString();
          if (!weekMap[weekKey]) weekMap[weekKey] = { present: 0, total: 0, date: weekStart };
          weekMap[weekKey].total++;
          if (r.status === "presente") weekMap[weekKey].present++;
        });

        attendanceTrend = Object.values(weekMap)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((w) => ({
            week: isoWeekLabel(w.date),
            pct: w.total > 0 ? Math.round((w.present / w.total) * 100) : 0,
          }));

        // top absentees
        const absentMap: Record<string, { name: string; course: string; count: number }> = {};
        records
          .filter((r: any) => r.status === "ausente")
          .forEach((r: any) => {
            const p = r.profiles as any;
            if (!p) return;
            if (!absentMap[r.student_id])
              absentMap[r.student_id] = { name: p.name || "Aluno", course: p.course || "Sem turma", count: 0 };
            absentMap[r.student_id].count++;
          });

        topAbsentees = Object.entries(absentMap)
          .map(([id, v]) => ({ id, name: v.name, course: v.course, absences: v.count }))
          .sort((a, b) => b.absences - a.absences)
          .slice(0, 8);
      }

      /* ── 3. Document uploads ── */
      const { data: uploads } = await supabase
        .from("student_uploads")
        .select("status");

      const uploadList = uploads || [];
      const docsByStatus = {
        pendente: uploadList.filter((u: any) => u.status === "pendente").length,
        aprovado: uploadList.filter((u: any) => u.status === "aprovado").length,
        rejeitado: uploadList.filter((u: any) => u.status === "rejeitado").length,
      };
      const totalDocs = uploadList.length;
      const docsApprovedPct =
        totalDocs > 0 ? Math.round((docsByStatus.aprovado / totalDocs) * 100) : 0;

      /* ── 4. Checklist progress ── */
      let checklistAvgPct = 0;
      try {
        const TOTAL_REQUIRED_DOCS = 12;
        const { data: checklists } = await supabase
          .from("student_checklists")
          .select("user_id");
        if (checklists && checklists.length > 0 && totalStudents > 0) {
          const countMap: Record<string, number> = {};
          checklists.forEach((c: any) => {
            countMap[c.user_id] = (countMap[c.user_id] || 0) + 1;
          });
          const avgCompleted =
            Object.values(countMap).reduce((s, c) => s + c, 0) / totalStudents;
          checklistAvgPct = Math.min(100, Math.round((avgCompleted / TOTAL_REQUIRED_DOCS) * 100));
        }
      } catch {
        // student_checklists may not exist — silently skip
      }

      setKpi({
        totalStudents,
        activeStudents,
        attendancePct,
        docsApprovedPct,
        incomeExceeded,
        attendanceTrend,
        byClass,
        docsByStatus,
        topAbsentees,
        incomePending,
        checklistAvgPct,
      });
    } catch (err) {
      console.error("[SECRETARY KPI] Erro:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === "staff" || userRole === "admin") fetchKpi();
  }, [fetchKpi, userRole]);

  // Só auth/role travam a tela cheia — cabeçalho pinta no primeiro paint;
  // stat cards e gráficos ganham skeleton próprio abaixo.
  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Carregando KPIs...
        </p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total de Alunos",
      value: kpi.totalStudents,
      sub: `${kpi.activeStudents} ativos`,
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Taxa de Presença",
      value: `${kpi.attendancePct}%`,
      sub: kpi.attendancePct >= 75 ? "Dentro da meta" : "Abaixo de 75%",
      icon: CheckCircle2,
      color: kpi.attendancePct >= 75 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
    },
    {
      label: "Docs Aprovados",
      value: `${kpi.docsApprovedPct}%`,
      sub: `${kpi.docsByStatus.pendente} pendentes`,
      icon: FileCheck,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Checklist Médio",
      value: `${kpi.checklistAvgPct}%`,
      sub: "Documentação por aluno",
      icon: ClipboardCheck,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Renda Excedida",
      value: kpi.incomeExceeded,
      sub: `${kpi.incomePending} sem dados`,
      icon: DollarSign,
      color: kpi.incomeExceeded > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black text-primary italic leading-none uppercase tracking-tighter">
              Painel de KPIs
            </h1>
            <Badge className="bg-primary text-white border-none font-black text-[10px] px-4 py-1.5 shadow-xl uppercase tracking-widest">
              Secretaria
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium text-sm italic">
            Indicadores de frequência, documentação, turmas e renda em tempo real.
          </p>
        </div>
        <Button
          onClick={fetchKpi}
          variant="ghost"
          size="icon"
          className="rounded-2xl h-12 w-12 bg-white shadow-xl shrink-0"
        >
          <Activity className="h-5 w-5 text-primary" />
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="border-none shadow-xl rounded-3xl bg-white">
            <CardContent className="p-6">
              <div
                className={`h-9 w-9 rounded-xl ${s.color} flex items-center justify-center shrink-0 mb-4`}
              >
                <s.icon className="h-4 w-4" />
              </div>
              {loading ? (
                <div className="h-8 w-14 rounded-lg bg-slate-100 animate-pulse" />
              ) : (
                <p className="text-3xl font-black text-primary leading-none italic">{s.value}</p>
              )}
              <p className="text-[10px] text-primary/70 font-black uppercase tracking-wider mt-2">
                {s.label}
              </p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{loading ? '' : s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance trend */}
        <Card className="lg:col-span-3 border-none shadow-2xl rounded-[2.5rem] bg-white">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-lg font-black text-primary italic flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Frequência Semanal
            </CardTitle>
            <CardDescription className="text-xs font-semibold">
              % de presença por semana — últimas 8 semanas. Linha amarela = meta 75%.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {loading ? (
              <div className="h-52 rounded-2xl bg-slate-50 animate-pulse" />
            ) : kpi.attendanceTrend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm italic opacity-50">
                Sem dados de frequência ainda.
              </div>
            ) : (
              <div className="h-52">
                <LineChartPremium
                  data={kpi.attendanceTrend}
                  xKey="week"
                  yKey="pct"
                  color="#10b981"
                  referenceY={75}
                  unit="%"
                  domainMax={100}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students by class */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-lg font-black text-primary italic flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Alunos por Turma
            </CardTitle>
            <CardDescription className="text-xs font-semibold">
              Distribuição de alunos cadastrados por turma/curso.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {loading ? (
              <div className="h-52 rounded-2xl bg-slate-50 animate-pulse" />
            ) : kpi.byClass.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm italic opacity-50">
                Nenhuma turma encontrada.
              </div>
            ) : (
              <div className="h-52">
                <BarChartPremium
                  data={kpi.byClass}
                  xKey="turma"
                  yKey="total"
                  horizontal
                  colors={["#1a2c4b", "#f59e0b", "#10b981", "#6366f1", "#f43f5e", "#0ea5e9", "#a855f7"]}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Docs + Income row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document status */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-lg font-black text-primary italic flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-purple-500" />
              Status de Documentos
            </CardTitle>
            <CardDescription className="text-xs font-semibold">
              Documentos enviados pelos alunos via upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            {[
              {
                label: "Pendentes",
                value: kpi.docsByStatus.pendente,
                bar: "bg-amber-400",
                text: "text-amber-700",
                bg: "bg-amber-50",
              },
              {
                label: "Aprovados",
                value: kpi.docsByStatus.aprovado,
                bar: "bg-emerald-400",
                text: "text-emerald-700",
                bg: "bg-emerald-50",
              },
              {
                label: "Rejeitados",
                value: kpi.docsByStatus.rejeitado,
                bar: "bg-red-400",
                text: "text-red-700",
                bg: "bg-red-50",
              },
            ].map((item) => {
              const total =
                kpi.docsByStatus.pendente +
                kpi.docsByStatus.aprovado +
                kpi.docsByStatus.rejeitado;
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.label} className={`p-4 rounded-2xl ${item.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-black uppercase tracking-wider ${item.text}`}>
                      {item.label}
                    </span>
                    <span className={`text-2xl font-black italic ${item.text}`}>{item.value}</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-2">
                    <div
                      className={`${item.bar} h-2 rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-[10px] font-bold mt-1 ${item.text} opacity-70`}>{pct}% do total</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Income distribution */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-lg font-black text-primary italic flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-teal-500" />
              Distribuição de Renda
            </CardTitle>
            <CardDescription className="text-xs font-semibold">
              Renda per capita vs limite de R$ {INCOME_THRESHOLD.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (1,5 sal. mín.).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            {[
              {
                label: "Dentro do Limite",
                value:
                  kpi.totalStudents -
                  kpi.incomeExceeded -
                  kpi.incomePending,
                bar: "bg-emerald-400",
                text: "text-emerald-700",
                bg: "bg-emerald-50",
                desc: "Renda per capita ≤ limite",
              },
              {
                label: "Excedeu Limite",
                value: kpi.incomeExceeded,
                bar: "bg-red-400",
                text: "text-red-700",
                bg: "bg-red-50",
                desc: "Renda per capita > limite",
              },
              {
                label: "Sem Dados",
                value: kpi.incomePending,
                bar: "bg-slate-300",
                text: "text-slate-600",
                bg: "bg-slate-50",
                desc: "Renda não informada",
              },
            ].map((item) => {
              const pct =
                kpi.totalStudents > 0
                  ? Math.round((item.value / kpi.totalStudents) * 100)
                  : 0;
              return (
                <div key={item.label} className={`p-4 rounded-2xl ${item.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className={`text-xs font-black uppercase tracking-wider ${item.text}`}>
                        {item.label}
                      </span>
                      <p className={`text-[10px] font-medium ${item.text} opacity-60 mt-0.5`}>
                        {item.desc}
                      </p>
                    </div>
                    <span className={`text-2xl font-black italic ${item.text}`}>{item.value}</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-2">
                    <div
                      className={`${item.bar} h-2 rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-[10px] font-bold mt-1 ${item.text} opacity-70`}>
                    {pct}% dos alunos
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top absentees */}
      <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden border-l-[12px] border-amber-500">
        <CardHeader className="p-6 md:p-8 pb-0">
          <CardTitle className="text-xl font-black text-primary italic flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Top Faltantes
          </CardTitle>
          <CardDescription className="text-xs font-semibold">
            Alunos com mais faltas nas últimas 8 semanas. Risco de evasão.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 pt-4">
          {kpi.topAbsentees.length === 0 ? (
            <div className="py-12 text-center opacity-40 italic font-bold border-2 border-dashed rounded-[2rem] text-slate-500">
              Nenhum faltante detectado no período.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kpi.topAbsentees.map((student, idx) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/50 border border-amber-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm italic shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800 leading-none">{student.name}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400 mt-1 tracking-wider">
                        {student.course}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px] px-3 shrink-0">
                    {student.absences} faltas
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
