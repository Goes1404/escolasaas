
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ClipboardCheck, Loader2, AlertTriangle, Users, CalendarDays, TrendingUp, Search } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";

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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-xl">
          <ClipboardCheck className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black italic">Frequência Geral</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de presença dos alunos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-[2.5rem] shadow-2xl border-none">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{sessions.length}</p>
              <p className="text-sm text-muted-foreground">Total de Sessões</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-2xl border-none">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{students.length}</p>
              <p className="text-sm text-muted-foreground">Total de Alunos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] shadow-2xl border-none">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-black">{globalStats.avgPct}%</p>
              <p className="text-sm text-muted-foreground">Média Geral</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`rounded-[2.5rem] shadow-2xl border-none ${globalStats.atRiskCount > 0 ? "bg-red-50" : ""}`}>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${globalStats.atRiskCount > 0 ? "bg-red-100" : "bg-gray-100"}`}>
              <AlertTriangle className={`h-5 w-5 ${globalStats.atRiskCount > 0 ? "text-red-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className={`text-2xl font-black ${globalStats.atRiskCount > 0 ? "text-red-600" : ""}`}>
                {globalStats.atRiskCount}
              </p>
              <p className="text-sm text-muted-foreground">Alunos em Risco</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] shadow-2xl border-none">
        <CardHeader>
          <CardTitle className="font-black italic flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Frequência por Aluno
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar aluno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-48">
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
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-3 text-muted-foreground border-2 border-dashed rounded-2xl">
              <Users className="h-10 w-10 opacity-30" />
              <p className="font-semibold">Nenhum aluno encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2 font-semibold">Aluno</th>
                    <th className="text-left py-3 px-2 font-semibold">Turma</th>
                    <th className="text-center py-3 px-2 font-semibold">Presentes</th>
                    <th className="text-center py-3 px-2 font-semibold">Total Aulas</th>
                    <th className="text-center py-3 px-2 font-semibold">Frequência</th>
                    <th className="text-center py-3 px-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr
                      key={student.id}
                      className={`border-b last:border-0 transition-colors ${student.atRisk ? "bg-red-50 hover:bg-red-100/50" : "hover:bg-muted/30"}`}
                    >
                      <td className="py-3 px-2 font-medium">{student.full_name || "—"}</td>
                      <td className="py-3 px-2 text-muted-foreground">{student.className}</td>
                      <td className="py-3 px-2 text-center">{student.presentes}</td>
                      <td className="py-3 px-2 text-center">{student.total}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`font-black ${student.pct >= 75 ? "text-green-600" : student.pct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                          {student.pct}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {student.atRisk ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Em Risco
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Regular</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
