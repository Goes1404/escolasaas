'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Plus, CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/app/lib/supabase';

type Props = { userId: string };

type Goal = {
  id: string;
  title: string;
  goal_type: 'questions' | 'essays' | 'simulados' | 'hours' | 'custom';
  target_value: number;
  current_value: number;
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  status: 'active' | 'completed' | 'abandoned';
  deadline: string | null;
};

const TYPE_LABEL: Record<Goal['goal_type'], string> = {
  questions: 'Questões',
  essays: 'Redações',
  simulados: 'Simulados',
  hours: 'Horas de estudo',
  custom: 'Personalizada',
};

const PERIOD_LABEL: Record<Goal['period'], string> = {
  daily: 'hoje',
  weekly: 'esta semana',
  monthly: 'este mês',
  custom: 'até a data',
};

export function GoalsWidget({ userId }: Props) {
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('student_goals')
      .select('id, title, goal_type, target_value, current_value, period, status, deadline')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (alive) setGoals((data ?? []) as Goal[]);
      });
    return () => { alive = false; };
  }, [userId]);

  if (goals === null) {
    return <div className="h-44 rounded-[2.5rem] bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-muted/20 overflow-hidden">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minhas Metas</p>
              <p className="text-base font-black text-primary italic leading-none">
                {goals.length === 0 ? 'Defina sua primeira' : `${goals.length} ativa${goals.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/student/goals"
            className="h-11 w-11 min-w-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center shadow-md"
            aria-label="Adicionar meta"
          >
            <Plus className="h-4 w-4 text-white" />
          </Link>
        </div>

        {goals.length === 0 ? (
          <Link
            href="/dashboard/student/goals"
            className="block py-6 text-center border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50 transition-colors"
          >
            <Circle className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-[11px] font-black text-emerald-700 italic">Defina sua primeira meta</p>
            <p className="text-[10px] text-emerald-600/70 mt-0.5">Ex: 20 questões por dia</p>
          </Link>
        ) : (
          <div className="space-y-3">
            {goals.map(g => {
              const pct = Math.min(100, Math.round((g.current_value / Math.max(1, g.target_value)) * 100));
              const done = pct >= 100;
              return (
                <div key={g.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-primary italic truncate">{g.title}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {TYPE_LABEL[g.goal_type]} · {PERIOD_LABEL[g.period]}
                      </p>
                    </div>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-black text-emerald-700 shrink-0">
                        {g.current_value}/{g.target_value}
                      </span>
                    )}
                  </div>
                  <Progress value={pct} className="h-1.5 rounded-full bg-slate-200" />
                </div>
              );
            })}
            <Link
              href="/dashboard/student/goals"
              className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-800 py-2"
            >
              Gerenciar metas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
