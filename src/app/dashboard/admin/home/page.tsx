
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
      <Loader2 className="h-10 w-10 animate-spin text-accent" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Auditoria Global...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 px-1">
      {/* HERO */}
      <div className="relative aurora-dark rounded-[2rem] p-5 md:p-8 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-60 h-60 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse block" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45">Painel Admin</span>
            </div>
            <h1 className="text-[2.5rem] md:text-[3.5rem] font-black text-white italic tracking-tighter leading-none">
              Plataforma<span className="text-primary">.</span>
            </h1>
            <p className="text-white/45 text-[10px] font-bold mt-2 tracking-wide uppercase">Coordenação · {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white/8 border-white/15 text-white font-bold text-xs w-[150px]">
                <Filter className="h-3.5 w-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-2xl">
                <SelectItem value="all" className="font-bold">Todo o Período</SelectItem>
                <SelectItem value="week" className="font-bold">Última Semana</SelectItem>
                <SelectItem value="month" className="font-bold">Último Mês</SelectItem>
                <SelectItem value="year" className="font-bold">Último Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => fetchDashboardData()} variant="ghost" size="icon" className="rounded-2xl h-11 w-11 bg-white/8 border border-white/15 hover:bg-white/15">
              <Activity className={`h-4 w-4 text-white ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* CARD DE CÓDIGO DOCENTE */}
      <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 border-l-[12px] border-accent animate-in zoom-in-95 duration-700">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent shadow-inner">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-primary italic leading-none">Segurança de Rede</h2>
            <p className="text-muted-foreground text-sm font-medium italic">Gerencie o código de entrada para novos Mentores/Professores.</p>
          </div>
        </div>
        
        <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
          <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border-2 border-dashed border-primary/10 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-primary/40" />
              <p className="text-lg font-black tracking-[0.3em] font-mono text-primary">
                {showTeacherCode ? TEACHER_CODE : "••••••••••••••"}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowTeacherCode(!showTeacherCode)}
              className="h-10 w-10 rounded-full hover:bg-white"
            >
              {showTeacherCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
            <Sparkles className="h-3 w-3" /> CÓDIGO ATIVO PARA NOVOS MENTORES
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users,       value: stats.totalStudents,    label: "Alunos",       sub: "Na base",        accent: "text-primary" },
          { icon: BookOpen,    value: stats.totalTeachers,    label: "Staff",        sub: "Professores",    accent: "text-violet-600" },
          { icon: CheckCircle2,value: stats.finishedTrails,   label: "Concluídas",   sub: "Trilhas",        accent: "text-emerald-600" },
          { icon: HandHeart,   value: stats.eligibleStudents, label: "Isenção",      sub: "Elegíveis",      accent: "text-orange-500" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden border border-slate-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <stat.icon className={`h-4 w-4 ${stat.accent} mb-3`} strokeWidth={1.5} />
              {loading ? (
                <div className="h-8 w-14 rounded-lg bg-slate-100 animate-pulse" />
              ) : (
                <p className={`text-3xl md:text-4xl font-black italic leading-none tabular-nums ${stat.accent}`}>{stat.value}</p>
              )}
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-2">{stat.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden border border-slate-100">
          <CardHeader className="p-5 md:p-8 pb-0">
            <CardTitle className="text-xl font-black text-slate-900 italic">Atividade Recente</CardTitle>
            <CardDescription className="text-sm">Últimas respostas de simulados na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 md:p-8 space-y-2.5">
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="h-[76px] rounded-[2rem] bg-slate-50 animate-pulse" />)
            ) : logs.length === 0 ? (
              <div className="py-16 text-center opacity-30 italic font-medium border-2 border-dashed rounded-[2rem]">Nenhuma atividade recente registrada.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 md:p-6 rounded-[2rem] bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all group">
                  <div className="flex items-center gap-3 md:gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white shadow-inner flex items-center justify-center font-black text-primary text-sm italic group-hover:bg-primary group-hover:text-white transition-all">{log.user_name?.charAt(0)}</div>
                    <div>
                      <p className="text-base font-bold text-primary italic leading-none group-hover:text-accent transition-colors">{log.action}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })} por {log.user_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-primary/5 text-primary text-[8px] font-black uppercase border-none px-3 py-1">{log.entity_type}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-none shadow-xl bg-white rounded-[3rem] p-6 md:p-10 overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">Status de Sinal</h3>
              <Activity className={`h-5 w-5 ${networkStatus.db === 'online' ? 'text-green-500 animate-pulse' : 'text-red-500'}`} />
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-primary/60 uppercase tracking-widest">Banco de Dados</span>
                <Badge variant="outline" className={`border-none ${networkStatus.db === 'online' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} uppercase text-[9px] px-3 py-1 font-black`}>
                  {networkStatus.db === 'online' ? <Wifi className="h-3 w-3 mr-2" /> : <WifiOff className="h-3 w-3 mr-2" />}
                  {networkStatus.db.toUpperCase()}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-xl aurora-dark rounded-[2.5rem] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/15 rounded-full blur-[60px] pointer-events-none" />
            <CardHeader className="pb-2 p-5 md:p-7 relative z-10">
              <CardTitle className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 text-primary">
                <AlertCircle className="h-4 w-4" />
                Alertas de Risco
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 md:px-7 pb-5 md:pb-7 space-y-4 relative z-10">
              {riskAlerts.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-[2rem] opacity-40">
                  <p className="text-[10px] font-bold italic tracking-widest uppercase">Rede em Conformidade Total</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {riskAlerts.map((alert) => (
                    <div key={alert.id} className="p-5 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-start gap-5 group hover:bg-white/10 transition-all cursor-pointer">
                      <div className={`p-3 rounded-2xl bg-white/10 ${alert.color} shadow-inner`}>
                        <alert.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="font-black text-sm italic leading-none">{alert.label}</p>
                          <Badge className="h-5 px-2 bg-accent text-accent-foreground border-none font-black text-[9px]">{alert.count}</Badge>
                        </div>
                        <p className="text-[10px] font-medium text-white/50 mt-2 leading-relaxed">{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild className="w-full h-14 rounded-2xl bg-accent text-accent-foreground font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform mt-4 border-none">
                <Link href="/dashboard/admin/checklists">Aplicar Intervenção</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
