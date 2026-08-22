'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Loader2, Award, RotateCw, BrainCircuit, Library, AlertCircle,
  Target, Shuffle, ClipboardList, CheckCircle2, XCircle, BookOpen,
  Timer, ChevronRight, ChevronDown, ChevronUp, Zap, Trophy, Play, Pause, LogOut,
  Sun, Moon, TrendingUp, Flame, Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/app/lib/supabase';
import { useToast } from '@/hooks/use-toast';
// Confete e vibração agora são compartilhados (mesma paleta em toda a
// plataforma, e com guarda de prefers-reduced-motion). Importados com o
// nome antigo para não mexer nas dezenas de chamadas desta tela.
import { celebrate as triggerConfetti, haptic as triggerHaptic } from '@/lib/celebrate';
import { SupportingTextBlock } from '@/components/SupportingTextBlock';
import {
  awardXP, checkAndAwardBadges, getTotalAnswered, BADGE_META,
} from '@/lib/gamification';
import { trackMissionProgress } from '@/lib/missions';
import { allowedExamTypesFor, examTypeLabel } from '@/lib/exam-types';
import { trackAcao, trackFalha } from '@/lib/telemetry';

// ─── constants ────────────────────────────────────────────────────────────────
const ALL_TOPICS = '_all';
/** Sentinela do seletor de banca: mistura as bancas da trilha, a pedido do aluno. */
const ALL_BOARDS = '_all_boards';

type Mode = 'especifico' | 'materia' | 'completo';
type Subject     = { id: string; name: string; question_count: number };
type MicroTopic  = { id: string; name: string };
type Question    = {
  id: string; question_text: string;
  options: { key?: string; letter?: string; text: string }[];
  correct_answer: string; subjects: { name: string } | null;
  year: number; explanation?: string; supporting_text?: string; image_url?: string;
};
type Answer = {
  questionId: string; selected: string; correct: string; explanation?: string;
  question_text: string; options: { key?: string; letter?: string; text: string }[];
  subject: string | null;
};
type GameState = 'loading_subjects' | 'idle' | 'loading_questions' | 'active' | 'finished' | 'error';

