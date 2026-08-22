"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLoader } from "@/components/DashboardLoader";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence, MotionConfig } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Library, Bot, Loader2, Megaphone, AlertOctagon, Info,
  TrendingUp, PlayCircle, Video, FileText, FileCheck,
  Calculator, BrainCircuit, Sparkles, Zap, FilePenLine,
  ArrowRight, ChevronRight, ChevronDown, BookOpen, Phone, Check,
  ClipboardCheck, KeyRound, CheckCircle2, ShieldAlert,
  AlertTriangle, GraduationCap, Scroll, BarChart3, Star,
  XCircle, ListChecks, Flame
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/AuthProvider";
import { useTenant } from "@/components/TenantProvider";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { AreaChartPremium } from "@/components/charts/premium";

// Canvases decorativos (pointer-events-none) fora do bundle inicial: no 3G/
// celular fraco eles não podem competir com o conteúdo pelo primeiro paint.
const EmberCanvas = dynamic(() => import("@/components/EmberCanvas").then(m => m.EmberCanvas), { ssr: false });
const FlameEmberCanvas = dynamic(() => import("@/components/FlameEmberCanvas").then(m => m.FlameEmberCanvas), { ssr: false });

import {
  SIMULADO_GABARITO,
  SIMULADO_GABARITO_CHAVE,
  SIMULADO_GABARITO_TITULO,
  SIMULADO_GABARITO_TOTAL,
} from "@/lib/gabarito-simulado";

const GamificationWidget = dynamic(
  () => import('@/components/GamificationWidget').then(m => ({ default: m.GamificationWidget })),
  { ssr: false, loading: () => <div className="h-40 rounded-card bg-muted/20 animate-pulse" /> }
);
const UpcomingEventsWidget = dynamic(
  () => import('@/components/UpcomingEventsWidget').then(m => ({ default: m.UpcomingEventsWidget })),
  { ssr: false, loading: () => <div className="h-32 rounded-card bg-muted/20 animate-pulse" /> }
);
const StudySuggestionWidget = dynamic(
  () => import('@/components/StudySuggestionWidget').then(m => ({ default: m.StudySuggestionWidget })),
  { ssr: false, loading: () => <div className="h-24 rounded-card bg-muted/20 animate-pulse" /> }
);
// O bichinho absorveu o cartao de ofensiva: os dois contam a mesma coisa
// (quantos dias seguidos), e a home ja tinha oito cartoes — somar um nono
// empurraria o resto para fora da primeira tela do celular.
const BichinhoWidget = dynamic(
  () => import('@/components/BichinhoWidget').then(m => ({ default: m.BichinhoWidget })),
  { ssr: false, loading: () => <div className="h-64 rounded-card bg-muted/20 animate-pulse" /> }
);
const GoalsWidget = dynamic(
  () => import('@/components/GoalsWidget').then(m => ({ default: m.GoalsWidget })),
  { ssr: false, loading: () => <div className="h-44 rounded-card bg-muted/20 animate-pulse" /> }
);
const JournalWidget = dynamic(
  () => import('@/components/JournalWidget').then(m => ({ default: m.JournalWidget })),
  { ssr: false, loading: () => <div className="h-40 rounded-card bg-muted/20 animate-pulse" /> }
);
const WeeklySummaryWidget = dynamic(
  () => import('@/components/WeeklySummaryWidget').then(m => ({ default: m.WeeklySummaryWidget })),
  { ssr: false, loading: () => <div className="h-48 rounded-card bg-muted/20 animate-pulse" /> }
);
const DailyQuestionCard = dynamic(
  () => import('@/components/DailyQuestionCard').then(m => ({ default: m.DailyQuestionCard })),
  { ssr: false, loading: () => <div className="h-28 rounded-card bg-muted/20 animate-pulse" /> }
);
const WeeklyMissionsWidget = dynamic(
  () => import('@/components/WeeklyMissionsWidget').then(m => ({ default: m.WeeklyMissionsWidget })),
  { ssr: false, loading: () => <div className="h-48 rounded-card bg-muted/20 animate-pulse" /> }
);
const WeeklyRankingWidget = dynamic(
  () => import('@/components/WeeklyRankingWidget').then(m => ({ default: m.WeeklyRankingWidget })),
  { ssr: false, loading: () => <div className="h-48 rounded-card bg-muted/20 animate-pulse" /> }
);
function DashboardChart({ data }: { data: { name: string; score: number }[] }) {
  return <AreaChartPremium data={data} xKey="name" yKey="score" color="#7c3aed" showAxis={false} domainMax={100} />;
}


const localImagesFallback = [
  "/images/capa1.jpeg",
  "/images/carrosel1.jpeg",
  "/images/carrosel2.jpeg",
  "/images/carrosel3.jpeg",
  "/images/carrosel4.jpeg"
];

function getSafeImageUrl(url: string | null | undefined, index: number) {
  if (!url || url.includes("picsum.photos") || url.includes("pixabay.com")) {
    return localImagesFallback[index % localImagesFallback.length];
  }
  return url;
}

