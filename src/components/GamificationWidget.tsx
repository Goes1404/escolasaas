'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getLevel, BADGE_META, BadgeType, XP_LEVELS } from '@/lib/gamification';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';

type Props = { userId: string };

export function GamificationWidget({ userId }: Props) {
  const [xp, setXp] = useState<number | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<BadgeType[]>([]);

  useEffect(() => {
    const load = async () => {
      const [profileRes, badgesRes] = await Promise.all([
        supabase.from('profiles').select('xp_points').eq('id', userId).single(),
        supabase.from('user_badges').select('badge_type').eq('user_id', userId),
      ]);
      setXp((profileRes.data?.xp_points as number) ?? 0);
      setEarnedBadges((badgesRes.data ?? []).map((b: any) => b.badge_type as BadgeType));
    };
    load();
  }, [userId]);

  if (xp === null) return null;

  const { current, next, progressPct } = getLevel(xp);
  const allBadges = Object.keys(BADGE_META) as BadgeType[];

  return (
    <div className="gradient-border bg-white rounded-[2.5rem] shadow-xl overflow-hidden glow-orange group">
      <div className="aurora-dark dot-grid p-6 space-y-5 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Seu Nível Atual</p>
            <p className="text-xl font-black italic leading-none text-white">
              Nível {current.level} · <span className="text-accent">{current.label}</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black text-white leading-none">{xp}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/65">XP Total</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/65">
            <span>{current.minXP} XP</span>
            {next && <span>Próximo: {next.minXP} XP</span>}
          </div>
          <Progress value={progressPct} className="h-2.5 rounded-full bg-white/10" />
          {next && (
            <p className="text-[9px] text-accent font-black uppercase tracking-wider text-right">
              Faltam {next.minXP - xp} XP para {next.label}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 pt-2">

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Conquistas</p>
        <div className="grid grid-cols-3 gap-2">
          {allBadges.map(badge => {
            const meta = BADGE_META[badge];
            const earned = earnedBadges.includes(badge);
            return (
              <div
                key={badge}
                title={meta.description}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-[transform,box-shadow] duration-300
                  ${earned ? 'bg-accent/5 border-accent/20 glow-orange' : 'bg-muted/20 border-transparent opacity-40 grayscale'}`}
              >
                <span className="text-xl">{meta.icon}</span>
                <span className="text-[8px] font-black text-center leading-tight text-primary">{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}
