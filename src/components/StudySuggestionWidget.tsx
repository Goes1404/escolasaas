'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { BrainCircuit, Compass, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Suggestion = {
  subjectId: string;
  subjectName: string;
  accuracy: number;
  trailId?: string;
  trailTitle?: string;
  reason: string;
};

type Props = { userId: string };

export function StudySuggestionWidget({ userId }: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const compute = async () => {
      try {
        // Last 20 simulation attempts
        const { data: attempts } = await supabase
          .from('simulation_attempts')
          .select('subject_id, score, total_questions, subjects(name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (attempts && attempts.length > 0) {
          // Group by subject and compute accuracy
          const bySubject: Record<string, { name: string; correct: number; total: number }> = {};
          for (const a of attempts as any[]) {
            const sid = a.subject_id;
            if (!bySubject[sid]) bySubject[sid] = { name: a.subjects?.name ?? sid, correct: 0, total: 0 };
            bySubject[sid].correct += a.score;
            bySubject[sid].total += a.total_questions;
          }

          let worstId = '';
          let worstPct = 101;
          for (const [id, s] of Object.entries(bySubject)) {
            const pct = s.total > 0 ? (s.correct / s.total) * 100 : 0;
            if (pct < worstPct) { worstPct = pct; worstId = id; }
          }

          if (worstId) {
            const s = bySubject[worstId];
            const pct = Math.round(worstPct);

            // Try to find a trail for this subject
            const { data: trail } = await supabase
              .from('trails')
              .select('id, title')
              .ilike('title', `%${s.name}%`)
              .eq('status', 'published')
              .maybeSingle();

            setSuggestion({
              subjectId: worstId,
              subjectName: s.name,
              accuracy: pct,
              trailId: trail?.id,
              trailTitle: trail?.title,
              reason: `Você acertou apenas ${pct}% em ${s.name} recentemente.`,
            });
            return;
          }
        }

        // Fallback: first trail with 0% progress
        const { data: zeroProgress } = await supabase
          .from('user_progress')
          .select('trail_id, trails(id, title, category)')
          .eq('user_id', userId)
          .eq('percentage', 0)
          .maybeSingle();

        if (zeroProgress) {
          const trail = (zeroProgress as any).trails;
          setSuggestion({
            subjectId: '',
            subjectName: trail?.category ?? 'Trilha',
            accuracy: 0,
            trailId: trail?.id,
            trailTitle: trail?.title,
            reason: 'Você ainda não começou esta trilha.',
          });
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    compute();
  }, [userId]);

  if (loading || !suggestion) return null;

  return (
    <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-[2rem] border border-primary/10 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sugestão de Estudo</p>
          <p className="text-lg font-black text-primary italic leading-none">Foque Nisso Hoje</p>
        </div>
      </div>

      <div className="bg-white/70 rounded-2xl p-4 space-y-1">
        <p className="text-base font-black text-primary">{suggestion.subjectName}</p>
        <p className="text-xs text-muted-foreground font-medium">{suggestion.reason}</p>
      </div>

      <div className="flex gap-2">
        {suggestion.subjectId && (
          <Button asChild size="sm" className="flex-1 h-10 rounded-xl bg-primary text-white font-black text-xs shadow-lg">
            <Link href={`/dashboard/student/simulados?subject=${suggestion.subjectId}`}>
              <FileText className="h-4 w-4 mr-1" />
              Praticar Questões
            </Link>
          </Button>
        )}
        {suggestion.trailId && (
          <Button asChild size="sm" variant="outline" className="flex-1 h-10 rounded-xl font-black text-xs border-primary/20">
            <Link href={`/dashboard/trails`}>
              <Compass className="h-4 w-4 mr-1" />
              Ver Trilha
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
