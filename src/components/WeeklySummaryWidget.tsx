'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, BarChart3, Target, BookOpen, Zap } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

type Props = { userId: string };

type Recommendation = { icon?: string; title?: string; description?: string };

type SummaryData = {
  week_start: string;
  summary: string;
  metrics: {
    totalAnswered?: number;
    accuracy?: number;
    essaysCount?: number;
    essayAvg?: number;
    examsCount?: number;
    examAvg?: number;
    weakestSubjects?: { name: string; accuracy: number; total: number }[];
  } | null;
  recommendations: Recommendation[] | null;
};

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export function WeeklySummaryWidget({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  useEffect(() => {
    let alive = true;
    const weekStart = getCurrentWeekStart();
    supabase
      .from('weekly_summaries')
      .select('week_start, summary, metrics, recommendations')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data) setSummary(data as SummaryData);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [userId]);

  /**
   * `forcar` distingue as duas chamadas que antes eram idênticas: gerar pela
   * primeira vez e regenerar. Sem isso, o botão de recarregar devolvia o mesmo
   * resumo em cache — o ícone girava e nada mudava na tela.
   */
  const generate = async (forcar = false) => {
    setGenerating(true);
    setError(null);
    setIndisponivel(false);
    try {
      const res = await fetch('/api/student/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forcar }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // 503 com `indisponivel` é a IA fora do ar, não erro do aluno: merece
        // uma mensagem diferente de "falha ao gerar".
        if (data?.indisponivel) setIndisponivel(true);
        throw new Error(data.error ?? 'Falha ao gerar resumo');
      }
      setSummary(data.summary);
    } catch (e: any) {
      setError(e.message ?? 'Erro inesperado');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="h-48 rounded-card bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-card shadow-xl border border-muted/20 overflow-hidden">
      <div className="aurora-dark dot-grid p-6 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center border border-white/10">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Resumo Semanal · Aurora IA</p>
              <p className="text-base font-black italic leading-none">Sua semana de estudos</p>
            </div>
          </div>
          {summary && (
            <button
              onClick={() => generate(true)}
              disabled={generating}
              title="Gerar de novo com os dados mais recentes"
              className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className={`p-3 rounded-2xl text-[11px] font-bold border ${
            indisponivel
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {error}
            {indisponivel && (
              <p className="font-medium mt-1 opacity-80">
                Seu progresso continua sendo registrado normalmente — só o texto da Aurora está em espera.
              </p>
            )}
          </div>
        )}

        {!summary && !generating && (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs font-medium text-slate-600 italic">
              A Aurora pode gerar uma análise da sua semana com base no seu desempenho.
            </p>
            <button
              onClick={() => generate(false)}
              className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg hover:scale-[1.03] active:scale-95 transition-all"
            >
              <Sparkles className="h-4 w-4 text-accent" /> Gerar resumo
            </button>
          </div>
        )}

        {generating && !summary && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Aurora analisando...</p>
          </div>
        )}

        {summary && (
          <>
            {summary.metrics && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-violet-50 rounded-2xl p-3 text-center border border-violet-100">
                  <BarChart3 className="h-3.5 w-3.5 text-violet-600 mx-auto mb-1" />
                  <p className="text-xl font-black text-violet-700 leading-none">{summary.metrics.accuracy ?? 0}%</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-violet-500 mt-1">Acerto</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                  <Target className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-xl font-black text-emerald-700 leading-none">{summary.metrics.totalAnswered ?? 0}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mt-1">Questões</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
                  <BookOpen className="h-3.5 w-3.5 text-amber-600 mx-auto mb-1" />
                  <p className="text-xl font-black text-amber-700 leading-none">{summary.metrics.essaysCount ?? 0}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mt-1">Redações</p>
                </div>
              </div>
            )}

            <div className="prose prose-sm max-w-none">
              <p className="text-xs text-slate-700 italic font-medium leading-relaxed whitespace-pre-line">
                {summary.summary}
              </p>
            </div>

            {summary.recommendations && summary.recommendations.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-accent" /> Próximos passos
                </p>
                {summary.recommendations.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-xl shrink-0">{r.icon ?? '✨'}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-primary italic leading-tight">{r.title ?? '—'}</p>
                      <p className="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">{r.description ?? ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
