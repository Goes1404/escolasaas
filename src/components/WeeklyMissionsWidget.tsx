'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { awardXP } from '@/lib/gamification';
import { CheckCircle2, Circle, Zap, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Mission = {
  id:          string;
  title:       string;
  description: string | null;
  icon:        string;
  goal:        number;
  xp_reward:   number;
  action_type: string;
  progress:    number;
  completed:   boolean;
  xp_granted:  boolean;
};

type Props = { userId: string; examTarget?: string };

export function WeeklyMissionsWidget({ userId, examTarget }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading]   = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = (() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(d);
        mon.setDate(diff);
        return mon.toISOString().slice(0, 10);
      })();

      const tg = (examTarget || 'enem').toLowerCase().includes('etec') ? 'etec' : 'enem';

      // Busca missões da semana (all + target específico)
      const { data: missionData } = await supabase
        .from('weekly_missions')
        .select('id, title, description, icon, goal, xp_reward, action_type')
        .eq('week_start', weekStart)
        .or(`target.eq.all,target.eq.${tg}`)
        .order('xp_reward', { ascending: true });

      if (!missionData || missionData.length === 0) { setLoading(false); return; }

      // Busca progresso do aluno
      const { data: progressData } = await supabase
        .from('mission_progress')
        .select('mission_id, progress, completed, xp_granted')
        .eq('student_id', userId)
        .in('mission_id', missionData.map(m => m.id));

      const progMap = new Map(
        (progressData ?? []).map(p => [p.mission_id, p])
      );

      setMissions(missionData.map(m => {
        const p = progMap.get(m.id);
        return {
          ...m,
          progress:   p?.progress   ?? 0,
          completed:  p?.completed  ?? false,
          xp_granted: p?.xp_granted ?? false,
        };
      }));
    } catch (e) {
      console.error('[WeeklyMissionsWidget]', e);
    } finally {
      setLoading(false);
    }
  }, [userId, examTarget]);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async (mission: Mission) => {
    if (!mission.completed || mission.xp_granted || claiming) return;
    setClaiming(mission.id);
    try {
      await awardXP(userId, mission.xp_reward, 'mission_complete', mission.id);
      await supabase
        .from('mission_progress')
        .update({ xp_granted: true })
        .eq('student_id', userId)
        .eq('mission_id', mission.id);
      setMissions(prev => prev.map(m =>
        m.id === mission.id ? { ...m, xp_granted: true } : m
      ));
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return <div className="h-48 rounded-[2.5rem] bg-muted/20 animate-pulse" />;
  if (missions.length === 0) return null;

  const completedCount = missions.filter(m => m.completed).length;

  return (
    <div className="gradient-border bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="aurora-dark dot-grid p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Esta Semana</p>
            <p className="text-lg font-black italic leading-tight">Missões Semanais 🎖️</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black leading-none">{completedCount}<span className="text-sm text-white/50">/{missions.length}</span></p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">concluídas</p>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <div className="mt-4 space-y-1">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-amber-400 transition-all duration-1000"
              style={{ width: `${Math.round((completedCount / missions.length) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Lista de missões */}
      <div className="p-4 space-y-2">
        {missions.map(mission => {
          const pct = Math.min(100, Math.round((mission.progress / mission.goal) * 100));
          const isComplete = mission.completed;
          const canClaim = isComplete && !mission.xp_granted;

          return (
            <div
              key={mission.id}
              className={`rounded-2xl border p-3 transition-all ${
                isComplete && mission.xp_granted
                  ? 'bg-emerald-50/50 border-emerald-100'
                  : isComplete
                  ? 'bg-amber-50 border-amber-200 shadow-sm'
                  : 'bg-slate-50 border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Ícone + estado */}
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-base ${
                  isComplete && mission.xp_granted ? 'bg-emerald-100' :
                  isComplete ? 'bg-amber-100' : 'bg-slate-100'
                }`}>
                  {isComplete && mission.xp_granted
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    : mission.icon}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-black leading-tight truncate ${
                      isComplete && mission.xp_granted ? 'text-emerald-700 line-through opacity-60' :
                      isComplete ? 'text-amber-800' : 'text-slate-800'
                    }`}>
                      {mission.title}
                    </p>
                    <span className="shrink-0 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      +{mission.xp_reward} XP
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {mission.progress}/{mission.goal} · {mission.description}
                  </p>

                  {/* Barra de progresso individual */}
                  {!isComplete && (
                    <div className="mt-1.5 h-1 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Botão de claim ou check */}
                {canClaim ? (
                  <button
                    onClick={() => handleClaim(mission)}
                    disabled={!!claiming}
                    className="shrink-0 h-9 px-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[10px] font-black uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                  >
                    {claiming === mission.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Zap className="h-3.5 w-3.5" /> Resgatar</>}
                  </button>
                ) : isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                )}
              </div>
            </div>
          );
        })}

        {/* Link para ranking */}
        <Link
          href="/dashboard/student/ranking"
          className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group"
        >
          <span className="text-xs font-black text-primary">Ver Ranking da Semana 🏆</span>
          <ChevronRight className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors" />
        </Link>
      </div>
    </div>
  );
}
