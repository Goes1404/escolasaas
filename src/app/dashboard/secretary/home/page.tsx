"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  CheckCircle2, 
  Loader2, 
  Activity,
  BookOpen,
  Calendar,
  AlertTriangle,
  Link2,
  FileCheck,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Megaphone
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { StudentQuickSearch } from "@/components/StudentQuickSearch";

interface AbsenteeStudent {
  id: string;
  name: string;
  course: string;
  absences: number;
}

export default function SecretaryDashboard() {
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    suspendedStudents: 0,
    totalSessions: 0,
    newThisMonth: 0,
  });
  const [absentees, setAbsentees] = useState<AbsenteeStudent[]>([]);

  useEffect(() => {
    if (!isUserLoading && userRole !== 'staff' && userRole !== 'admin') {
      router.replace(userRole === 'teacher' ? "/dashboard/teacher/home" : "/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      // Faltômetro olha só os últimos 60 dias: risco de evasão é sobre
      // comportamento recente, e evita herdar o ano letivo inteiro de faltas
      // conforme a tabela cresce (hoje é pequena, mas isso não vai durar).
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // 1+2+3. Contagens via head:true — banco devolve só o número, nunca as
      // linhas (antes baixava status+role de TODO aluno só pra somar em JS).
      const [
        { count: total },
        { count: active },
        { count: suspended },
        { count: sessionsCount },
        { count: newThisMonth },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').neq('status', 'suspended'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'suspended'),
        supabase.from('class_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').gte('created_at', startOfMonth.toISOString()),
      ]);

      setStats({
        totalStudents: total ?? 0,
        activeStudents: active ?? 0,
        suspendedStudents: suspended ?? 0,
        totalSessions: sessionsCount ?? 0,
        newThisMonth: newThisMonth ?? 0,
      });

      // 4. Faltômetro (Alunos com mais faltas nos últimos 60 dias)
      const { data: records, error: rErr } = await supabase
        .from('attendance_records')
        .select('student_id, status, profiles(name, course)')
        .eq('status', 'ausente')
        .gte('recorded_at', sixtyDaysAgo.toISOString());

      if (!rErr && records) {
        const counts: Record<string, { name: string; course: string; count: number }> = {};
        records.forEach((r: any) => {
          const sId = r.student_id;
          const p = r.profiles;
          if (sId && p) {
            if (!counts[sId]) {
              counts[sId] = { name: p.name || 'Aluno', course: p.course || 'Sem turma', count: 0 };
            }
            counts[sId].count++;
          }
        });

        // Converte em array, ordena por faltas desc, filtra > 2 faltas
        const list: AbsenteeStudent[] = Object.entries(counts)
          .map(([id, item]) => ({
            id,
            name: item.name,
            course: item.course,
            absences: item.count,
          }))
          .filter(student => student.absences >= 2)
          .sort((a, b) => b.absences - a.absences)
          .slice(0, 5);

        setAbsentees(list);
      }

    } catch (err) {
      console.error("[SECRETARY DASHBOARD] Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'staff' || userRole === 'admin') fetchDashboardData();
  }, [fetchDashboardData, userRole]);

  // Só auth/role travam a tela cheia — hero, hubs e busca pintam no primeiro
  // paint; estatísticas e faltômetro ganham skeleton próprio abaixo.
  if (isUserLoading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
        Carregando Central da Secretaria...
      </p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black text-primary italic leading-none uppercase tracking-tighter">
              Painel Operacional
            </h1>
            <Badge className="bg-primary text-white border-none font-black text-[10px] px-4 py-1.5 shadow-xl uppercase tracking-widest">
              Secretaria
            </Badge>
          </div>
          <p className="text-muted-foreground font-medium text-sm md:text-lg italic">
            Controle de matrículas, frequências, emissão de documentos e suporte ao estudante.
          </p>
        </div>
        <Button onClick={() => fetchDashboardData()} variant="ghost" size="icon" className="rounded-2xl h-12 w-12 bg-white shadow-xl shrink-0">
          <Activity className="h-5 w-5 text-primary" />
        </Button>
      </div>

      {/* Busca Global de Alunos */}
      <StudentQuickSearch />

      {/* Ações Rápidas (CEO style operational hubs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Hub Matrículas */}
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div>
              <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 shadow-sm w-fit mb-5 shadow-inner">
                <UserPlus className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-black text-primary italic leading-none">Matrículas & Cadastro</h3>
              <p className="text-muted-foreground text-xs font-semibold mt-2 leading-relaxed">
                Aprove pré-matrículas de alunos, emita novos links de convite para turmas ou suspenda contas inativas.
              </p>
            </div>
            <Button asChild className="w-full h-11 rounded-xl bg-blue-600 text-white font-black text-xs uppercase shadow-md hover:bg-blue-700 mt-6 border-none">
              <Link href="/dashboard/secretary/enrollments" className="flex items-center justify-center gap-2">
                Acessar Diretório <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Hub Frequência */}
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div>
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm w-fit mb-5 shadow-inner">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-black text-primary italic leading-none">Registro de Chamadas</h3>
              <p className="text-muted-foreground text-xs font-semibold mt-2 leading-relaxed">
                Gerencie a frequência diária das turmas, lance justificativas de faltas enviadas por responsáveis ou gere listas.
              </p>
            </div>
            <Button asChild className="w-full h-11 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase shadow-md hover:bg-emerald-700 mt-6 border-none">
              <Link href="/dashboard/secretary/attendance" className="flex items-center justify-center gap-2">
                Lançar Frequência <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Hub Certidões */}
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div>
              <div className="p-4 rounded-2xl bg-purple-50 text-purple-600 shadow-sm w-fit mb-5 shadow-inner">
                <FileCheck className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-black text-primary italic leading-none">Emissão de Documentos</h3>
              <p className="text-muted-foreground text-xs font-semibold mt-2 leading-relaxed">
                Gere declarações de matrícula ativa, relatórios de simulados e certificados de conclusão de forma instantânea em PDF.
              </p>
            </div>
            <Button asChild className="w-full h-11 rounded-xl bg-purple-600 text-white font-black text-xs uppercase shadow-md hover:bg-purple-700 mt-6 border-none">
              <Link href="/dashboard/secretary/documents" className="flex items-center justify-center gap-2">
                Gerar Certidões <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas Numéricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total de Alunos', value: stats.totalStudents, color: 'bg-blue-50 text-blue-600', desc: 'Cadastrados na base' },
          { label: 'Alunos Ativos',  value: stats.activeStudents, color: 'bg-green-50 text-green-600', desc: 'Acesso liberado' },
          { label: 'Contas Suspensas', value: stats.suspendedStudents, color: 'bg-red-50 text-red-600', desc: 'Sem acesso' },
          { label: 'Aulas Registradas', value: stats.totalSessions, color: 'bg-purple-50 text-purple-600', desc: 'No diário de classe' },
          { label: 'Cadastros Este Mês', value: stats.newThisMonth, color: 'bg-orange-50 text-orange-600', desc: 'Novos alunos no mês' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-xl rounded-3xl bg-white">
            <CardContent className="p-6">
              <div className={`h-9 w-9 rounded-xl ${s.color} flex items-center justify-center shrink-0 mb-4 font-black`}>
                <TrendingUp className="h-4 w-4" />
              </div>
              {loading ? (
                <div className="h-8 w-14 rounded-lg bg-slate-100 animate-pulse" />
              ) : (
                <p className="text-3xl font-black text-primary leading-none italic">{s.value}</p>
              )}
              <p className="text-[10px] text-primary/70 font-black uppercase tracking-wider mt-2">{s.label}</p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Faltômetro & Links Úteis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Faltômetro (Alerta de evasão) */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden border-l-[12px] border-amber-500">
          <CardHeader className="p-6 md:p-8 pb-0">
            <CardTitle className="text-xl font-black text-primary italic flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alerta de Absenteísmo (Faltômetro)
            </CardTitle>
            <CardDescription className="text-xs font-semibold">
              Alunos com 2 ou mais faltas seguidas ou acumuladas. Risco de evasão escolar.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-4">
            {loading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => <div key={i} className="h-[68px] rounded-2xl bg-amber-50/50 animate-pulse" />)}
              </div>
            ) : absentees.length === 0 ? (
              <div className="py-12 text-center opacity-40 italic font-bold border-2 border-dashed rounded-[2rem] text-slate-500">
                Nenhum aluno com faltas críticas no momento. Excelente!
              </div>
            ) : (
              <div className="space-y-3">
                {absentees.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/50 border border-amber-100 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm italic">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-800 leading-none">{student.name}</p>
                        <p className="text-[9px] font-black uppercase text-slate-400 mt-1 tracking-wider">{student.course}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px] px-3">
                        {student.absences} Faltas
                      </Badge>
                      <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white border border-amber-200 text-amber-600 hover:bg-amber-50">
                        <Link href={`/dashboard/chat/${student.id}`} title="Contatar aluno">
                          <Activity className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links Úteis / Acesso Rápido */}
        <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-6 md:p-8">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-xs font-black text-primary/40 uppercase tracking-[0.2em]">
              Links Auxiliares
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {[
              { label: 'Comunicados em Massa', href: '/secretary/communication', icon: Megaphone, color: 'text-amber-500 bg-amber-50' },
              { label: 'Calendário de Eventos', href: '/admin/calendar', icon: Calendar, color: 'text-blue-500 bg-blue-50' },
              { label: 'Lista de Chamadas (Professor)', href: '/teacher/attendance', icon: BookOpen, color: 'text-purple-500 bg-purple-50' },
              { label: 'Configurações de Perfil', href: '/settings', icon: Users, color: 'text-slate-600 bg-slate-50' },
            ].map(linkItem => (
              <Link 
                key={linkItem.label}
                href={`/dashboard${linkItem.href}`}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${linkItem.color} group-hover:scale-105 transition-transform shrink-0`}>
                    <linkItem.icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">
                    {linkItem.label}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
