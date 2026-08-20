'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/app/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { awardXP } from '@/lib/gamification';
import { medirCarregamentoDeTela } from '@/lib/perf';
import { trackFalha } from '@/lib/telemetry';
import { trackMissionProgress } from '@/lib/missions';
import {
  Brain, ChevronLeft, ChevronRight, Loader2, RefreshCw,
  CheckCircle2, XCircle, Zap, BookOpen, Filter,
  RotateCcw, Star, TrendingUp, Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Types ─────────────────────────────────────────────────────── */
type CardRow = {
  id: string;            // flashcard_progress.id (or '' if new)
  question_id: string;
  question_text: string;
  options: { key: string; text: string }[];
  correct_answer: string;
  explanation: string | null;
  subject: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;   // ISO date
  last_reviewed: string | null; // ISO date da última revisão
};

type Rating = 'again' | 'hard' | 'good' | 'easy';

const INTERVAL: Record<Rating, number> = {
  again: 1,
  hard:  3,
  good:  7,
  easy:  14,
};

const EF_DELTA: Record<Rating, number> = {
  again: -0.3,
  hard:  -0.15,
  good:  0,
  easy:  0.15,
};

const RATING_LABELS: Record<Rating, { label: string; color: string; bg: string }> = {
  again: { label: 'Errei',    color: 'text-red-600',    bg: 'bg-red-50 border-red-200 hover:bg-red-100' },
  hard:  { label: 'Difícil',  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100' },
  good:  { label: 'Bom',      color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  easy:  { label: 'Fácil',    color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
};

/* ─── SM-2 calculation ───────────────────────────────────────────── */
function computeNext(card: CardRow, rating: Rating): Partial<CardRow> {
  const newEF = Math.max(1.3, card.ease_factor + EF_DELTA[rating]);
  const newInterval = rating === 'again' ? 1 : INTERVAL[rating];
  const newReps = rating === 'again' ? 0 : card.repetitions + 1;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  return {
    ease_factor:   newEF,
    interval_days: newInterval,
    repetitions:   newReps,
    next_review:   nextDate.toISOString().slice(0, 10),
    last_reviewed: new Date().toISOString(),
  };
}

/* ─── FlipCard component ─────────────────────────────────────────── */
function FlipCard({
  card,
  revealed,
  onReveal,
}: {
  card: CardRow;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div
      className="relative w-full"
      style={{ perspective: '1200px', minHeight: '480px' }}
    >
      {/* Front */}
      <motion.div
        className="absolute inset-0 w-full rounded-[2rem] bg-white border border-slate-200 shadow-xl flex flex-col items-center p-6 md:p-8 gap-4 cursor-pointer select-none overflow-y-auto"
        style={{ backfaceVisibility: 'hidden' }}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
        onClick={!revealed ? onReveal : undefined}
      >
        {card.subject && (
          <Badge className="bg-violet-100 text-violet-700 border-none font-black text-[9px] uppercase tracking-widest shrink-0">
            {card.subject}
          </Badge>
        )}
        <p className="text-base md:text-lg font-bold text-primary italic text-center leading-relaxed max-w-lg shrink-0">
          {card.question_text.replace('[IMAGEM_PENDENTE]', '')}
        </p>

        {card.options && card.options.length > 0 && (
          <div className="w-full max-w-md space-y-1.5 my-2 shrink-0">
            {card.options.map((opt) => (
              <div key={opt.key} className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-medium">
                <span className="shrink-0 font-black text-primary uppercase">{opt.key})</span>
                <span className="flex-1 leading-normal">{opt.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
          <Brain className="h-3.5 w-3.5" />
          <span>Toque para revelar a resposta</span>
        </div>
      </motion.div>

      {/* Back */}
      <motion.div
        className="absolute inset-0 w-full rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-700 shadow-xl flex flex-col p-8 gap-5 overflow-y-auto"
        style={{ backfaceVisibility: 'hidden', rotateY: 180 }}
        animate={{ rotateY: revealed ? 360 : 180 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-3">Resposta Correta</p>
          <div className="flex items-center gap-3 bg-white/15 rounded-2xl px-4 py-3 border border-white/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
            <p className="text-white font-black text-lg">
              {card.correct_answer})&nbsp;
              {card.options.find(o => o.key === card.correct_answer)?.text}
            </p>
          </div>
        </div>
        {card.explanation && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-2">Explicação</p>
            <p className="text-white/80 text-sm leading-relaxed font-medium">{card.explanation}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function FlashcardsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [cards, setCards]         = useState<CardRow[]>([]);
  const [index, setIndex]         = useState(0);
  const [revealed, setRevealed]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // `xp` é o que o servidor realmente concedeu, não `acertos × 5`: um card já
  // pontuado antes paga 0 quando volta na revisão, e o teto diário também pode
  // cortar o valor. Somar na mão faria a tela prometer XP que não existe.
  const [session, setSession]     = useState({ reviewed: 0, correct: 0, xp: 0 });
  const [done, setDone]           = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [subjects, setSubjects]   = useState<string[]>([]);
  const startTime = useRef(Date.now());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setDone(false);
    setIndex(0);
    setRevealed(false);
    setSession({ reviewed: 0, correct: 0, xp: 0 });
    const inicioCarga = Date.now();
    try {
      // Get exam_target to scope questions
      const rawTarget = (profile?.exam_target || 'enem').toLowerCase();
      const audience  = rawTarget.includes('etec') ? 'etec' : 'enem';

      // 1. Fetch cards due today
      const today = new Date().toISOString().slice(0, 10);

      const { data: existing } = await supabase
        .from('flashcard_progress')
        .select(`
          id, question_id, ease_factor, interval_days, repetitions, next_review, last_reviewed,
          questions(question_text, options, correct_answer, explanation, subjects(name), exams:exam_questions(exams(exam_type)))
        `)
        .eq('student_id', user.id)
        .lte('next_review', today)
        .limit(20);

      // 2. If less than 10, also fetch NEW questions (not yet in flashcard_progress)
      const existingQIds = (existing || []).map(r => r.question_id);
      let newCards: any[] = [];
      if ((existing || []).length < 10) {
        const needed = 10 - (existing || []).length;
        let newQ = supabase
          .from('questions')
          .select('id, question_text, options, correct_answer, explanation, subjects(name)')
          .limit(needed * 3); // fetch extra to allow audience filter

        if (existingQIds.length > 0) {
          newQ = newQ.not('id', 'in', `(${existingQIds.join(',')})`);
        }

        const { data: rawNew } = await newQ;

        // Filter by audience via exam_questions join (best-effort)
        newCards = (rawNew || []).slice(0, needed).map((q: any) => ({
          id: '',
          question_id: q.id,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          subject: q.subjects?.name || null,
          ease_factor: 2.5,
          interval_days: 1,
          repetitions: 0,
          next_review: today,
          last_reviewed: null,
        }));
      }

      const existingRows: CardRow[] = (existing || []).map((r: any) => ({
        id: r.id,
        question_id: r.question_id,
        question_text: r.questions?.question_text || '',
        options: r.questions?.options || [],
        correct_answer: r.questions?.correct_answer || '',
        explanation: r.questions?.explanation || null,
        subject: r.questions?.subjects?.name || null,
        ease_factor: r.ease_factor,
        interval_days: r.interval_days,
        repetitions: r.repetitions,
        next_review: r.next_review,
        last_reviewed: r.last_reviewed,
      }));

      const all = [...existingRows, ...newCards].filter(c => c.question_text);

      // Extract unique subjects
      const subs = Array.from(new Set(all.map(c => c.subject).filter(Boolean))) as string[];
      setSubjects(subs);
      setCards(all);
      medirCarregamentoDeTela('flashcards', inicioCarga);
    } catch (e: any) {
      trackFalha('flashcards_falha_carregar', e);
      toast({ title: 'Erro ao carregar flashcards', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => { load(); }, [load]);

  const filteredCards = filterSubject === 'all'
    ? cards
    : cards.filter(c => c.subject === filterSubject);

  const currentCard = filteredCards[index];

  const handleRate = async (rating: Rating) => {
    if (!user || !currentCard || submitting) return;
    setSubmitting(true);

    const update = computeNext(currentCard, rating);
    const isCorrect = rating === 'good' || rating === 'easy';

    try {
      if (currentCard.id) {
        // Update existing
        await supabase
          .from('flashcard_progress')
          .update({ ...update })
          .eq('id', currentCard.id);
      } else {
        // Insert new
        await supabase
          .from('flashcard_progress')
          .upsert({
            student_id:   user.id,
            question_id:  currentCard.question_id,
            ...update,
          }, { onConflict: 'student_id,question_id' });
      }

      // Update card in local state
      setCards(prev => prev.map((c, i) =>
        c.question_id === currentCard.question_id ? { ...c, ...update } : c
      ));

      // XP & mission
      const ganho = isCorrect
        ? await awardXP(user.id, 5, 'flashcard_correct', currentCard.question_id)
        : 0;

      const newSession = {
        reviewed: session.reviewed + 1,
        correct:  session.correct + (isCorrect ? 1 : 0),
        xp:       session.xp + ganho,
      };
      setSession(newSession);

      if (newSession.reviewed % 5 === 0) {
        await trackMissionProgress(supabase, user.id, 'answer_questions', 5);
      }

      // Advance
      if (index + 1 >= filteredCards.length) {
        setDone(true);
      } else {
        setIndex(i => i + 1);
        setRevealed(false);
      }
    } catch (e: any) {
      trackFalha('flashcard_progresso_nao_salvo', e);
      toast({ title: 'Erro ao salvar progresso', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-4 flex-col">
      <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">
        Preparando seus cards...
      </p>
    </div>
  );

  if (done || filteredCards.length === 0) {
    const pct = session.reviewed > 0 ? Math.round((session.correct / session.reviewed) * 100) : 0;
    const elapsed = Math.round((Date.now() - startTime.current) / 60000);
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 space-y-6 animate-in fade-in duration-700">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white shadow-2xl">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10 text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h1 className="text-3xl font-black italic tracking-tighter">Sessão Concluída!</h1>
            <p className="text-white/60 text-sm">
              {session.reviewed === 0 ? 'Nenhum card disponível para hoje.' : `${session.reviewed} cards revisados em ~${elapsed} min`}
            </p>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { label: 'Revisados', value: session.reviewed, icon: Brain },
                { label: 'Acertos', value: `${pct}%`, icon: CheckCircle2 },
                { label: 'XP ganhos', value: `+${session.xp}`, icon: Zap },
              ].map(stat => (
                <div key={stat.label} className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
                  <p className="text-2xl font-black leading-none">{stat.value}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={load} className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest gap-2">
          <RefreshCw className="h-4 w-4" />
          Nova Sessão
        </Button>
      </div>
    );
  }

  const progress = filteredCards.length > 0 ? ((index) / filteredCards.length) * 100 : 0;

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 space-y-5 animate-in fade-in duration-700">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-2xl">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/20 inline-flex items-center gap-1.5">
              <Brain className="h-2.5 w-2.5" /> Flash Cards
            </span>
            <h1 className="text-2xl font-black italic tracking-tighter leading-tight">
              Revisão<br />
              <span className="text-white/60">Espaçada 🧠</span>
            </h1>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-black leading-none">{index + 1}<span className="text-sm text-white/40">/{filteredCards.length}</span></p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mt-1">cards hoje</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-1 bg-white/15 rounded-full overflow-hidden">
          <div className="h-full bg-white/70 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        {/* Session stats */}
        <div className="flex gap-3 mt-3">
          <div className="flex items-center gap-1 text-[10px] font-bold text-white/60">
            <CheckCircle2 className="h-3 w-3 text-emerald-300" />{session.correct} acertos
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-white/60">
            <XCircle className="h-3 w-3 text-red-300" />{session.reviewed - session.correct} erros
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-white/60 ml-auto">
            <Zap className="h-3 w-3 text-amber-300" />+{session.xp} XP
          </div>
        </div>
      </section>

      {/* Subject filter */}
      {subjects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide -mx-1 px-1">
          {['all', ...subjects].map(sub => (
            <button
              key={sub}
              onClick={() => { setFilterSubject(sub); setIndex(0); setRevealed(false); }}
              className={`shrink-0 h-7 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider border transition-all ${
                filterSubject === sub
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {sub === 'all' ? 'Todas' : sub}
            </button>
          ))}
        </div>
      )}

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.question_id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          <FlipCard
            card={currentCard}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        </motion.div>
      </AnimatePresence>

      {/* Rating buttons */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Como foi?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(RATING_LABELS) as [Rating, typeof RATING_LABELS[Rating]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handleRate(key)}
                  disabled={submitting}
                  className={`h-14 rounded-2xl border font-black text-sm transition-all active:scale-95 touch-manipulation ${cfg.bg} ${cfg.color} disabled:opacity-40`}
                >
                  <span className="block">{cfg.label}</span>
                  <span className="text-[9px] font-bold opacity-60">{
                    key === 'again' ? '+1 dia' :
                    key === 'hard'  ? '+3 dias' :
                    key === 'good'  ? '+7 dias' : '+14 dias'
                  }</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interval info */}
      {!revealed && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/60">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="font-medium">
            Próx. revisão em {currentCard.interval_days} dia{currentCard.interval_days !== 1 ? 's' : ''}
            {currentCard.repetitions > 0 ? ` · ${currentCard.repetitions}ª repetição` : ' · Novo card'}
          </span>
        </div>
      )}
    </div>
  );
}
