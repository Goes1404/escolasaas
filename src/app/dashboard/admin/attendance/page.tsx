
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ClipboardCheck, Loader2, AlertTriangle, Users, CalendarDays, TrendingUp, Search } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { fmtNumber, fmtPct, txt } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [sessionsRes, studentsRes, classesRes, recordsRes] = await Promise.all([
          supabase.from("class_sessions").select("id, title, session_date, session_type, teacher_name").order("session_date", { ascending: false }),
          supabase.from("profiles").select("id, full_name, class_id, institution").eq("role", "student").order("full_name"),
          supabase.from("classes").select("id, name").order("name"),
          supabase.from("attendance_records").select("session_id, student_id, status"),
        ]);

        if (sessionsRes.data) setSessions(sessionsRes.data);
        if (studentsRes.data) setStudents(studentsRes.data);
        if (classesRes.data) setClasses(classesRes.data);
        if (recordsRes.data) setAllRecords(recordsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const studentStats = useMemo(() => {
    const total = sessions.length;
    return students.map((student) => {
      const studentRecords = allRecords.filter((r) => r.student_id === student.id);
      const presentes = studentRecords.filter((r) => r.status === "presente").length;
      const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
      const classObj = classes.find((c) => c.id === student.class_id);
      return {
        ...student,
        presentes,
        total,
        pct,
        atRisk: pct < 75 && total > 0,
        className: classObj?.name || "—",
      };
    });
  }, [students, sessions, allRecords, classes]);

  const filtered = useMemo(() => {
    return studentStats
      .filter((s) => {
        if (filterClass !== "all" && s.class_id !== filterClass) return false;
        if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.pct - b.pct);
  }, [studentStats, filterClass, search]);

  const globalStats = useMemo(() => {
    const avgPct = studentStats.length > 0
      ? Math.round(studentStats.reduce((acc, s) => acc + s.pct, 0) / studentStats.length)
      : 0;
    const atRiskCount = studentStats.filter((s) => s.atRisk).length;
    return { avgPct, atRiskCount };
  }, [studentStats]);

  const pctColor = (v: number) => (v >= 75 ? "text-emerald-600" : v >= 50 ? "text-amber-600" : "text-red-600");
  const situacao = (student: any) =>
    student.atRisk ? (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Em risco
      </Badge>
    ) : (
      <Badge variant="outline">Regular</Badge>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <p className="u-label flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" /> Coordenação · frequência</p>
        <h1 className="u-page-title text-3xl mt-1">Frequência geral</h1>
        <p className="text-sm text-muted-foreground mt-2">Presença consolidada de todos os alunos.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-card">
          <CardContent className="p-4 sm:p-6">
            <div className="u-label flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Aulas</div>
            <p className="u-num text-2xl tabular-nums mt-2">{fmtNumber(sessions.length, 0, "0")}</p>
          </CardContent>
        </Card>
        <Card className="rounded-card">
          <CardContent className="p-4 sm:p-6">
            <div className="u-label flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Alunos</div>
            <p className="u-num text-2xl tabular-nums mt-2">{fmtNumber(students.length, 0, "0")}</p>
          </CardContent>
        </Card>
        <Card className="rounded-card">
          <CardContent className="p-4 sm:p-6">
            <div className="u-label flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Média geral</div>
            <p className="u-num text-2xl tabular-nums mt-2">{fmtPct(globalStats.avgPct, "0%")}</p>
          </CardContent>
        </Card>
        <Card className="rounded-card">
          <CardContent className="p-4 sm:p-6">
            <div className={`u-label flex items-center gap-2 ${globalStats.atRiskCount > 0 ? "!text-red-600" : ""}`}><AlertTriangle className="h-3.5 w-3.5" /> Em risco</div>
            <p className={`u-num text-2xl tabular-nums mt-2 ${globalStats.atRiskCount > 0 ? "text-red-600" : ""}`}>
              {fmtNumber(globalStats.atRiskCount, 0, "0")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">abaixo de 75%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-card">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Frequência por aluno
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 rounded-control"
                placeholder="Buscar aluno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-48 rounded-control">
                <SelectValue placeholder="Filtrar por turma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="u-label">Carregando frequência…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title={students.length === 0 ? "Nenhum aluno cadastrado" : "Nenhum aluno encontrado"}
              description={students.length === 0
                ? "Cadastre alunos para acompanhar a frequência deles aqui."
                : "Tente outro nome ou outra turma."}
              action={students.length === 0
                ? { label: "Cadastrar aluno", href: "/dashboard/admin/users/new" }
                : { label: "Limpar filtros", onClick: () => { setSearch(""); setFilterClass("all"); } }}
            />
          ) : (
            <>
              <ul className="sm:hidden divide-y">
                {filtered.map((student) => (
                  <li key={student.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm break-words">{txt(student.full_name)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {student.className} · <span className="tabular-nums">{student.presentes}/{student.total}</span> aulas
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`u-num text-lg tabular-nums ${pctColor(student.pct)}`}>{fmtPct(student.pct, "0%")}</span>
                      {situacao(student)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="u-label text-left py-3 px-2">Aluno</th>
                      <th className="u-label text-left py-3 px-2">Turma</th>
                      <th className="u-label text-center py-3 px-2">Presenças</th>
                      <th className="u-label text-center py-3 px-2">Aulas</th>
                      <th className="u-label text-center py-3 px-2">Frequência</th>
                      <th className="u-label text-center py-3 px-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((student) => (
                      <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{txt(student.full_name)}</td>
                        <td className="py-3 px-2 text-muted-foreground">{student.className}</td>
                        <td className="py-3 px-2 text-center tabular-nums">{student.presentes}</td>
                        <td className="py-3 px-2 text-center tabular-nums">{student.total}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`font-bold tabular-nums ${pctColor(student.pct)}`}>
                            {fmtPct(student.pct, "0%")}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">{situacao(student)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
