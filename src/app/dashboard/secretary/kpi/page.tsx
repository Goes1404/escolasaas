"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Loader2,
  RefreshCw,
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
import { EmptyState } from "@/components/EmptyState";
import { pct as pctOf, txt } from "@/lib/format";

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
        <p className="u-label">Carregando indicadores…</p>
      </div>
    );
  }

  // Cor só como sinal: verde/vermelho quando o número diz "bom"/"ruim";
  // o resto fica neutro (acento só no ícone).
  const statCards = [
    {
      label: "Total de alunos",
      value: String(kpi.totalStudents),
      sub: `${kpi.activeStudents} ativos`,
      icon: Users,
      tone: "",
    },
    {
      label: "Presença",
      value: `${kpi.attendancePct}%`,
      sub: kpi.attendancePct >= 75 ? "Dentro da meta" : "Abaixo de 75%",
      icon: CheckCircle2,
      tone: kpi.attendancePct >= 75 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Docs aprovados",
      value: `${kpi.docsApprovedPct}%`,
      sub: `${kpi.docsByStatus.pendente} pendentes`,
      icon: FileCheck,
      tone: "",
    },
    {
      label: "Checklist médio",
      value: `${kpi.checklistAvgPct}%`,
      sub: "Documentação por aluno",
      icon: ClipboardCheck,
      tone: "",
    },
    {
      label: "Acima do limite de renda",
      value: String(kpi.incomeExceeded),
      sub: `${kpi.incomePending} sem dados`,
      icon: DollarSign,
      tone: kpi.incomeExceeded > 0 ? "text-red-600" : "",
    },
  ];

  const docsTotal = kpi.docsByStatus.pendente + kpi.docsByStatus.aprovado + kpi.docsByStatus.rejeitado;
  const incomeOk = Math.max(0, kpi.totalStudents - kpi.incomeExceeded - kpi.incomePending);

  const DistRow = ({ label, desc, value, total, bar, text, unit }: {
    label: string; desc?: string; value: number; total: number; bar: string; text: string; unit: string;
  }) => {
    const p = pctOf(value, total);
    return (
      <div className="p-4 rounded-control border border-border">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <span className={`u-label ${text}`}>{label}</span>
            {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
          </div>
          <span className={`u-num text-2xl shrink-0 ${text.replace("!", "")}`}>{value}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className={`${bar} h-2 rounded-full`} style={{ width: `${p}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{p}% {unit}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Secretaria · indicadores</p>
          <h1 className="u-page-title text-3xl mt-1">Indicadores</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Frequência, documentação, turmas e renda, atualizados a cada carregamento.
          </p>
        </div>
        <Button
          onClick={fetchKpi}
          variant="outline"
          size="icon"
          className="rounded-control h-10 w-10 shrink-0"
          title="Atualizar dados"
          aria-label="Atualizar dados"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="rounded-card shadow-none">
            <CardContent className="p-4 sm:p-5">
              <p className="u-label flex items-center gap-2"><s.icon className="h-3.5 w-3.5 shrink-0 text-primary" /> <span className="truncate">{s.label}</span></p>
              {loading ? (
                <div className="h-8 w-14 rounded-control bg-muted animate-pulse mt-2" />
              ) : (
                <p className={`u-num text-2xl sm:text-3xl leading-none mt-2 ${s.tone}`}>{s.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{loading ? '' : s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 rounded-card shadow-none min-w-0">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Frequência semanal
            </CardTitle>
            <CardDescription className="text-xs">
              % de presença por semana nas últimas 8 semanas. A linha de referência marca a meta de 75%.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0">
            {loading ? (
              <div className="h-52 rounded-control bg-muted animate-pulse" />
            ) : kpi.attendanceTrend.length === 0 ? (
              <EmptyState
                compact
                icon={TrendingUp}
                title="Sem chamadas nas últimas 8 semanas"
                description="A curva aparece quando houver frequência lançada no período."
                action={{ label: "Lançar frequência", href: "/dashboard/secretary/attendance" }}
              />
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

        <Card className="lg:col-span-2 rounded-card shadow-none min-w-0">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Alunos por turma
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição dos alunos cadastrados por turma/curso.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0">
            {loading ? (
              <div className="h-52 rounded-control bg-muted animate-pulse" />
            ) : kpi.byClass.length === 0 ? (
              <EmptyState
                compact
                icon={Users}
                title="Nenhuma turma encontrada"
                description="As turmas aparecem quando houver alunos cadastrados."
              />
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

      {/* Documentos + renda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-card shadow-none">
          <CardHeader className="p-5 sm:p-6 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              Situação dos documentos
            </CardTitle>
            <CardDescription className="text-xs">
              Documentos enviados pelos alunos pela plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 space-y-3">
            <DistRow label="Pendentes" value={kpi.docsByStatus.pendente} total={docsTotal} bar="bg-muted-foreground/50" text="" unit="do total" />
            <DistRow label="Aprovados" value={kpi.docsByStatus.aprovado} total={docsTotal} bar="bg-emerald-500" text="!text-emerald-600" unit="do total" />
            <DistRow label="Rejeitados" value={kpi.docsByStatus.rejeitado} total={docsTotal} bar="bg-red-500" text="!text-red-600" unit="do total" />
          </CardContent>
        </Card>

        <Card className="rounded-card shadow-none">
          <CardHeader className="p-5 sm:p-6 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Distribuição de renda
            </CardTitle>
            <CardDescription className="text-xs">
              Renda per capita comparada ao limite de R$ {INCOME_THRESHOLD.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (1,5 salário mínimo).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 space-y-3">
            <DistRow label="Dentro do limite" desc="Renda per capita até o limite" value={incomeOk} total={kpi.totalStudents} bar="bg-emerald-500" text="!text-emerald-600" unit="dos alunos" />
            <DistRow label="Acima do limite" desc="Renda per capita maior que o limite" value={kpi.incomeExceeded} total={kpi.totalStudents} bar="bg-red-500" text="!text-red-600" unit="dos alunos" />
            <DistRow label="Sem dados" desc="Renda não informada" value={kpi.incomePending} total={kpi.totalStudents} bar="bg-muted-foreground/50" text="" unit="dos alunos" />
          </CardContent>
        </Card>
      </div>

      {/* Mais faltas */}
      <Card className="rounded-card shadow-none overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-0">
          <p className="u-label flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Últimas 8 semanas</p>
          <CardTitle className="text-base font-bold mt-1">Alunos com mais faltas</CardTitle>
          <CardDescription className="text-xs">
            Quem mais faltou no período. É o primeiro sinal de risco de evasão.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array(4).fill(0).map((_, i) => <div key={i} className="h-[60px] rounded-control bg-muted animate-pulse" />)}
            </div>
          ) : kpi.topAbsentees.length === 0 ? (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="Nenhuma falta no período"
              description="Os alunos com mais faltas nas últimas 8 semanas aparecem aqui."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {kpi.topAbsentees.map((student, idx) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-control border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-control bg-muted flex items-center justify-center u-num text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{txt(student.name, "Aluno")}</p>
                      <p className="u-label mt-1 truncate">{txt(student.course, "Sem turma")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-300 text-amber-700 font-bold shrink-0">
                    <span className="u-num mr-1">{student.absences}</span> {student.absences === 1 ? "falta" : "faltas"}
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
