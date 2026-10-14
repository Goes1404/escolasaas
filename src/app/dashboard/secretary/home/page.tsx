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
  FileCheck,
  UserPlus,
  ArrowRight,
  Megaphone,
  RefreshCw,
  MessageCircle
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { StudentQuickSearch } from "@/components/StudentQuickSearch";
import { EmptyState } from "@/components/EmptyState";
import { fmtNumber, txt } from "@/lib/format";

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
      <p className="u-label">Carregando painel da secretaria…</p>
    </div>
  );

  // Nível médio: superfícies neutras, acento só no ícone, entrada em stagger.
  // A sombra dura fica só no CTA primário (matrículas) — o resto é secundário.
  const hubs = [
    {
      title: 'Matrículas e cadastro',
      desc: 'Aprove pré-matrículas, gere links de convite para turmas ou suspenda contas inativas.',
      href: '/dashboard/secretary/enrollments',
      cta: 'Abrir diretório',
      icon: UserPlus,
      primary: true,
    },
    {
      title: 'Registro de chamadas',
      desc: 'Lance a frequência diária das turmas, registre justificativas de falta enviadas pelos responsáveis ou gere listas.',
      href: '/dashboard/secretary/attendance',
      cta: 'Lançar frequência',
      icon: CheckCircle2,
      primary: false,
    },
    {
      title: 'Emissão de documentos',
      desc: 'Gere declarações de matrícula, relatórios de simulados e certificados de conclusão em PDF.',
      href: '/dashboard/secretary/documents',
      cta: 'Emitir documentos',
      icon: FileCheck,
      primary: false,
    },
  ];

  const statCards = [
    { label: 'Total de alunos', value: stats.totalStudents, desc: 'Cadastrados na base', tone: '' },
    { label: 'Alunos ativos', value: stats.activeStudents, desc: 'Acesso liberado', tone: '' },
    { label: 'Contas suspensas', value: stats.suspendedStudents, desc: 'Sem acesso', tone: 'text-red-600' },
    { label: 'Aulas registradas', value: stats.totalSessions, desc: 'No diário de classe', tone: '' },
    { label: 'Cadastros no mês', value: stats.newThisMonth, desc: 'Novos alunos no mês', tone: '' },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 anim-rise">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Secretaria · início</p>
          <h1 className="u-page-title text-3xl mt-1">Painel da secretaria</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Matrículas, frequência, documentos e atendimento ao aluno.
          </p>
        </div>
        <Button
          onClick={() => fetchDashboardData()}
          variant="outline"
          size="icon"
          className="rounded-control h-10 w-10 shrink-0"
          title="Atualizar dados"
          aria-label="Atualizar dados"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Busca global de alunos */}
      <StudentQuickSearch />

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hubs.map((hub, i) => (
          <div key={hub.href} className="anim-rise" style={{ '--i': i + 1 } as React.CSSProperties}>
            <Card className="rounded-card h-full shadow-none">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                  <div className="h-11 w-11 rounded-control bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <hub.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold leading-snug">{hub.title}</h3>
                  <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">{hub.desc}</p>
                </div>
                <Button
                  asChild
                  variant={hub.primary ? 'arcade' : 'outline'}
                  className="w-full h-11 rounded-control font-bold mt-6"
                >
                  <Link href={hub.href} className="flex items-center justify-center gap-2">
                    {hub.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="rounded-card shadow-none">
            <CardContent className="p-4 sm:p-5">
              <p className="u-label">{s.label}</p>
              {loading ? (
                <div className="h-8 w-14 rounded-control bg-muted animate-pulse mt-2" />
              ) : (
                <p className={`u-num text-2xl sm:text-3xl leading-none mt-2 ${s.tone}`}>{fmtNumber(s.value)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Faltômetro & links úteis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Faltômetro (alerta de evasão) */}
        <Card className="lg:col-span-2 rounded-card shadow-none overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-0">
            <p className="u-label flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Últimos 60 dias</p>
            <CardTitle className="text-lg font-bold mt-1">Alunos com muitas faltas</CardTitle>
            <CardDescription className="text-sm">
              Quem tem 2 ou mais faltas no período. É o primeiro sinal de risco de evasão.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => <div key={i} className="h-[60px] rounded-control bg-muted animate-pulse" />)}
              </div>
            ) : absentees.length === 0 ? (
              <EmptyState
                compact
                icon={CheckCircle2}
                title="Nenhum aluno com faltas acumuladas"
                description="Quem tiver 2 ou mais faltas nos últimos 60 dias aparece aqui."
                action={{ label: 'Lançar frequência', href: '/dashboard/secretary/attendance' }}
              />
            ) : (
              <div className="space-y-2">
                {absentees.map(student => (
                  <div key={student.id} className="flex items-center justify-between gap-3 p-3 rounded-control border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-control bg-muted text-foreground flex items-center justify-center font-bold text-sm shrink-0">
                        {(student.name || 'A').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{txt(student.name, 'Aluno')}</p>
                        <p className="u-label mt-1 truncate">{txt(student.course, 'Sem turma')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="border-amber-300 text-amber-700 font-bold">
                        <span className="u-num mr-1">{student.absences}</span> {student.absences === 1 ? 'falta' : 'faltas'}
                      </Badge>
                      <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-control">
                        <Link href={`/dashboard/chat/${student.id}`} title="Conversar com o aluno" aria-label="Conversar com o aluno">
                          <MessageCircle className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links úteis */}
        <Card className="rounded-card shadow-none p-5 sm:p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="u-label">Atalhos</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {[
              { label: 'Comunicados em massa', href: '/secretary/communication', icon: Megaphone },
              { label: 'Calendário de eventos', href: '/admin/calendar', icon: Calendar },
              { label: 'Lista de chamadas (professor)', href: '/teacher/attendance', icon: BookOpen },
              { label: 'Configurações de perfil', href: '/settings', icon: Users },
            ].map(linkItem => (
              <Link
                key={linkItem.label}
                href={`/dashboard${linkItem.href}`}
                className="flex items-center justify-between gap-3 p-3 rounded-control border border-border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-control bg-primary/10 text-primary shrink-0">
                    <linkItem.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold truncate">{linkItem.label}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
