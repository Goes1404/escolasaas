"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  BrainCircuit,
  Target,
  Clock,
  Zap,
  Award,
  Mail,
  Building2,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Calendar,
  FileText,
  Loader2,
  Star,
  BarChart3,
  User,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { format, subDays } from "date-fns";
import { RadarChartPremium, AreaChartPremium } from "@/components/charts/premium";
import { fmtDate, fmtNumber, fmtPct, pct, toNumber, txt } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  if (!seconds) return "0min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

// Duração de uma tentativa de prova. Retorna null quando não há registro
// (tentativas antigas, antes de passarmos a cronometrar).
function formatAttemptDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

function formatLastAccess(ts: string | null) {
  if (!ts) return "Nunca";
  return fmtDate(ts, "dd/MM/yyyy 'às' HH:mm");
}

const SUBJECT_COLORS: Record<string, string> = {
  "Matemática": "bg-blue-500",
  "Linguagens": "bg-purple-500",
  "Ciências da Natureza": "bg-emerald-500",
  "Ciências Humanas": "bg-amber-500",
  "Redação": "bg-rose-500",
};

function subjectColor(name: string) {
  return SUBJECT_COLORS[name] ?? "bg-slate-400";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminStudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [examAttempts, setExamAttempts] = useState<any[]>([]);
  const [essays, setEssays] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, semester: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo PDF.", variant: "destructive" });
      return;
    }

    const setUploading = semester === 1 ? setUploading1 : setUploading2;
    setUploading(true);

    const path = `${studentId}/boletim_${semester}sem.pdf`;

    try {
      const { data, error: uploadError } = await supabase.storage
        .from("report-cards")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("report-cards")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      const fieldUrl = semester === 1 ? "report_card_pdf_url_1sem" : "report_card_pdf_url_2sem";
      const fieldPath = semester === 1 ? "report_card_pdf_path_1sem" : "report_card_pdf_path_2sem";

      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          [fieldUrl]: publicUrl,
          [fieldPath]: path
        })
        .eq("id", studentId);

      if (dbError) throw dbError;

      setStudent((s: any) => ({
        ...s,
        [fieldUrl]: publicUrl,
        [fieldPath]: path
      }));

      toast({ title: "Boletim enviado" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Não foi possível enviar o boletim", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handlePdfDelete = async (semester: 1 | 2) => {
    if (!confirm("Tem certeza que deseja remover este boletim em PDF?")) return;

    const fieldUrl = semester === 1 ? "report_card_pdf_url_1sem" : "report_card_pdf_url_2sem";
    const fieldPath = semester === 1 ? "report_card_pdf_path_1sem" : "report_card_pdf_path_2sem";
    const path = student[fieldPath];

    try {
      if (path) {
        await supabase.storage.from("report-cards").remove([path]);
      }

      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          [fieldUrl]: null,
          [fieldPath]: null
        })
        .eq("id", studentId);

      if (dbError) throw dbError;

      setStudent((s: any) => ({
        ...s,
        [fieldUrl]: null,
        [fieldPath]: null
      }));

      toast({ title: "Boletim removido" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Não foi possível remover o boletim", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!studentId) return;

    async function load() {
      setLoading(true);
      try {
        const [profileRes, answersRes, examsRes, essaysRes, badgesRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", studentId).single(),
          supabase
            .from("student_question_answers")
            .select("*, questions(subject_id, subjects(name))")
            .eq("student_id", studentId),
          supabase
            .from("exam_attempts")
            .select("*, exams(title, year, exam_type)")
            .eq("user_id", studentId)
            .order("completed_at", { ascending: false })
            .limit(10),
          supabase
            .from("essay_submissions")
            .select("id, theme, score, status, created_at")
            .eq("user_id", studentId)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase.from("user_badges").select("*").eq("user_id", studentId),
        ]);

        if (profileRes.data) setStudent(profileRes.data);
        if (answersRes.data) setAnswers(answersRes.data);
        if (examsRes.data) setExamAttempts(examsRes.data);
        if (essaysRes.data) setEssays(essaysRes.data);
        if (badgesRes.data) setBadges(badgesRes.data);
      } catch (e) {
        console.error("Erro ao carregar perfil:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId]);

  // ── Computed metrics ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = answers.length;
    const correct = answers.filter((a) => a.is_correct).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, incorrect: total - correct, accuracy };
  }, [answers]);

  const subjectData = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {};
    answers.forEach((a) => {
      const name = a.questions?.subjects?.name ?? "Geral";
      if (!map[name]) map[name] = { total: 0, correct: 0 };
      map[name].total++;
      if (a.is_correct) map[name].correct++;
    });
    return Object.entries(map)
      .map(([subject, d]) => ({
        subject,
        total: d.total,
        correct: d.correct,
        score: Math.round((d.correct / d.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }, [answers]);

  const radarData = useMemo(
    () => subjectData.map((s) => ({ subject: s.subject, score: s.score, fullMark: 100 })),
    [subjectData]
  );

  const historyData = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => {
      const dateStr = format(subDays(new Date(), 14 - i), "yyyy-MM-dd");
      const day = answers.filter(
        (a) => fmtDate(a.created_at ?? a.answered_at, "yyyy-MM-dd") === dateStr
      );
      return {
        date: fmtDate(dateStr, "dd/MM"),
        acertos: day.filter((a) => a.is_correct).length,
        total: day.length,
      };
    });
  }, [answers]);

  const examAvgScore = useMemo(() => {
    if (!examAttempts.length) return null;
    const avg = examAttempts.reduce((s, e) => s + (e.score ?? 0), 0) / examAttempts.length;
    return Math.round(avg);
  }, [examAttempts]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="u-label">Carregando perfil…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-xl mx-auto py-10 px-1">
        <EmptyState
          icon={User}
          title="Aluno não encontrado"
          description="Este aluno pode ter sido removido, ou o link está incorreto."
          action={{ label: "Voltar para a lista", href: "/dashboard/admin/students", icon: ArrowLeft }}
        />
      </div>
    );
  }

  const semesterCard = (semester: 1 | 2) => {
    const url = semester === 1 ? student.report_card_pdf_url_1sem : student.report_card_pdf_url_2sem;
    const uploading = semester === 1 ? uploading1 : uploading2;
    return (
      <div className="border rounded-card p-4 sm:p-5 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <span className="u-label">{semester}º semestre</span>
          {url && (
            <Badge className="bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase border-none">Disponível</Badge>
          )}
        </div>

        {url ? (
          <div className="flex flex-col gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Ver boletim em PDF
            </a>
            <Button
              variant="outline"
              onClick={() => handlePdfDelete(semester)}
              className="h-9 w-full rounded-control text-red-600 border-red-200 hover:bg-red-50 font-bold text-xs"
            >
              Remover boletim
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-control h-24 cursor-pointer hover:border-primary/50 transition-colors">
            {uploading ? (
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            ) : (
              <>
                <FileText className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-xs font-bold text-muted-foreground">Enviar PDF</span>
              </>
            )}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handlePdfUpload(e, semester)}
            />
          </label>
        )}
      </div>
    );
  };

  const sectionTitle = "text-base font-bold text-foreground";

  return (
    <div className="space-y-6 pb-24 px-1">

      {/* ── Voltar ── */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="h-10 rounded-control font-bold text-muted-foreground hover:text-foreground gap-2 -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para a lista
      </Button>

      {/* ── Cabeçalho do aluno ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
        <div className="h-16 w-16 md:h-20 md:w-20 rounded-card bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-3xl font-bold text-primary">
            {txt(student.name, "?").charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <p className="u-label">Coordenação · desempenho do aluno</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="u-page-title text-2xl md:text-3xl break-words">{txt(student.name, "Aluno sem nome")}</h1>
            <Badge variant="outline" className="font-bold text-[10px] uppercase px-3 py-1">
              {txt(student.exam_target, "ENEM")}
            </Badge>
            {student.status === "suspended" && (
              <Badge className="bg-red-100 text-red-700 font-bold text-[10px] uppercase border-none">
                Suspenso
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {student.email && (
              <span className="flex items-center gap-2 text-muted-foreground text-sm min-w-0 break-all">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {student.email}
              </span>
            )}
            {student.institution && (
              <span className="flex items-center gap-2 text-muted-foreground text-sm">
                <Building2 className="h-3.5 w-3.5 shrink-0" /> {student.institution}
              </span>
            )}
            {student.course && (
              <span className="flex items-center gap-2 text-muted-foreground text-sm">
                <GraduationCap className="h-3.5 w-3.5 shrink-0" /> {student.course}
              </span>
            )}
          </div>

          <p className="u-label !text-[10px]">
            Último acesso: {formatLastAccess(student.last_access)}
          </p>
        </div>

        {/* XP */}
        <Card className="rounded-card px-6 py-4 text-center shrink-0 self-start md:self-auto">
          <div className="u-label flex items-center justify-center gap-1.5"><Zap className="h-3.5 w-3.5" /> XP total</div>
          <p className="u-num text-3xl tabular-nums mt-1">{fmtNumber(student.xp_points, 0, "0")}</p>
        </Card>
      </div>

      {/* ── Métricas rápidas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Questões respondidas", value: fmtNumber(stats.total, 0, "0"), icon: BrainCircuit, color: "" },
          {
            label: "Taxa de acerto",
            value: fmtPct(stats.accuracy, "0%"),
            icon: Target,
            color: stats.total === 0 ? "" : stats.accuracy >= 60 ? "text-emerald-600" : stats.accuracy >= 40 ? "text-amber-600" : "text-red-600",
          },
          { label: "Tempo de estudo", value: formatTime(toNumber(student.total_time_spent) ?? 0), icon: Clock, color: "" },
          { label: "Medalhas", value: fmtNumber(badges.length, 0, "0"), icon: Award, color: "" },
        ].map((m, i) => (
          <Card key={i} className="rounded-card">
            <CardContent className="p-4 md:p-6">
              <div className="u-label flex items-center gap-2"><m.icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{m.label}</span></div>
              <p className={`u-num text-2xl md:text-3xl leading-none tabular-nums mt-3 ${m.color}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Boletins em PDF ── */}
      <Card className="rounded-card overflow-hidden">
        <CardHeader className="p-5 md:p-6 pb-4 border-b">
          <CardTitle className={sectionTitle}>Boletins oficiais em PDF</CardTitle>
          <CardDescription className="text-sm">
            Envie os boletins em PDF para o aluno poder baixar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {semesterCard(1)}
          {semesterCard(2)}
        </CardContent>
      </Card>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

        {/* Radar */}
        <Card className="lg:col-span-6 rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-0">
            <CardTitle className={sectionTitle}>Desempenho por área</CardTitle>
            <CardDescription className="text-sm">Acerto por área do conhecimento.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-4 h-[260px] md:h-[350px]">
            {radarData.length > 0 ? (
              <RadarChartPremium data={radarData} angleKey="subject" yKey="score" color="#4ccced" unit="%" />
            ) : (
              <EmptyState
                compact
                className="h-full justify-center"
                icon={Target}
                title="Nenhuma resposta registrada ainda"
                description="Quando o aluno responder questões, o desempenho por área aparece aqui."
              />
            )}
          </CardContent>
        </Card>

        {/* Atividade diária */}
        <Card className="lg:col-span-6 rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-0">
            <CardTitle className={sectionTitle}>Atividade diária</CardTitle>
            <CardDescription className="text-sm">Questões acertadas nos últimos 15 dias.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-4 h-[260px] md:h-[350px]">
            <AreaChartPremium data={historyData} xKey="date" yKey="acertos" color="#4ccced" />
          </CardContent>
        </Card>
      </div>

      {/* ── Breakdown por matéria ── */}
      {subjectData.length > 0 && (
        <Card className="rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-4 border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className={sectionTitle}>Detalhamento por matéria</CardTitle>
                <CardDescription className="text-sm">Acertos, erros e aproveitamento.</CardDescription>
              </div>
              <BarChart3 className="h-6 w-6 text-muted-foreground/40 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {subjectData.map((s, i) => (
                <div key={i} className="flex items-center gap-3 md:gap-6 px-4 md:px-6 py-4">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${subjectColor(s.subject)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground text-sm truncate">{s.subject}</p>
                      <span className="text-xs font-bold text-muted-foreground ml-2 shrink-0 tabular-nums">{fmtPct(s.score, "0%")}</span>
                    </div>
                    <Progress value={s.score} className="h-1.5 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 shrink-0 text-xs font-bold tabular-nums">
                    <span className="flex items-center gap-1 text-emerald-600" title="Acertos">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {s.correct}
                    </span>
                    <span className="flex items-center gap-1 text-red-600" title="Erros">
                      <XCircle className="h-3.5 w-3.5" /> {s.total - s.correct}
                    </span>
                    <Badge variant="outline" className="font-bold text-[10px] uppercase hidden sm:inline-flex">
                      {s.total} questões
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grid: Provas + Redações ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

        {/* Tentativas de provas */}
        <Card className="rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-4 border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className={sectionTitle}>Provas realizadas</CardTitle>
                <CardDescription className="text-sm">
                  {examAttempts.length} tentativa{examAttempts.length !== 1 ? "s" : ""}
                  {examAvgScore !== null && ` · média de ${fmtNumber(examAvgScore, 0, "0")} pts`}
                </CardDescription>
              </div>
              <TrendingUp className="h-6 w-6 text-muted-foreground/40 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {examAttempts.length === 0 ? (
              <div className="p-4 md:p-6">
                <EmptyState
                  compact
                  icon={BookOpen}
                  title="Nenhuma prova realizada"
                  description="As provas que o aluno fizer aparecem aqui, com nota e tempo."
                />
              </div>
            ) : (
              <div className="divide-y">
                {examAttempts.map((e, i) => {
                  const p = pct(e.score, e.total_questions);
                  const meta = [e.exams?.year, e.exams?.exam_type].filter(Boolean).join(" · ");
                  return (
                    <div key={i} className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4">
                      <div className="h-9 w-9 rounded-control bg-muted flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">
                          {txt(e.exams?.title, "Prova")}
                        </p>
                        {meta && (
                          <p className="u-label !text-[10px]">{meta}</p>
                        )}
                        {formatAttemptDuration(e.duration_seconds) && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Concluiu em {formatAttemptDuration(e.duration_seconds)}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground tabular-nums">
                          {fmtNumber(e.score, 0, "0")}/{fmtNumber(e.total_questions, 0, "0")}
                        </p>
                        <p className={`text-[11px] font-bold tabular-nums ${p >= 60 ? "text-emerald-600" : "text-red-600"}`}>
                          {p}%
                        </p>
                        {e.tri_score != null && (
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tabular-nums">TRI {fmtNumber(e.tri_score, 0)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Redações */}
        <Card className="rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-4 border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className={sectionTitle}>Redações</CardTitle>
                <CardDescription className="text-sm">
                  {essays.length} envio{essays.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <FileText className="h-6 w-6 text-muted-foreground/40 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {essays.length === 0 ? (
              <div className="p-4 md:p-6">
                <EmptyState
                  compact
                  icon={FileText}
                  title="Nenhuma redação enviada"
                  description="As redações que o aluno enviar aparecem aqui, com a nota quando corrigidas."
                />
              </div>
            ) : (
              <div className="divide-y">
                {essays.map((essay, i) => (
                  <div key={i} className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4">
                    <div className="h-9 w-9 rounded-control bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{txt(essay.theme, "Redação")}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {fmtDate(essay.created_at, "dd/MM/yyyy")}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {essay.score != null ? (
                        <span className="font-bold text-foreground tabular-nums">{fmtNumber(essay.score, 0, "0")} pts</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-bold uppercase border-amber-200 text-amber-800 bg-amber-50">
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Medalhas ── */}
      {badges.length > 0 && (
        <Card className="rounded-card overflow-hidden">
          <CardHeader className="p-5 md:p-6 pb-4 border-b">
            <CardTitle className={sectionTitle}>Conquistas e medalhas</CardTitle>
            <CardDescription className="text-sm">{badges.length} medalha{badges.length !== 1 ? "s" : ""} conquistada{badges.length !== 1 ? "s" : ""}.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-muted/40 border rounded-control px-3 py-2"
                  title={b.earned_at ? fmtDate(b.earned_at, "dd/MM/yyyy") : ""}
                >
                  <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">{txt(b.badge_type)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Resumo acertos/erros ── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card className="rounded-card p-4 md:p-6">
            <div className="u-label !text-emerald-600 flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Corretas</div>
            <p className="u-num text-2xl md:text-3xl tabular-nums mt-2 text-emerald-600">{fmtNumber(stats.correct, 0, "0")}</p>
          </Card>
          <Card className="rounded-card p-4 md:p-6">
            <div className="u-label !text-red-600 flex items-center gap-2"><XCircle className="h-3.5 w-3.5 shrink-0" /> Erradas</div>
            <p className="u-num text-2xl md:text-3xl tabular-nums mt-2 text-red-600">{fmtNumber(stats.incorrect, 0, "0")}</p>
          </Card>
          <Card className="rounded-card p-4 md:p-6">
            <div className="u-label flex items-center gap-2"><Target className="h-3.5 w-3.5 shrink-0" /> Aproveitamento</div>
            <p className="u-num text-2xl md:text-3xl tabular-nums mt-2">{fmtPct(stats.accuracy, "0%")}</p>
          </Card>
        </div>
      )}

    </div>
  );
}
