"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Clock, 
  BrainCircuit, 
  CheckCircle2, 
  XCircle,
  Zap,
  Award,
  Sparkles,
  Calendar,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RadarChartPremium, AreaChartPremium } from "@/components/charts/premium";

// Tempo em h/min a partir de segundos (ex.: 4520 -> "1h 15min", 435 -> "7min", 40 -> "40s")
function fmtDurationLong(seconds: number) {
  if (!seconds || seconds <= 0) return "0min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  if (m > 0) return `${m}min`;
  return `${seconds}s`;
}

// Cronômetro MM:SS (ou H:MM:SS) para a coluna de tempo por tentativa
function fmtClock(seconds: number) {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function StudentPerformancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAnswered: 0,
    correctCount: 0,
    accuracy: 0,
    timeSpent: 0, // em segundos
    streak: 0
  });
  
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Buscar todas as respostas do aluno
        const { data: answers, error } = await supabase
          .from('student_question_answers')
          .select(`
            *,
            questions (
              subjects (name)
            )
          `)
          .eq('student_id', user.id);

        if (error) throw error;

        // Tentativas de simulado (com o tempo gasto persistido)
        const { data: attemptRows } = await supabase
          .from('simulation_attempts')
          .select('id, score, total_questions, duration_seconds, created_at, subjects(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30);
        setAttempts(attemptRows || []);
        const realTimeSpent = (attemptRows || []).reduce((acc, a) => acc + (a.duration_seconds || 0), 0);

        if (answers && answers.length > 0) {
          const total = answers.length;
          const corrects = answers.filter(a => a.is_correct).length;
          
          // Calcular Radar Data (por matéria)
          const subjectsMap: Record<string, { total: number, corrects: number }> = {};
          answers.forEach(a => {
            const subject = a.questions?.subjects?.name || "Geral";
            if (!subjectsMap[subject]) subjectsMap[subject] = { total: 0, corrects: 0 };
            subjectsMap[subject].total++;
            if (a.is_correct) subjectsMap[subject].corrects++;
          });

          const radar = Object.entries(subjectsMap).map(([subject, data]) => ({
            subject,
            score: Math.round((data.corrects / data.total) * 100),
            fullMark: 100
          }));

          // Calcular Histórico (últimos 15 dias)
          const last15Days = Array.from({ length: 15 }, (_, i) => {
            const date = subDays(new Date(), i);
            return format(date, 'yyyy-MM-dd');
          }).reverse();

          const history = last15Days.map(dateStr => {
            const dayAnswers = answers.filter(a => format(new Date(a.answered_at), 'yyyy-MM-dd') === dateStr);
            return {
              date: format(new Date(dateStr), 'dd/MM'),
              acertos: dayAnswers.filter(a => a.is_correct).length,
              total: dayAnswers.length
            };
          });

          setStats({
            totalAnswered: total,
            correctCount: corrects,
            accuracy: Math.round((corrects / total) * 100),
            // Tempo real gasto em simulados; fallback pro estimado se ainda não houver dados de duração.
            timeSpent: realTimeSpent > 0 ? realTimeSpent : total * 45,
            streak: 5 // Mock
          });
          setSubjectData(radar);
          setHistoryData(history);
        }
      } catch (e) {
        console.error("Erro ao carregar performance:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="text-primary font-black italic uppercase tracking-widest animate-pulse">Sincronizando BI...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-7 animate-in fade-in duration-500 pb-8 px-1 md:px-0">

      {/* ── HERO — compact on mobile ── */}
      <div className="aurora-dark dot-grid rounded-2xl md:rounded-[3rem] p-5 md:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-accent/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <Badge className="bg-accent text-accent-foreground border-none font-black text-[9px] uppercase tracking-widest px-3 py-1">
                Meu Desempenho
              </Badge>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white italic leading-tight">
              Centro de <span className="text-accent">Comando</span>
            </h1>
            <p className="text-white/50 text-xs font-medium italic">
              Dados reais sobre sua jornada. Refine seus pontos cegos.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-5 py-3 rounded-2xl self-start md:self-auto">
            <div>
              <p className="text-[9px] font-black text-white/65 uppercase tracking-widest">Taxa de Acerto</p>
              <p className="text-3xl font-black text-accent italic leading-none">{stats.accuracy}%</p>
            </div>
            <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin-slow shrink-0" />
          </div>
        </div>
      </div>

      {/* ── KPI CARDS — 2×2 on mobile ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {[
          { label: "Questões",     value: stats.totalAnswered,                      icon: BrainCircuit, color: "text-blue-500",   bg: "bg-blue-50" },
          { label: "Taxa de Acerto", value: `${stats.accuracy}%`,                   icon: Target,       color: "text-orange-500", bg: "bg-orange-50" },
          { label: "Tempo em Simulados", value: fmtDurationLong(stats.timeSpent), icon: Clock,        color: "text-purple-500", bg: "bg-purple-50" },
          { label: "Sequência",    value: `${stats.streak}d`,                       icon: Zap,          color: "text-amber-500",  bg: "bg-amber-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <div className={`h-9 w-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 italic leading-none">{stat.value}</p>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-1.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

        {/* Radar chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl md:rounded-card shadow-md border border-slate-100 overflow-hidden">
          <div className="p-4 md:p-8 pb-2 flex items-center justify-between">
            <div>
              <h2 className="font-black text-base md:text-xl text-slate-900 italic">Mapa de Competências</h2>
              <p className="text-xs text-slate-400 italic mt-0.5">Distribuição de acertos por área.</p>
            </div>
            <Award className="h-6 w-6 text-accent/30" />
          </div>
          <div className="p-4 md:p-8 pt-2 h-[260px] md:h-[400px]">
            {subjectData.length > 0 ? (
              <RadarChartPremium data={subjectData} angleKey="subject" yKey="score" color="#4ccced" unit="%" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 italic text-sm">
                <p>Responda questões para gerar seu mapa.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* Line chart */}
          <div className="bg-white rounded-2xl md:rounded-card shadow-md border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-8 pb-2">
              <h2 className="font-black text-base text-slate-900 italic">Atividade Diária</h2>
              <p className="text-xs text-slate-400 italic mt-0.5">Acertos nos últimos 15 dias.</p>
            </div>
            <div className="p-4 md:p-8 pt-2 h-[200px] md:h-[260px]">
              <AreaChartPremium data={historyData} xKey="date" yKey="acertos" color="#4ccced" />
            </div>
          </div>

          {/* Aurora tip */}
          <div className="bg-primary rounded-2xl md:rounded-card p-4 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-accent mb-1">Aurora IA</p>
                <p className="text-xs font-semibold italic text-white/80 leading-relaxed">
                  "Seu desempenho em Linguagens cresceu 15% esta semana. Foque em Natureza para equilibrar sua média TRI."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUBJECT BREAKDOWN ── */}
      <div className="space-y-3">
        <h3 className="text-base font-black text-slate-900 italic px-1 uppercase tracking-tighter">Detalhamento por Área</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {subjectData.map((item, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-4 md:p-5 shadow-md border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="flex justify-between items-center mb-3">
                <p className="font-black text-sm italic text-slate-900">{item.subject}</p>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${item.score >= 70 ? 'bg-green-50 text-green-600' : item.score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                  {item.score}%
                </span>
              </div>
              <Progress value={item.score} className="h-1.5 rounded-full" />
              <div className="flex justify-between mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Iniciante</span>
                <span className="text-accent">Maestro</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HISTÓRICO DE SIMULADOS (com tempo gasto) ── */}
      <div className="space-y-3">
        <h3 className="text-base font-black text-slate-900 italic px-1 uppercase tracking-tighter flex items-center gap-2">
          <Clock className="h-4 w-4 text-purple-500" />
          Histórico de Simulados
        </h3>
        <div className="bg-white rounded-2xl md:rounded-card shadow-md border border-slate-100 overflow-hidden">
          {attempts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic text-sm">
              Nenhum simulado finalizado ainda. Ao concluir um simulado, o tempo aparece aqui.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-4 md:px-6 py-3 font-black uppercase text-[9px] tracking-widest text-slate-400">Data</th>
                    <th className="text-left px-2 py-3 font-black uppercase text-[9px] tracking-widest text-slate-400">Matéria</th>
                    <th className="text-center px-2 py-3 font-black uppercase text-[9px] tracking-widest text-slate-400">Acertos</th>
                    <th className="text-center px-2 py-3 font-black uppercase text-[9px] tracking-widest text-slate-400">%</th>
                    <th className="text-right px-4 md:px-6 py-3 font-black uppercase text-[9px] tracking-widest text-slate-400">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
                    return (
                      <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 md:px-6 py-3 font-bold text-slate-600 whitespace-nowrap">
                          {format(new Date(a.created_at), "dd/MM/yy", { locale: ptBR })}
                        </td>
                        <td className="px-2 py-3 font-semibold text-slate-500">
                          {a.subjects?.name || "Geral / Misto"}
                        </td>
                        <td className="px-2 py-3 text-center font-black text-slate-800 tabular-nums">
                          {a.score}<span className="text-slate-300">/{a.total_questions}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pct >= 70 ? 'bg-green-50 text-green-600' : pct >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 text-right font-black text-purple-600 tabular-nums whitespace-nowrap">
                          {fmtClock(a.duration_seconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
