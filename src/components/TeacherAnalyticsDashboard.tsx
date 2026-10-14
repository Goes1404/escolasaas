"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Users, Loader2, ClipboardCheck, BrainCircuit,
  Activity, FileDown, BarChart3, Sparkles, Filter, Calendar,
  ArrowLeft, Send, GraduationCap, Award, CheckCircle2, AlertCircle,
  Clock, ArrowUpRight, BookOpen, User, Phone, Mail, MapPin, Target, Eye
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChartPremium,
  LineChartPremium,
  RadarChartPremium,
  AreaChartPremium
} from "@/components/charts/premium";
import { subDays, formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { fmtDate, fmtNumber } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

// Mock Data for Demo Mode
const MOCK_PROFILES = [
  { id: "demo-1", name: "Ana Beatriz Silva", email: "anabeatriz@gmail.com", course: "01", sala: "01", institution: "Polo Centro", exam_target: "ENEM", last_access: subDays(new Date(), 2).toISOString(), progress: 68, answeredCount: 45, correctCount: 38, accuracy: 84, score: 844, is_financial_aid_eligible: true },
  { id: "demo-2", name: "Gabriel Macedo", email: "gabriel.m@gmail.com", course: "01", sala: "01", institution: "Polo Centro", exam_target: "ENEM", last_access: subDays(new Date(), 1).toISOString(), progress: 82, answeredCount: 60, correctCount: 52, accuracy: 86, score: 866, is_financial_aid_eligible: false },
  { id: "demo-3", name: "Julia Santos", email: "julia.s@gmail.com", course: "02", sala: "02", institution: "Polo Alphaville", exam_target: "ETEC", last_access: subDays(new Date(), 9).toISOString(), progress: 24, answeredCount: 12, correctCount: 5, accuracy: 41, score: 416, is_financial_aid_eligible: true },
  { id: "demo-4", name: "Pedro Oliveira", email: "pedro.oli@gmail.com", course: "02", sala: "02", institution: "Polo Alphaville", exam_target: "ENEM", last_access: subDays(new Date(), 12).toISOString(), progress: 15, answeredCount: 8, correctCount: 3, accuracy: 37, score: 375, is_financial_aid_eligible: false },
  { id: "demo-5", name: "Bianca Guimarães", email: "bianca.g@gmail.com", course: "03", sala: "03", institution: "Polo Centro", exam_target: "ENEM", last_access: new Date().toISOString(), progress: 95, answeredCount: 110, correctCount: 98, accuracy: 89, score: 890, is_financial_aid_eligible: true },
];

const MOCK_ANSWERS = [
  { student_id: "demo-1", is_correct: true, answered_at: subDays(new Date(), 1).toISOString(), questions: { subjects: { name: "Matemática" } } },
  { student_id: "demo-1", is_correct: true, answered_at: subDays(new Date(), 2).toISOString(), questions: { subjects: { name: "Redação" } } },
  { student_id: "demo-1", is_correct: true, answered_at: subDays(new Date(), 2).toISOString(), questions: { subjects: { name: "Linguagens" } } },
  { student_id: "demo-2", is_correct: true, answered_at: subDays(new Date(), 1).toISOString(), questions: { subjects: { name: "Matemática" } } },
  { student_id: "demo-2", is_correct: false, answered_at: subDays(new Date(), 3).toISOString(), questions: { subjects: { name: "Biologia" } } },
  { student_id: "demo-3", is_correct: false, answered_at: subDays(new Date(), 8).toISOString(), questions: { subjects: { name: "Física" } } },
  { student_id: "demo-5", is_correct: true, answered_at: new Date().toISOString(), questions: { subjects: { name: "Matemática" } } },
  { student_id: "demo-5", is_correct: true, answered_at: subDays(new Date(), 1).toISOString(), questions: { subjects: { name: "Redação" } } },
  { student_id: "demo-5", is_correct: true, answered_at: subDays(new Date(), 3).toISOString(), questions: { subjects: { name: "Linguagens" } } },
];

export default function TeacherAnalyticsDashboard({ userId }: { userId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [useDemo, setUseDemo] = useState(false);
  const { toast } = useToast();

  // Filters State
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all");
  const [selectedExamTarget, setSelectedExamTarget] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  // Raw Database Data
  const [rawData, setRawData] = useState({
    profiles: [] as any[],
    answers: [] as any[],
  });

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        // 1. Fetch Student Profiles
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email, role, profile_type, course, sala, institution, exam_target, last_access, is_financial_aid_eligible, xp_points, phone")
          .eq("role", "student")
          .order("name");

        if (profilesError) throw profilesError;

        // 2. Fetch student answers with proper relationship naming
        const { data: answers, error: answersError } = await supabase
          .from("student_question_answers")
          .select(`
            id,
            is_correct,
            answered_at,
            student_id,
            selected_option,
            questions (
              id,
              subjects (
                id,
                name
              )
            )
          `)
          .order("answered_at", { ascending: false });

        if (answersError) throw answersError;

        // 3. Fetch trail progress
        const { data: progress, error: progressError } = await supabase
          .from("user_progress")
          .select("user_id, percentage");

        if (progressError) throw progressError;

        // Map progress to profiles
        const mappedProfiles = (profiles || []).map((s) => {
          const userProg = progress?.filter((p) => p.user_id === s.id) || [];
          const avgProgress = userProg.length > 0
            ? Math.round(userProg.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / userProg.length)
            : 0;

          const studentAnswers = (answers || []).filter((a) => a.student_id === s.id);
          const answeredCount = studentAnswers.length;
          const correctCount = studentAnswers.filter((a) => a.is_correct).length;
          const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
          const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 1000) : 0;

          return {
            ...s,
            progress: avgProgress,
            answeredCount,
            correctCount,
            accuracy,
            score
          };
        });

        // Set raw data
        setRawData({
          profiles: mappedProfiles,
          answers: answers || []
        });

        // Diagnostic Console Output
        console.log(`[BI & Analytics] Loaded ${mappedProfiles.length} profiles and ${answers?.length || 0} answers from database.`);

        // Auto-enable demo mode if database contains no students or no answers
        const noRealData = mappedProfiles.length === 0 || !answers || answers.length === 0;
        setUseDemo(noRealData);
        if (noRealData) {
          console.log("[BI & Analytics] Auto-switched to Demo Mode (no live performance records found).");
        }

      } catch (e) {
        console.error("Erro ao processar inteligência analítica:", e);
        toast({
          title: "Erro ao carregar",
          description: "Não foi possível carregar todos os dados de desempenho.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [userId, toast]);

  // Extract distinct filter options
  const filterOptions = useMemo(() => {
    if (useDemo) {
      return {
        courses: ["01", "02", "03"],
        institutions: ["Polo Centro", "Polo Alphaville"],
      };
    }
    const courses = Array.from(new Set(
      rawData.profiles.map((s) => {
        const val = s.course || s.sala;
        if (!val || val === "Não informada") return null;
        return val;
      }).filter(Boolean)
    )).sort();

    const institutions = Array.from(new Set(
      rawData.profiles.map((s) => s.institution).filter(Boolean)
    )).sort();
    
    return { courses, institutions };
  }, [rawData.profiles, useDemo]);

  // Reactive Calculations based on Filters and userId
  const processedData = useMemo(() => {
    const activeProfiles = useDemo ? MOCK_PROFILES : rawData.profiles;
    const activeAnswers = useDemo ? MOCK_ANSWERS : rawData.answers;

    if (activeProfiles.length === 0) return null;

    const now = new Date();

    // 1. Filter students
    let filteredStudents = activeProfiles;
    if (userId) {
      filteredStudents = activeProfiles.filter(s => s.id === userId);
    } else {
      filteredStudents = activeProfiles.filter((s) => {
        // Match both s.course and s.sala to align with database discrepancies
        const matchesCourse = selectedCourse === "all" || s.course === selectedCourse || s.sala === selectedCourse;
        const matchesInstitution = selectedInstitution === "all" || s.institution === selectedInstitution;
        const matchesExamTarget = selectedExamTarget === "all" || 
          (selectedExamTarget === "enem" && (s.exam_target || "").toLowerCase().includes("enem")) ||
          (selectedExamTarget === "etec" && (s.exam_target || "").toLowerCase().includes("etec"));
        return matchesCourse && matchesInstitution && matchesExamTarget;
      });
    }

    const studentIds = filteredStudents.map((s) => s.id);

    // 2. Filter answers based on students and selected period
    const filteredAnswers = activeAnswers.filter((a) => {
      if (!studentIds.includes(a.student_id)) return false;
      
      if (selectedPeriod === "week") {
        return new Date(a.answered_at) >= subDays(now, 7);
      }
      if (selectedPeriod === "month") {
        return new Date(a.answered_at) >= subDays(now, 30);
      }
      return true; // all time
    });

    // 3. Compute metrics
    const totalStudents = filteredStudents.length;
    const totalAnswers = filteredAnswers.length;
    const correctAnswers = filteredAnswers.filter((a) => a.is_correct).length;
    
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
    const avgScore = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 1000) : 0;
    
    const avgProgress = totalStudents > 0
      ? Math.round(filteredStudents.reduce((acc, s) => acc + (s.progress || 0), 0) / totalStudents)
      : 0;

    // Engagement: % of students active in last 7 days (via access or answers)
    const sevenDaysAgo = subDays(now, 7);
    const activeStudentsCount = filteredStudents.filter((s) => {
      const hasRecentAccess = s.last_access && new Date(s.last_access) >= sevenDaysAgo;
      const hasRecentAnswer = activeAnswers.some(a => a.student_id === s.id && new Date(a.answered_at) >= sevenDaysAgo);
      return hasRecentAccess || hasRecentAnswer;
    }).length;
    const engagementRate = totalStudents > 0 ? Math.round((activeStudentsCount / totalStudents) * 100) : 0;

    // 4. Performance by Subject
    const subjectMap: Record<string, { correct: number; total: number }> = {};
    filteredAnswers.forEach((a) => {
      const name = a.questions?.subjects?.name || "Geral";
      if (!subjectMap[name]) subjectMap[name] = { correct: 0, total: 0 };
      subjectMap[name].total += 1;
      if (a.is_correct) subjectMap[name].correct += 1;
    });

    const performanceBySubject = Object.entries(subjectMap)
      .map(([name, s]) => ({ name, performance: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0 }))
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 8);

    // 5. Weekly trend (Last 7 Days)
    const daysShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i);
      dayMap[daysShort[d.getDay()]] = 0;
    }
    filteredAnswers.forEach((a) => {
      const date = new Date(a.answered_at);
      if (date >= subDays(now, 7)) {
        const day = daysShort[date.getDay()];
        if (day in dayMap) dayMap[day]++;
      }
    });
    const engagementTrend = Object.entries(dayMap).map(([day, acessos]) => ({ day, acessos }));

    // 6. Top Students
    const topPerformers = [...filteredStudents]
      .filter((s) => s.answeredCount >= 3 || useDemo)
      .sort((a, b) => b.accuracy - a.accuracy || b.progress - a.progress)
      .slice(0, 5);

    // 7. Students at Risk (Busca Ativa)
    const atRiskStudents = [...filteredStudents]
      .filter((s) => {
        const isInactive = !s.last_access || new Date(s.last_access) < subDays(now, 7);
        const hasLowPerformance = s.answeredCount >= 5 && s.accuracy < 50;
        return isInactive || hasLowPerformance;
      })
      .sort((a, b) => {
        if (a.progress !== b.progress) return a.progress - b.progress;
        return (a.last_access ? new Date(a.last_access).getTime() : 0) - (b.last_access ? new Date(b.last_access).getTime() : 0);
      })
      .slice(0, 5);

    return {
      filteredStudents,
      totalStudents,
      avgScore,
      accuracy,
      avgProgress,
      totalAnswers,
      engagementRate,
      performanceBySubject: performanceBySubject.length > 0 ? performanceBySubject : [{ name: "Sem Dados", performance: 0 }],
      engagementTrend,
      topPerformers,
      atRiskStudents,
    };
  }, [rawData, useDemo, loading, selectedCourse, selectedInstitution, selectedExamTarget, selectedPeriod, userId]);

  // Current Individual Student Profile
  const currentStudent = useMemo(() => {
    if (!userId) return null;
    const list = useDemo ? MOCK_PROFILES : rawData.profiles;
    return list.find((p) => p.id === userId);
  }, [rawData.profiles, useDemo, userId]);

  // Student Answers log
  const studentAnswersLog = useMemo(() => {
    if (!userId) return [];
    const list = useDemo ? MOCK_ANSWERS : rawData.answers;
    return list.filter((a) => a.student_id === userId).slice(0, 10);
  }, [rawData.answers, useDemo, userId]);

  // Dynamic Aurora IA Advisor suggestions
  const auroraInsight = useMemo(() => {
    if (useDemo) {
      return "Em modo de demonstração, observamos um excelente aproveitamento de acertos nas disciplinas de Humanas. A Sala 01 lidera o progresso de trilhas. Recomendamos direcionar listas extras de revisão de Matemática Básica e Física Geral para equilibrar a nota TRI geral.";
    }
    if (userId) {
      const name = currentStudent?.name || "Aluno";
      const acc = processedData?.accuracy || 0;
      const progress = processedData?.avgProgress || 0;
      const lowestSubject = processedData?.performanceBySubject[processedData.performanceBySubject.length - 1];
      const lowestSubjectName = lowestSubject ? lowestSubject.name : "";

      if (acc < 50 && acc > 0) {
        return `O aluno ${name} apresenta aproveitamento de ${acc}% nos simulados. Observa-se maior dificuldade em ${lowestSubjectName}. Sugerimos enviar uma mensagem via chat orientando a revisão dos conceitos básicos dessa matéria.`;
      }
      if (progress < 30) {
        return `${name} está com bom aproveitamento nas questões (${acc}%), porém concluiu apenas ${progress}% das trilhas propostas. Incentive-o a avançar nas aulas pendentes.`;
      }
      return `Desempenho sólido observado para o aluno ${name}. Média estimada de ${processedData?.avgScore} pontos (${acc}% de acertos). Mantendo ritmo regular de estudo.`;
    }

    const lowestSubject = processedData?.performanceBySubject[processedData.performanceBySubject.length - 1];
    const lowestSubjectName = lowestSubject ? lowestSubject.name : "";
    const lowestScore = lowestSubject ? lowestSubject.performance : 0;
    const acc = processedData?.accuracy || 0;

    if (acc === 0) {
      return "Ainda não há respostas suficientes neste filtro para um diagnóstico. Publique trilhas e oriente os alunos a resolverem simulados.";
    }

    if (lowestScore < 55 && lowestSubjectName && lowestSubjectName !== "Sem Dados") {
      return `Detectamos uma queda de rendimento do grupo em ${lowestSubjectName} (média de ${lowestScore}% de acerto). Sugerimos aos mentores liberar um material de revisão focado nesse tema.`;
    }

    return `O segmento atual demonstra aproveitamento geral de ${acc}% (${processedData?.avgScore} pts). O engajamento semanal está saudável em ${processedData?.engagementRate}%. Mantenham a consistência!`;
  }, [useDemo, userId, currentStudent, processedData, rawData]);

  const handleDownloadReport = () => {
    toast({ title: "Gerando relatório…", description: "Preparando o diagnóstico para impressão." });
    setTimeout(() => { window.print(); }, 800);
  };

  const handleClearUser = () => {
    router.push("/dashboard/teacher/analytics");
  };

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="u-label">Carregando desempenho…</p>
      </div>
    );
  }

  const data = processedData;
  const filterLabel = "u-label block mb-1 ml-0.5";
  const triggerCls = "h-10 rounded-control bg-background border-border text-foreground text-xs font-semibold";

  return (
    <div className="pb-24 space-y-6">

      {/* ── Cabeçalho (nível médio): u-label + u-page-title ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="u-label flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Professor · desempenho</p>
            {useDemo && (
              <span className="u-label !text-foreground border border-border rounded-control px-2 py-0.5">Demonstração</span>
            )}
          </div>
          <h1 className="u-page-title text-2xl md:text-3xl mt-1">
            {userId ? "Diagnóstico do aluno" : "Desempenho da turma"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 break-words">
            {userId
              ? `${currentStudent?.name || "Aluno"}${currentStudent?.email ? ` · ${currentStudent.email}` : ""}`
              : "Engajamento, acertos por matéria e alunos que precisam de atenção."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center print:hidden">
          <Button
            onClick={() => setUseDemo(!useDemo)}
            variant="outline"
            className="rounded-control h-10 text-xs font-semibold [touch-action:manipulation]"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {useDemo ? "Sair da demonstração" : "Ver demonstração"}
          </Button>

          {userId && (
            <Button
              onClick={handleClearUser}
              variant="outline"
              className="rounded-control h-10 text-xs font-semibold [touch-action:manipulation]"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Visão geral
            </Button>
          )}
          <Button
            onClick={handleDownloadReport}
            variant="arcade"
            className="rounded-control h-10 text-xs font-bold px-4 [touch-action:manipulation]"
          >
            <FileDown className="h-4 w-4 mr-1.5" />
            Baixar relatório
          </Button>
        </div>
      </div>

      {/* ── Filtros (só na visão geral) ── */}
      {!userId && (
        <div className="u-surface p-4 grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
          <div>
            <label className={filterLabel}>Sala / turma</label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all" className="text-xs">Todas</SelectItem>
                {filterOptions.courses.map((course) => (
                  <SelectItem key={course} value={course} className="text-xs">
                    Sala {course}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className={filterLabel}>Polo / instituição</label>
            <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                {filterOptions.institutions.map((inst) => (
                  <SelectItem key={inst} value={inst} className="text-xs">
                    {inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className={filterLabel}>Exame-alvo</label>
            <Select value={selectedExamTarget} onValueChange={setSelectedExamTarget}>
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                <SelectItem value="enem" className="text-xs">ENEM</SelectItem>
                <SelectItem value="etec" className="text-xs">ETEC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className={filterLabel}>Período</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Todo o período" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all" className="text-xs">Todo o período</SelectItem>
                <SelectItem value="week" className="text-xs">Últimos 7 dias</SelectItem>
                <SelectItem value="month" className="text-xs">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ── Indicadores ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="u-surface p-4 md:p-5">
          <p className="u-label flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {userId ? "Aluno" : "Alunos"}</p>
          <p className="u-num text-2xl md:text-3xl mt-2">{userId ? "1" : fmtNumber(data?.totalStudents ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{userId ? "Selecionado" : "No filtro atual"}</p>
        </div>

        <div className="u-surface p-4 md:p-5">
          <p className="u-label flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Nota média</p>
          <p className="u-num text-2xl md:text-3xl mt-2">
            {fmtNumber(data?.avgScore ?? 0)} <span className="text-xs font-sans font-semibold text-muted-foreground">pts</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">{data?.accuracy ?? 0}% de acerto</p>
        </div>

        <div className="u-surface p-4 md:p-5">
          <p className="u-label flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Progresso</p>
          <p className="u-num text-2xl md:text-3xl mt-2">{data?.avgProgress ?? 0}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">Média de trilhas concluídas</p>
        </div>

        <div className="u-surface p-4 md:p-5">
          <p className="u-label flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> {userId ? "Respostas" : "Engajamento"}</p>
          <p className="u-num text-2xl md:text-3xl mt-2">
            {userId ? fmtNumber(data?.totalAnswers ?? 0) : `${data?.engagementRate ?? 0}%`}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {userId ? "No período" : "Ativos nos últimos 7 dias"}
          </p>
        </div>
      </div>

      {/* ── Sugestão da Aurora IA ── */}
      <div className="u-surface p-4 md:p-5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="u-label">Sugestão da Aurora IA</p>
          <p className="text-sm text-foreground leading-relaxed mt-1">{auroraInsight}</p>
        </div>
      </div>

      {/* ── Gráficos e listas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        <div className={`${userId ? "lg:col-span-8" : "lg:col-span-7"} space-y-5 min-w-0`}>

          {/* Acerto por matéria */}
          <div className="u-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <p className="u-label flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Acerto por matéria</p>
              <span className="text-[11px] text-muted-foreground">Simulados</span>
            </div>
            <div className="p-4 md:p-6 h-[280px]">
              {data && data.performanceBySubject.length > 0 && data.performanceBySubject[0].name !== "Sem Dados" ? (
                <BarChartPremium
                  data={data.performanceBySubject}
                  xKey="name"
                  yKey="performance"
                  horizontal
                  domainMax={100}
                  unit="%"
                  colors={["#4ccced"]}
                />
              ) : (
                <EmptyState
                  compact
                  icon={BarChart3}
                  title="Ainda sem respostas neste filtro"
                  description="O acerto por matéria aparece quando os alunos resolverem questões."
                  className="h-full justify-center"
                />
              )}
            </div>
          </div>

          {/* Atividade semanal */}
          <div className="u-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <p className="u-label flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Atividade da semana</p>
              <span className="text-[11px] text-muted-foreground">Respostas por dia</span>
            </div>
            <div className="p-4 md:p-6 h-[250px]">
              {data && data.engagementTrend.length > 0 ? (
                <AreaChartPremium
                  data={data.engagementTrend}
                  xKey="day"
                  yKey="acessos"
                  color="#4ccced"
                  unit=" q"
                />
              ) : (
                <EmptyState
                  compact
                  icon={Activity}
                  title="Nenhuma atividade nos últimos 7 dias"
                  className="h-full justify-center"
                />
              )}
            </div>
          </div>
        </div>

        <div className={`${userId ? "lg:col-span-4" : "lg:col-span-5"} space-y-5 min-w-0`}>

          {/* Ficha do aluno (diagnóstico individual) */}
          {userId && currentStudent && (
            <div className="u-surface p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                  {currentStudent.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground text-sm leading-tight truncate">{currentStudent.name}</h3>
                  <p className="u-label mt-0.5">Ficha do aluno</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentStudent.email}</span>
                </div>
                {currentStudent.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{currentStudent.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{currentStudent.institution || "Sem polo informado"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 shrink-0" />
                  <span>Foco: <strong className="text-foreground font-semibold">{currentStudent.exam_target || "ENEM"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>Turma: <strong className="text-foreground font-semibold">{(currentStudent.course || currentStudent.sala) ? `Sala ${currentStudent.course || currentStudent.sala}` : "Sem turma"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Último acesso: <strong className="text-foreground font-semibold">
                    {currentStudent.last_access
                      ? formatDistanceToNow(new Date(currentStudent.last_access), { addSuffix: true, locale: ptBR })
                      : "nunca acessou"}
                  </strong></span>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <Button asChild size="sm" className="w-full h-9 rounded-control text-xs font-semibold">
                  <Link href={`/dashboard/chat/${currentStudent.id}`}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Enviar mensagem
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Histórico de respostas (diagnóstico individual) */}
          {userId && (
            <div className="u-surface p-5">
              <p className="u-label flex items-center gap-1.5 mb-3"><ClipboardCheck className="h-3.5 w-3.5" /> Últimas respostas</p>

              {studentAnswersLog.length === 0 ? (
                <EmptyState
                  compact
                  icon={ClipboardCheck}
                  title="Este aluno ainda não respondeu questões"
                  description="As respostas aparecem aqui assim que ele resolver exercícios ou simulados."
                  action={currentStudent ? { label: "Enviar mensagem", href: `/dashboard/chat/${currentStudent.id}`, icon: Send } : undefined}
                />
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {studentAnswersLog.map((log: any, idx: number) => (
                    <div key={log.id ?? idx} className="flex items-center justify-between gap-2 p-2.5 rounded-control bg-muted/40 border border-border">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate leading-none">
                          {log.questions?.subjects?.name || "Geral"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Opção <span className="font-semibold">{log.selected_option ?? "—"}</span> · {fmtDate(log.answered_at, "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge className={`border-none text-[10px] font-semibold px-2 rounded-control shrink-0 ${
                        log.is_correct ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                      }`}>
                        {log.is_correct ? "Acerto" : "Erro"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Melhores desempenhos (visão geral) */}
          {!userId && (
            <div className="u-surface p-5">
              <p className="u-label flex items-center gap-1.5 mb-3"><Award className="h-3.5 w-3.5" /> Melhores desempenhos</p>

              {data && data.topPerformers.length === 0 ? (
                <EmptyState
                  compact
                  icon={Award}
                  title="Ninguém com respostas suficientes ainda"
                  description="Entra aqui quem respondeu pelo menos 3 questões no filtro atual."
                />
              ) : (
                <div className="divide-y divide-border">
                  {data?.topPerformers.map((student, i) => (
                    <div key={student.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="u-num text-sm text-muted-foreground w-6 shrink-0">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{student.name}</p>
                          <p className="text-[11px] text-muted-foreground">Sala {student.course || student.sala || "—"} · {student.answeredCount} respostas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="u-num text-sm">{student.accuracy}%</span>
                        <Link
                          href={`/dashboard/teacher/analytics?user=${student.id}`}
                          className="h-8 w-8 rounded-control border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Ver diagnóstico"
                          aria-label={`Ver diagnóstico de ${student.name}`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alunos em risco (visão geral) */}
          {!userId && (
            <div className="u-surface p-5">
              <p className="u-label flex items-center gap-1.5 mb-3"><AlertCircle className="h-3.5 w-3.5" /> Alunos que precisam de atenção</p>

              {data && data.atRiskStudents.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="Nenhum aluno em risco"
                  description="Ninguém está sem acessar há mais de 7 dias ou com acerto abaixo de 50%."
                />
              ) : (
                <div className="divide-y divide-border">
                  {data?.atRiskStudents.map((student) => {
                    const isInactive = !student.last_access || new Date(student.last_access) < subDays(new Date(), 7);
                    return (
                      <div key={student.id} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{student.name}</p>
                          <p className="text-[11px] font-semibold text-red-600 mt-0.5">
                            {isInactive ? "Sem acessar há mais de 7 dias" : `Acerto baixo (${student.accuracy}%)`}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Link
                            href={`/dashboard/teacher/analytics?user=${student.id}`}
                            className="h-8 w-8 rounded-control border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Ver diagnóstico"
                            aria-label={`Ver diagnóstico de ${student.name}`}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/dashboard/chat/${student.id}`}
                            className="h-8 w-8 rounded-control border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Enviar mensagem"
                            aria-label={`Enviar mensagem para ${student.name}`}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button asChild variant="outline" className="w-full mt-4 h-10 rounded-control text-xs font-semibold">
                <Link href="/dashboard/teacher/students">Ver todos os alunos</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
