'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/app/lib/supabase';
import { grantXP, XP_VALUES } from '@/lib/xp';
import { fixEncoding } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { trackMissionProgress } from '@/lib/missions';
import { celebrate, haptic } from '@/lib/celebrate';
import {
  Zap, CheckCircle2, XCircle, Lock, Trophy,
  Flame, Target, ChevronRight, Loader2, Star,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────
type Option = { key: string; value?: string; text?: string };

type DailyQuestion = {
  daily_id:    string;
  question_id: string;
  question_text: string;
  options:     Option[];
  correct_answer: string;
  explanation: string | null;
  subject_name: string | null;
  scheduled_date: string;
};

type AnswerState = 'unanswered' | 'correct' | 'wrong';

// ─── Helpers ─────────────────────────────────────────────────
function parseOptions(raw: any): Option[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ─── Component ───────────────────────────────────────────────
export default function DailyQuestionPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [daily, setDaily]           = useState<DailyQuestion | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [xpEarned, setXpEarned]     = useState<number | null>(null);
  const [countdown, setCountdown]   = useState('');
  const [streakCount, setStreakCount] = useState<number>(0);

  // Countdown até meia-noite
  useEffect(() => {
    const tick = () => {
      const now      = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      setCountdown(formatCountdown(midnight.getTime() - now.getTime()));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const fetchDaily = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Determina o público do aluno
      const rawTarget = (
        profile?.exam_target ||
        user?.user_metadata?.exam_target ||
        profile?.profile_type ||
        'enem'
      ).toLowerCase();
      const audience = rawTarget.includes('etec') ? 'etec' : 'enem';

      // 1. Busca a questão do dia
      const { data: dq, error: dqErr } = await supabase
        .from('daily_questions')
        .select(`
          id,
          scheduled_date,
          question_id,
          questions (
            id,
            question_text,
            options,
            correct_answer,
            explanation,
            subjects ( name )
          )
        `)
        .eq('target_audience', audience)
        .eq('scheduled_date', today)
        .maybeSingle();

      if (dqErr) throw dqErr;

      if (!dq) {
        setDaily(null);
        setLoading(false);
        return;
      }

      const q = dq.questions as any;
      setDaily({
        daily_id:       dq.id,
        question_id:    dq.question_id,
        question_text:  q.question_text,
        options:        parseOptions(q.options),
        correct_answer: q.correct_answer,
        explanation:    q.explanation ?? null,
        subject_name:   q.subjects?.name ?? null,
        scheduled_date: dq.scheduled_date,
      });

      // 2. Verifica se já respondeu hoje
      const { data: ans } = await supabase
        .from('daily_question_answers')
        .select('is_correct, selected_option')
        .eq('student_id', user.id)
        .eq('question_date', today)
        .eq('daily_id', dq.id)
        .maybeSingle();

      if (ans) {
        setAlreadyDone(true);
        setSelected(ans.selected_option);
        setAnswerState(ans.is_correct ? 'correct' : 'wrong');
      }

      // 3. Busca streak atual
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', user.id)
        .maybeSingle();
      setStreakCount(prof?.current_streak ?? 0);

    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => { fetchDaily(); }, [fetchDaily]);

  const handleSubmit = async () => {
    if (!selected || !daily || !user || alreadyDone) return;
    setSubmitting(true);
    try {
      const today     = new Date().toISOString().slice(0, 10);
      const isCorrect = selected.toUpperCase() === daily.correct_answer.toUpperCase();

      // Salva a resposta
      await supabase.from('daily_question_answers').insert({
        student_id:     user.id,
        daily_id:       daily.daily_id,
        question_date:  today,
        selected_option: selected,
        is_correct:     isCorrect,
      });

      // Concede XP
      const action = isCorrect ? 'daily_question_correct' : 'daily_question_wrong';
      const { xpEarned: xp } = await grantXP(supabase, user.id, action, daily.question_id);
      setXpEarned(xp);

      // Atualiza progresso das missões
      trackMissionProgress(supabase, user.id, 'daily_question', 1).then(() => {});
      trackMissionProgress(supabase, user.id, 'answer_questions', 1).then(() => {});

      setAnswerState(isCorrect ? 'correct' : 'wrong');
      setAlreadyDone(true);
      setStreakCount(s => s + (s === 0 || isCorrect ? 1 : 0));

      // A festa acontece AQUI, no instante do acerto — não num efeito que
      // observe `answerState`. A tela já respondida remonta a cada visita, e
      // pelo efeito o confete voltaria a cair toda vez que o aluno abrisse.
      if (isCorrect) celebrate();
      haptic(isCorrect ? [12, 40, 12] : 25);

      toast({
        title: isCorrect ? 'Resposta correta' : 'Quase lá',
        description: `+${xp} XP ganhos`,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar resposta', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-sm font-bold text-muted-foreground italic">Carregando desafio...</p>
        </div>
      </div>
    );
  }

  if (!daily) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="aurora-dark rounded-card border-2 border-foreground p-12 text-white shadow-hard">
          <Target className="h-16 w-16 mx-auto mb-4 opacity-40" />
          <h2 className="u-page-title text-2xl">Sem desafio hoje</h2>
          <p className="text-white/50 mt-2 text-sm">
            O professor ainda não agendou a questão de hoje. Volte mais tarde!
          </p>
        </div>
      </div>
    );
  }

  const optionLabels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6 pb-24 animate-in fade-in duration-700">

      {/* ── HERO ──
          Nível alto: cor chapada e sombra dura no lugar do blur difuso. O
          amarelo é o acento da marca, e é ele que carrega a ideia de "hoje,
          agora" — o âmbar/laranja anterior não existe na paleta. */}
      <section className="relative overflow-hidden rounded-card border-2 border-foreground bg-brand-yellow p-6 md:p-8 text-foreground shadow-hard">
        <div className="absolute inset-0 dot-grid opacity-[0.07] pointer-events-none rounded-card" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="u-label inline-flex items-center gap-1 border-2 border-foreground bg-foreground text-background px-2.5 py-1 rounded-control whitespace-nowrap">
                <Zap className="h-2.5 w-2.5" />
                Desafio diário
              </span>
              {daily.subject_name && (
                <span className="u-label border-2 border-foreground px-2.5 py-1 rounded-control whitespace-nowrap">
                  {daily.subject_name}
                </span>
              )}
            </div>
            <h1 className="u-page-title text-[clamp(1.5rem,6vw,2.25rem)] leading-[1.25]">
              Questão do dia
            </h1>
            <p className="u-label !text-foreground/60">
              {new Date(daily.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: '2-digit', month: 'long'
              })}
            </p>
          </div>

          {/* Ofensiva e contagem: os dois números da tela, em display */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 border-2 border-foreground bg-background px-2.5 py-1.5 rounded-control">
              <Flame className="h-3.5 w-3.5 md:h-4 md:w-4 text-brand-pink" />
              <span className="u-num text-base md:text-lg leading-none">{streakCount}</span>
              <span className="u-label !text-[8px] !text-foreground/50">dias</span>
            </div>
            <div className="text-right">
              <p className="u-label !text-[8px] !text-foreground/50 whitespace-nowrap">Nova em</p>
              <p className="u-num text-xs md:text-sm whitespace-nowrap tabular-nums">{countdown}</p>
            </div>
          </div>
        </div>

        {/* XP em jogo */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-2 border-foreground bg-background rounded-control px-4 py-3">
          <Star className="h-4 w-4 shrink-0 text-brand-yellow fill-brand-yellow stroke-foreground" />
          <span className="u-num text-base">+{XP_VALUES.daily_question_correct} XP</span>
          <span className="text-xs font-medium text-foreground/60">pelo acerto</span>
          <span className="w-full text-[11px] font-medium text-foreground/45 sm:w-auto sm:before:content-['·'] sm:before:mr-2">
            +{XP_VALUES.daily_question_wrong} XP mesmo errando
          </span>
        </div>
      </section>

      {/* ── CARD DA QUESTÃO ── */}
      <div className="bg-card rounded-card border-2 border-foreground overflow-hidden">
        {/* Barra superior de status */}
        {/* Verde e vermelho ficam: aqui a cor é SINAL (certo/errado), não
            decoração. O que sai é o gradiente. */}
        <div className={`h-1.5 w-full border-b-2 border-foreground transition-all duration-500 ${
          answerState === 'correct' ? 'bg-emerald-500' :
          answerState === 'wrong'   ? 'bg-red-400' :
          'bg-brand-yellow'
        }`} />

        <div className="p-6 md:p-8 space-y-6">
          {/* Texto da questão */}
          <p className="text-slate-800 font-semibold text-base leading-relaxed whitespace-pre-line">
            {fixEncoding(daily.question_text)}
          </p>

          {/* Alternativas */}
          <div className="space-y-3">
            {daily.options.map((opt, idx) => {
              const label     = optionLabels[idx] ?? String.fromCharCode(65 + idx);
              const isSelected = selected === opt.key;
              const isCorrect  = opt.key.toUpperCase() === daily.correct_answer.toUpperCase();
              const revealed   = alreadyDone;

              let cardStyle = 'border-slate-100 bg-slate-50/50 hover:border-primary/30 hover:bg-primary/5';
              if (revealed && isCorrect)
                cardStyle = 'border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100';
              else if (revealed && isSelected && !isCorrect)
                cardStyle = 'border-red-300 bg-red-50';
              else if (isSelected && !revealed)
                cardStyle = 'border-primary bg-primary/5 shadow-sm';

              return (
                <button
                  key={opt.key}
                  disabled={alreadyDone || submitting}
                  onClick={() => setSelected(opt.key)}
                  className={`w-full flex items-start gap-4 p-4 rounded-card border-2 text-left transition-all duration-200 group ${cardStyle} ${
                    !alreadyDone ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {/* Label */}
                  <span className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                    revealed && isCorrect  ? 'bg-emerald-500 text-white' :
                    revealed && isSelected && !isCorrect ? 'bg-red-400 text-white' :
                    isSelected && !revealed ? 'bg-primary text-white' :
                    'bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
                  }`}>
                    {revealed && isCorrect  ? <CheckCircle2 className="h-4 w-4" /> :
                     revealed && isSelected && !isCorrect ? <XCircle className="h-4 w-4" /> :
                     label}
                  </span>

                  <span className={`text-sm font-medium leading-relaxed flex-1 ${
                    revealed && isCorrect  ? 'text-emerald-800' :
                    revealed && isSelected && !isCorrect ? 'text-red-700' :
                    isSelected && !revealed ? 'text-primary font-semibold' :
                    'text-slate-700'
                  }`}>
                    {fixEncoding(opt.text || opt.value)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Botão de confirmar. `h-13` não existe na escala do Tailwind — a
              classe era descartada e o botão ficava na altura padrão. */}
          {!alreadyDone && (
            <Button
              variant="arcade"
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="w-full h-14 text-sm uppercase tracking-wider font-black"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Confirmando...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />Confirmar Resposta</>
              )}
            </Button>
          )}

          {/* Resultado */}
          {alreadyDone && (
            <div className={`rounded-card p-5 space-y-3 border-2 ${
              answerState === 'correct'
                ? 'bg-emerald-50 border-emerald-600 shadow-hard'
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex items-center gap-3">
                {answerState === 'correct'
                  ? <Trophy className="h-6 w-6 text-emerald-600" />
                  : <XCircle className="h-6 w-6 text-red-500" />}
                <div>
                  <p className={`u-display text-base leading-[1.3] ${answerState === 'correct' ? 'text-emerald-800' : 'text-red-700'}`}>
                    {answerState === 'correct' ? 'Resposta correta' : 'Resposta incorreta'}
                  </p>
                  {xpEarned !== null && (
                    <p className="mt-1 text-xs font-bold text-muted-foreground">
                      <span className="u-num">+{xpEarned}</span> XP adicionados ao seu perfil
                    </p>
                  )}
                </div>
              </div>

              {daily.explanation && (
                <div className="space-y-1">
                  <p className="u-label">Explicação</p>
                  <p className={`text-sm leading-relaxed font-medium ${
                    answerState === 'correct' ? 'text-emerald-900' : 'text-red-900'
                  }`}>
                    {fixEncoding(daily.explanation)}
                  </p>
                </div>
              )}

              {answerState === 'wrong' && (
                <p className={`text-xs font-semibold text-red-600`}>
                  Resposta correta:{' '}
                  <span className="font-black">
                    {optionLabels[daily.options.findIndex(o => o.key.toUpperCase() === daily.correct_answer.toUpperCase())] ?? daily.correct_answer}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Já respondido (sem XP novo) */}
          {alreadyDone && xpEarned === null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 rounded-xl px-4 py-3">
              <Lock className="h-3.5 w-3.5" />
              <span>Você já respondeu o desafio de hoje. Volte amanhã!</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA para Simulados ── */}
      {alreadyDone && (
        <div className="bg-card rounded-card border-2 border-foreground p-6 flex items-center justify-between gap-4">
          <div>
            <p className="u-display text-base">Quer mais questões?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pratique com simulados completos e ganhe ainda mais XP.
            </p>
          </div>
          <Button asChild variant="arcade" className="shrink-0 text-xs uppercase tracking-wider font-black">
            <a href="/dashboard/student/simulados">
              Simulados <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
