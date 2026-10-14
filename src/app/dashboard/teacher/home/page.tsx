
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Users,
  PlayCircle,
  TrendingUp,
  Bell,
  Loader2,
  AlertCircle,
  Activity,
  HandHeart,
  Info,
  Megaphone,
  AlertOctagon,
  ClipboardCheck,
  MonitorPlay,
  FilePenLine,
  Database,
  CalendarDays
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { subDays } from "date-fns";
import { BarChartPremium } from "@/components/charts/premium";
import { EmptyState } from "@/components/EmptyState";
import { fmtNumber, fmtPct, txt } from "@/lib/format";

export default function TeacherHomePage() {
  const { user, profile, userRole, loading: isUserLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [diagLoading, setDiagLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [stats, setStats] = useState({
    totalStudents: 0,
    eligibleStudents: 0,
    myTrails: 0,
    atRisk: 0,
    avgScore: 0
  });

  const [eligibleList, setEligibleList] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Cor só como sinal: urgente = vermelho, importante = amarelo da marca (o
  // idioma de "você precisa agir"), informativo = neutro.
  const priorityStyles: Record<'low' | 'medium' | 'high', { icon: any; color: string; bgColor: string; border: string; label: string }> = {
    low: { icon: Info, color: 'text-muted-foreground', bgColor: 'bg-card', border: 'border-border', label: 'Informativo' },
    medium: { icon: Megaphone, color: 'text-foreground', bgColor: 'bg-brand-yellow/25', border: 'border-foreground/15', label: 'Importante' },
    high: { icon: AlertOctagon, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', label: 'Urgente' },
  };

  // Guard de Papel
  useEffect(() => {
    if (!isUserLoading && userRole !== 'teacher' && userRole !== 'admin' && userRole !== 'staff') {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);

    try {
      // 1. Buscar Alunos e Filtrar
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, name, role, last_access, is_financial_aid_eligible')
        .eq('role', 'student');

      const sevenDaysAgo = subDays(new Date(), 7);

      const students = allProfiles || [];

      const atRisk = students.filter(s => 
        !s.last_access || new Date(s.last_access) < sevenDaysAgo
      ).length;

      const eligible = students.filter(s => s.is_financial_aid_eligible === true);

      // 2. Buscar minhas trilhas
      const { count: myTrails } = await supabase
        .from('trails')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user.id);

      // 3. Média Global de Acertos
      const { data: scores } = await supabase.from('simulation_attempts').select('score, total_questions');
      let avgScore = 0;
      if (scores && scores.length > 0) {
        // Tentativa sem total de questões entraria como Infinity/NaN na média.
        const validas = scores.filter(s => Number(s.total_questions) > 0);
        const totalPoints = validas.reduce((acc, s) => acc + (Number(s.score) || 0) / Number(s.total_questions), 0);
        avgScore = validas.length ? Math.round((totalPoints / validas.length) * 100) : 0;
      } else {
        avgScore = 0; // Fallback
      }

      setStats({
        totalStudents: students.length,
        eligibleStudents: eligible.length,
        myTrails: myTrails || 0,
        atRisk: atRisk,
        // Sem simulados ainda: mostra "—", nunca um número inventado.
        avgScore: scores && scores.length ? avgScore : (null as unknown as number)
      });

      setEligibleList(eligible.slice(0, 3));

      setChartData([
        { name: "Ativos", value: students.length - atRisk, color: "#10b981" },
        { name: "Inativos", value: atRisk, color: "#f43f5e" },
      ]);

      // Comunicados reais (antes eram três avisos de exemplo fixos no código).
      const { data: avisos } = await supabase
        .from('announcements')
        .select('id, title, message, priority, created_at')
        .neq('audience', 'guardians')
        .order('created_at', { ascending: false })
        .limit(3);
      setAnnouncements(avisos || []);

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && userRole !== 'student') {
      fetchDashboardData();
    }
  }, [user, userRole, fetchDashboardData]);

  const runDiagnostic = async () => {
    setDiagLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (response.status === 200) {
        toast({ title: "Tudo funcionando", description: "A conexão com o servidor está normal." });
      } else {
        toast({ title: "Problema na conexão", description: "O banco de dados não respondeu como esperado.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Não foi possível verificar a conexão", variant: "destructive" });
    } finally {
      setDiagLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="u-label">Carregando…</p>
      </div>
    );
  }

  // Se não é admin/teacher e não está carregando usuário, redireciona ou mostra erro suave
  if (!isUserLoading && profile && userRole !== 'teacher' && userRole !== 'admin' && userRole !== 'staff') {
    return null; // Redirecionamento no useEffect tratará isso
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = (profile as any)?.name?.split(' ')[0] || (profile as any)?.full_name?.split(' ')[0] || 'Professor';
  const avgLabel = fmtPct(stats.avgScore);

  return (
    <div className="space-y-4 md:space-y-6 pb-6 px-0.5">

      {/* ── CABEÇALHO (nível médio: superfície neutra, sombra dura só no CTA) ── */}
      <section className="anim-rise u-surface p-5 md:p-8" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="flex-1 min-w-0">
            <p className="u-label">Professor · início</p>
            <h1 className="u-page-title text-3xl md:text-4xl mt-2 truncate">Olá, {firstName}</h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{today}</p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <Button asChild variant="arcade" className="rounded-control h-11 px-5 text-sm font-bold [touch-action:manipulation]">
              <Link href="/dashboard/teacher/attendance/new">
                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                Iniciar chamada
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-control h-11 px-5 text-sm font-bold [touch-action:manipulation]">
              <Link href="/dashboard/teacher/live">
                <MonitorPlay className="h-4 w-4 mr-1.5" />
                Aulas ao vivo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── INDICADORES ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Alunos",       value: fmtNumber(stats.totalStudents),    sub: "Total cadastrado", icon: Users,       accent: "text-primary",    num: "",              href: "/dashboard/teacher/students" },
          { label: "Apoio social", value: fmtNumber(stats.eligibleStudents), sub: "Elegíveis",        icon: HandHeart,   accent: "text-emerald-600", num: "",              href: "/dashboard/teacher/students" },
          { label: "Em risco",     value: fmtNumber(stats.atRisk),           sub: "Sem acesso há 7 dias", icon: AlertCircle, accent: "text-red-600", num: "text-red-600",   href: "/dashboard/teacher/students" },
          { label: "Acerto médio", value: avgLabel,                          sub: "Todos os simulados", icon: TrendingUp, accent: "text-primary",    num: "",              href: "/dashboard/teacher/analytics" },
        ].map((stat, i) => (
          <Link key={i} href={stat.href} className="block anim-rise" style={{ "--i": i + 1 } as React.CSSProperties}>
            <div className="u-surface lift press p-4 md:p-5 h-full [touch-action:manipulation] cursor-pointer">
              <stat.icon className={`h-4 w-4 ${stat.accent} mb-3`} strokeWidth={1.8} />
              {dataLoading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded-control mb-1" />
              ) : (
                <p className={`u-num text-2xl md:text-3xl leading-none ${stat.num}`}>{stat.value}</p>
              )}
              <p className="u-label mt-3">{stat.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── ATALHOS ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {[
          { label: "Nova trilha",  icon: PlayCircle,    href: "/dashboard/teacher/trails" },
          { label: "Comunicado",   icon: Bell,          href: "/dashboard/teacher/communication" },
          { label: "Redações",     icon: FilePenLine,   href: "/dashboard/teacher/essays" },
          { label: "Questões",     icon: Database,      href: "/dashboard/teacher/questions" },
          { label: "Calendário",   icon: CalendarDays,  href: "/dashboard/teacher/calendar" },
          { label: "Relatórios",   icon: Activity,      href: "/dashboard/teacher/analytics" },
        ].map((action, i) => (
          <Link key={action.label} href={action.href} className="block anim-rise" style={{ "--i": i + 5 } as React.CSSProperties}>
            <div className="u-surface lift press flex flex-col items-center justify-center gap-2 p-3.5 h-full [touch-action:manipulation]">
              <action.icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
              <span className="text-xs font-semibold text-foreground text-center leading-tight">{action.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        <div className="lg:col-span-2 space-y-4 md:space-y-5">

          {/* Comunicados */}
          <section className="anim-rise u-surface p-4 md:p-6" style={{ "--i": 11 } as React.CSSProperties}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                Comunicados
              </h2>
              <Link href="/dashboard/teacher/communication" className="u-label hover:text-foreground transition-colors">
                Ver tudo
              </Link>
            </div>
            {announcements.length === 0 && !dataLoading && (
              <EmptyState
                compact
                icon={Megaphone}
                title="Nenhum comunicado publicado"
                description="Os avisos da coordenação e os seus aparecem aqui."
                action={{ label: "Criar comunicado", href: "/dashboard/teacher/communication" }}
              />
            )}
            <div className="space-y-2.5">
              {announcements.map((ann) => {
                const styles = priorityStyles[ann.priority as keyof typeof priorityStyles] || priorityStyles.low;
                const Icon = styles.icon;
                return (
                  <div key={ann.id} className={`flex items-start gap-3 p-3 rounded-control ${styles.bgColor} border ${styles.border}`}>
                    <div className="h-9 w-9 rounded-control bg-background border border-border flex items-center justify-center shrink-0">
                      <Icon className={`h-4 w-4 ${styles.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`u-label !tracking-[0.16em] ${ann.priority === 'high' ? '!text-red-600' : ''}`}>{styles.label}</span>
                      <p className="font-semibold text-sm text-foreground truncate mt-0.5">{ann.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ann.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Engajamento */}
          <section className="anim-rise u-surface p-4 md:p-6" style={{ "--i": 12 } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-base text-foreground">Engajamento da turma</h2>
            </div>
            <div className="h-[180px] md:h-[260px] w-full">
              {dataLoading ? (
                <div className="h-full w-full bg-muted animate-pulse rounded-control" />
              ) : (
                <BarChartPremium data={chartData} xKey="name" yKey="value" colorKey="color" barSize={80} />
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">

          {/* Busca ativa */}
          <section className="anim-rise u-surface p-4 md:p-6" style={{ "--i": 13 } as React.CSSProperties}>
            <h2 className="font-bold text-base text-foreground flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-primary" />
              Busca ativa
            </h2>
            {eligibleList.length === 0 ? (
              <EmptyState
                compact
                icon={HandHeart}
                title="Nenhum aluno para orientar agora"
                description="Quem for elegível à isenção aparece aqui para você conversar."
              />
            ) : (
              <div className="space-y-2">
                {eligibleList.map((aluno, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-control border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{txt(aluno.name, 'Aluno sem nome')}</p>
                      <p className="u-label !tracking-[0.16em] mt-0.5">Elegível à isenção</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold rounded-control px-3 shrink-0">
                      <Link href={`/dashboard/chat/${aluno.id}`}>Orientar</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline" className="w-full mt-4 h-11 rounded-control font-bold text-sm [touch-action:manipulation]">
              <Link href="/dashboard/teacher/students">Ver todos os alunos</Link>
            </Button>
          </section>

          {/* Taxa de acerto */}
          <div className="anim-rise u-surface p-4 flex items-center gap-4" style={{ "--i": 14 } as React.CSSProperties}>
            <div className="h-12 w-12 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="u-label">Taxa de acerto</p>
              <p className="u-num text-2xl text-foreground leading-none mt-1">{avgLabel}</p>
            </div>
          </div>

          {/* Diagnóstico */}
          <Button
            variant="outline"
            onClick={runDiagnostic}
            disabled={diagLoading}
            className="w-full rounded-control h-11 font-bold text-sm [touch-action:manipulation]"
          >
            {diagLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2 text-primary" />}
            Verificar conexão
          </Button>
        </div>
      </div>
    </div>
  );
}
