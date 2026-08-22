'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/app/lib/supabase';
import { 
  Trophy, Flame, Zap, CheckCircle2, BookOpen, 
  TrendingUp, Award, Clock, ArrowRight, Loader2, Sparkles 
} from 'lucide-react';
import Image from 'next/image';
import { useTenant } from '@/components/TenantProvider';

type EngagementData = {
  student_name: string;
  exam_target: string;
  institution: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  total_answers: number;
  correct_answers: number;
  essays_submitted: number;
};

export default function GuardianDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const { tenant } = useTenant();
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEngagement() {
      try {
        setLoading(true);
        const { data: res, error: fetchError } = await supabase.rpc(
          'get_student_engagement_by_token',
          { token_val: token }
        );

        if (fetchError) throw fetchError;
        if (!res || res.length === 0) {
          setError('Link de acompanhamento inválido ou expirado.');
        } else {
          setData(res[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar os dados.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchEngagement();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-bold italic text-slate-400">Carregando relatório de desempenho...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
        <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 rounded-card p-8 shadow-2xl">
          <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-black italic text-red-400">Acesso Não Autorizado</h2>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            {error || 'Este link de acompanhamento não é válido. Solicite um novo link atualizado ao estudante.'}
          </p>
        </div>
      </div>
    );
  }

  const accuracyRate = data.total_answers > 0 
    ? Math.round((data.correct_answers / data.total_answers) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased pb-16 selection:bg-amber-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-8 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-28">
              <Image
                src={tenant.branding.logoUrl}
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
              Espaço do Responsável
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Atualizado em tempo real
          </span>
        </header>

        {/* Hero Card */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 rounded-card p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
                  Aluno(a) Monitorado(a)
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full border border-violet-500/30">
                  {data.exam_target.toUpperCase()}
                </span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white">
                {data.student_name}
              </h1>
              
              <p className="text-slate-400 text-sm font-medium">
                Estudante no <span className="text-slate-200">{data.institution}</span>
              </p>
            </div>

            {/* Level and Streak Badges */}
            <div className="flex gap-4 items-center shrink-0">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center min-w-[100px] shadow-lg">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Nível</p>
                <div className="flex items-center justify-center gap-1 mt-1 text-amber-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-2xl font-black">{data.current_level}</span>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center min-w-[100px] shadow-lg">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Streak 🔥</p>
                <div className="flex items-center justify-center gap-1 mt-1 text-orange-400">
                  <span className="text-2xl font-black">{data.current_streak}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">dias</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Resoluções */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex items-start gap-4 hover:border-slate-700/80 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 text-amber-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Questões Respondidas</p>
              <h3 className="text-3xl font-black mt-1 text-white">{data.total_answers}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Exercícios focados em fixação de conteúdo.
              </p>
            </div>
          </div>

          {/* Card 2: Precisão */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex items-start gap-4 hover:border-slate-700/80 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Taxa de Acertos</p>
              <h3 className="text-3xl font-black mt-1 text-white">{accuracyRate}%</h3>
              <p className="text-xs text-slate-400 mt-1">
                {data.correct_answers} acertos do total de respostas.
              </p>
            </div>
          </div>

          {/* Card 3: Redações */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex items-start gap-4 hover:border-slate-700/80 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20 text-violet-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Redações Enviadas</p>
              <h3 className="text-3xl font-black mt-1 text-white">{data.essays_submitted}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Redações em preparação para a banca examinadora.
              </p>
            </div>
          </div>
        </section>

        {/* Informações Extras & Dica */}
        <section className="bg-slate-900/30 border border-slate-800/50 rounded-card p-6 flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 text-left">
            <Trophy className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <h4 className="font-black text-sm italic">Parabéns pelo incentivo!</h4>
              <p className="text-xs text-slate-400">
                O engajamento e a constância diária são os pilares mais importantes para a aprovação.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400 font-bold flex items-center gap-1.5 shrink-0">
            Pontuação total acumulada: <span className="text-amber-400 font-black">{data.total_xp} XP</span>
          </div>
        </section>
      </div>
    </div>
  );
}