// ─── SVG score ring ───────────────────────────────────────────────────────────
function ScoreRing({ pct, size = 110 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function SimuladoPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [gameState, setGameState]             = useState<GameState>('loading_subjects');
  const [mode, setMode]                       = useState<Mode>('materia');
  const [subjects, setSubjects]               = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [microTopics, setMicroTopics]         = useState<MicroTopic[]>([]);
  const [selectedMicroTopicId, setSelectedMicroTopicId] = useState<string>(ALL_TOPICS);
  /** Banca escolhida: um `exam_type` específico ou ALL_BOARDS (mistura consentida). */
  const [selectedBoard, setSelectedBoard]     = useState<string>(ALL_BOARDS);

  const [questions, setQuestions]   = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers]       = useState<Answer[]>([]);

  const [simSize, setSimSize]       = useState<number>(10);
  const [timeLeft, setTimeLeft]     = useState<number | null>(null);
  const [isPaused, setIsPaused]     = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // cronômetro crescente (tempo gasto)
  // XP que o servidor concedeu de fato nesta tentativa. Antes o placar somava
  // `acertos × 5 + 20` no cliente, o que passou a mentir quando concluir o
  // simulado deixou de valer XP — e já mentia ao bater o teto diário.
  const [xpGained, setXpGained]     = useState(0);
  // Active theme (dark or light)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Accordion index for finished screen gabarito
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const [resultadosOficiais, setResultadosOficiais] = useState<{ title: string; score: number; total: number; completed_at: string; answers: { q: number; selected: string }[]; answerKey: string[] | null }[]>([]);
  const [expandedOficial, setExpandedOficial] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('exam_attempts')
      .select('score, completed_at, answers, exam:exams!inner(title, exam_type, answer_key)')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .then(({ data }) => {
        const oficiais = (data || [])
          .filter((a: any) => a.exam?.exam_type === 'simulado_importado')
          .map((a: any) => ({ title: a.exam.title, score: Number(a.score), total: 60, completed_at: a.completed_at, answers: a.answers || [], answerKey: a.exam.answer_key || null }));
        setResultadosOficiais(oficiais);
      });
  }, [user]);

  /**
   * Bancas que a trilha do aluno permite. O aluno de ETEC só vê ETEC; o da
   * trilha ENEM vê ENEM e FUVEST (a FUVEST faz parte da trilha ENEM).
   */
  const allowedBoards = useMemo(
    () => allowedExamTypesFor(profile?.exam_target || user?.user_metadata?.exam_target || profile?.profile_type),
    [profile?.exam_target, profile?.profile_type, user?.user_metadata?.exam_target]
  );

  /** Bancas que a busca deve considerar, conforme a escolha do aluno. */
  const activeBoards = useMemo(
    () => (selectedBoard === ALL_BOARDS ? allowedBoards : [selectedBoard]),
    [selectedBoard, allowedBoards]
  );

  // ── data fetching ──
  const fetchSubjects = useCallback(async () => {
    setGameState('loading_subjects');
    try {
      // Conta só as questões das bancas escolhidas — senão o número exibido em
      // cada matéria mentiria ao filtrar por banca.
      const { data, error } = await supabase
        .rpc('get_subjects_with_question_count_by_boards', { p_boards: activeBoards });
      if (error) {
        // Sem a contagem não dá para saber o que está vazio; mostra tudo em vez
        // de esconder matérias que talvez tenham questões.
        const { data: fb } = await supabase.from('subjects').select('id, name').order('name');
        setSubjects((fb ?? []).map(s => ({ id: s.id, name: s.name, question_count: 0 })));
      } else {
        // Só matérias que existem para a banca escolhida.
        //
        // A função usa LEFT JOIN e devolve todas as matérias cadastradas,
        // inclusive as que não têm nenhuma questão. Na prática isso oferecia
        // ao aluno de ETEC matérias que nem caem no Vestibulinho — Sociologia,
        // Filosofia e Espanhol não existem nessa prova —, e ele escolhia uma
        // delas para bater num estado vazio. O problema não era falta de
        // conteúdo: era oferecer o que não existe.
        setSubjects((data ?? []).filter((s: any) => Number(s.question_count) > 0));
      }
      setGameState('idle');
    } catch {
      setGameState('error');
    }
  }, [activeBoards]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  useEffect(() => {
    if (!selectedSubjectId || mode !== 'especifico') { setMicroTopics([]); return; }
    supabase.from('micro_topics').select('id, name').eq('subject_id', selectedSubjectId).order('name')
      .then(({ data }) => setMicroTopics(data ?? []));
  }, [selectedSubjectId, mode]);

  /**
   * Monta a busca de questões.
   *
   * `ignoreAudience` relaxa apenas o público-alvo (`target_audience`), que é a
   * trilha do aluno. O filtro de BANCA nunca é relaxado: misturar questões de
   * vestibulares diferentes sem o aluno pedir é justamente o que não pode
   * acontecer. Quando ele escolhe "Todas", a busca ainda fica restrita às
   * bancas da trilha dele — "todas" nunca significa o banco inteiro.
   */
  const buildQuery = (ignoreAudience = false) => {
    let q = supabase.from('questions').select('*, subjects(name)');
    if ((mode === 'materia' || mode === 'especifico') && selectedSubjectId)
      q = q.eq('subject_id', selectedSubjectId) as any;
    if (mode === 'especifico' && selectedMicroTopicId && selectedMicroTopicId !== ALL_TOPICS)
      q = q.eq('micro_topic_id', selectedMicroTopicId) as any;

    // Banca — sempre aplicada, inclusive no fallback.
    q = q.in('exam_board', activeBoards) as any;

    if (!ignoreAudience) {
      const audience = (
        profile?.exam_target || user?.user_metadata?.exam_target ||
        profile?.profile_type || user?.user_metadata?.profile_type || 'enem'
      ).toLowerCase().trim();
      const ua = audience.includes('etec') ? 'etec' : 'enem';
      q = q.or(`target_audience.eq.all,target_audience.eq.${ua},target_audience.is.null`) as any;
    }
    return q.limit(200);
  };

  const startSimulado = useCallback(async () => {
    if (mode !== 'completo' && !selectedSubjectId) return;
    setGameState('loading_questions');
    try {
      let { data: raw, error } = await buildQuery(false);
      
      // Fallback se retornar vazio ou der erro
      if (error || !raw || raw.length === 0) {
        const { data: fallbackRaw, error: fallbackError } = await buildQuery(true);
        if (!fallbackError && fallbackRaw && fallbackRaw.length > 0) {
          raw = fallbackRaw;
        } else if (error) {
          throw error;
        }
      }

      const items = raw ?? [];
      const shuffled = items.sort(() => 0.5 - Math.random()).slice(0, simSize);
      if (shuffled.length === 0) {
        // Estado vazio honesto: diz qual banca e matéria faltam, em vez de
        // completar às escondidas com questões de outro vestibular.
        const bancaLabel = selectedBoard === ALL_BOARDS ? null : examTypeLabel(selectedBoard);
        const materiaLabel = subjects.find(s => s.id === selectedSubjectId)?.name;
        // Mede a hipótese de que o aluno não estuda porque não há conteúdo
        // para a trilha dele. Sem isto, "banco vazio" é indistinguível de
        // "aluno desistiu".
        trackAcao('simulado_sem_questoes', {
          banca: selectedBoard, materia: materiaLabel ?? 'nenhuma', modo: mode,
        });
        toast({
          title: bancaLabel ? `Ainda não temos questões de ${bancaLabel}` : 'Sem questões',
          description: bancaLabel
            ? `Não há questões de ${bancaLabel}${materiaLabel ? ` em ${materiaLabel}` : ''} por enquanto. Troque a banca ou a matéria para continuar treinando.`
            : 'Não há questões para este filtro.',
          variant: 'destructive',
        });
        setGameState('idle'); return;
      }
      const formatted: Question[] = shuffled.map((q: any) => {
        let opts = q.options;
        if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { opts = []; } }
        return { ...q, options: opts ?? [], subjects: typeof q.subjects === 'string' ? JSON.parse(q.subjects) : q.subjects };
      });
      setQuestions(formatted); setCurrentIndex(0); setAnswers([]); setSelectedAnswer(null);
      setTimeLeft(formatted.length * 3.5 * 60); setIsPaused(false);
      setElapsedSeconds(0);
      setXpGained(0);
      setExpandedIndex(null);
      setGameState('active');
      trackAcao('simulado_iniciado', { questoes: formatted.length, banca: selectedBoard, modo: mode });
    } catch (e: any) {
      trackFalha('simulado_falha_iniciar', e, { banca: selectedBoard, modo: mode });
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
      setGameState('error');
    }
  }, [mode, selectedSubjectId, selectedMicroTopicId, selectedBoard, activeBoards, subjects, profile, toast, simSize]);

  // ── timer ──
  useEffect(() => {
    if (gameState !== 'active' || timeLeft === null || isPaused) return;
    if (timeLeft <= 0) {
      toast({ title: 'Tempo esgotado!', description: 'Seu simulado será finalizado.', variant: 'destructive' });
      setGameState('finished'); return;
    }
    const t = setInterval(() => setTimeLeft(p => (p !== null ? p - 1 : null)), 1000);
    return () => clearInterval(t);
  }, [gameState, timeLeft, isPaused, toast]);

  // ── cronômetro crescente (tempo gasto) — congela ao pausar e ao finalizar ──
  useEffect(() => {
    if (gameState !== 'active' || isPaused) return;
    const t = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [gameState, isPaused]);

  // Confetti trigger on game finish
  useEffect(() => {
    if (gameState === 'finished') {
      triggerHaptic([40, 80, 40]);
      const cleanup = triggerConfetti();
      return cleanup;
    }
  }, [gameState]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const norm = (v: string | undefined | null) => (v ?? '').trim().toUpperCase();
  const score = answers.filter(a => norm(a.selected) === norm(a.correct)).length;
  const pct   = answers.length > 0 ? Math.round((score / answers.length) * 100) : 0;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const currentQuestion = questions[currentIndex];

  const handleNext = async () => {
    if (!currentQuestion) return;
    const q = currentQuestion;
    const isSkipped = selectedAnswer === null;
    const newAnswer: Answer = {
      questionId: q.id, selected: selectedAnswer || 'PULADO', correct: q.correct_answer,
      explanation: q.explanation, question_text: q.question_text, options: q.options,
      subject: q.subjects?.name ?? null,
    };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (user) {
      // Sem `await` de propósito: a navegação para a próxima questão não pode
      // esperar a rede. Mas a falha deixou de ser silenciosa — antes era
      // `.then(() => {})`, e uma resposta que não gravava sumia do histórico
      // sem ninguém perceber. É esse histórico que alimenta "Meu Desempenho" e
      // o Treino Específico.
      void supabase
        .from('student_question_answers')
        .insert({
          student_id: user.id, question_id: q.id,
          selected_option: selectedAnswer,
          is_correct: isSkipped ? false : norm(selectedAnswer) === norm(q.correct_answer),
        })
        .then(({ error }) => {
          if (error) trackFalha('resposta_nao_gravada', error, { modo: mode });
        });
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      triggerHaptic(15);
    } else {
      const s = newAnswers.filter(a => norm(a.selected) === norm(a.correct)).length;
      if (user) {
        // Registra a tentativa (inclui o tempo gasto). subject_id só no modo matéria.
        // O id da tentativa vira a referência do XP: é ele que impede o mesmo
        // simulado de pontuar duas vezes se a chamada for repetida.
        supabase.from('simulation_attempts').insert({
          user_id: user.id,
          subject_id: mode === 'materia' && selectedSubjectId ? selectedSubjectId : null,
          score: s,
          total_questions: newAnswers.length,
          duration_seconds: elapsedSeconds,
        }).select('id').single().then(async ({ data: attempt }) => {
          const ref = attempt?.id;
          if (!ref) return;
          // O valor de cada ação é decidido no servidor; aqui só dizemos o que
          // aconteceu — quantos acertos, e que o simulado foi concluído.
          const ganho =
            (s > 0 ? await awardXP(user.id, 0, 'correct_answer', ref, s) : 0) +
            (await awardXP(user.id, 0, 'simulado_complete', ref));
          // Mostra o que o servidor realmente concedeu: pode ser menos que o
          // esperado se o aluno já bateu o teto do dia, e concluir o simulado
          // deixou de valer XP por si só — só os acertos contam.
          setXpGained(ganho);
          trackAcao('simulado_concluido', { acertos: s, total: newAnswers.length, xp: ganho, segundos: elapsedSeconds });
          if (ganho > 0) {
            toast({ title: `+${ganho} XP ganhos!`, description: `${s} acertos neste simulado.` });
          }
        });
        trackMissionProgress(supabase, user.id, 'answer_questions', newAnswers.length).then(() => {});
        trackMissionProgress(supabase, user.id, 'complete_simulados', 1).then(() => {});
        const total = await getTotalAnswered(user.id);
        const badges = await checkAndAwardBadges(user.id, {
          totalAnswered: total + newAnswers.length,
          isPerfectSimulado: s === newAnswers.length && newAnswers.length > 0,
        });
        if (badges.length > 0)
          toast({ title: '🏆 Conquista desbloqueada!', description: badges.map(b => BADGE_META[b].label).join(', ') });
      }
      setGameState('finished');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // LOADING
  // ════════════════════════════════════════════════════════════════════════════
  if (gameState === 'loading_subjects' || gameState === 'loading_questions') {
    return (
      <div className="flex h-[75vh] w-full items-center justify-center flex-col gap-5">
        <div className="relative">
          <div className="h-20 w-20 rounded-3xl aurora-dark flex items-center justify-center shadow-2xl">
            <BrainCircuit className="h-9 w-9 text-white animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#4CCCED] flex items-center justify-center shadow-lg">
            <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
          </div>
        </div>
        <p className="text-sm font-black text-slate-800 italic animate-pulse">
          {gameState === 'loading_subjects' ? 'Carregando matérias...' : 'Montando seu simulado personalizado...'}
        </p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aguarde um momento</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ERROR
  // ════════════════════════════════════════════════════════════════════════════
  if (gameState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-5 px-4">
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-black text-xl text-primary italic">Algo deu errado</p>
          <p className="text-sm text-slate-400 mt-1">Não foi possível carregar as matérias.</p>
        </div>
        <Button onClick={fetchSubjects} className="rounded-xl bg-primary font-black px-8">
          <RotateCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVE — FULLSCREEN DISTRACTION-FREE SIMULATOR
  // ════════════════════════════════════════════════════════════════════════════
  if (gameState === 'active' && currentQuestion) {
    const opt = (o: any, i: number) => o.key || o.letter || String.fromCharCode(65 + i).toLowerCase();
    const urgentTime = timeLeft !== null && timeLeft < 180; // 3 min
    const isDark = theme === 'dark';

    // Theme responsive class mappings
    const containerTheme = isDark ? 'bg-[#070709] text-slate-100' : 'bg-[#f8fafc] text-slate-900';
    const headerTheme = isDark ? 'bg-[#0c0c0f] border-white/5' : 'bg-white border-slate-200 shadow-sm';
    const titleTextTheme = isDark ? 'text-white' : 'text-slate-800';
    const subTextTheme = isDark ? 'text-white/40' : 'text-slate-500';
    const colLeftTheme = isDark ? 'border-white/5' : 'border-slate-200/80';
    const colRightTheme = isDark ? 'bg-[#0b0b0e] border-white/5' : 'bg-white border-slate-200/80';
    const supportTextTheme = isDark ? 'bg-[#0b0b0d] border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700';
    const bodyTextTheme = isDark ? 'text-white/90' : 'text-slate-800';

    return (
      <div className={`fixed inset-0 z-[9999] ${containerTheme} flex flex-col h-screen select-none overflow-hidden font-sans transition-colors duration-300`}>
        
        {/* Confetti canvas placeholder */}
        <canvas id="confetti-canvas" className="fixed inset-0 pointer-events-none z-[10000]" />

        {/* ── Pause Overlay ── */}
        {isPaused && (
          <div className={`absolute inset-0 z-[10001] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 backdrop-blur-md
            ${isDark ? 'bg-[#070709]/95 text-white' : 'bg-white/95 text-slate-900 border border-slate-200 shadow-2xl'}`}>
            <div className="h-16 w-16 rounded-3xl bg-[#4CCCED]/10 border border-[#4CCCED]/25 flex items-center justify-center mb-6">
              <Timer className="h-8 w-8 text-orange-500 animate-pulse" />
            </div>
            <h2 className={`text-2xl font-black italic mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Simulado Pausado</h2>
            <p className={`text-xs font-semibold mb-6 max-w-xs leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
              O cronômetro está congelado. Faça uma pausa rápida para respirar e retome quando estiver pronto para focar.
            </p>
            <Button 
              onClick={() => {
                triggerHaptic(20);
                setIsPaused(false);
              }} 
              className="btn-orange-neon rounded-2xl h-14 px-8 text-slate-800 font-black text-sm uppercase tracking-wider glow-orange border-none"
            >
              <Play className="h-4 w-4 mr-2" />
              Retomar Simulado
            </Button>
          </div>
        )}

        {/* ── Sticky HUD Header ── */}
        <header className={`h-20 ${headerTheme} px-4 sm:px-6 flex items-center justify-between shrink-0 z-50 transition-colors duration-300`}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#4CCCED]/15 border border-[#4CCCED]/25 flex items-center justify-center shrink-0">
              <BrainCircuit className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className={`font-black text-xs uppercase tracking-widest leading-none ${titleTextTheme}`}>
                  Questão {currentIndex + 1} de {questions.length}
                </p>
                <Badge className={`${isDark ? 'bg-white/5 text-white/50 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200'} font-bold text-[7px] uppercase tracking-wider px-1.5 h-4.5 rounded-md`}>
                  {currentQuestion.subjects?.name || 'Geral'}
                </Badge>
              </div>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${subTextTheme}`}>
                ENEM / ETEC · {currentQuestion.year}
              </p>
            </div>
          </div>

          {/* Central Controls (Timer, Theme Toggle, Exit) */}
          <div className="flex items-center gap-2">
            {/* Cronômetro — tempo decorrido */}
            <div
              title="Tempo decorrido"
              className={`hidden sm:flex items-center gap-1.5 rounded-2xl px-3 py-2 border tabular-nums
                ${isDark ? 'bg-white/5 border-white/10 text-white/55' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
            >
              <Clock className="h-3.5 w-3.5 opacity-70" />
              <span className="text-xs font-black tracking-widest">{formatTime(elapsedSeconds)}</span>
            </div>

            {/* Timer */}
            {timeLeft !== null && (
              <div 
                onClick={() => {
                  triggerHaptic(20);
                  setIsPaused(true);
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 border cursor-pointer active:scale-95 transition-all
                  ${urgentTime 
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' 
                    : isDark 
                      ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/8' 
                      : 'bg-slate-100 border-slate-250 text-slate-700 hover:bg-slate-200'}`}
              >
                <Timer className={`h-4 w-4 ${urgentTime ? 'text-red-400' : 'text-orange-400'}`} />
                <span className="text-xs font-black tabular-nums tracking-widest">{formatTime(timeLeft)}</span>
                <Pause className="h-3 w-3 opacity-40 ml-1.5" />
              </div>
            )}

            {/* Theme Selector Toggle (Sol/Lua) */}
            <button
              onClick={() => {
                triggerHaptic(15);
                setTheme(isDark ? 'light' : 'dark');
              }}
              className={`h-10 w-10 rounded-xl flex items-center justify-center border transition-all active:scale-95
                ${isDark 
                  ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10' 
                  : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-250'}`}
              title={isDark ? "Alternar para Tema Claro" : "Alternar para Tema Escuro"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Exit button */}
            <button
              onClick={() => {
                triggerHaptic(30);
                if (confirm("Deseja sair do simulado? Seu progresso atual nesta sessão será perdido.")) {
                  setGameState("idle");
                }
              }}
              className={`h-10 px-3.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider
                ${isDark 
                  ? 'bg-white/5 border-white/10 text-white/60 hover:border-red-500/30 hover:text-red-400' 
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-red-500/30 hover:text-red-500'}`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Global Progress Bar */}
        <div className="h-1 bg-white/5 w-full shrink-0 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Main Panel (Two Columns on Desktop) ── */}
        <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0 transition-colors duration-300">
          
          {/* LEFT COLUMN: Question Content */}
          <div className={`flex-1 md:overflow-y-auto p-5 sm:p-8 space-y-6 md:border-r ${colLeftTheme} transition-colors duration-300`}>
            {currentQuestion.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentQuestion.image_url}
                alt="Imagem de apoio à questão"
                className={`w-full rounded-2xl object-contain max-h-64 border ${isDark ? 'border-white/5 bg-[#0d0d10]' : 'border-slate-200 bg-white'}`}
              />
            )}
            
            {currentQuestion.supporting_text && (
              <div className={`border rounded-2xl p-4 sm:p-5 transition-colors duration-300 ${supportTextTheme}`}>
                <SupportingTextBlock text={currentQuestion.supporting_text} />
              </div>
            )}

            <div className="space-y-4">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500 bg-[#4CCCED]/10 border border-[#4CCCED]/20 px-2 py-0.5 rounded-full">Enunciado</span>
              <p className={`text-sm sm:text-base font-bold leading-[1.8] whitespace-pre-wrap break-words italic pr-2 transition-colors duration-300 ${bodyTextTheme}`}>
                {currentQuestion.question_text.replace(/\[IMAGEM_PENDENTE\]/g, '').trim()}
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Alternatives Gabarito & Action */}
          <div className={`w-full md:w-[400px] shrink-0 p-5 sm:p-8 flex flex-col justify-between ${colRightTheme} md:overflow-y-auto md:h-full pb-28 md:pb-8 border-t md:border-t-0 transition-colors duration-300`}>
            <div className="space-y-5">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-orange-400/80 mb-2">
                Selecione a alternativa correta:
              </p>

              <div className="space-y-3">
                {(currentQuestion.options || []).map((o: any, i: number) => {
                  const key = opt(o, i);
                  const isSelected = selectedAnswer === key;
                  return (
                    <motion.div
                      key={key}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => {
                        triggerHaptic(15);
                        setSelectedAnswer(key);
                      }}
                      className={`group flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.99]
                        ${isSelected
                          ? isDark
                            ? 'border-[#4CCCED] bg-[#4CCCED]/15 shadow-[0_0_25px_rgba(76,204,237,0.18)] text-white'
                            : 'border-[#4CCCED] bg-[#4CCCED]/5 shadow-[0_0_20px_rgba(76,204,237,0.08)] text-[#0F7A95] font-bold'
                          : isDark
                            ? 'border-white/5 bg-[#121215]/80 text-white/80 hover:border-white/10'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-sm italic transition-all shrink-0
                        ${isSelected
                          ? 'bg-[#4CCCED] text-slate-950 shadow-[0_0_10px_rgba(76,204,237,0.5)]'
                          : isDark
                            ? 'bg-white/5 border border-white/10 text-white/40 group-hover:border-white/20 group-hover:text-white/60'
                            : 'bg-slate-200 border border-slate-350 text-slate-500 group-hover:border-slate-400 group-hover:text-slate-700'}`}
                      >
                        {key.toUpperCase()}
                      </div>
                      <span className="font-bold text-xs sm:text-sm leading-relaxed break-words pt-1">{o.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom floating button on mobile / normal in column for desktop */}
            <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 border-t transition-all duration-300 md:relative md:bottom-auto md:p-0 md:bg-transparent md:border-0 md:mt-8
              ${isDark ? 'bg-[#0a0a0d]/90 backdrop-blur-xl border-white/5' : 'bg-white/90 backdrop-blur-xl border-slate-200'}`}>
              <Button
                onClick={handleNext}
                className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest bg-[#4CCCED] text-slate-950 hover:bg-orange-600 shadow-xl shadow-orange-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2 touch-manipulation border-none"
              >
                {selectedAnswer === null ? (
                  currentIndex < questions.length - 1 ? (
                    <>
                      <span>Pular Questão</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4" />
                      <span>Finalizar Simulado (Pular)</span>
                    </>
                  )
                ) : (
                  currentIndex < questions.length - 1 ? (
                    <>
                      <span>Confirmar e Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4" />
                      <span>Finalizar Simulado</span>
                    </>
                  )
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FINISHED — SCORECARD GAMER & REVIEW ACCORDIONS
  // ════════════════════════════════════════════════════════════════════════════
  if (gameState === 'finished') {
    const resultColor = pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
    const resultLabel = pct >= 70 ? 'Desempenho de Elite!' : pct >= 50 ? 'Bom progresso!' : 'Continue praticando!';
    const resultBg    = pct >= 70 ? 'from-[#0d2e1b] to-[#070709]' : pct >= 50 ? 'from-[#3a2007] to-[#070709]' : 'from-[#380e14] to-[#070709]';

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-700 pb-28 px-2 sm:px-4">
        
        {/* Confetti canvas */}
        <canvas id="confetti-canvas" className="fixed inset-0 pointer-events-none z-[10000]" />

        {/* Premium Gamer Scorecard */}
        <div className={`rounded-card bg-gradient-to-b ${resultBg} border border-white/5 overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6 text-center relative`}>
          <div className="absolute top-3 right-3 shrink-0">
            <Badge className="bg-[#4CCCED]/10 text-orange-400 border border-[#4CCCED]/25 font-black text-[9px] uppercase tracking-widest px-2.5 h-6">
              <Trophy className="h-3 w-3 mr-1" />
              Simulado Concluído
            </Badge>
          </div>

          <div className="flex flex-col items-center">
            {/* Circular Ring Gauge */}
            <div className="relative shrink-0 flex items-center justify-center h-28 w-28 mb-3 mt-4">
              <ScoreRing pct={pct} size={110} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-black text-white text-2xl leading-none">{pct}<span className="text-xs text-white/50">%</span></p>
                <p className="text-[7px] font-black uppercase tracking-widest text-white/40 mt-1">Acertos</p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-white leading-none mb-1">
              {resultLabel}
            </h2>
            <p className="text-white/60 text-xs font-semibold max-w-sm">
              Você concluiu o teste personalizado e seus pontos foram computados.
            </p>

            {/* Tempo total gasto */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2">
              <Clock className="h-4 w-4 text-orange-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Tempo total</span>
              <span className="text-sm font-black text-white tabular-nums tracking-wider">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>

          {/* Gamified Reward Banner */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center justify-center gap-6 max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#4CCCED]/20 flex items-center justify-center shadow-md">
                <Zap className="h-4.5 w-4.5 text-orange-400 fill-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-white">+{xpGained} XP</p>
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Experiência</p>
              </div>
            </div>
            <div className="h-8 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shadow-md">
                <Award className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-white">Salvo</p>
                <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Histórico</p>
              </div>
            </div>
          </div>

          {/* Stats breakdown */}
          <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5 pt-5">
            {[
              { label: 'Acertos', value: score, color: 'text-emerald-400', icon: CheckCircle2 },
              { label: 'Erros',   value: answers.length - score, color: 'text-red-400', icon: XCircle },
              { label: 'Total',   value: answers.length, color: 'text-orange-400', icon: ClipboardList },
            ].map(s => (
              <div key={s.label} className="text-center px-1">
                <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Button
              onClick={() => {
                triggerHaptic(20);
                setAnswers([]);
                setGameState('idle');
              }}
              className="w-full h-12 rounded-2xl bg-[#4CCCED] text-slate-950 hover:bg-orange-600 font-black text-sm uppercase tracking-wider active:scale-95 transition-transform border-none"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Iniciar Novo Simulado
            </Button>
          </div>
        </div>

        {/* Gabarito Comentado Accordion */}
        <div className="space-y-4">
          <h3 className="text-base font-black text-slate-800 italic px-1 mb-2 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-500" />
            Revisão & Gabarito Comentado
          </h3>

          <div className="space-y-3">
            {answers.map((ans, i) => {
              const isCorrect = norm(ans.selected) === norm(ans.correct);
              const isExpanded = expandedIndex === i;
              const getKey = (o: any) => o.key || o.letter || '';
              
              return (
                <div 
                  key={`${ans.questionId}-${i}`} 
                  className={`bg-white rounded-card shadow-sm border overflow-hidden transition-all duration-300
                    ${isCorrect ? 'border-emerald-100 hover:border-emerald-200' : 'border-red-100 hover:border-red-200'}`}
                >
                  {/* Collapsible Accordion Header */}
                  <div 
                    onClick={() => {
                      triggerHaptic(10);
                      setExpandedIndex(isExpanded ? null : i);
                    }}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isCorrect ? (
                        <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                          <XCircle className="h-4 w-4 text-red-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          isCorrect ? 'text-emerald-500' : 'text-red-400'
                        }`}>
                          Questão {i + 1} — {isCorrect ? 'Acerto' : 'Erro'}
                        </span>
                        <p className="text-xs font-bold text-slate-600 truncate max-w-[200px] sm:max-w-md mt-0.5 leading-none">
                          {ans.question_text}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {ans.subject && (
                        <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-bold text-[8px] uppercase tracking-wider px-1.5 h-4.5 rounded">
                          {ans.subject}
                        </Badge>
                      )}
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 text-orange-500' : ''
                      }`} />
                    </div>
                  </div>

                  {/* Expanded Content Drawer */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden bg-slate-50/50 border-t border-slate-100"
                      >
                        <div className="p-4 sm:p-5 space-y-4 text-sm text-slate-600">
                          
                          {/* Question body */}
                          <div className="space-y-1.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Texto da Questão</span>
                            <p className="text-xs font-bold text-slate-700 italic leading-relaxed whitespace-pre-wrap">
                              {ans.question_text}
                            </p>
                          </div>

                          {/* Options display with custom validation states */}
                          <div className="space-y-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Opções da Questão</span>
                            <div className="space-y-1.5">
                              {(ans.options || []).map((opt: any) => {
                                const k = getKey(opt);
                                const isCorrectOpt  = norm(k) === norm(ans.correct);
                                const isSelectedOpt = norm(k) === norm(ans.selected);
                                const wasWrong = isSelectedOpt && !isCorrect;
                                return (
                                  <div
                                    key={k || opt.text}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs border transition-all
                                      ${isCorrectOpt ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : ''}
                                      ${wasWrong     ? 'bg-red-50 border-red-200 text-red-600 line-through' : ''}
                                      ${!isCorrectOpt && !wasWrong ? 'bg-white border-slate-100 text-slate-500' : ''}`}
                                  >
                                    <span className="font-black italic w-4 shrink-0">{(k || '?').toUpperCase()})</span>
                                    <span className="flex-1">{opt.text}</span>
                                    {isCorrectOpt && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                    {wasWrong     && <XCircle      className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Detailed comment block */}
                          {ans.explanation && (
                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3.5 flex gap-3">
                              <BookOpen className="h-4.5 w-4.5 text-orange-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-1 leading-none">Explicação Pedagógica</p>
                                <p className="text-xs font-semibold text-amber-900/90 leading-relaxed italic">
                                  {ans.explanation}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // IDLE — SIMULATOR GENERATION & MODE SELECTOR SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  const canStart = mode === 'completo' || !!selectedSubjectId;

  const MODES = [
    { id: 'materia'   as Mode, label: 'Por Matéria',      icon: Library,     desc: 'Escolha uma disciplina e pratique.',     color: 'text-blue-500',   bg: 'bg-blue-50' },
    { id: 'especifico'as Mode, label: 'Treino Específico', icon: Target,      desc: 'Filtre por micro-tópico com precisão.',  color: 'text-violet-500', bg: 'bg-violet-50' },
    { id: 'completo'  as Mode, label: 'Simulado Completo', icon: Shuffle,     desc: 'Questões de todas as matérias.',         color: 'text-amber-500',  bg: 'bg-amber-55/10' },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-24 px-2 sm:px-4 animate-in fade-in duration-500">

      {/* ── Hero Banner ── */}
      <div className="aurora-dark rounded-card p-7 md:p-10 mb-8 relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Prática Inteligente</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black italic text-white leading-none tracking-tight mb-2">
            Gerador de Listas
          </h1>
          <p className="text-white/60 font-semibold text-xs leading-relaxed max-w-sm mb-6">
            Simulados personalizados gerados sob demanda de acordo com sua necessidade de foco.
          </p>

          {/* Setup stats pills */}
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {[
              { label: 'Disciplinas',  value: subjects.length, icon: Library },
              { label: 'Tamanho',   value: `${simSize}q`,   icon: ClipboardList },
              { label: 'Tempo est.', value: `~${Math.round(simSize * 3.5)}m`, icon: Timer },
            ].map(s => (
              <div key={s.label} className="gradient-border flex items-center gap-2.5 bg-white/8 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-2.5 shrink-0 min-w-[110px]">
                <s.icon className="h-4 w-4 text-orange-400 shrink-0" />
                <div>
                  <p className="text-white font-black text-sm leading-none">{s.value}</p>
                  <p className="text-white/50 text-[8px] font-black uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mode selector buttons ── */}
      <div className="mb-6">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Selecione o Modo de Simulado</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODES.map(m => (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                triggerHaptic(10);
                setMode(m.id); 
                setSelectedSubjectId(''); 
                setSelectedMicroTopicId(ALL_TOPICS); 
              }}
              className={`p-4 rounded-[1.75rem] border-2 text-left transition-all duration-200 active:scale-[0.99] [touch-action:manipulation]
                ${mode === m.id
                  ? 'border-[#4CCCED] bg-[#4CCCED]/5 shadow-md'
                  : 'border-slate-100 bg-white hover:border-slate-200'}`}
            >
              <div className={`h-10 w-10 rounded-2xl ${mode === m.id ? 'aurora-dark text-white' : m.bg + ' ' + m.color} flex items-center justify-center mb-3 shadow-inner`}>
                <m.icon className="h-5 w-5" />
              </div>
              <p className={`font-black text-xs uppercase tracking-wide leading-tight mb-1 ${mode === m.id ? 'text-orange-500' : 'text-slate-700'}`}>{m.label}</p>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">{m.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Dynamic filters dropdowns ── */}
      <div className="mb-6">
        <AnimatePresence mode="wait">
          {(mode === 'materia' || mode === 'especifico') && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-card shadow-md border border-slate-200 p-6 space-y-4"
            >
              {/* Banca — só faz sentido quando a trilha do aluno tem mais de uma.
                  O aluno de ETEC não vê seletor, porque só existe uma banca para ele. */}
              {allowedBoards.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Banca</Label>
                  <div className="flex gap-2">
                    {[ALL_BOARDS, ...allowedBoards].map(board => {
                      const isActive = selectedBoard === board;
                      const label = board === ALL_BOARDS ? 'Todas' : examTypeLabel(board);
                      return (
                        <button
                          key={board}
                          type="button"
                          onClick={() => { triggerHaptic(10); setSelectedBoard(board); }}
                          aria-pressed={isActive}
                          className={`flex-1 h-11 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                            isActive
                              ? 'bg-slate-900 text-white border-transparent shadow-md'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Disciplina Principal</Label>
                <Select value={selectedSubjectId} onValueChange={(v) => { triggerHaptic(10); setSelectedSubjectId(v); }}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold text-sm focus:ring-orange-500/25">
                    <SelectValue placeholder="Escolha a matéria..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 bg-white">
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id} className="font-bold text-slate-700 text-xs">
                        {s.name} {s.question_count > 0 ? `· ${s.question_count} questões` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mode === 'especifico' && selectedSubjectId && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Micro-tópico de Foco</Label>
                  <Select value={selectedMicroTopicId} onValueChange={(v) => { triggerHaptic(10); setSelectedMicroTopicId(v); }}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold text-sm focus:ring-orange-500/25">
                      <SelectValue placeholder={microTopics.length === 0 ? 'Sem micro-tópicos cadastrados' : 'Todos os tópicos'} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 bg-white">
                      <SelectItem value={ALL_TOPICS} className="font-bold text-slate-700 text-xs">Todos os tópicos</SelectItem>
                      {microTopics.map(mt => (
                        <SelectItem key={mt.id} value={mt.id} className="font-bold text-slate-700 text-xs">{mt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Question size slider/pills ── */}
      <div className="mb-6">
        <AnimatePresence mode="wait">
          {mode === 'completo' ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-card shadow-md border border-slate-200 p-6 space-y-4"
            >
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Tamanho do Simulado Completo</p>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 45, 90].map(n => (
                    <button
                      key={n}
                      onClick={() => { triggerHaptic(10); setSimSize(n); }}
                      className={`h-11 rounded-xl font-black text-xs transition-all active:scale-95 [touch-action:manipulation]
                        ${simSize === n
                          ? 'bg-[#4CCCED] text-slate-950 shadow-md font-black'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {n === 90 ? <span className="text-[9px]">ENEM<br/>Oficial</span> : `${n} questões`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-500/5 to-amber-500/5 rounded-2xl border border-[#4CCCED]/10">
                <div className="h-9 w-9 rounded-xl bg-[#4CCCED]/15 flex items-center justify-center shrink-0">
                  <Timer className="h-4.5 w-4.5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">{simSize} questões · ~{Math.round(simSize * 3.5)} minutos estimados</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">3,5 minutos por questão (ritmo ENEM INEP)</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white rounded-[1.75rem] shadow-sm border border-slate-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Tamanho da Lista de Exercícios</p>
              <div className="flex gap-2">
                {[5, 10, 20, 30].map(n => (
                  <button
                    key={n}
                    onClick={() => { triggerHaptic(10); setSimSize(n); }}
                    className={`flex-1 h-10 rounded-xl font-black text-xs transition-all active:scale-95 [touch-action:manipulation]
                      ${simSize === n
                        ? 'bg-[#4CCCED] text-slate-950 shadow-sm font-black'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {n} q
                  </button>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Start simulation CTA ── */}
      <Button
        onClick={() => {
          triggerHaptic([30, 50]);
          startSimulado();
        }}
        disabled={!canStart}
        className="btn-orange-neon w-full h-14 rounded-2xl bg-[#4CCCED] text-slate-950 font-black text-base hover:scale-[1.01] active:scale-95 transition-transform [touch-action:manipulation] flex items-center justify-center gap-2 border-none shadow-xl glow-orange"
      >
        <BrainCircuit className="h-5 w-5" />
        Iniciar Simulado
        <ChevronRight className="h-4.5 w-4.5" />
      </Button>

      {!canStart && (
        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-3.5">
          Selecione uma matéria ou tópico para ativar o simulador.
        </p>
      )}

      {/* ── Resultados Oficiais (importados pela secretaria) ── */}
      {resultadosOficiais.length > 0 && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-slate-100" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Resultados Oficiais</p>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          {resultadosOficiais.map((r, i) => {
            const pct = Math.round((r.score / r.total) * 100);
            const color = pct >= 70 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500';
            const bg    = pct >= 70 ? 'bg-emerald-50 border-emerald-100' : pct >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
            const hasCard = r.answers?.length > 0 && r.answerKey;
            const isOpen = expandedOficial === i;
            return (
              <div key={i} className={`rounded-card border overflow-hidden ${bg}`}>
                <div className="p-5 flex items-center gap-4">
                  <div className="relative shrink-0">
                    {(() => {
                      const rv = 22, circ = 2 * Math.PI * rv;
                      const stroke = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <svg width="54" height="54" className="-rotate-90">
                          <circle cx="27" cy="27" r={rv} fill="none" stroke="#e2e8f0" strokeWidth="5" />
                          <circle cx="27" cy="27" r={rv} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} />
                        </svg>
                      );
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-black leading-none ${color}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Resultado Oficial</p>
                    <p className="font-black italic text-slate-800 truncate">{r.title}</p>
                    <p className={`text-2xl font-black italic leading-none mt-1 ${color}`}>
                      {r.score}<span className="text-sm text-slate-400 font-bold">/{r.total}</span>
                    </p>
                  </div>
                  {hasCard ? (
                    <button onClick={() => setExpandedOficial(isOpen ? null : i)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-primary transition-colors shrink-0">
                      Ver gabarito {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  ) : <Trophy className="h-5 w-5 text-slate-300 shrink-0" />}
                </div>
                {isOpen && hasCard && r.answerKey && (
                  <div className="px-5 pb-5 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Gabarito questão a questão</p>
                    <div className="grid grid-cols-10 sm:grid-cols-15 gap-1">
                      {r.answerKey.map((correct, qi) => {
                        const ans = r.answers.find(x => x.q === qi + 1);
                        const selected = ans?.selected || '';
                        const right = correct && selected && selected.toUpperCase() === correct.toUpperCase();
                        const wrong = correct && selected && !right;
                        return (
                          <div key={qi} className={`flex flex-col items-center p-1.5 rounded-xl text-[9px] font-black ${right ? 'bg-emerald-100 text-emerald-700' : wrong ? 'bg-red-100 text-red-600' : 'bg-white/60 text-slate-300'}`}>
                            <span className="opacity-60 text-[8px]">{qi + 1}</span>
                            <span className="text-xs">{selected || '–'}</span>
                            {wrong && <span className="text-[7px] opacity-60">{correct}</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 text-[10px] font-black pt-1">
                      <span className="text-emerald-700">✓ {r.answers.filter(a => r.answerKey![a.q-1] && a.selected.toUpperCase() === r.answerKey![a.q-1].toUpperCase()).length} acertos</span>
                      <span className="text-red-500">✗ {r.answers.filter(a => r.answerKey![a.q-1] && a.selected.toUpperCase() !== r.answerKey![a.q-1].toUpperCase()).length} erros</span>
                      <span className="text-slate-400">– {r.answerKey.length - r.answers.length} sem resposta</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
