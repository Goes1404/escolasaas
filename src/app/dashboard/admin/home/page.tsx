
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Activity,
  BookOpen,
  Clock,
  Wifi,
  WifiOff,
  Filter,
  Layers,
  ArrowUpRight,
  HandHeart,
  FileWarning,
  UserX,
  ZapOff,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { fmtLocale, fmtNumber, toDate, txt, VAZIO } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

interface RiskAlert {
  id: string;
  type: 'inactivity' | 'documentation' | 'progress' | 'system';
  label: string;
  count: number;
  description: string;
  icon: any;
  color: string;
}

export default function CoordinatorDashboard() {
  const { profile, userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState({ db: 'checking', ai: 'checking' });
  const [logs, setLogs] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState("all");
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    startedTrails: 0,
    finishedTrails: 0,
    avgFinishedPerStudent: 0,
    eligibleStudents: 0
  });

  const TEACHER_CODE = "PROFESSOR2026";

  useEffect(() => {
    if (!isUserLoading && userRole !== 'admin' && userRole !== 'staff') {
      router.replace(userRole === 'teacher' ? "/dashboard/teacher/home" : "/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const status = {
        db: data.supabase?.status === 'ok' ? 'online' : 'offline',
        ai: data.genkit?.status === 'ok' ? 'online' : 'offline'
      };
      setNetworkStatus(status);
      return status;
    } catch (e) {
      setNetworkStatus({ db: 'offline', ai: 'offline' });
      return { db: 'offline', ai: 'offline' };
    }
  }

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    
    try {
      // 1. BUSCA DE PERFIS — head:true: banco devolve só a contagem, nunca as
      // 723+ linhas (antes vinham role+is_financial_aid_eligible de TODO
      // profile só pra somar em memória — puro desperdício de payload/CPU).
      const [
        { count: studentCount },
        { count: teacherCount },
        { count: eligibleCount },
        { count: engagedCount },
        { count: finishedCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['teacher', 'admin', 'staff']),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_financial_aid_eligible', true),
        // 2. PROGRESSO: engajados (qualquer %) e concluídos (percentage >= 100)
        supabase.from('user_progress').select('*', { count: 'exact', head: true }),
        supabase.from('user_progress').select('*', { count: 'exact', head: true }).gte('percentage', 100),
      ]);

      // 3. ALERTAS DE RISCO
      const alerts: RiskAlert[] = [];
      setRiskAlerts(alerts);

      // 4. LOGS — usa student_question_answers pois activity_logs pode não existir
      const { data: logData } = await supabase
        .from('student_question_answers')
        .select('id, student_id, question_id, is_correct, answered_at')
        .order('answered_at', { ascending: false })
        .limit(5);

      if (logData) {
        setLogs(logData.map(r => ({
          id: r.id,
          user_name: r.student_id?.slice(0, 8),
          action: r.is_correct ? 'Questão respondida corretamente' : 'Questão respondida incorretamente',
          entity_type: 'simulado',
          created_at: r.answered_at,
        })));
      }

      const finished = finishedCount ?? 0;
      const students = studentCount ?? 0;
      setStats({
        totalStudents: students,
        totalTeachers: teacherCount ?? 0,
        startedTrails: engagedCount ?? 0,
        finishedTrails: finished,
        avgFinishedPerStudent: students > 0
          ? Math.round((finished / students) * 100) / 100
          : 0,
        eligibleStudents: eligibleCount ?? 0,
      });

    } catch (err) {
      console.error("[ADMIN DEBUG] Falha no carregamento:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'staff') fetchDashboardData();
  }, [fetchDashboardData, userRole]);

  // Só auth/role travam a tela cheia — herói e cards pintam no primeiro
  // paint com skeleton próprio; antes ficavam atrás das 5 queries de `loading`.
  if (isUserLoading || (userRole !== 'admin' && userRole !== 'staff')) return (
    <div className="h-96 flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="u-label">Carregando painel…</p>
    </div>
  );

  const dbLabel = networkStatus.db === 'online' ? 'No ar' : networkStatus.db === 'offline' ? 'Fora do ar' : 'Verificando';
  const relTime = (v: string | null | undefined) => {
    const d = toDate(v);
    return d ? formatDistanceToNow(d, { addSuffix: true, locale: ptBR }) : VAZIO;
  };

  // Nível médio: superfícies neutras, acento só no ícone, entrada em stagger.
  return (
    <div className="space-y-6 pb-20 px-1">
      {/* CABEÇALHO */}
      <div className="anim-rise flex flex-col sm:flex-row sm:items-end gap-4" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="flex-1 min-w-0">
          <p className="u-label flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-primary" /> Coordenação · {fmtLocale(new Date(), 'date', 'pt-BR', { day: 'numeric', month: 'long' })}
          </p>
          <h1 className="u-page-title text-3xl md:text-4xl mt-1">Painel da coordenação</h1>
          <p className="text-muted-foreground text-sm mt-2">Visão geral da plataforma: alunos, equipe e atividade recente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-11 rounded-control font-semibold text-sm w-[170px]">
              <Filter className="h-3.5 w-3.5 mr-2 text-primary" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fetchDashboardData()} variant="outline" size="icon" aria-label="Atualizar dados" className="rounded-control h-11 w-11 shrink-0">
            <Activity className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* CARD DE CÓDIGO DOCENTE */}
      <div className="anim-rise" style={{ "--i": 1 } as React.CSSProperties}>
        <Card className="rounded-card p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-control bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground leading-tight">Código de acesso de professores</h2>
              <p className="text-muted-foreground text-sm">Código que novos professores usam para se cadastrar.</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
            <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3 rounded-control border border-dashed">
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="h-5 w-5 text-muted-foreground shrink-0" />
                <p className="text-base sm:text-lg font-bold tracking-[0.2em] font-mono text-foreground truncate">
                  {showTeacherCode ? TEACHER_CODE : "••••••••••••••"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={showTeacherCode ? "Ocultar código" : "Mostrar código"}
                onClick={() => setShowTeacherCode(!showTeacherCode)}
                className="h-10 w-10 rounded-control shrink-0"
              >
                {showTeacherCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="u-label flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary" /> Código ativo para novos professores
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users,       value: stats.totalStudents,    label: "Alunos",     sub: "Na base" },
          { icon: BookOpen,    value: stats.totalTeachers,    label: "Equipe",     sub: "Professores e coordenação" },
          { icon: CheckCircle2,value: stats.finishedTrails,   label: "Concluídas", sub: "Trilhas" },
          { icon: HandHeart,   value: stats.eligibleStudents, label: "Isenção",    sub: "Alunos elegíveis" },
        ].map((stat, i) => (
          <div key={i} className="anim-rise" style={{ "--i": i + 2 } as React.CSSProperties}>
            <Card className="rounded-card h-full">
              <CardContent className="p-4 md:p-5">
                <stat.icon className="h-4 w-4 text-primary mb-3" strokeWidth={1.75} />
                {loading ? (
                  <div className="h-8 w-14 rounded-control bg-muted animate-pulse" />
                ) : (
                  <p className="u-num text-3xl leading-none tabular-nums">{fmtNumber(stat.value, 0, "0")}</p>
                )}
                <p className="u-label mt-2">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <Card className="lg:col-span-2 rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-0">
            <CardTitle className="text-lg font-bold text-foreground">Atividade recente</CardTitle>
            <CardDescription className="text-sm">Últimas respostas de simulados na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 md:p-6 space-y-2.5">
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="h-[68px] rounded-card bg-muted/50 animate-pulse" />)
            ) : logs.length === 0 ? (
              <EmptyState
                compact
                icon={Clock}
                title="Nenhuma atividade recente"
                description="Quando os alunos responderem questões e simulados, a atividade aparece aqui."
              />
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 p-3 md:p-4 rounded-card bg-muted/30 border">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-control bg-card border flex items-center justify-center font-bold text-primary text-sm shrink-0">{txt(log.user_name, "?").charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{log.action}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">
                          {relTime(log.created_at)} · aluno {txt(log.user_name)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase px-2.5 py-1 shrink-0">{log.entity_type}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-card p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="u-label">Status do sistema</h3>
              <Activity className={`h-5 w-5 ${networkStatus.db === 'online' ? 'text-emerald-600' : networkStatus.db === 'offline' ? 'text-red-600' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Banco de dados</span>
              <Badge variant="outline" className={`border-none ${networkStatus.db === 'online' ? 'text-emerald-700 bg-emerald-50' : networkStatus.db === 'offline' ? 'text-red-700 bg-red-50' : 'text-muted-foreground bg-muted'} text-[11px] px-3 py-1 font-bold`}>
                {networkStatus.db === 'offline' ? <WifiOff className="h-3 w-3 mr-2" /> : <Wifi className="h-3 w-3 mr-2" />}
                {dbLabel}
              </Badge>
            </div>
          </Card>

          <Card className="rounded-card overflow-hidden">
            <CardHeader className="pb-2 p-5 md:p-6">
              <CardTitle className="u-label flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Alertas de risco
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 md:px-6 pb-5 md:pb-6 space-y-4">
              {riskAlerts.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="Nenhum alerta no momento"
                  description="Alunos inativos, documentos pendentes e outros riscos aparecem aqui."
                />
              ) : (
                <div className="space-y-3">
                  {riskAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 rounded-card bg-muted/30 border flex items-start gap-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className={`p-2.5 rounded-control bg-card border ${alert.color}`}>
                        <alert.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm leading-none">{alert.label}</p>
                          <Badge variant="secondary" className="h-5 px-2 font-bold text-[10px] tabular-nums">{fmtNumber(alert.count, 0, "0")}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild variant="arcade" className="w-full h-12 rounded-control font-bold">
                <Link href="/dashboard/admin/checklists">Abrir checklists</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
