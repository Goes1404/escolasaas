'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Target, CheckCircle2, Zap, ChevronRight, Flame } from 'lucide-react';
import Link from 'next/link';

type Props = {
  userId: string;
  profile: any;
};

export function DailyQuestionCard({ userId, profile }: Props) {
  const [state, setState] = useState<'loading' | 'available' | 'done' | 'empty'>('loading');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const rawTarget = (
        profile?.exam_target || profile?.profile_type || 'enem'
      ).toLowerCase();
      const audience = rawTarget.includes('etec') ? 'etec' : 'enem';

      // Busca questão do dia
      const { data: dq } = await supabase
        .from('daily_questions')
        .select('id, questions(subjects(name))')
        .eq('target_audience', audience)
        .eq('scheduled_date', today)
        .maybeSingle();

      if (!dq) { setState('empty'); return; }

      const q = dq.questions as any;
      setSubjectName(q?.subjects?.name ?? null);

      // Verifica se já respondeu
      const { data: ans } = await supabase
        .from('daily_question_answers')
        .select('is_correct')
        .eq('student_id', userId)
        .eq('daily_id', dq.id)
        .maybeSingle();

      if (ans) {
        setIsCorrect(ans.is_correct);
        setState('done');
      } else {
        setState('available');
      }
    };

    load().catch(() => setState('empty'));
  }, [userId, profile]);

  if (state === 'loading') {
    return <div className="h-28 rounded-[2.5rem] bg-muted/20 animate-pulse" />;
  }

  if (state === 'empty') return null;

  return (
    <Link href="/dashboard/student/daily" className="block group">
      <div className={`gradient-border overflow-hidden rounded-[2.5rem] shadow-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl ${
        state === 'done' && isCorrect  ? 'bg-emerald-500' :
        state === 'done' && !isCorrect ? 'bg-slate-700' :
        'bg-gradient-to-br from-amber-500 to-orange-600'
      } text-white`}>
        <div className="dot-grid p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/10">
                {state === 'done'
                  ? <CheckCircle2 className="h-5 w-5 text-white" />
                  : <Target className="h-5 w-5 text-white" />}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/60">
                  {state === 'done' ? 'Concluído!' : 'Disponível agora'}
                </p>
                <p className="text-sm font-black italic leading-tight">
                  Desafio do Dia 🎯
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50 group-hover:text-white transition-colors shrink-0" />
          </div>

          {state === 'available' && (
            <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-3 py-2 border border-white/10">
              <Zap className="h-3.5 w-3.5 text-yellow-200 shrink-0" />
              <span className="text-xs font-bold">+25 XP pelo acerto de hoje</span>
              {subjectName && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-xs font-semibold text-white/70">{subjectName}</span>
                </>
              )}
            </div>
          )}

          {state === 'done' && (
            <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-3 py-2 border border-white/10">
              <Flame className="h-3.5 w-3.5 text-yellow-200 shrink-0" />
              <span className="text-xs font-bold">
                {isCorrect ? 'Você acertou! Streak mantido 🔥' : 'Você respondeu. Volte amanhã!'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
