"use client";

export const runtime = "edge";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/AuthProvider";
import Script from "next/script";
import { supabase } from "@/app/lib/supabase";
import { computeTriResult } from "@/lib/tri-solver";
import { examTypeLabel } from "@/lib/exam-types";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  XCircle,
  Award,
  FileText,
  LayoutGrid,
  Clock,
  AlertTriangle,
  ClipboardList,
  Timer,
  Play,
  RotateCcw,
  Highlighter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { trackAcao, trackFalha } from "@/lib/telemetry";

const InteractiveWorkbook = dynamic(
  () => import("@/components/InteractiveWorkbook").then((mod) => mod.InteractiveWorkbook),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0c] text-white gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">
          Carregando Prova Digital...
        </p>
      </div>
    ),
  }
);

type ExamData = {
  id: string;
  title: string;
  exam_type: string;
  pdf_url: string;
  is_special_cursinho?: boolean;
  tri_score_calculated?: boolean;
};

type QuestionData = {
  id: string;
  question_id: string;
  order_index: number;
  question: {
    id: string;
    correct_answer: string;
    subjects: { name: string } | null;
    tri_a?: number;
    tri_b?: number;
    tri_c?: number;
  };
};

const norm = (v: string | undefined | null) => (v ?? "").trim().toUpperCase();

// Segundos por questão no ritmo ENEM (3,5 min). Define o tempo oficial da prova.
const SECONDS_PER_QUESTION = 210;

