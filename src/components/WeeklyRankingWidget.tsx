'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Medal, Crown, Zap, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';

type RankEntry = {
  student_id:  string;
  full_name:   string;
  avatar_url:  string | null;
  weekly_xp:   number;
  position:    number;
};

type Props = {
  userId: string;
  examTarget?: string | null;
};

export function WeeklyRankingWidget({ userId, examTarget }: Props) {
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [myEntry, setMyEntry] = useState<RankEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Ranking único: ENEM e ETEC disputam juntos, sem filtro por trilha.
      const { data, error } = await supabase
        .from('weekly_ranking')
        .select('student_id, full_name, avatar_url, exam_target, weekly_xp, position')
        .order('position', { ascending: true })
        .limit(5);

      if (error) throw error;

      const list = (data ?? []) as RankEntry[];
      setRanking(list);

      const me = list.find(r => r.student_id === userId);
      if (me) {
        setMyEntry(me);
      } else {
        const { data: myData } = await supabase
          .from('weekly_ranking')
          .select('student_id, full_name, avatar_url, weekly_xp, position')
          .eq('student_id', userId)
          .maybeSingle();
        if (myData) setMyEntry(myData as RankEntry);
      }
    } catch {
      // fail silent
    } finally {
      setLoading(false);
    }
  }, [userId, examTarget]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="h-48 rounded-card bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="gradient-border bg-white rounded-card shadow-xl overflow-hidden group border border-slate-100">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ranking Semanal</p>
              <p className="text-sm font-black italic text-slate-800 leading-none">
                Líderes da Semana
              </p>
            </div>
          </div>
          <Link href="/dashboard/student/ranking" className="text-slate-400 hover:text-primary transition-colors">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* List of top 5 */}
        <div className="space-y-2">
          {ranking.length === 0 ? (
            <p className="text-xs font-semibold text-muted-foreground italic text-center py-4">Nenhuma atividade esta semana</p>
          ) : (
            ranking.map((entry) => {
              const isMe = entry.student_id === userId;
              const initials = entry.full_name?.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

              return (
                <div
                  key={entry.student_id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all ${
                    isMe
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50/50 border-slate-100 group-hover:border-slate-200'
                  }`}
                >
                  {/* Position / Icon */}
                  <div className="w-6 text-center flex items-center justify-center shrink-0">
                    {entry.position === 1 ? (
                      <Crown className="h-4.5 w-4.5 text-amber-500" />
                    ) : entry.position === 2 ? (
                      <Medal className="h-4 w-4 text-slate-400" />
                    ) : entry.position === 3 ? (
                      <Medal className="h-4 w-4 text-amber-700" />
                    ) : (
                      <span className="text-xs font-black text-slate-400">{entry.position}º</span>
                    )}
                  </div>

                  {/* Avatar */}
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt={entry.full_name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-[10px] shrink-0">
                      {initials}
                    </div>
                  )}

                  {/* Name */}
                  <p className={`text-xs font-black truncate flex-1 ${isMe ? 'text-amber-900' : 'text-slate-700'}`}>
                    {entry.full_name?.split(' ')[0]} {entry.full_name?.split(' ')[1] || ''}
                    {isMe && <span className="text-[8px] font-bold text-amber-600 bg-amber-100 rounded px-1 ml-1">você</span>}
                  </p>

                  {/* XP */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span className="text-[11px] font-black text-slate-700">{entry.weekly_xp}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* My Position Row if outside top 5 */}
        {myEntry && myEntry.position > 5 && (
          <div className="pt-2 border-t border-dashed border-slate-100">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="w-6 text-center text-xs font-black text-amber-700">{myEntry.position}º</span>
              {myEntry.avatar_url ? (
                <img src={myEntry.avatar_url} alt={myEntry.full_name} className="h-8 w-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-[10px] shrink-0">
                  {myEntry.full_name?.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'}
                </div>
              )}
              <p className="text-xs font-black text-amber-900 truncate flex-1">
                {myEntry.full_name?.split(' ')[0]} (você)
              </p>
              <div className="flex items-center gap-0.5 shrink-0">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span className="text-[11px] font-black text-slate-700">{myEntry.weekly_xp}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
