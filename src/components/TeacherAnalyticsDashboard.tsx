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
          title: "Erro de Conexão",
          description: "Não foi possível sincronizar todos os dados acadêmicos com o banco.",
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
      return "Aurora IA: Em modo de demonstração, observamos um excelente aproveitamento de acertos nas disciplinas de Humanas. A Sala 01 lidera o progresso de trilhas. Recomendamos direcionar listas extras de revisão de Matemática Básica e Física Geral para equilibrar a nota TRI geral.";
    }
    if (userId) {
      const name = currentStudent?.name || "Aluno";
      const acc = processedData?.accuracy || 0;
      const progress = processedData?.avgProgress || 0;
      const lowestSubject = processedData?.performanceBySubject[processedData.performanceBySubject.length - 1];
      const lowestSubjectName = lowestSubject ? lowestSubject.name : "";

      if (acc < 50 && acc > 0) {
        return `Aurora IA: O aluno ${name} apresenta aproveitamento de ${acc}% nos simulados. Observa-se maior dificuldade em ${lowestSubjectName}. Sugerimos enviar uma mensagem via chat orientando a revisão dos conceitos básicos dessa matéria.`;
      }
      if (progress < 30) {
        return `Aurora IA: ${name} está com bom aproveitamento nas questões (${acc}%), porém concluiu apenas ${progress}% das trilhas propostas. Incentive-o a avançar nas aulas pendentes.`;
      }
      return `Aurora IA: Desempenho sólido observado para o aluno ${name}. Média estimada de ${processedData?.avgScore} pontos (${acc}% de acertos). Mantendo ritmo regular de estudo.`;
    }

    const lowestSubject = processedData?.performanceBySubject[processedData.performanceBySubject.length - 1];
    const lowestSubjectName = lowestSubject ? lowestSubject.name : "";
    const lowestScore = lowestSubject ? lowestSubject.performance : 0;
    const acc = processedData?.accuracy || 0;

    if (acc === 0) {
      return "Aurora IA: Sintonizando satélite analítico... Sem dados suficientes para traçar diagnósticos pedagógicos neste segmento. Publique trilhas e oriente a resolução de simulados.";
    }

    if (lowestScore < 55 && lowestSubjectName && lowestSubjectName !== "Sem Dados") {
      return `Aurora IA: Detectamos uma queda de rendimento do grupo em ${lowestSubjectName} (média de ${lowestScore}% de acerto). Sugerimos aos mentores liberar um material de revisão focado nesse tema.`;
    }

    return `Aurora IA: O segmento atual demonstra aproveitamento geral de ${acc}% (${processedData?.avgScore} pts). O engajamento semanal está saudável em ${processedData?.engagementRate}%. Mantenham a consistência!`;
  }, [useDemo, userId, currentStudent, processedData, rawData]);

  const handleDownloadReport = () => {
    toast({ title: "Gerando Relatório...", description: "Preparando diagnóstico para impressão." });
    setTimeout(() => { window.print(); }, 800);
  };

  const handleClearUser = () => {
    router.push("/dashboard/teacher/analytics");
  };

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">Sintonizando Satélite Analítico...</p>
      </div>
    );
  }

  const data = processedData;

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Header / Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6 md:p-8">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.15) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(99,102,241,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <BarChart3 className="h-3.5 w-3.5 text-orange-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
                  BI · Analytics
                </p>
                {useDemo && (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2 py-0.5 animate-pulse">Modo Demonstrativo</span>
                )}
                {userId && (
                  <span className="text-[8px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5">Diagnóstico Aluno</span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white leading-none">
                {userId ? `Diagnóstico: ${currentStudent?.name || "Aluno"}` : "Inteligência Pedagógica"}
              </h1>
              <p className="text-white/70 text-xs font-semibold mt-1">
                {userId ? `Dados e trilha de desempenho de ${currentStudent?.email}` : "Engajamento, performance e busca ativa do cursinho em tempo real"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {/* Interactive Demo Mode Toggle */}
              <Button
                onClick={() => setUseDemo(!useDemo)}
                variant="outline"
                className={`rounded-xl h-11 border-white/10 text-white font-black text-xs uppercase active:scale-95 transition-all [touch-action:manipulation] print:hidden ${
                  useDemo ? "bg-amber-500/20 text-amber-300 border-amber-500/35" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {useDemo ? "Demo Ativo" : "Ver Demo"}
              </Button>

              {userId && (
                <Button
                  onClick={handleClearUser}
                  variant="outline"
                  className="rounded-xl h-11 border-white/10 bg-white/5 text-white font-black text-xs uppercase hover:bg-white/10 active:scale-95 transition-all [touch-action:manipulation] print:hidden"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Geral
                </Button>
              )}
              <Button
                onClick={handleDownloadReport}
                className="btn-orange-neon rounded-xl h-11 text-slate-800 font-black text-xs uppercase tracking-wider active:scale-95 transition-all [touch-action:manipulation] border-none px-5 print:hidden"
              >
                <FileDown className="h-4 w-4 mr-1.5" />
                Relatório Executivo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters (Only on Global view) ── */}
      {!userId && (
        <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] p-4 grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Sala / Turma</label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 text-xs font-bold focus:ring-orange-500/25">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="all" className="text-slate-600 text-xs font-bold">Todas</SelectItem>
                {filterOptions.courses.map((course) => (
                  <SelectItem key={course} value={course} className="text-slate-600 text-xs font-bold">
                    Sala {course}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Polo / Instituição</label>
            <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
              <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 text-xs font-bold focus:ring-orange-500/25">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="all" className="text-slate-600 text-xs font-bold">Todos</SelectItem>
                {filterOptions.institutions.map((inst) => (
                  <SelectItem key={inst} value={inst} className="text-slate-600 text-xs font-bold">
                    {inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Meta Exame</label>
            <Select value={selectedExamTarget} onValueChange={setSelectedExamTarget}>
              <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 text-xs font-bold focus:ring-orange-500/25">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="all" className="text-slate-600 text-xs font-bold">Todas</SelectItem>
                <SelectItem value="enem" className="text-slate-600 text-xs font-bold">ENEM</SelectItem>
                <SelectItem value="etec" className="text-slate-600 text-xs font-bold">ETEC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Período Histórico</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 text-xs font-bold focus:ring-orange-500/25">
                <SelectValue placeholder="Todo Período" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="all" className="text-slate-600 text-xs font-bold">Todo Período</SelectItem>
                <SelectItem value="week" className="text-slate-600 text-xs font-bold">Últimos 7 dias</SelectItem>
                <SelectItem value="month" className="text-slate-600 text-xs font-bold">Último mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-md border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 italic leading-none">
              {userId ? "1" : data?.totalStudents}
            </p>
          </div>
          <div className="mt-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              {userId ? "Aluno Selecionado" : "Alunos Ativos"}
            </p>
            <p className="text-[8px] text-slate-400 italic">No segmento filtrado</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-md border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="h-8 w-8 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 italic leading-none">
              {data?.avgScore} <span className="text-xs font-bold text-slate-400">pts</span>
            </p>
          </div>
          <div className="mt-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Média Geral de Acertos
            </p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{data?.accuracy}% de acerto</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-md border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="h-8 w-8 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <ClipboardCheck className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 italic leading-none">
              {data?.avgProgress}%
            </p>
          </div>
          <div className="mt-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Progresso Médio
            </p>
            <p className="text-[8px] text-slate-400 italic">Conclusão de trilhas</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-md border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="h-8 w-8 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
              <Activity className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 italic leading-none">
              {userId ? data?.totalAnswers : `${data?.engagementRate}%`}
            </p>
          </div>
          <div className="mt-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              {userId ? "Respostas no Período" : "Engajamento Semanal"}
            </p>
            <p className="text-[8px] text-slate-400 italic">
              {userId ? "Total de envios" : "Estudantes ativos >7d"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Aurora IA Insights ── */}
      <div className="relative rounded-[1.5rem] overflow-hidden border border-[#4CCCED]/15 bg-gradient-to-br from-orange-500/5 to-amber-500/3 p-5 shadow-inner">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(76,204,237,0.12) 0%, transparent 60%)" }}
        />
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-10 w-10 rounded-2xl bg-[#4CCCED]/20 border border-[#4CCCED]/30 flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-orange-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-orange-400">Aurora IA Advisor</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs font-semibold text-slate-700 leading-relaxed italic">
              "{auroraInsight}"
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Charts & Lists Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Charts Column (Left) */}
        <div className={`${userId ? "lg:col-span-8" : "lg:col-span-7"} space-y-5`}>
          
          {/* Performance por Matéria */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500/85" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">Performance por Matéria</p>
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-600 bg-white shadow-sm border border-slate-200 rounded-full px-2 py-0.5">Simulados</span>
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
                  colors={["#4ccced", "#fb923c", "#fdba74", "#fcd34d", "#fde68a", "#6366f1", "#10b981", "#ec4899"]}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-sm">
                  <p>Sem dados de exercícios para as matérias selecionadas.</p>
                </div>
              )}
            </div>
          </div>

          {/* Engajamento de Respostas */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500/85" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">Atividade Semanal</p>
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">Respostas</span>
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
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-sm">
                  <p>Sem atividade registrada nos últimos 7 dias.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Diagnostic & Student Context Columns (Right) */}
        <div className={`${userId ? "lg:col-span-4" : "lg:col-span-5"} space-y-5`}>
          
          {/* Individual Student Info (Only on individual diagnostic mode) */}
          {userId && currentStudent && (
            <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="h-10 w-10 rounded-xl bg-[#4CCCED]/20 text-orange-400 border border-[#4CCCED]/30 flex items-center justify-center font-black text-base italic shadow-md">
                  {currentStudent.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm italic leading-tight">{currentStudent.name}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Cadastro de Estudante</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{currentStudent.email}</span>
                </div>
                {currentStudent.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{currentStudent.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{currentStudent.institution || "Sem polo informado"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Foco: <strong className="text-orange-500 font-black">{currentStudent.exam_target || "ENEM"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Turma: <strong className="text-indigo-500 font-black">Sala {currentStudent.course || currentStudent.sala || "Não alocado"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Último Acesso: <strong>
                    {currentStudent.last_access 
                      ? formatDistanceToNow(new Date(currentStudent.last_access), { addSuffix: true, locale: ptBR }) 
                      : "Nunca acessou"}
                  </strong></span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <Button asChild size="sm" className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-wider bg-[#4CCCED] hover:bg-orange-600 text-slate-800 border-none shadow-md">
                  <Link href={`/dashboard/chat/${currentStudent.id}`}>
                    <Send className="h-3 w-3 mr-1" />
                    Contatar Aluno
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Individual Student Recent answers log (Only on individual diagnostic mode) */}
          {userId && (
            <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] p-5">
              <h3 className="font-black text-slate-900 text-xs italic uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4 text-orange-400" />
                Histórico de Respostas
              </h3>

              {studentAnswersLog.length === 0 ? (
                <div className="py-8 text-center text-slate-400 italic text-[11px] border border-dashed rounded-xl">
                  Nenhuma resposta no histórico.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {studentAnswersLog.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate leading-none">
                          {log.questions?.subjects?.name || "Geral"}
                        </p>
                        <p className="text-[9px] text-slate-400 font-semibold mt-1">
                          Opção: <span className="font-bold">{log.selected_option}</span> · {format(new Date(log.answered_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge className={`border-none text-[8px] font-black uppercase px-1.5 h-4.5 rounded-full ${
                        log.is_correct ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {log.is_correct ? "Acerto" : "Erro"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Destaques da Rede (Only on Global Mode) */}
          {!userId && (
            <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] p-5">
              <h3 className="font-black text-slate-900 text-xs italic uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-orange-400 animate-pulse-subtle" />
                🏆 Destaques da Rede
              </h3>

              {data && data.topPerformers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic text-[11px] border border-dashed rounded-xl">
                  Nenhum destaque elegível.
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.topPerformers.map((student, i) => (
                    <div key={student.id} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-100 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-black text-orange-400/80 w-4">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 italic truncate max-w-[130px]">{student.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Sala {student.course || student.sala || "—"} · {student.answeredCount} res.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-500 italic leading-none">{student.accuracy}%</span>
                        <Link
                          href={`/dashboard/teacher/analytics?user=${student.id}`}
                          className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:bg-[#4CCCED]/10 transition-all"
                          title="Ficha do Aluno"
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

          {/* Busca Ativa / Risco (Only on Global Mode) */}
          {!userId && (
            <div className="bg-[#0d0d0f] border border-white/5 rounded-[1.5rem] p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <h3 className="font-black text-white text-xs italic uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                  ⚠️ Busca Ativa (Em Risco)
                </h3>

                {data && data.atRiskStudents.length === 0 ? (
                  <div className="py-12 text-center text-white/35 italic text-[11px] border border-white/10 rounded-xl">
                    Sem alertas de evasão ou rendimento. ✅
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.atRiskStudents.map((student) => {
                      const isInactive = !student.last_access || new Date(student.last_access) < subDays(new Date(), 7);
                      return (
                        <div key={student.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white italic truncate max-w-[130px]">{student.name}</p>
                            <p className="text-[8px] font-black text-red-400 uppercase tracking-wide mt-0.5">
                              {isInactive ? "Inatividade" : `Baixo Rendimento (${student.accuracy}%)`}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <Link
                              href={`/dashboard/teacher/analytics?user=${student.id}`}
                              className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                              title="Diagnóstico"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                            <Link
                              href={`/dashboard/chat/${student.id}`}
                              className="h-8 w-8 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-500/20 flex items-center justify-center text-red-400 transition-all"
                              title="Orientar"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button asChild className="w-full mt-4 h-10 rounded-xl bg-white/5 text-white hover:bg-white/10 border border-white/10 font-black text-xs uppercase tracking-wide transition-all">
                  <Link href="/dashboard/teacher/students">Ver Todos os Alunos</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
