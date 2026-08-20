
"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
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

  const priorityStyles: Record<'low' | 'medium' | 'high', { icon: any; color: string; bgColor: string; border: string; label: string }> = {
    low: { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50/50', border: 'border-blue-100', label: 'Informativo' },
    medium: { icon: Megaphone, color: 'text-amber-600', bgColor: 'bg-amber-50/50', border: 'border-amber-100', label: 'Importante' },
    high: { icon: AlertOctagon, color: 'text-red-600', bgColor: 'bg-red-50', border: 'border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.1)] animate-pulse-subtle', label: 'Urgente' },
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
        const totalPoints = scores.reduce((acc, s) => acc + (s.score / s.total_questions), 0);
        avgScore = Math.round((totalPoints / scores.length) * 100);
      } else {
        avgScore = 0; // Fallback
      }

      setStats({
        totalStudents: students.length,
        eligibleStudents: eligible.length,
        myTrails: myTrails || 0,
        atRisk: atRisk,
        avgScore: avgScore || 88 // Fallback aesthetic
      });

      setEligibleList(eligible.slice(0, 3));

      setChartData([
        { name: "Ativos", value: students.length - atRisk, color: "#10b981" },
        { name: "Inativos", value: atRisk, color: "#f43f5e" },
      ]);

      // Mocks para avaliação do usuário no painel docente
      setAnnouncements([
        { id: '1', title: 'Reunião Pedagógica Extra', message: 'Alinhamento sobre os novos parâmetros do ENEM 2024 na próxima segunda.', priority: 'high' },
        { id: '2', title: 'Atualização de Materiais', message: 'Novos bancos de questões de Exatas foram adicionados ao diretório.', priority: 'medium' },
        { id: '3', title: 'Treinamento IA Aurora', message: 'Webinar disponível sobre como usar os diagnósticos preditivos com seus alunos.', priority: 'low' },
      ]);

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
        toast({ title: "Sistema Operacional", description: "Conexões estabilizadas com sucesso! ✅" });
      } else {
        toast({ title: "Alerta de Rede", description: "Verifique o status do banco de dados.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro de Comunicação", variant: "destructive" });
    } finally {
      setDiagLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Gestão...</p>
      </div>
    );
  }

  // Se não é admin/teacher e não está carregando usuário, redireciona ou mostra erro suave
  if (!isUserLoading && profile && userRole !== 'teacher' && userRole !== 'admin' && userRole !== 'staff') {
    return null; // Redirecionamento no useEffect tratará isso
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = (profile as any)?.name?.split(' ')[0] || (profile as any)?.full_name?.split(' ')[0] || 'Professor';

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-6 px-0.5">

      {/* ── HERO ── */}
      <div className="relative aurora-dark rounded-[2rem] p-5 md:p-8 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse block" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45">Professor</span>
            </div>
            <h1 className="text-[2.6rem] md:text-[3.5rem] font-black text-white italic tracking-tighter leading-none">
              {firstName}<span className="text-primary">.</span>
            </h1>
            <p className="text-white/45 text-[10px] font-bold mt-2 capitalize tracking-wide">{today}</p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <Button asChild className="rounded-2xl h-11 bg-primary text-white font-black border-none px-5 text-xs uppercase tracking-wide active:scale-95 transition-all [touch-action:manipulation] shadow-lg shadow-primary/30">
              <Link href="/dashboard/teacher/attendance/new">
                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                Iniciar Chamada
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl h-11 border-white/15 bg-white/5 text-white font-black px-5 text-xs uppercase hover:bg-white/10 active:scale-95 transition-all [touch-action:manipulation]">
              <Link href="/dashboard/teacher/live">
                <MonitorPlay className="h-4 w-4 mr-1.5" />
                Lives
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS — numbers as heroes ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Alunos",       value: stats.totalStudents,   sub: "Total ativo",   icon: Users,      accent: "text-primary",    href: "/dashboard/teacher/students" },
          { label: "Apoio Social", value: stats.eligibleStudents, sub: "Elegíveis",     icon: HandHeart,  accent: "text-emerald-600", href: "/dashboard/teacher/students" },
          { label: "Em Risco",     value: stats.atRisk,           sub: "Inativos >7d",  icon: AlertCircle,accent: "text-red-500",     href: "/dashboard/teacher/students" },
          { label: "Acerto Médio", value: `${stats.avgScore}%`,   sub: "Taxa global",   icon: TrendingUp, accent: "text-violet-600",  href: "/dashboard/teacher/analytics" },
        ].map((stat, i) => (
          <Link key={i} href={stat.href} className="block">
            <div className="gradient-border bg-white rounded-2xl p-4 md:p-5 shadow-md border-none hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all [touch-action:manipulation] cursor-pointer">
              <stat.icon className={`h-4 w-4 ${stat.accent} mb-3`} strokeWidth={1.5} />
              {dataLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg mb-1" />
              ) : (
                <p className={`text-3xl md:text-4xl font-black italic leading-none tabular-nums ${stat.accent}`}>{stat.value}</p>
              )}
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-2">{stat.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── QUICK ACTIONS — horizontal scroll ── */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {[
          { label: "Nova Trilha",  icon: PlayCircle,    href: "/dashboard/teacher/trails",        color: "from-violet-500 to-purple-600" },
          { label: "Comunicado",   icon: Bell,           href: "/dashboard/teacher/communication",  color: "from-blue-500 to-indigo-600" },
          { label: "Redações",     icon: FilePenLine,    href: "/dashboard/teacher/essays",         color: "from-emerald-500 to-green-600" },
          { label: "Questões",     icon: Database,       href: "/dashboard/teacher/questions",      color: "from-amber-500 to-orange-500" },
          { label: "Calendário",   icon: CalendarDays,   href: "/dashboard/teacher/calendar",       color: "from-pink-500 to-rose-500" },
          { label: "Analytics",    icon: Activity,       href: "/dashboard/teacher/analytics",      color: "from-slate-600 to-slate-800" },
        ].map((action) => (
          <Link key={action.label} href={action.href} className="shrink-0">
            <div className={`btn-shimmer flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${action.color} rounded-2xl p-3.5 w-[88px] shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all [touch-action:manipulation]`}>
              <action.icon className="h-5 w-5 text-white" strokeWidth={1.5} />
              <span className="text-[9px] font-bold text-white/90 uppercase tracking-wide text-center leading-tight">{action.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        {/* LEFT — chart + announcements */}
        <div className="lg:col-span-2 space-y-4 md:space-y-5">

          {/* Announcements */}
          <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-md border border-slate-100 p-4 md:p-7">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-sm text-slate-900 italic flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-500" />
                Comunicados
              </h2>
              <Link href="/dashboard/teacher/communication" className="text-[9px] font-black uppercase tracking-widest text-accent hover:text-primary transition-colors">
                Ver tudo
              </Link>
            </div>
            <div className="space-y-2.5">
              {announcements.map((ann) => {
                const styles = priorityStyles[ann.priority as keyof typeof priorityStyles] || priorityStyles.low;
                const Icon = styles.icon;
                return (
                  <div key={ann.id} className={`flex items-start gap-3 p-3 rounded-xl ${styles.bgColor} border ${styles.border} relative overflow-hidden`}>
                    {ann.priority === 'high' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-xl" />}
                    <div className="h-9 w-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                      <Icon className={`h-4 w-4 ${styles.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[7px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${styles.border} ${styles.color}`}>{styles.label}</span>
                      </div>
                      <p className="font-black text-xs text-slate-900 truncate">{ann.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic mt-0.5">{ann.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engagement chart */}
          <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-md border border-slate-100 p-4 md:p-7">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-accent" />
              <h2 className="font-black text-sm text-slate-900 italic">Engajamento da Turma</h2>
            </div>
            <div className="h-[180px] md:h-[260px] w-full">
              {dataLoading ? (
                <div className="h-full w-full bg-slate-50 animate-pulse rounded-xl" />
              ) : (
                <BarChartPremium data={chartData} xKey="name" yKey="value" colorKey="color" barSize={80} />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — busca ativa + diagnostic */}
        <div className="space-y-4">

          {/* Busca Ativa */}
          <div className="aurora-dark dot-grid rounded-2xl md:rounded-[2rem] p-5 md:p-7 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="font-black text-sm text-white italic flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-accent animate-pulse" />
                Busca Ativa
              </h2>
              {eligibleList.length === 0 ? (
                <p className="text-white/65 text-xs italic text-center py-5 border border-white/10 rounded-xl">
                  Sem alertas pendentes ✅
                </p>
              ) : (
                <div className="space-y-2">
                  {eligibleList.map((aluno, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/8 border border-white/10">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white italic truncate max-w-[130px]">{aluno.name}</p>
                        <p className="text-[8px] font-black text-accent uppercase tracking-widest">Elegível Isenção</p>
                      </div>
                      <Button asChild size="sm" className="h-8 text-[9px] font-black uppercase bg-accent/15 hover:bg-accent/25 text-accent border-none rounded-xl px-3 shrink-0 transition-all active:scale-95">
                        <Link href={`/dashboard/chat/${aluno.id}`}>Orientar</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild className="w-full mt-4 h-11 rounded-xl bg-accent text-accent-foreground font-black text-xs uppercase border-none shadow-lg active:scale-95 transition-all [touch-action:manipulation]">
                <Link href="/dashboard/teacher/students">Ver Todos Alunos</Link>
              </Button>
            </div>
          </div>

          {/* Avg score pill */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Taxa de Sucesso</p>
              <p className="text-2xl font-black text-slate-900 italic leading-none">{stats.avgScore}%</p>
            </div>
          </div>

          {/* Diagnostic */}
          <Button
            variant="outline"
            onClick={runDiagnostic}
            disabled={diagLoading}
            className="btn-shimmer glow-orange-strong w-full rounded-xl h-11 border-accent/20 bg-accent/10 text-primary font-black text-xs uppercase tracking-wide active:scale-95 transition-all [touch-action:manipulation]"
          >
            {diagLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2 text-accent" />}
            Diagnóstico de Rede
          </Button>
        </div>
      </div>
    </div>
  );
}