// 3D Tilt Card component
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-8, 8]);
  const springX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  return (
    <motion.div
      style={{ rotateX: springX, rotateY: springY, transformStyle: "preserve-3d" }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.97 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Contador animado — número sobe com easing até o valor real
function CountUp({ value, suffix = "", duration = 1400 }: { value: number; suffix?: string; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n}{suffix}</>;
}

// Header editorial numerado — dá ritmo de revista às seções da home
function SectionHeader({ index, title, icon: Icon, iconClass, children }: {
  index: string; title: string; icon: any; iconClass: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 px-1">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-accent leading-none">{index}</span>
            <span className="h-px w-8 bg-gradient-to-r from-accent/50 to-transparent" />
          </div>
          <h2 className="text-lg font-black text-slate-900 italic tracking-tighter uppercase leading-tight truncate mt-1 px-1 -ml-1">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

const MARQUEE_WORDS = ["FOCO", "DISCIPLINA", "CONSTÂNCIA", "APROVAÇÃO", "ENEM", "ETEC", "EXCELÊNCIA"];

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

const priorityStyles: Record<'low' | 'medium' | 'high', { icon: any; color: string; bgColor: string; border: string; label: string }> = {
  low: { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50/50', border: 'border-blue-100', label: 'Informativo' },
  medium: { icon: Megaphone, color: 'text-amber-600', bgColor: 'bg-amber-50/50', border: 'border-amber-100', label: 'Importante' },
  high: { icon: AlertOctagon, color: 'text-red-600', bgColor: 'bg-red-50', border: 'border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.1)] animate-pulse-subtle', label: 'Urgente' },
};

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const CACHE_DURATION = 5 * 60 * 1000;

export default function DashboardHome() {
  const { user, profile, userRole, loading: isUserLoading, refreshProfile } = useAuth();
  const { tenant } = useTenant();
  const logoUrl = tenant.branding.logoUrl;
  const router = useRouter();
  const dataFetchedRef = useRef(false);
  const { toast } = useToast();

  const [phoneValue, setPhoneValue] = useState("");
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [salaValue, setSalaValue] = useState("");
  const [examTargetValue, setExamTargetValue] = useState("");
  const [turnoValue, setTurnoValue] = useState("");
  const [submittingClass, setSubmittingClass] = useState(false);

  const [recommendedTrails, setRecommendedTrails] = useState<any[]>([]);
  const [libraryResources, setLibraryResources] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentProgress, setRecentProgress] = useState<any[]>([]);
  const [essayStats, setEssayStats] = useState<{ count: number; average: number; latest: any } | null>(null);
  const [examStats, setExamStats] = useState<{ totalAssessed: number; averageScore: number; history?: any[] } | null>(null);
  const [simuladoOficial, setSimuladoOficial] = useState<{ title: string; score: number; total: number; completed_at: string; answers: { q: number; selected: string }[] } | null>(null);
  const [simuladoEspecial, setSimuladoEspecial] = useState<{
    id: string;
    title: string;
    description: string;
    pdf_url: string;
    hasAttempt: boolean;
    score?: number;
    triScore?: number;
    completedAt?: string;
  } | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [simNoticeDismissed, setSimNoticeDismissed] = useState(true); // some hidden ate checar

  // Gabarito comentado (modal)
  const [gabaritoOpen, setGabaritoOpen] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  // Aviso de simulado na home (dispensável por aluno)
  useEffect(() => {
    if (!user) return;
    try {
      setSimNoticeDismissed(localStorage.getItem(`sim_notice_dismissed_${user.id}`) === '1');
    } catch {
      // Storage indisponível: o aviso de simulado reaparece. Incômodo, não
      // perda de dado — o aluno consegue dispensar de novo.
    }
  }, [user]);
  const dismissSimNotice = () => {
    setSimNoticeDismissed(true);
    try {
      if (user) localStorage.setItem(`sim_notice_dismissed_${user.id}`, '1');
    } catch {
      // Idem: sem persistir, o aviso volta na próxima visita.
    }
  };

  const [activeSession, setActiveSession] = useState<any>(null);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceStep, setAttendanceStep] = useState<"code" | "fraud">("code");
  const [checkinCode, setCheckinCode] = useState("");
  const [confirmoInput, setConfirmoInput] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) {
      if (digits.length <= 6) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      else if (digits.length <= 10) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      else formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setPhoneValue(formatted);
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const digits = phoneValue.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({ title: "Telefone Inválido ⚠️", description: "Insira um número com DDD válido.", variant: "destructive" });
      return;
    }
    setSubmittingPhone(true);
    try {
      const { error } = await supabase.from("profiles").update({ phone: phoneValue }).eq("id", user.id);
      if (error) throw error;
      toast({ title: "Telefone Salvo! 🎉", description: "Seu número foi registrado com sucesso." });
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      toast({ title: "Erro ao Salvar ❌", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingPhone(false);
    }
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!salaValue) { toast({ title: "Campo obrigatório ⚠️", description: "Selecione o número da sua sala.", variant: "destructive" }); return; }
    if (!examTargetValue) { toast({ title: "Campo obrigatório ⚠️", description: "Selecione seu foco de exame.", variant: "destructive" }); return; }
    if (!turnoValue) { toast({ title: "Campo obrigatório ⚠️", description: "Selecione o turno em que você estuda.", variant: "destructive" }); return; }
    setSubmittingClass(true);
    try {
      const { error } = await supabase.from("profiles").update({ sala: salaValue, exam_target: examTargetValue, turno: turnoValue }).eq("id", user.id);
      if (error) throw error;
      toast({ title: "Perfil atualizado! 🎉", description: "Sala, foco e turno salvos com sucesso." });
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      toast({ title: "Erro ao Salvar ❌", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingClass(false);
    }
  };

  const checkActiveSession = useCallback(async () => {
    if (!user || !profile?.course) return;
    try {
      const { data: activeSessions } = await supabase
        .from("class_sessions")
        .select("id, title, subject, session_date, teacher_name, class_label, checkin_code, checkin_code_expires_at")
        .eq("class_label", profile.course)
        .gt("checkin_code_expires_at", new Date().toISOString())
        .order("checkin_code_expires_at", { ascending: true })
        .limit(1);
      if (activeSessions && activeSessions.length > 0) {
        const session = activeSessions[0];
        const { data: record } = await supabase.from("attendance_records").select("status").eq("session_id", session.id).eq("student_id", user.id).maybeSingle();
        if (!record || record.status === "ausente") { setActiveSession(session); return; }
      }
      setActiveSession(null);
    } catch (err) { console.error("Error checking session:", err); }
  }, [user, profile]);

  const handleOpenAttendanceCheckin = () => {
    setAttendanceStep("code");
    setCheckinCode("");
    setConfirmoInput("");
    setAttendanceDialogOpen(true);
  };

  const handleConfirmedCheckin = async () => {
    const code = checkinCode.trim().toUpperCase();
    if (confirmoInput.trim().toUpperCase() !== "CONFIRMO") {
      toast({ title: "Digite CONFIRMO para prosseguir", variant: "destructive" });
      return;
    }
    setCheckingIn(true);
    try {
      const res = await fetch("/api/attendance/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, confirmed: true }) });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro no check-in", description: data.error || "Código inválido ou expirado.", variant: "destructive" });
      } else {
        toast({ title: "Presença registrada!", description: `Aula: ${data.session_title}` });
        setAttendanceDialogOpen(false);
        setActiveSession(null);
        fetchData(true);
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setCheckingIn(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && userRole !== 'student') {
      if (userRole === 'admin' || userRole === 'staff') router.replace("/dashboard/admin/home");
      else if (userRole === 'teacher') router.replace("/dashboard/teacher/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchData = useCallback(async (force = false) => {
    if (!user || (dataFetchedRef.current && !force)) return;
    const cacheKey = `dash_cache_${user.id}`;
    const cachedData = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setAnnouncements(parsed.data.announcements);
          setRecommendedTrails(parsed.data.recommendedTrails);
          setRecentProgress(parsed.data.recentProgress);
          setLibraryResources(parsed.data.libraryResources);
          setEssayStats(parsed.data.essayStats);
          setExamStats(parsed.data.examStats);
          if (parsed.data.simuladoOficial) setSimuladoOficial(parsed.data.simuladoOficial);
          if (parsed.data.simuladoEspecial) setSimuladoEspecial(parsed.data.simuladoEspecial);
          setLoadingData(false);
          if (Date.now() - parsed.timestamp < 60000) { dataFetchedRef.current = true; return; }
        }
      } catch (e) { console.error("Cache corrupto"); }
    }
    setLoadingData(true);
    dataFetchedRef.current = true;
    try {
      const [annRes, trailRes, progressRes, libRes, essayRes, examRes, simOficialRes, specialExamRes] = await Promise.all([
        supabase.from('announcements').select('*').neq('audience', 'guardians').order('created_at', { ascending: false }).limit(4),
        supabase.from('trails').select('*').or('status.eq.active,status.eq.published').limit(3),
        supabase.from('user_progress').select(`*, trail:trails(title, category, image_url)`).eq('user_id', user.id).order('last_accessed', { ascending: false }).limit(4),
        supabase.from('library_resources').select('*').not('category', 'ilike', 'LIVRO|%').order('created_at', { ascending: false }).limit(3),
        supabase.from('essay_submissions').select('score, status, theme, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('simulation_attempts').select('score, total_questions').eq('user_id', user.id),
        // sem `answers` aqui: o JSONB de 60+ respostas de CADA tentativa pesava
        // o payload no celular — só a tentativa do simulado oficial usa answers,
        // buscado pontualmente logo abaixo.
        supabase.from('exam_attempts').select('id, score, completed_at, tri_score, exam:exams!inner(id, title, exam_type, is_special_cursinho, tri_score_calculated)').eq('user_id', user.id).order('completed_at', { ascending: false }),
        supabase.from('exams').select('id, title, description, pdf_url').eq('is_special_cursinho', true).maybeSingle(),
      ]);
      let essayData = essayRes?.data || [];
      let examData = examRes?.data || [];
      let newAnn = annRes?.data && annRes.data.length > 0
        ? annRes.data
        : [
            { id: '1', title: 'Simulado Geral ETEC/ENEM', message: 'O grande simulado presencial ocorrerá neste sábado às 08h.', priority: 'high' },
            { id: '2', title: 'Novas Apostilas de Biologia', message: 'Já estão disponíveis as novas apostilas de genética.', priority: 'medium' },
          ];
      setAnnouncements(newAnn as any);
      setRecommendedTrails(trailRes?.data || []);
      setRecentProgress(progressRes?.data ? (progressRes.data as any[]).filter((p: any) => p.trail) : []);
      setLibraryResources(libRes?.data || []);
      let newEssayStats = { count: 0, average: 0, latest: null as any };
      if (essayData.length > 0) {
        const scoredEssays = essayData.filter((e: any) => e.score !== null && e.score > 0);
        const avg = scoredEssays.length > 0 ? scoredEssays.reduce((acc: number, curr: any) => acc + Number(curr.score), 0) / scoredEssays.length : 0;
        newEssayStats = { count: essayData.length, average: Math.round(avg), latest: essayData[0] };
      }
      setEssayStats(newEssayStats);
      let newExamStats = { totalAssessed: 0, averageScore: 0, history: [] as any[] };
      if (examData.length > 0) {
        let totalScore = 0, totalMax = 0;
        const historyData = examData.map((ex: any, i: number) => {
          totalScore += Number(ex.score || 0);
          totalMax += Number(ex.total_questions || 0);
          return { name: `S${i + 1}`, score: Math.round(ex.total_questions ? (ex.score / ex.total_questions) * 100 : 0) };
        }).reverse();
        newExamStats = { totalAssessed: examData.length, averageScore: Math.round(totalMax > 0 ? (totalScore / totalMax) * 100 : 0), history: historyData };
      } else {
        newExamStats = { totalAssessed: 0, averageScore: 0, history: [{ name: "Jan", score: 40 }, { name: "Fev", score: 55 }, { name: "Mar", score: 85 }] };
      }
      setExamStats(newExamStats);

      // Simulado oficial importado pela secretaria
      const simOficialData = (simOficialRes?.data || []).find(
        (a: any) => {
          const examObj = Array.isArray(a.exam) ? a.exam[0] : a.exam;
          return examObj?.exam_type === 'simulado_importado';
        }
      ) as any;
      let newSimOficial: typeof simuladoOficial = null;
      if (simOficialData) {
        const examObj = Array.isArray(simOficialData.exam) ? simOficialData.exam[0] : simOficialData.exam;
        // answers só da tentativa que interessa (gabarito comentado)
        const { data: ansRow } = await supabase
          .from('exam_attempts')
          .select('answers')
          .eq('id', simOficialData.id)
          .maybeSingle();
        const rawAnswers = Array.isArray(ansRow?.answers) ? ansRow.answers : [];
        newSimOficial = {
          title: examObj?.title ?? 'Simulado ENEM',
          score: Number(simOficialData.score),
          total: 60,
          completed_at: simOficialData.completed_at,
          answers: rawAnswers,
        };
        setSimuladoOficial(newSimOficial);
      }

      // Simulado especial dos professores (com TRI)
      const specialExam = specialExamRes?.data || null;
      let newSimEspecial: typeof simuladoEspecial = null;
      if (specialExam) {
        const attempt = (simOficialRes?.data || []).find(
          (a: any) => {
            const examObj = Array.isArray(a.exam) ? a.exam[0] : a.exam;
            return examObj?.id === specialExam.id;
          }
        );
        newSimEspecial = {
          id: specialExam.id,
          title: specialExam.title,
          description: specialExam.description || '',
          pdf_url: specialExam.pdf_url || '',
          hasAttempt: !!attempt,
          score: attempt ? Number(attempt.score) : undefined,
          triScore: attempt ? (attempt.tri_score ?? undefined) : undefined,
          completedAt: attempt ? attempt.completed_at : undefined,
        };
        setSimuladoEspecial(newSimEspecial);
      } else {
        setSimuladoEspecial(null);
      }

      const cacheData = {
        // valores recém-calculados, não o estado da render anterior — o cache
        // gravava simulado velho e o widget "pulava" na visita seguinte
        data: { announcements: newAnn, recommendedTrails: trailRes?.data || [], recentProgress: progressRes?.data, libraryResources: libRes?.data, essayStats: newEssayStats, examStats: newExamStats, simuladoOficial: newSimOficial, simuladoEspecial: newSimEspecial },
        timestamp: Date.now()
      };
      if (typeof window !== 'undefined') localStorage.setItem(`dash_cache_${user.id}`, JSON.stringify(cacheData));
    } catch (e: any) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoadingData(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (user && profile && userRole === 'student') {
      fetchData();
      checkActiveSession();
    }
  }, [user, profile, userRole, fetchData, checkActiveSession]);

  // Só o auth segura a tela cheia. Os dados chegam com a página já pintada:
  // cada widget tem skeleton próprio, então o herói (LCP) aparece no primeiro
  // paint em vez de esperar as 8 queries — antes o celular ficava 4-6s no loader.
  if (isUserLoading) return (
    <DashboardLoader />
  );

  const nameToUse = profile?.name || user?.user_metadata?.full_name || '';
  const nameParts = nameToUse.trim().split(' ');
  const firstName = nameParts[0] || 'Estudante';
  const greeting = greetingByHour();
  const score = examStats?.averageScore || 0;
  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;

  // Utilitário para corrigir problemas de codificação (ex: "Ã£" -> "ã") vindos do banco de dados
  const fixEncoding = (str: string) => {
    if (!str) return str;
    return str
      .replace(/Ã£/g, 'ã')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é')
      .replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã§/g, 'ç')
      .replace(/Ãµ/g, 'õ')
      .replace(/Ã¢/g, 'â')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã/g, 'Á')
      .replace(/Á£/g, 'ã')
      .replace(/Á¡/g, 'á')
      .replace(/Á§/g, 'ç');
  };

  // ── Gabarito comentado: dados derivados ──
  const studentAnswerByQ: Record<number, string> = {};
  (simuladoOficial?.answers || []).forEach((a) => {
    if (a && typeof a.q === 'number' && a.selected) {
      studentAnswerByQ[a.q] = String(a.selected).toUpperCase();
    }
  });
  const hasStudentAnswers = Object.keys(studentAnswerByQ).length > 0;
  const gabAcertos = hasStudentAnswers
    ? SIMULADO_GABARITO_CHAVE.filter((g, i) => studentAnswerByQ[i + 1] === g.toUpperCase()).length
    : (simuladoOficial?.score ?? 0);
  const gabErros = hasStudentAnswers ? Object.keys(studentAnswerByQ).length - gabAcertos : 0;
  const visibleGabarito = onlyErrors && hasStudentAnswers
    ? SIMULADO_GABARITO.filter((q) => {
        const sel = studentAnswerByQ[q.numero];
        return sel && sel !== q.resposta.toUpperCase();
      })
    : SIMULADO_GABARITO;
  const gabaritoPorArea = visibleGabarito.reduce((acc, q) => {
    (acc[q.area] = acc[q.area] || []).push(q);
    return acc;
  }, {} as Record<string, typeof SIMULADO_GABARITO>);

  const quickActions = [
    { label: "Simulado",   icon: BrainCircuit, href: "/dashboard/student/simulados",           color: "from-violet-500 to-purple-600" },
    { label: "Redação",    icon: FilePenLine,  href: "/dashboard/student/essays",              color: "from-emerald-500 to-green-600" },
    { label: "Provas",     icon: Scroll,       href: "/dashboard/student/provas",              color: "from-red-500 to-rose-600" },
    { label: "Checklist",  icon: FileCheck,    href: "/dashboard/student/documents",           color: "from-blue-500 to-blue-600" },
    { label: "Biblioteca", icon: Library,      href: "/dashboard/library",                     color: "from-teal-500 to-cyan-600" },
    { label: "Isenção",    icon: Calculator,   href: "/dashboard/student/documents/exemption", color: "from-amber-500 to-orange-500" },
  ];

  const platformFeatures = [
    { icon: BrainCircuit, label: "Banco de Questões",  desc: "novas questões semanais",      href: "/dashboard/student/simulados", gradient: "from-violet-600 to-purple-700",  glow: "shadow-violet-500/30" },
    { icon: FilePenLine,  label: "Sala de Redação",     desc: "correções para o seu texto",   href: "/dashboard/student/essays",    gradient: "from-emerald-500 to-teal-600",  glow: "shadow-emerald-500/30" },
    { icon: Bot,          label: "Aurora AI",          desc: "mentora disponível 24h",       href: "/dashboard/support",           gradient: "from-indigo-500 to-violet-600", glow: "shadow-indigo-500/30", wide: true },
    { icon: PlayCircle,   label: "Trilhas de Vídeo",   desc: "aprenda no seu ritmo",         href: "/dashboard/trails",            gradient: "from-blue-500 to-cyan-600",     glow: "shadow-blue-500/30" },
    { icon: BarChart3,    label: "Meu Desempenho",     desc: "estatísticas para o seu progresso", href: "/dashboard/student/performance", gradient: "from-orange-500 to-red-500",  glow: "shadow-orange-500/30" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } }
  };

  return (
    <MotionConfig reducedMotion="user">
    <motion.div
      className="space-y-4 md:space-y-6 pb-10"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >

      {/* ── CARD DE TELEFONE PENDENTE ── */}
      {profile && !profile.phone && (
        <motion.div variants={itemVariants}
          className="gradient-border relative overflow-hidden rounded-card border border-orange-200 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-5 md:p-8 shadow-2xl text-white">
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none rounded-card" />
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70">Cadastro Obrigatório</span>
                <h2 className="text-base md:text-xl font-black italic tracking-tighter leading-tight">Cadastre seu Telefone</h2>
              </div>
            </div>
            <form onSubmit={handlePhoneSubmit} className="flex flex-col sm:flex-row gap-3">
              <input type="tel" inputMode="numeric" value={phoneValue} onChange={handlePhoneChange} placeholder="(00) 00000-0000"
                className="h-12 flex-1 bg-white/10 backdrop-blur-md text-white placeholder:text-white/50 border border-white/20 focus:border-white rounded-xl font-bold font-mono text-center text-sm focus-visible:outline-none px-3" />
              <Button type="submit" disabled={submittingPhone}
                className="bg-white text-[#0F7A95] hover:bg-orange-50 font-black rounded-xl shadow-lg border-none h-12 px-6 text-xs uppercase tracking-widest active:scale-95 flex items-center gap-2 justify-center shrink-0">
                {submittingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Salvar</>}
              </Button>
            </form>
          </div>
        </motion.div>
      )}

      {/* ── CARD DE TURMA/EXAME PENDENTE ── */}
      {profile && userRole === 'student' && (!profile.sala || !profile.exam_target || !profile.turno) && (
        <motion.div variants={itemVariants}
          className="relative overflow-hidden rounded-card border border-blue-200 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-5 md:p-8 shadow-2xl text-white">
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none rounded-card" />
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70">Cadastro Obrigatório</span>
                <h2 className="text-base md:text-xl font-black italic tracking-tighter leading-tight">Complete seu Perfil</h2>
              </div>
            </div>
            <form onSubmit={handleClassSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <select value={salaValue} onChange={(e) => setSalaValue(e.target.value)}
                    className="h-12 w-full bg-white/10 text-white border border-white/20 focus:border-white rounded-xl font-bold text-sm focus-visible:outline-none px-3 pr-10 cursor-pointer appearance-none">
                    <option value="" className="text-slate-800">Número de sala...</option>
                    {Array.from({ length: 15 }, (_, i) => String(i + 1)).map(n => (
                      <option key={n} value={n} className="text-slate-800">Sala {n}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                </div>
                <div className="relative">
                  <select value={examTargetValue} onChange={(e) => setExamTargetValue(e.target.value)}
                    className="h-12 w-full bg-white/10 text-white border border-white/20 focus:border-white rounded-xl font-bold text-sm focus-visible:outline-none px-3 pr-10 cursor-pointer appearance-none">
                    <option value="" className="text-slate-800">Foco de exame...</option>
                    <option value="ENEM" className="text-slate-800">ENEM</option>
                    <option value="ETEC" className="text-slate-800">ETEC</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <select value={turnoValue} onChange={(e) => setTurnoValue(e.target.value)}
                    className="h-12 w-full bg-white/10 text-white border border-white/20 focus:border-white rounded-xl font-bold text-sm focus-visible:outline-none px-3 pr-10 cursor-pointer appearance-none">
                    <option value="" className="text-slate-800">Turno...</option>
                    <option value="manha" className="text-slate-800">Manhã</option>
                    <option value="tarde" className="text-slate-800">Tarde</option>
                    <option value="integral" className="text-slate-800">Integral</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                </div>
                <Button type="submit" disabled={submittingClass}
                  className="bg-white text-blue-600 hover:bg-blue-50 font-black rounded-xl shadow-lg border-none h-12 px-5 text-xs uppercase tracking-widest active:scale-95 flex items-center gap-2 justify-center shrink-0">
                  {submittingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Salvar</>}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* ── AVISO DE SIMULADO ── */}
      {simuladoEspecial && !simNoticeDismissed && (
        <motion.div variants={itemVariants}
          className="relative overflow-hidden rounded-card border border-orange-200 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-5 md:p-6 shadow-2xl text-white">
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none rounded-card" />
          <button
            onClick={dismissSimNotice}
            aria-label="Dispensar aviso"
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors active:scale-95"
          >
            <XCircle className="h-4 w-4 text-white" />
          </button>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="h-11 w-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-lg animate-float">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 pr-8 sm:pr-0">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/75">Simulados disponíveis</span>
                <h2 className="text-base md:text-lg font-black italic tracking-tighter leading-tight">
                  Faça os simulados do 2º semestre
                </h2>
                <p className="text-[11px] md:text-xs font-semibold text-white/85 mt-1 leading-relaxed">
                  As <strong>2 primeiras tentativas</strong> de cada simulado contam para o seu <strong>boletim do 2º semestre</strong>. As demais valem como treino e entram no seu gráfico de evolução.
                </p>
              </div>
            </div>
            <Link href="/dashboard/student/provas" className="shrink-0">
              <Button className="w-full sm:w-auto h-11 px-5 rounded-xl bg-white text-[#0F7A95] hover:bg-orange-50 font-black text-[11px] uppercase tracking-widest shadow-lg border-none active:scale-95 flex items-center justify-center gap-2">
                Fazer simulado <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── CHAMADA ATIVA ── */}
      {activeSession && (
        <motion.div variants={itemVariants}
          className="gradient-border relative overflow-hidden rounded-card border border-violet-200 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 md:p-8 shadow-2xl glow-purple text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none rounded-card" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 relative z-10 w-full md:w-auto">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-xl animate-float">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
            <div className="text-center sm:text-left space-y-1">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/80 animate-pulse">Chamada em Andamento 🚨</span>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tighter leading-none">Registre sua Presença</h2>
              <p className="text-white/80 font-semibold text-xs leading-relaxed max-w-lg italic">
                Chamada para <strong className="text-white">{activeSession.title}</strong> · turma <strong className="text-white">{activeSession.class_label}</strong> aberta.
              </p>
            </div>
          </div>
          <Button onClick={handleOpenAttendanceCheckin}
            className="bg-white text-violet-600 hover:bg-violet-50 font-black rounded-xl shadow-lg border-none h-12 px-6 text-xs uppercase tracking-widest active:scale-[0.98] flex items-center gap-2 relative z-10 shrink-0">
            <KeyRound className="h-4 w-4" /> Responder Chamada
          </Button>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
           HERO "ARENA" — fundo vivo de brasas + tipografia editorial
          ══════════════════════════════════════════════════ */}
      <motion.section variants={itemVariants}
        className="relative rounded-card overflow-hidden hero-arena-bg noise shadow-2xl">

        {/* camadas de atmosfera (de trás pra frente) */}
        <EmberCanvas className="absolute inset-0 h-full w-full pointer-events-none" />
        <div className="absolute inset-0 dot-grid opacity-[0.14] pointer-events-none" />
        <div className="hero-sweep" />
        {/* linha de horizonte incandescente */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent z-10" />

        <div className="relative z-10 p-5 md:p-10 pb-5 md:pb-7 flex flex-col gap-6">

          {/* topo: status ao vivo + alvo do aluno */}
          <div className="flex items-center justify-between gap-3">
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="flex items-center gap-2 bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-full pl-2.5 pr-3.5 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/80">Área do Aluno</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="flex items-center gap-1.5 bg-primary/15 backdrop-blur-md border border-primary/30 rounded-full px-3.5 py-1.5">
              <GraduationCap className="h-3 w-3 text-accent" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-accent">
                Foco · {(profile?.exam_target || 'ENEM').toUpperCase()}
              </span>
            </motion.div>
          </div>

          {/* headline editorial + ring de score */}
          <div className="flex items-end justify-between gap-5">
            <div className="min-w-0">
              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-[10px] md:text-xs font-black uppercase tracking-[0.35em] text-white/50">
                {greeting},
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="text-[2.7rem] leading-[0.92] sm:text-6xl md:text-7xl font-black italic tracking-tighter text-white truncate">
                {firstName}<span className="text-gradient-fire not-italic">.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                className="mt-2 md:mt-3 text-sm md:text-base font-bold italic text-white/70">
                Cada questão te deixa mais perto da <span className="text-gradient-fire font-black">aprovação</span>.
              </motion.p>
            </div>

            {/* Score ring — ticks de relógio + arco com gradiente de fogo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, type: "spring", stiffness: 200, damping: 18 }}
              className="shrink-0 flex flex-col items-center gap-1.5">
              <div className="relative w-[88px] h-[88px] md:w-28 md:h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FF9A00" />
                      <stop offset="60%" stopColor="#4CCCED" />
                      <stop offset="100%" stopColor="#FF3D00" />
                    </linearGradient>
                  </defs>
                  {Array.from({ length: 48 }, (_, i) => (
                    <line key={i} x1="48" y1="2.5" x2="48" y2="6.5"
                      stroke={`rgba(255,255,255,${i % 4 === 0 ? 0.28 : 0.10})`} strokeWidth="1.5"
                      transform={`rotate(${i * 7.5} 48 48)`} />
                  ))}
                  <circle cx="48" cy="48" r={ringR} stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
                  <motion.circle
                    cx="48" cy="48" r={ringR}
                    stroke="url(#scoreGrad)"
                    strokeWidth="5" fill="none" strokeLinecap="round"
                    strokeDasharray={ringC}
                    initial={{ strokeDashoffset: ringC }}
                    animate={{ strokeDashoffset: ringC - (score / 100) * ringC }}
                    transition={{ duration: 1.8, ease: "easeOut", delay: 0.7 }}
                    style={{ filter: "drop-shadow(0 0 6px rgba(76,204,237,0.8))" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl md:text-2xl font-black text-white leading-none tabular-nums"><CountUp value={score} /></span>
                  <span className="text-[7px] md:text-[8px] text-accent font-black uppercase tracking-widest mt-0.5">% acertos</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats strip — contadores animados em vidro */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Acertos", value: examStats?.averageScore || 0, suffix: "%",    icon: BrainCircuit },
              { label: "Redação", value: essayStats?.average || 0,     suffix: " pts", icon: FilePenLine  },
              { label: "Trilhas", value: recentProgress.length,        suffix: "",     icon: PlayCircle   },
            ].map((stat, i) => (
              <motion.div key={stat.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + i * 0.08 }}
                className="gradient-border flex items-center gap-2 md:gap-3 bg-white/[0.05] backdrop-blur-md border border-white/10 rounded-2xl px-2 py-2.5 md:px-3 md:py-3">
                <div className="h-7 w-7 md:h-8 md:w-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                  <stat.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white text-sm md:text-lg leading-none tabular-nums whitespace-nowrap"><CountUp value={stat.value} suffix={stat.suffix} /></p>
                  <p className="text-[7px] md:text-[8px] text-white/50 font-black uppercase tracking-normal md:tracking-[0.25em] mt-1 leading-tight whitespace-nowrap">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Letreiro editorial — fita infinita no rodapé do hero */}
        <div
          className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden py-2.5"
          style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}>
          <div className="flex w-max animate-marquee">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
                {MARQUEE_WORDS.map((w, i) => (
                  <span key={`${dup}-${w}`} className="flex items-center">
                    <span className={`text-[10px] font-black uppercase tracking-[0.35em] whitespace-nowrap ${i % 2 === 0 ? 'text-white/40' : 'text-outline-fire'}`}>{w}</span>
                    <span className="mx-4 text-accent/70 text-[8px]">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════
           QUICK ACTIONS — 3D tilt cards
          ══════════════════════════════════ */}
      <motion.div variants={itemVariants} className="flex gap-3 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-hide">
        {quickActions.map((action, i) => (
          <TiltCard key={action.label} className="shrink-0">
            <Link href={action.href}>
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className={`btn-shimmer flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${action.color} rounded-2xl w-[84px] h-[84px] shadow-lg hover:shadow-xl transition-all [touch-action:manipulation]`}
                style={{ transformStyle: "preserve-3d" }}>
                <div style={{ transform: "translateZ(8px)" }}>
                  <action.icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-white uppercase text-[9px] tracking-wide text-center leading-tight px-1"
                   style={{ transform: "translateZ(4px)" }}>
                  {action.label}
                </p>
              </motion.div>
            </Link>
          </TiltCard>
        ))}
      </motion.div>

      {/* ── CARD DO SIMULADO DOS PROFESSORES (PEGANDO FOGO) ── */}
      {simuladoEspecial && (
        <motion.div variants={itemVariants}>
          {simuladoEspecial.hasAttempt ? (
            // Card de resultado concluído com TRI
            <div className="w-full relative card-on-fire rounded-card overflow-hidden p-6 text-white group shadow-2xl">
              <div className="absolute inset-0 pointer-events-none z-0" style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(255,90,0,0.2) 0%, transparent 60%)" }} />
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#4CCCED]/10 border border-[#4CCCED]/35 flex items-center justify-center shrink-0 shadow-lg">
                    <Flame className="h-6 w-6 text-orange-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase tracking-[0.25em] text-orange-400">Simulado Especial Concluído</span>
                      <Badge className="bg-[#4CCCED]/25 text-orange-400 border border-[#4CCCED]/30 text-[7px] font-black px-1 rounded">TRI ATIVA</Badge>
                    </div>
                    <h3 className="font-black italic text-lg leading-tight text-white mt-0.5">{simuladoEspecial.title}</h3>
                    <p className="text-[10px] text-white/60 mt-1">Sua nota oficial estimada pela Teoria de Resposta ao Item.</p>
                  </div>
                </div>
                <div className="text-center sm:text-right shrink-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Média TRI Estimada</p>
                  <p className="text-3xl font-black italic text-orange-400 text-glow-orange leading-none mt-1">
                    {simuladoEspecial.triScore ?? 0}
                    <span className="text-xs text-white/50 font-bold not-italic ml-1">pts</span>
                  </p>
                  <p className="text-[9px] font-bold text-white/40 mt-1">({simuladoEspecial.score}/45 acertos)</p>
                </div>
              </div>
            </div>
          ) : (
            // Card para iniciar o simulado
            <Link href={`/dashboard/student/provas/${simuladoEspecial.id}`} className="block">
              <div className="w-full text-left relative card-on-fire rounded-card overflow-hidden p-6 group cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-transform [touch-action:manipulation] shadow-2xl">
                {/* Canvas de partículas de fogo */}
                <FlameEmberCanvas className="absolute inset-0 h-full w-full pointer-events-none z-0 opacity-70" />
                <div className="absolute inset-0 pointer-events-none z-10" style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(255,90,0,0.15) 0%, transparent 60%)" }} />
                
                <div className="relative z-20 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-[#4CCCED]/10 border border-[#4CCCED]/30 flex items-center justify-center shrink-0 shadow-lg animate-float">
                      <Flame className="h-7 w-7 text-orange-500 fill-orange-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-orange-400">Simulado Especial dos Professores</span>
                        <Badge className="bg-red-500 text-white border-none text-[8px] font-black tracking-widest px-2 animate-pulse">INÉDITO</Badge>
                      </div>
                      <h3 className="font-black italic text-xl leading-tight text-white mt-1 group-hover:text-orange-400 transition-colors">
                        {simuladoEspecial.title}
                      </h3>
                      <p className="text-xs font-semibold text-white/70 mt-1.5 leading-relaxed max-w-md">
                        {simuladoEspecial.description || "Elaborado exclusivamente pela equipe de professores. Teste seu desempenho com a nota TRI real do ENEM!"}
                      </p>
                    </div>
                  </div>
                  <Button className="w-full sm:w-auto h-12 px-6 rounded-xl bg-[#4CCCED] hover:bg-orange-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2 border-none shrink-0">
                    <span>Iniciar Simulado</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Link>
          )}
        </motion.div>
      )}

      {/* ══════════════════════════════════
           GABARITO COMENTADO — card fixo na home
           (toque abre o gabarito comentado do simulado)
          ══════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <button
          onClick={() => { setExpandedQ(null); setOnlyErrors(false); setGabaritoOpen(true); }}
          className="w-full text-left relative bg-[#0d0d0f] rounded-card overflow-hidden p-5 group cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-transform [touch-action:manipulation]"
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(76,204,237,0.3) 0%, transparent 60%)" }} />
          <div className="relative z-10 flex items-center gap-4">
            <div className="relative shrink-0">
              {simuladoOficial ? (
                <>
                  {(() => {
                    const pct = Math.round((simuladoOficial.score / simuladoOficial.total) * 100);
                    const r = 24, circ = 2 * Math.PI * r;
                    const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <svg width="60" height="60" className="-rotate-90">
                        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                          strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} />
                      </svg>
                    );
                  })()}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white leading-none italic">
                      {Math.round((simuladoOficial.score / simuladoOficial.total) * 100)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-[60px] w-[60px] rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <ListChecks className="h-7 w-7 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40 mb-0.5">Gabarito Comentado</p>
              <p className="font-black italic text-white leading-tight truncate">{simuladoOficial?.title || SIMULADO_GABARITO_TITULO}</p>
              {simuladoOficial ? (
                <p className="text-xl font-black text-primary leading-none mt-1 italic">
                  {simuladoOficial.score}<span className="text-sm text-white/40 font-bold">/{simuladoOficial.total} acertos</span>
                </p>
              ) : (
                <p className="text-[11px] font-bold text-white/50 mt-1 italic">Toque para ver as respostas comentadas</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-primary transition-colors shrink-0" />
          </div>
        </button>
      </motion.div>

      {/* ══════════════════════════════════════════
           PLATFORM FEATURES — bento 3D cards
          ══════════════════════════════════════════ */}
      <motion.section variants={itemVariants}>
        <SectionHeader index="01 · Plataforma" title="Tudo em Um Só Lugar" icon={Sparkles} iconClass="bg-primary/10 text-primary" />

        <div className="grid grid-cols-2 gap-3">
          {platformFeatures.map((feat, i) => (
            <motion.div key={feat.label} className={feat.wide ? "col-span-2" : "col-span-1"}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <TiltCard>
                <Link href={feat.href}>
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${feat.gradient} p-4 md:p-5 shadow-xl ${feat.glow} shadow-lg flex items-center gap-4 [touch-action:manipulation]`}
                       style={{ transformStyle: "preserve-3d" }}>
                    {/* Orb glow bg */}
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                    <motion.div
                      className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0"
                      animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      style={{ transform: "translateZ(12px)" }}>
                      <feat.icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                    </motion.div>
                    <div className="relative z-10 flex-1 min-w-0" style={{ transform: "translateZ(6px)" }}>
                      <p className="font-black text-white text-sm md:text-base italic leading-tight break-words">{feat.label}</p>
                      <p className="text-white/60 text-[10px] md:text-xs font-semibold mt-0.5 break-words">{feat.desc}</p>
                    </div>
                    {feat.wide && (
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                        <ArrowRight className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </Link>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ══════════════════════════════════════
           AURORA AI — full-width CTA banner
          ══════════════════════════════════════ */}
      <motion.div variants={itemVariants}
        className="gradient-border relative overflow-hidden rounded-card border border-accent/20 bg-gradient-to-r from-blue-50 via-indigo-50/20 to-white p-5 md:p-8 shadow-2xl group">
        <div className="absolute inset-0 dot-grid-dark opacity-40 pointer-events-none rounded-card" />
        <motion.div
          className="absolute right-[-40px] top-[-40px] w-64 h-64 bg-accent/5 rounded-full blur-[80px] pointer-events-none"
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-0">
            <motion.div className="relative h-12 w-12 md:h-16 md:w-16 shrink-0"
              whileHover={{ scale: 1.1, rotateY: 15 }} style={{ transformStyle: "preserve-3d" }}>
              <div className="h-full w-full rounded-2xl bg-white shadow-xl flex items-center justify-center border border-accent/10">
                <Bot className="h-6 w-6 md:h-8 md:w-8 text-accent animate-pulse-subtle" />
              </div>
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            </motion.div>
            <div className="flex items-center gap-2 sm:hidden">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Aurora IA</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Aurora IA · Mentoria Estratégica</span>
            </div>
            <p className="text-slate-700 font-semibold italic text-sm md:text-base leading-relaxed tracking-tight">
              "A constância é a chave da aprovação! Revise os erros do último simulado antes de avançar. Estou disponível 24h para corrigir redações."
            </p>
          </div>
          <Button asChild className="bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 border-none hover:scale-105 transition-all w-full sm:w-auto shrink-0 h-12 md:h-14 px-6 md:px-8 text-xs md:text-sm uppercase tracking-widest italic active:scale-95">
            <Link href="/dashboard/support" className="flex items-center justify-center gap-2">
              Falar com Aurora <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* ── SUGESTÃO DE ESTUDO ── */}
      {user && <StudySuggestionWidget userId={user.id} />}

      {/* ── RESUMO SEMANAL POR IA ── */}
      {user && <WeeklySummaryWidget userId={user.id} />}

      {/* ── WIDGETS MÓVEL RÁPIDOS ── */}
      <motion.div variants={itemVariants} className="lg:hidden grid grid-cols-2 gap-4">
        <div className="gradient-border bg-white rounded-card shadow-xl border border-muted/20 p-4 space-y-3 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-violet-100 flex items-center justify-center">
              <BrainCircuit className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="font-black text-xs text-primary italic">Acertos</span>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-primary">{examStats?.averageScore || 0}<span className="text-lg text-muted-foreground">%</span></p>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">{examStats?.totalAssessed || 0} avaliações</p>
          </div>
        </div>
        <div className="bg-white rounded-card shadow-xl border border-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-green-100 flex items-center justify-center">
              <FilePenLine className="h-3.5 w-3.5 text-green-600" />
            </div>
            <span className="font-black text-xs text-primary italic">Redações</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-xl p-2.5 text-center">
              <span className="text-2xl font-black text-primary">{essayStats?.count || 0}</span>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Envios</p>
            </div>
            <div className="bg-accent/5 rounded-xl p-2.5 text-center">
              <span className="text-2xl font-black text-accent">{essayStats?.average || 0}</span>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Média</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── MAIN CONTENT GRID ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — 2/3 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Trilhas em Progresso */}
          <div>
            <SectionHeader index="02 · Trilhas" title="Por Onde Começar" icon={TrendingUp} iconClass="bg-primary/10 text-primary">
              {recentProgress.length > 0 && (
                <Link href="/dashboard/trails" className="text-[10px] font-black uppercase tracking-widest text-accent hover:text-primary transition-colors flex items-center gap-1 shrink-0 pb-1">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </SectionHeader>

            {loadingData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array(2).fill(0).map((_, i) => <div key={i} className="h-52 bg-muted/20 animate-pulse rounded-3xl" />)}
              </div>
            ) : recentProgress.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-muted/20 rounded-3xl bg-muted/5 flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <PlayCircle className="h-6 w-6 text-primary/30" />
                </div>
                <div>
                  <p className="font-black italic text-primary/60 text-sm">Nenhuma trilha iniciada</p>
                  <p className="text-xs text-muted-foreground mt-1">Explore o catálogo e comece sua jornada.</p>
                </div>
                <Button asChild size="sm" className="mt-1 bg-primary text-white border-none rounded-xl font-black h-9 px-5 text-xs">
                  <Link href="/dashboard/trails">Explorar Trilhas</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentProgress.map((prog, i) => {
                  const trailData = prog.trail;
                  return (
                    <motion.div key={prog.id}
                      whileHover={{ y: -4, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                      <Link href={`/dashboard/classroom/${prog.trail_id}`}>
                        <div className="group overflow-hidden rounded-3xl shadow-xl bg-white hover:shadow-2xl transition-all duration-500 border border-muted/10">
                          <div className="relative aspect-[16/7] overflow-hidden bg-slate-100">
                            <Image src={getSafeImageUrl(trailData?.image_url, i)} alt={trailData?.title || "Trilha"} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            <div className="absolute top-3 left-3">
                              <Badge className="bg-primary/90 text-white border-none text-[9px] font-black uppercase px-2.5 h-5 backdrop-blur-sm">
                                {trailData?.category || 'Curso'}
                              </Badge>
                            </div>
                            <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                              <PlayCircle className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div className="p-4 space-y-2.5">
                            <h3 className="font-black text-sm text-primary italic truncate leading-tight">{trailData?.title || 'Trilha'}</h3>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Progresso</span>
                                <span className="text-[9px] font-black text-primary">{prog.percentage || 0}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                                  initial={{ width: 0 }} animate={{ width: `${prog.percentage || 0}%` }}
                                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 + i * 0.1 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Anúncios */}
          {(!loadingData && announcements.length === 0) ? null : (
            <div>
              <SectionHeader index="03 · Mural" title="Comunicados" icon={Megaphone} iconClass="bg-amber-100 text-amber-600" />
              <div className="space-y-3">
                {loadingData ? Array(2).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-2xl" />) : (
                  announcements.map((ann: any) => {
                    const styles = priorityStyles[ann.priority as keyof typeof priorityStyles] || priorityStyles.low;
                    const Icon = styles.icon;
                    return (
                      <motion.div key={ann.id} whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400 }}
                        className={`p-4 rounded-2xl flex items-start gap-4 ${styles.bgColor} border ${styles.border} shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer`}>
                        {ann.priority === 'high' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />}
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-white shadow-sm border border-gray-100">
                          <Icon className={`h-5 w-5 ${styles.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${styles.border} ${styles.color}`}>{styles.label}</span>
                            <span className="text-[10px] font-bold text-slate-400">Público Geral</span>
                          </div>
                          <p className="font-black text-sm text-slate-900 truncate">{fixEncoding(ann.title)}</p>
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-medium mt-0.5 pr-1">{fixEncoding(ann.message)}</p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — 1/3 (desktop only widgets) */}
        <div className="space-y-5">
          {/* Taxa de Acertos */}
          <div className="hidden lg:block gradient-border bg-white rounded-card shadow-xl border border-muted/20 p-5 md:p-6 space-y-4 relative overflow-hidden group hover:glow-orange transition-shadow duration-300">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center shadow-inner">
                  <BrainCircuit className="h-4 w-4 text-violet-600" />
                </div>
                <h3 className="font-black text-sm text-primary italic">Taxa de Acertos</h3>
              </div>
              <Badge className="bg-violet-50 text-violet-600 border-none px-2 shadow-sm font-black">{score}%</Badge>
            </div>
            <div className="h-[120px] w-full" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
              {loadingData ? <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" /> : <DashboardChart data={examStats?.history || []} />}
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2 relative z-10">
              Evolução: {examStats?.totalAssessed || 0} Avaliações
            </p>
            <Button asChild className="w-full h-11 bg-primary text-white font-black rounded-2xl border-none shadow-lg text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform">
              <Link href="/dashboard/student/simulados">Banco de Questões</Link>
            </Button>
          </div>

          {/* Lab. Redação */}
          <div className="hidden lg:block bg-white rounded-3xl shadow-xl border border-muted/20 p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center">
                <FilePenLine className="h-4 w-4 text-green-600" />
              </div>
              <h3 className="font-black text-sm text-primary italic">Lab. de Redação</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 text-center border border-slate-100">
                <span className="text-3xl font-black text-primary">{essayStats?.count || 0}</span>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Enviadas</p>
              </div>
              <div className="bg-gradient-to-br from-accent/5 to-primary/5 rounded-2xl p-4 text-center border border-accent/10">
                <span className="text-3xl font-black text-accent">{essayStats?.average || 0}</span>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Média pts</p>
              </div>
            </div>
            {essayStats?.latest ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-50 to-white border border-muted/20 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-primary truncate italic">{essayStats.latest.theme}</p>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mt-0.5">
                    {essayStats.latest.status === 'reviewed' ? '✅ Corrigida' : '⏳ Aguardando'}
                  </p>
                </div>
                {essayStats.latest.score && (
                  <div className="shrink-0 bg-white shadow border border-muted/20 px-2.5 py-1.5 rounded-xl">
                    <span className="font-black text-primary text-sm">{essayStats.latest.score}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center border-2 border-dashed rounded-2xl bg-slate-50 opacity-50">
                <p className="text-xs font-medium italic text-slate-400">Comece a escrever hoje!</p>
              </div>
            )}
            <Button asChild className="w-full h-11 bg-primary text-white font-black rounded-2xl border-none shadow-lg text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform">
              <Link href="/dashboard/student/essays">Acessar Laboratório</Link>
            </Button>
          </div>

          {/* Biblioteca */}
          <div className="bg-white rounded-3xl shadow-xl border border-muted/20 p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Library className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="font-black text-sm text-primary italic">Biblioteca</h3>
              </div>
              <Link href="/dashboard/library" className="text-[9px] font-black uppercase tracking-widest text-accent hover:text-primary transition-colors">Ver tudo</Link>
            </div>
            <div className="space-y-2.5">
              {loadingData ? Array(3).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted/20 animate-pulse rounded-2xl" />) : libraryResources.length === 0 ? (
                <div className="py-8 text-center opacity-30 italic text-xs">Materiais em sincronização...</div>
              ) : (
                libraryResources.map((res) => (
                  <Link key={res.id} href="/dashboard/library">
                    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 hover:shadow-md transition-all group cursor-pointer border border-transparent hover:border-muted/20">
                      <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/10 transition-colors">
                        {res.type === 'Video' ? <Video className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-primary truncate italic">{res.title}</h4>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {user && <WeeklyMissionsWidget userId={user.id} examTarget={profile?.exam_target} />}
          {user && <WeeklyRankingWidget userId={user.id} examTarget={profile?.exam_target} />}
          {user && profile && <DailyQuestionCard userId={user.id} profile={profile} />}
          {user && <BichinhoWidget />}
          {user && <GoalsWidget userId={user.id} />}
          {user && <JournalWidget userId={user.id} />}
          {user && <GamificationWidget userId={user.id} />}
          <UpcomingEventsWidget />
        </div>
      </motion.div>

      {/* FOOTER */}
      <footer className="mt-12 py-8 border-t border-slate-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
            <div className="relative h-10 w-10 shrink-0 bg-white rounded-xl shadow-md p-1.5 border border-slate-100 overflow-hidden">
              <Image src={logoUrl} alt="Logo" fill className="object-contain" sizes="40px" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Plataforma Educacional</p>
            </div>
          </div>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">{new Date().getFullYear()}</p>
        </div>
      </footer>

      {/* ── DIALOG CHECK-IN ── */}
      <Dialog open={attendanceDialogOpen} onOpenChange={(v) => { if (!v) { setAttendanceDialogOpen(false); setConfirmoInput(""); } }}>
        <DialogContent className="sm:max-w-lg rounded-card border-none shadow-2xl p-0 overflow-hidden">
          {attendanceStep === "code" ? (
            <>
              <DialogHeader className="p-8 pb-4 bg-violet-50 border-b-2 border-violet-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-14 w-14 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                    <KeyRound className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black text-violet-700 leading-none italic uppercase tracking-tighter">Check-in da Aula</DialogTitle>
                    <DialogDescription className="text-xs mt-1 font-bold text-violet-500">Confirme sua presença inserindo o token da lousa</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="p-8 space-y-6">
                <p className="font-semibold text-sm text-slate-600">
                  Digite o token exibido pelo professor para a aula <strong className="text-violet-700">{activeSession?.title}</strong>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="checkin-code" className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Token da aula</Label>
                  <Input id="checkin-code" className="h-14 text-center text-2xl font-black tracking-[0.4em] uppercase font-mono rounded-2xl border-2 border-violet-200 focus:border-violet-500 bg-white"
                    maxLength={6} placeholder="A7X9" value={checkinCode}
                    onChange={(e) => setCheckinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && checkinCode.length >= 4 && setAttendanceStep("fraud")} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)} className="flex-1 h-12 rounded-2xl font-black text-xs border-slate-200">Cancelar</Button>
                  <Button onClick={() => setAttendanceStep("fraud")} disabled={checkinCode.length < 4}
                    className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl shadow-lg shadow-violet-200 border-none text-xs disabled:opacity-40">Prosseguir</Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="p-8 pb-4 bg-red-50 border-b-2 border-red-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-14 w-14 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-300">
                    <ShieldAlert className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black text-red-700 leading-none italic uppercase tracking-tighter">Aviso de Fraude</DialogTitle>
                    <DialogDescription className="text-xs mt-1 font-bold text-red-600">Leia com atenção antes de confirmar</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="p-8 space-y-5">
                <div className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-red-700 font-bold text-sm">Você está prestes a registrar <strong>presença em aula presencial</strong>. O token só pode ser digitado por <strong>você, dentro da sala</strong>.</p>
                </div>
                <ul className="space-y-2 text-slate-700 font-medium text-[13px]">
                  <li className="flex gap-2"><span className="text-red-600 font-black">·</span> Compartilhar o token com colegas caracteriza <strong>fraude documental</strong>.</li>
                  <li className="flex gap-2"><span className="text-red-600 font-black">·</span> Alunos detectados em fraude perdem a vaga <strong>imediatamente</strong>.</li>
                  <li className="flex gap-2"><span className="text-red-600 font-black">·</span> A lista de papel é cruzada com os check-ins do app pela secretaria.</li>
                </ul>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="confirmo" className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                    Para prosseguir, digite a palavra <span className="text-red-600 font-black">CONFIRMO</span>
                  </Label>
                  <Input id="confirmo" placeholder="CONFIRMO" value={confirmoInput} onChange={(e) => setConfirmoInput(e.target.value.toUpperCase())}
                    className="h-14 text-center text-xl font-black tracking-[0.3em] rounded-2xl border-2 border-red-200 focus:border-red-500 bg-white" autoComplete="off" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setAttendanceStep("code")} className="flex-1 h-12 rounded-2xl font-black text-xs border-slate-200">Voltar</Button>
                  <Button onClick={handleConfirmedCheckin} disabled={checkingIn || confirmoInput.trim().toUpperCase() !== "CONFIRMO"}
                    className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-200 border-none text-xs disabled:opacity-40">
                    {checkingIn ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Registrar Presença ({checkinCode})
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG GABARITO COMENTADO ── */}
      <Dialog open={gabaritoOpen} onOpenChange={setGabaritoOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] rounded-card border-none shadow-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-[#0d0d0f] relative shrink-0 text-left">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 90% 0%, rgba(76,204,237,0.25) 0%, transparent 60%)" }} />
            <div className="relative z-10 flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <ClipboardCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-black italic text-white leading-tight tracking-tighter truncate">
                  {SIMULADO_GABARITO_TITULO}
                </DialogTitle>
                <DialogDescription className="text-[11px] font-bold text-white/50 mt-0.5">
                  Gabarito comentado · {SIMULADO_GABARITO_TOTAL} questões
                </DialogDescription>
              </div>
            </div>
            {hasStudentAnswers && (
              <div className="relative z-10 flex items-center gap-2 mt-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 rounded-full px-3 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-[11px] font-black text-green-400 tabular-nums">{gabAcertos} acertos</span>
                </div>
                <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 rounded-full px-3 py-1">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-[11px] font-black text-red-400 tabular-nums">{gabErros} erros</span>
                </div>
                <button
                  onClick={() => setOnlyErrors((v) => !v)}
                  className={`ml-auto text-[10px] font-black uppercase tracking-wider rounded-full px-3 py-1.5 transition-colors [touch-action:manipulation] ${onlyErrors ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:bg-white/15'}`}
                >
                  {onlyErrors ? 'Mostrar tudo' : 'Só meus erros'}
                </button>
              </div>
            )}
          </DialogHeader>

          <div className="overflow-y-auto px-4 py-4 space-y-5 bg-slate-50">
            {Object.keys(gabaritoPorArea).length === 0 ? (
              <div className="py-14 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="font-black italic text-slate-700">Nenhum erro! Mandou bem 🎉</p>
              </div>
            ) : (
              Object.entries(gabaritoPorArea).map(([area, questoes]) => (
                <div key={area}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-2 mb-2">{area}</h3>
                  <div className="space-y-2">
                    {questoes.map((q) => {
                      const sel = studentAnswerByQ[q.numero];
                      const acertou = sel ? sel === q.resposta.toUpperCase() : null;
                      const isOpen = expandedQ === q.numero;
                      return (
                        <div key={q.numero} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                          <button
                            onClick={() => setExpandedQ(isOpen ? null : q.numero)}
                            className="w-full flex items-center gap-3 p-3.5 text-left [touch-action:manipulation] active:bg-slate-50"
                          >
                            <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-black text-slate-700 tabular-nums">{q.numero}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1 truncate">{q.topico}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                                  Gabarito {q.resposta}
                                </span>
                                {sel && (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 ${acertou ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                                    {acertou ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    Você {sel}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="px-3.5 pb-4 pt-0">
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1.5">Comentário</p>
                                <p className="text-[13px] text-slate-700 leading-relaxed font-medium whitespace-pre-line">{q.comentario}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
    </MotionConfig>
  );
}