/** Formata segundos como H:MM:SS ou MM:SS. */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = sec.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function InteractiveExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    triRange: string;
    durationSeconds: number;
    forfeited: boolean;
  } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  // Aba ativa no mobile: a prova (PDF) ou o cartão-resposta.
  const [mobileTab, setMobileTab] = useState<"pdf" | "answers">("pdf");
  // A prova só começa (e o cronômetro só corre) depois do "Começar prova".
  // Quando há progresso salvo ou o aluno já viu o passo a passo antes, pulamos
  // direto para a prova.
  const [started, setStarted] = useState(false);
  // Vira true quando já decidimos entre passo a passo x entrar direto (evita
  // o passo a passo "piscar" para quem está retomando uma prova).
  const [introDecided, setIntroDecided] = useState(false);
  // Quantas vezes o aluno saiu da página durante a prova. A 1ª saída é só um
  // aviso; a 2ª encerra a prova (perde a oportunidade). Persistido no progresso.
  const [leaveCount, setLeaveCount] = useState(0);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  // ── Cronômetro ───────────────────────────────────────────────────────────────
  // Contamos o tempo DECORRIDO (sobe a cada segundo). O tempo oficial é derivado
  // do número de questões; quando o decorrido passa do oficial, o relógio entra
  // em contagem negativa (tempo excedido) — mas o aluno continua podendo entregar.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const allottedSeconds = questions.length * SECONDS_PER_QUESTION;

  useEffect(() => {
    async function loadExam() {
      if (!id) return;
      try {
        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("id, title, exam_type, pdf_url, is_special_cursinho, tri_score_calculated")
          .eq("id", id)
          .single();

        if (examError || !examData || !examData.pdf_url) {
          toast({ title: "Erro", description: "Prova não encontrada ou sem PDF.", variant: "destructive" });
          router.push("/dashboard/student/provas");
          return;
        }
        setExam(examData);

        const { data: qData, error: qError } = await supabase
          .from("exam_questions")
          .select("id, question_id, order_index, question:questions(id, correct_answer, tri_a, tri_b, tri_c, subjects(name))")
          .eq("exam_id", id)
          .order("order_index", { ascending: true });

        if (!qError && qData) {
          setQuestions(qData as unknown as QuestionData[]);
        }
      } catch (err) {
        console.error("Falha fatal:", err);
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [id, router, toast]);

  // ── Progresso salvo (continuar depois) — localStorage ────────────────────────
  const pdfProgressKey = user ? `prova_pdf_progress_${user.id}_${id}` : null;
  // Flag global (por aluno) de que o passo a passo já foi visto.
  const introSeenKey = user ? `prova_pdf_intro_seen_${user.id}` : null;
  const restoredRef = useRef(false);

  // Restaura respostas/posição/tempo uma vez, após carregar as questões, e
  // decide se mostramos o passo a passo ou já entramos na prova.
  useEffect(() => {
    if (restoredRef.current || result || !pdfProgressKey || questions.length === 0) return;
    restoredRef.current = true;
    let hasProgress = false;
    try {
      const raw = localStorage.getItem(pdfProgressKey);
      if (raw) {
        const sp = JSON.parse(raw) as {
          answers?: Record<string, string>;
          currentIndex?: number;
          total?: number;
          elapsedSeconds?: number;
          leaves?: number;
        };
        if (!(sp.total && sp.total !== questions.length)) {
          if (typeof sp.leaves === "number" && sp.leaves > 0) {
            setLeaveCount(sp.leaves);
          }
          if (typeof sp.elapsedSeconds === "number" && sp.elapsedSeconds > 0) {
            setElapsedSeconds(sp.elapsedSeconds);
            hasProgress = true;
          }
          if (sp.answers && Object.keys(sp.answers).length > 0) {
            setAnswers(sp.answers);
            setCurrentIndex(Math.min(sp.currentIndex ?? 0, questions.length - 1));
            hasProgress = true;
            toast({ title: "Progresso restaurado", description: `Voce ja tinha marcado ${Object.keys(sp.answers).length} resposta(s).` });
          }
        }
      }
    } catch (e) {
      // O aluno recomeça a prova do zero achando que nunca salvou nada.
      trackFalha("prova_pdf_progresso_ilegivel", e);
    }

    let introSeen = false;
    try {
      introSeen = !!(introSeenKey && localStorage.getItem(introSeenKey));
    } catch {
      // Sem consequência: o aluno vê a tela de instruções mais uma vez.
    }

    // Retomar prova em andamento ou já conhecer o passo a passo → entra direto.
    if (hasProgress || introSeen) {
      setStarted(true);
    }
    setIntroDecided(true);
  }, [pdfProgressKey, introSeenKey, questions.length, result, toast]);

  const handleStart = useCallback(() => {
    try {
      if (introSeenKey) localStorage.setItem(introSeenKey, "1");
    } catch {
      // Idem: só faz a intro reaparecer numa próxima vez.
    }
    setStarted(true);
  }, [introSeenKey]);

  // Salva progresso a cada mudança de resposta/posição/tempo/saídas.
  useEffect(() => {
    if (!pdfProgressKey || result || questions.length === 0) return;
    if (Object.keys(answers).length === 0 && elapsedSeconds === 0 && leaveCount === 0) return;
    try {
      localStorage.setItem(
        pdfProgressKey,
        JSON.stringify({ answers, currentIndex, total: questions.length, elapsedSeconds, leaves: leaveCount, savedAt: new Date().toISOString() })
      );
    } catch (e) {
      // O pior silêncio desta tela: é a prova EM ANDAMENTO que deixa de ser
      // salva. Se o aparelho fechar a aba, o aluno perde tudo o que respondeu
      // e ainda gasta uma das duas tentativas.
      trackFalha("prova_pdf_progresso_nao_salvo", e, { respondidas: Object.keys(answers).length });
    }
  }, [answers, currentIndex, elapsedSeconds, leaveCount, pdfProgressKey, result, questions.length]);

  // Tique do cronômetro (1s) — só corre depois que a prova começa.
  useEffect(() => {
    if (!started || result || loading || questions.length === 0) return;
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [started, result, loading, questions.length]);

  const handleSelectAnswer = useCallback(
    (qId: string, option: string) => {
      if (result) return;
      setAnswers((prev) => ({ ...prev, [qId]: option }));
    },
    [result]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setShowGrid(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
    setShowGrid(false);
  }, [questions.length]);

  // ── Keyboard navigation (desktop) ─────────────────────────────────────────
  useEffect(() => {
    if (result) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const currentQ = questions[currentIndex];
      if (!currentQ) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (["a", "b", "c", "d", "e", "A", "B", "C", "D", "E"].includes(e.key)) {
        e.preventDefault();
        handleSelectAnswer(currentQ.question.id, e.key.toUpperCase());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIndex, questions, handleSelectAnswer, goPrev, goNext, result]);

  // Evita entrega dupla (ex.: aluno clica em Entregar e some da aba ao mesmo tempo).
  const finalizingRef = useRef(false);

  const finalizeAttempt = useCallback(
    async ({ forfeited }: { forfeited: boolean }) => {
      if (!user || !exam) return;
      if (finalizingRef.current || result) return;
      finalizingRef.current = true;

      const durationSeconds = elapsedSeconds;
      setIsSubmitting(true);
      let correctCount = 0;

      const formattedAnswers = questions.map((q) => {
        const selected = answers[q.question.id] || null;
        const correct = q.question.correct_answer;
        if (norm(selected) === norm(correct)) correctCount++;
        return { question_id: q.question.id, selected, correct };
      });

      let triScore: number | null = null;
      let triRange = "";
      const shouldCalcTri = exam.tri_score_calculated || exam.exam_type.toLowerCase() === "enem";

      if (shouldCalcTri) {
        const triResponses = questions.map((q) => {
          const selected = answers[q.question.id] || null;
          const correct = q.question.correct_answer;
          const isRight = norm(selected) === norm(correct);
          return {
            correct: isRight,
            triParams: {
              a: Number(q.question.tri_a ?? 1.2),
              b: Number(q.question.tri_b ?? 0.2),
              c: Number(q.question.tri_c ?? 0.20),
            },
          };
        });
        const tri = computeTriResult(triResponses);
        triScore = tri.score;
        triRange = `${tri.scoreLow}–${tri.scoreHigh} pts`;
      } else {
        triRange = "N/A";
      }

      try {
        await supabase.from("exam_attempts").insert({
          user_id: user.id,
          exam_id: exam.id,
          score: correctCount,
          total_questions: questions.length,
          answers: formattedAnswers,
          tri_score: triScore,
          duration_seconds: durationSeconds,
          forfeited,
          source: "self",
        });

        if (pdfProgressKey) {
          try {
            localStorage.removeItem(pdfProgressKey);
          } catch (e) {
            trackFalha("prova_pdf_progresso_nao_limpo", e);
          }
        }
        setResult({ score: correctCount, total: questions.length, triRange, durationSeconds, forfeited });
        setMobileTab("answers");
        if (!forfeited) {
          toast({ title: "Prova Finalizada!", description: `Você acertou ${correctCount} questões.` });
        }
        trackAcao("prova_pdf_finalizada", {
          acertos: correctCount, total: questions.length,
          segundos: durationSeconds, desistiu: forfeited,
        });
      } catch (e) {
        // O aluno fez a prova inteira e ela não foi registrada. Sem este
        // evento, some sem deixar rastro — e a nota nunca aparece no boletim.
        trackFalha("prova_pdf_nao_registrada", e, {
          acertos: correctCount, total: questions.length,
        });
        finalizingRef.current = false; // permite tentar de novo em caso de erro
        toast({
          title: "Não conseguimos registrar sua prova",
          description: "Suas respostas continuam aqui. Toque em entregar de novo.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, exam, result, elapsedSeconds, questions, answers, pdfProgressKey, toast]
  );

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      if (!confirm("Você deixou questões em branco. Deseja entregar a prova mesmo assim?")) {
        return;
      }
    }
    finalizeAttempt({ forfeited: false });
  };

  // ── Sair da página durante a prova: 1 aviso, depois encerra ───────────────────
  // Trocar de aba, abrir outro app/site ou minimizar dispara. Na 1ª vez é só um
  // aviso (a prova continua); na 2ª a prova é encerrada (perde a oportunidade).
  // Usamos visibilitychange/pagehide (confiáveis) — não usamos "blur", que
  // dispara ao abrir o próprio diálogo de confirmação e daria falso positivo.
  useEffect(() => {
    if (!started || result) return;

    const onLeave = () => {
      if (finalizingRef.current) return;
      if (leaveCount >= 1) {
        finalizeAttempt({ forfeited: true });
      } else {
        setLeaveCount(1);
        setShowLeaveWarning(true);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onLeave();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [started, result, finalizeAttempt, leaveCount]);

  if (authLoading || loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0c] text-white gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
          Carregando Prova e Gabarito...
        </p>
      </div>
    );
  }

  // ── PASSO A PASSO (antes de começar) ─────────────────────────────────────────
  if (!result && !started) {
    if (!introDecided) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#0a0a0c] text-white gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Preparando prova...</p>
        </div>
      );
    }

    const totalMin = Math.round((questions.length * SECONDS_PER_QUESTION) / 60);
    const steps: { icon: any; title: string; text: string }[] = [
      {
        icon: FileText,
        title: "1. Leia a prova no PDF",
        text: "A prova completa aparece em PDF. Você pode dar zoom, rolar as páginas e usar as ferramentas para grifar e anotar direto no material.",
      },
      {
        icon: ClipboardList,
        title: "2. Marque no cartão-resposta",
        text: "As respostas vão no cartão, com botões grandes de A a E. No celular, troque entre a Prova (PDF) e o Cartão pelas duas abas na parte de baixo da tela.",
      },
      {
        icon: LayoutGrid,
        title: "3. Ande pelas questões",
        text: "Use os botões Anterior e Próxima, ou toque em Mapa para pular direto para qualquer questão. As questões já respondidas ficam em verde no mapa.",
      },
      {
        icon: Timer,
        title: "4. De olho no tempo",
        text: `O cronômetro no topo mostra o tempo restante (a prova tem cerca de ${totalMin} min). Nos últimos 5 minutos ele fica amarelo. Se o tempo zerar, a prova NÃO é encerrada: o relógio passa a contar em vermelho quanto tempo você excedeu.`,
      },
      {
        icon: RotateCcw,
        title: "5. Pode parar e voltar depois",
        text: "Suas respostas e o tempo ficam salvos neste aparelho. Se sair e voltar, você retoma exatamente de onde parou.",
      },
      {
        icon: Send,
        title: "6. Entregue a prova",
        text: "Ao terminar, toque em Entregar Prova (se deixar questões em branco, o sistema avisa). Depois você vê o gabarito, seu aproveitamento, a nota TRI estimada e o tempo que levou.",
      },
    ];

    return (
      <div className="h-[100dvh] flex flex-col bg-[#0a0a0c] text-white overflow-hidden">
        {/* Cabeçalho */}
        <header className="shrink-0 px-4 pt-5 pb-4 border-b border-white/5">
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-orange-400">
            Como funciona
          </span>
          <h1 className="mt-3 text-2xl font-black italic tracking-tighter leading-tight">{exam?.title}</h1>
          <p className="mt-1 text-xs font-semibold text-white/55">
            Leia o passo a passo antes de começar. Leva menos de 1 minuto.
          </p>
        </header>

        {/* Passos */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex gap-3 rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black italic text-white leading-tight">{s.title}</p>
                  <p className="mt-1 text-xs font-medium text-white/60 leading-relaxed">{s.text}</p>
                </div>
              </div>
            );
          })}

          {/* AVISO IMPORTANTE — sair da página perde a oportunidade */}
          <div className="rounded-2xl bg-red-500/10 border-2 border-red-500/40 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm font-black italic text-red-300 uppercase tracking-wide">Atenção: não saia da prova</p>
            </div>
            <p className="text-xs font-semibold text-red-200/90 leading-relaxed">
              Se você <span className="font-black underline">sair desta página</span> durante a prova — trocar de aba,
              abrir outro app ou site, ou minimizar a tela — você recebe <span className="font-black">1 aviso</span>.
              Se sair <span className="font-black">uma segunda vez</span>, a prova é <span className="font-black">encerrada
              na hora</span> com o que você já marcou e <span className="font-black">você perde esta oportunidade</span>.
              Só existem 2 tentativas que valem para o boletim, então mantenha o foco até entregar.
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/8 border border-amber-500/20 p-3.5">
            <Highlighter className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-200/90 leading-relaxed">
              Dica: responda primeiro as questões que você tem certeza e use o Mapa para voltar nas mais difíceis. O tempo é só um guia — o importante é entregar tudo respondido.
            </p>
          </div>
        </div>

        {/* Começar */}
        <div className="shrink-0 p-4 border-t border-white/5 bg-[#0a0a0c]">
          <Button
            onClick={handleStart}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-500/30 border-none"
          >
            <Play className="h-5 w-5 mr-2" />
            Começar prova
          </Button>
          <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-widest text-white/40">
            O cronômetro começa ao tocar em “Começar prova”
          </p>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.question.id] : undefined;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const progressPct = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  // Relógio: tempo restante = oficial - decorrido. Negativo = tempo excedido.
  const remainingSeconds = allottedSeconds - elapsedSeconds;
  const isOvertime = remainingSeconds < 0;
  const isLowTime = !isOvertime && remainingSeconds <= 300; // últimos 5 min
  const clockLabel = isOvertime ? `+${formatClock(Math.abs(remainingSeconds))}` : formatClock(remainingSeconds);

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0a0a0c] overflow-hidden select-none">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" strategy="afterInteractive" />

      {/* ════════════════════════════════════════════════════════════════════
         TOP BAR — voltar · título · cronômetro (sempre visível)
      ═════════════════════════════════════════════════════════════════════ */}
      <header className="h-16 bg-[#0a0a0c] flex items-center gap-3 px-3 sm:px-4 shrink-0 z-50 border-b border-white/5">
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
          className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-white italic truncate leading-tight">
            {exam?.title}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">
              Prova Digital
            </span>
            <span className="text-[8px] font-black text-white/40">·</span>
            <span className="text-[8px] font-black text-white/50 uppercase tracking-widest truncate">
              {examTypeLabel(exam?.exam_type)}
            </span>
          </div>
        </div>

        {/* Cronômetro */}
        <div
          className={`flex items-center gap-2 pl-2.5 pr-3 h-11 rounded-2xl border shrink-0 transition-all ${
            isOvertime
              ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse"
              : isLowTime
              ? "bg-amber-500/15 border-amber-500/40 text-amber-400 animate-pulse"
              : "bg-white/5 border-white/10 text-white"
          }`}
        >
          {isOvertime ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          <div className="flex flex-col leading-none">
            <span className="font-mono font-black text-base tabular-nums tracking-tight">{clockLabel}</span>
            <span className="text-[7px] font-black uppercase tracking-[0.18em] opacity-70 mt-0.5">
              {isOvertime ? "Tempo excedido" : isLowTime ? "Reta final" : "Tempo restante"}
            </span>
          </div>
        </div>
      </header>

      {/* Lembrete fixo: não sair da página */}
      {!result && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
          <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-red-300/90 text-center">
            {leaveCount >= 1
              ? "Último aviso — se sair de novo, a prova é encerrada"
              : "Não saia desta página — 1 aviso e depois a prova é encerrada"}
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
         CONTEÚDO — PDF + Cartão-resposta
         Mobile: uma aba por vez (troca no rodapé). Desktop: lado a lado.
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* ── PDF ── (sempre montado; escondido no mobile quando não é a aba ativa) */}
        <section
          className={`${mobileTab === "pdf" ? "flex" : "hidden"} md:flex flex-1 flex-col min-h-0 overflow-hidden md:border-r border-white/5`}
        >
          <div className="flex-1 min-h-0 relative">
            <InteractiveWorkbook
              materialId={exam?.id || ""}
              pdfUrl={exam?.pdf_url}
              userName={profile?.name || user?.email || "Estudante"}
              userCpf={profile?.id?.substring(0, 8) || "ID"}
            />
          </div>
        </section>

        {/* ── CARTÃO-RESPOSTA ── */}
        <aside
          className={`${mobileTab === "answers" ? "flex" : "hidden"} md:flex w-full md:w-[380px] flex-col min-h-0 bg-[#0d0d0f] overflow-hidden shrink-0`}
        >
          <div className="flex-1 overflow-y-auto min-h-0">
            {result ? (
              /* ── RESULTADO ──────────────────────────────────────────────── */
              <div className="p-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                {result.forfeited && (
                  <div className="rounded-2xl bg-red-500/10 border-2 border-red-500/40 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                      <p className="text-sm font-black italic text-red-300 uppercase tracking-wide">Oportunidade encerrada</p>
                    </div>
                    <p className="text-xs font-semibold text-red-200/90 leading-relaxed">
                      Você saiu da página novamente, mesmo após o aviso, então a prova foi encerrada automaticamente com
                      o que estava marcado. Esta tentativa foi contabilizada.
                    </p>
                  </div>
                )}
                <div className="relative rounded-card overflow-hidden bg-[#0a0a0c] border border-emerald-500/20 p-5">
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.18) 0%, transparent 60%)" }}
                  />
                  <div className="relative z-10 text-center">
                    <Award className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-4xl font-black italic text-white leading-none tracking-tighter">
                      {result.score}
                      <span className="text-xl text-white/65">/{result.total}</span>
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/65 mt-2">
                      Questões Acertadas
                    </p>
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-base font-black text-emerald-400 italic">
                        {Math.round((result.score / result.total) * 100)}%
                      </p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-400/60 mt-0.5">
                        Aproveitamento
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tempo de conclusão */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                    <Timer className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/55">Tempo de conclusão</p>
                    <p className="text-base font-black text-white italic tabular-nums leading-tight">
                      {formatClock(result.durationSeconds)}
                      {result.durationSeconds > allottedSeconds && (
                        <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-red-400 not-italic">
                          Excedeu {formatClock(result.durationSeconds - allottedSeconds)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {(exam?.tri_score_calculated || exam?.exam_type.toLowerCase() === "enem") && (
                  <div className="bg-white/[0.03] border border-orange-500/20 rounded-2xl p-3 text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/65 mb-1">
                      Nota TRI Estimada
                    </p>
                    <p className="text-lg font-black text-orange-400 italic">{result.triRange}</p>
                  </div>
                )}

                {/* Gabarito completo */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/65 px-1">
                    Gabarito completo
                  </p>
                  {questions.map((q, idx) => {
                    const selected = answers[q.question.id];
                    const correct = q.question.correct_answer;
                    const isRight = norm(selected) === norm(correct);
                    return (
                      <div
                        key={q.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          isRight ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-black text-[10px] text-white/65 w-5">{idx + 1}.</span>
                          {isRight ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                          )}
                          <span className={`font-black text-xs uppercase ${isRight ? "text-emerald-400" : "text-red-400"}`}>
                            {selected || "—"}
                          </span>
                        </div>
                        {!isRight && (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-1.5 h-5 rounded-md flex items-center">
                            Correta: {correct}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ── CARTÃO-RESPOSTA ATIVO ──────────────────────────────────── */
              <div>
                {/* Cabeçalho de progresso */}
                <div className="p-4 pb-3 border-b border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/65">Questão</p>
                      <p className="text-3xl font-black italic text-white leading-none tracking-tighter mt-0.5">
                        {String(currentIndex + 1).padStart(2, "0")}
                        <span className="text-base text-white/60 font-bold ml-1">
                          /{String(questions.length).padStart(2, "0")}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => setShowGrid((s) => !s)}
                      className={`h-10 px-3.5 rounded-2xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 touch-manipulation ${
                        showGrid ? "bg-orange-500 text-white" : "bg-white/5 border border-white/10 text-white/70"
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {showGrid ? "Fechar" : "Mapa"}
                    </button>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Questão em foco */}
                {!showGrid && currentQ && (
                  <div className="p-4 sm:p-5">
                    {currentQ.question.subjects?.name && (
                      <Badge className="bg-white/5 text-white/70 border border-white/10 font-black text-[8px] uppercase tracking-widest px-2 h-5 self-start mb-3">
                        {currentQ.question.subjects.name}
                      </Badge>
                    )}
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400/70 mb-3">
                      Selecione a resposta
                    </p>

                    {/* Botões A–E grandes (2 colunas para caber melhor no mobile) */}
                    <div className="grid grid-cols-5 gap-2">
                      {["A", "B", "C", "D", "E"].map((letter) => {
                        const isSelected = currentAnswer === letter;
                        return (
                          <button
                            key={letter}
                            onClick={() => handleSelectAnswer(currentQ.question.id, letter)}
                            className={`aspect-square rounded-2xl font-black text-2xl italic transition-all touch-manipulation active:scale-90 flex items-center justify-center ${
                              isSelected
                                ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/40 scale-105"
                                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 text-center">
                      {currentAnswer ? (
                        <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest">
                          ✓ Resposta marcada: <span className="text-orange-400">{currentAnswer}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-white/55 uppercase tracking-widest">
                          Nenhuma resposta marcada
                        </p>
                      )}
                    </div>

                    {/* Atalhos de teclado (desktop) */}
                    <div className="hidden md:flex items-center justify-center gap-2 mt-5 pt-4 border-t border-white/5">
                      {(["A", "B", "C", "D", "E"] as const).map((k) => (
                        <kbd key={k} className="px-1.5 py-0.5 text-[9px] font-black bg-white/5 border border-white/10 rounded text-white/65">
                          {k}
                        </kbd>
                      ))}
                      <span className="text-[9px] text-white/60">·</span>
                      <kbd className="px-1.5 py-0.5 text-[9px] font-black bg-white/5 border border-white/10 rounded text-white/65">←</kbd>
                      <kbd className="px-1.5 py-0.5 text-[9px] font-black bg-white/5 border border-white/10 rounded text-white/65">→</kbd>
                    </div>
                  </div>
                )}

                {/* Mapa de questões */}
                {showGrid && (
                  <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/65 mb-3">
                      Mapa de questões
                    </p>
                    <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                      {questions.map((q, idx) => {
                        const answered = !!answers[q.question.id];
                        const isCurrent = idx === currentIndex;
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setCurrentIndex(idx);
                              setShowGrid(false);
                            }}
                            className={`aspect-square rounded-xl font-black text-[11px] italic transition-all active:scale-90 touch-manipulation flex items-center justify-center ${
                              isCurrent
                                ? "bg-orange-500 text-white ring-2 ring-orange-300 ring-offset-2 ring-offset-[#0d0d0f]"
                                : answered
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-orange-500" />
                        <span className="text-[9px] font-bold text-white/65 uppercase tracking-wider">Atual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
                        <span className="text-[9px] font-bold text-white/65 uppercase tracking-wider">Respondida</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-white/5 border border-white/10" />
                        <span className="text-[9px] font-bold text-white/65 uppercase tracking-wider">Em branco</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navegação anterior/próxima — fixa fora do scroll */}
          {!result && !showGrid && (
            <div className="shrink-0 px-3 py-2.5 border-t border-white/8 bg-[#0d0d0f]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={goPrev}
                  disabled={isFirst}
                  className="h-12 rounded-2xl flex items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95 touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  onClick={goNext}
                  disabled={isLast}
                  className="h-12 rounded-2xl flex items-center justify-center gap-1.5 font-black text-[10px] uppercase tracking-widest bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 transition-all active:scale-95 touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Entregar */}
          {!result && (
            <div className="p-3 bg-[#0a0a0c] border-t border-white/5 shrink-0">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/30 border-none disabled:opacity-40"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Entregar Prova
              </Button>
              {answeredCount < questions.length && (
                <p className="text-[9px] text-amber-400/70 font-bold uppercase tracking-wider text-center mt-2">
                  {questions.length - answeredCount} {questions.length - answeredCount === 1 ? "questão em branco" : "questões em branco"}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
         RODAPÉ DE ABAS — só no mobile. Alterna entre PDF e cartão-resposta.
      ═════════════════════════════════════════════════════════════════════ */}
      <nav className="md:hidden shrink-0 grid grid-cols-2 gap-2 p-2 bg-[#0a0a0c] border-t border-white/5">
        <button
          onClick={() => setMobileTab("pdf")}
          className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 touch-manipulation ${
            mobileTab === "pdf"
              ? "bg-white/10 border border-white/15 text-white"
              : "bg-transparent border border-white/5 text-white/45"
          }`}
        >
          <FileText className="h-4 w-4" />
          Prova (PDF)
        </button>
        <button
          onClick={() => setMobileTab("answers")}
          className={`relative h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 touch-manipulation ${
            mobileTab === "answers"
              ? "bg-orange-500 border border-orange-400 text-white shadow-lg shadow-orange-500/25"
              : "bg-transparent border border-white/5 text-white/45"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Cartão · {answeredCount}/{questions.length}
        </button>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
         AVISO — aluno saiu da página (1ª vez). A 2ª encerra a prova.
      ═════════════════════════════════════════════════════════════════════ */}
      {showLeaveWarning && !result && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[1.75rem] bg-[#141416] border-2 border-red-500/50 p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="text-lg font-black italic text-white leading-tight">Você saiu da prova!</h2>
            <p className="mt-2 text-sm font-semibold text-white/70 leading-relaxed">
              Este é o seu <span className="text-red-400 font-black">único aviso</span>. Se você sair da página de novo
              — trocar de aba, abrir outro app ou site — a prova será <span className="font-black text-white">encerrada
              na hora</span> e você <span className="font-black text-white">perde esta oportunidade</span>.
            </p>
            <button
              onClick={() => setShowLeaveWarning(false)}
              className="mt-5 w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-500/30 active:scale-95 transition-transform"
            >
              Entendi, voltar à prova
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
