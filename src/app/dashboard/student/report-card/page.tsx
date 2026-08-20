"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { examTypeStyles } from "@/lib/exam-types";
import {
  ArrowLeftRight,
  Calendar,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  School,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  ENEM_SUBJECTS,
  LABELS,
  avg,
  pct,
  subjectScores,
  type EnemReportCard,
  type EtecReportCard,
} from "./report-card-lib";

// Recharts (~100 kB gzip) só é necessário no modo "completo" — carrega sob
// demanda pra não pesar o primeiro paint no celular (regra da casa: recharts
// sempre via dynamic ssr:false).
const EnemInsights = dynamic(() => import("./enem-insights"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="h-96 animate-pulse rounded-[1.75rem] border border-slate-100 bg-white shadow-sm" />
      <div className="h-96 animate-pulse rounded-[1.75rem] border border-slate-100 bg-white shadow-sm" />
    </div>
  ),
});

function formatTurno(turno?: string | null) {
  if (!turno) return null;
  const map: Record<string, string> = { manha: LABELS.manha, tarde: "Tarde", integral: "Integral" };
  return map[turno] ?? turno;
}

function statusFromPct(value: number | null) {
  if (value === null) return { title: "Sem dados suficientes", tone: "slate", text: "Assim que houver notas, o resumo aparece aqui." };
  if (value >= 80) return { title: "Muito bom", tone: "emerald", text: "O desempenho atual esta forte. Vale manter a rotina." };
  if (value >= 60) return { title: "Em desenvolvimento", tone: "amber", text: "Ha uma boa base, com espaco claro para crescer." };
  return { title: "Precisa de apoio", tone: "red", text: "Este ponto merece acompanhamento mais proximo." };
}

function ScoreCard({ label, score, max, icon: Icon }: { label: string; score: number | null; max: number | null; icon: any }) {
  const percentage = pct(score, max);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            {percentage !== null && <span className="text-xs font-black text-primary">{percentage}%</span>}
          </div>
          {score !== null && score !== undefined ? (
            <p className="mt-1 text-xl font-black text-slate-950 tabular-nums">
              {score}
              {max !== null && max !== undefined && <span className="text-sm font-bold text-slate-400">/{max}</span>}
            </p>
          ) : (
            <p className="mt-2 text-sm font-bold text-slate-300">{LABELS.naoRealizado}</p>
          )}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400" style={{ width: `${percentage ?? 0}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-white/55">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-white/50">{hint}</p>
    </div>
  );
}

function SimuladoCard({ score1, score2, score3, max }: { score1: number | null; score2: number | null; score3: number | null; max: number | null }) {
  const simulados = [
    { label: "Simulado 1", score: score1 },
    { label: "Simulado 2", score: score2 },
    { label: "Simulado 3", score: score3 },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Simulados ENEM</p>
          <p className="text-xs font-semibold text-slate-500">Evolucao dentro do semestre</p>
        </div>
        <Trophy className="h-5 w-5 text-primary" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {simulados.map((sim) => {
          const percentage = pct(sim.score, max);
          return (
            <div key={sim.label} className="rounded-xl bg-slate-50 p-3 text-center">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{sim.label}</span>
              {sim.score !== null ? (
                <span className="mt-1 block text-base font-black text-slate-950 tabular-nums">
                  {sim.score}
                  <span className="text-[10px] text-slate-400">/{max}</span>
                </span>
              ) : (
                <span className="mt-1 block text-[10px] font-bold text-slate-300">Pendente</span>
              )}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percentage ?? 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: number; detail?: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-xl font-black text-slate-950 tabular-nums">
            {value}
            {detail && <span className="ml-2 text-xs font-bold text-slate-400">{detail}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function SimplifiedEnemReport({ entries }: { entries: EnemReportCard[] }) {
  const first = entries[0];
  const latest = entries[entries.length - 1];
  const latestClassPct = pct(latest?.classificatoria_score, latest?.classificatoria_max);
  const latestSimAvg = avg([latest?.simulado_1_score, latest?.simulado_2_score, latest?.simulado_3_score]);
  const status = statusFromPct(latestClassPct);
  const acertos = latest?.classificatoria_score ?? null;
  const acertosMax = latest?.classificatoria_max ?? null;
  const acertosLabel = acertos !== null ? `${acertos}${acertosMax !== null ? `/${acertosMax}` : ""}` : "--";
  const scoreDelta =
    latest?.classificatoria_score !== null && latest?.classificatoria_score !== undefined &&
    first?.classificatoria_score !== null && first?.classificatoria_score !== undefined
      ? latest.classificatoria_score - first.classificatoria_score
      : null;
  const rankedSubjects = subjectScores(latest).sort((a, b) => b.score - a.score);
  const strengths = rankedSubjects.slice(0, 3);
  const attention = rankedSubjects.slice(-3).reverse();
  const faltas = (latest?.absences_1sem ?? 0) + (latest?.absences_2sem ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo simples</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{status.title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{status.text}</p>
            </div>
            <div className={`rounded-2xl px-5 py-4 text-center ${status.tone === "emerald" ? "bg-emerald-50 text-emerald-700" : status.tone === "amber" ? "bg-amber-50 text-amber-700" : status.tone === "red" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
              <p className="text-[10px] font-black uppercase tracking-wider">Acertos</p>
              <p className="text-3xl font-black tabular-nums">{acertosLabel}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SimpleMiniCard label="Prova" value={acertosLabel} detail={scoreDelta !== null ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta} acertos desde o inicio` : "Sem comparativo"} />
            <SimpleMiniCard label="Simulados" value={latestSimAvg !== null ? `${latestSimAvg}${latest?.simulado_max ? `/${latest.simulado_max}` : ""}` : "--"} detail="Media dos simulados" />
            <SimpleMiniCard label={LABELS.redacao} value={latest?.redacao_score !== null && latest?.redacao_score !== undefined ? `${latest.redacao_score}` : "--"} detail={latest?.redacao_max !== null && latest?.redacao_max !== undefined ? `de ${latest.redacao_max}` : "Sem redacao"} />
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Frequencia</h3>
          </div>
          <p className="text-4xl font-black text-slate-950 tabular-nums">{faltas}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">faltas registradas no boletim atual.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
            {faltas <= 2 ? "Frequencia boa. Continue assim." : "Vale acompanhar as faltas para nao prejudicar a rotina."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SimpleSubjectList title="Maiores afinidades" description="Materias em que o aluno esta mais forte." subjects={strengths} tone="good" />
        <SimpleSubjectList title="Pontos de atencao" description="Materias que merecem mais estudo." subjects={attention} tone="attention" />
      </div>
    </div>
  );
}

function SimpleMiniCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950 tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function SimpleSubjectList({
  title,
  description,
  subjects,
  tone,
}: {
  title: string;
  description: string;
  subjects: Array<(typeof ENEM_SUBJECTS)[number] & { score: number }>;
  tone: "good" | "attention";
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">{title}</h3>
        <p className="text-xs font-semibold text-slate-500">{description}</p>
      </div>
      <div className="space-y-2">
        {subjects.map((subject, index) => {
          const Icon = subject.icon;
          return (
            <div key={subject.key} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone === "good" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{index + 1}. {subject.label}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full ${tone === "good" ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, subject.score * 10)}%` }} />
                </div>
              </div>
              <span className="text-sm font-black text-slate-950 tabular-nums">{subject.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimpleEtecReport({ entries }: { entries: EtecReportCard[] }) {
  const first = entries[0];
  const latest = entries[entries.length - 1];
  const classPct = pct(latest?.classificatoria_score, latest?.classificatoria_max);
  const simPct = pct(latest?.simulado_score, latest?.simulado_max);
  const firstPct = pct(first?.classificatoria_score, first?.classificatoria_max);
  const delta = classPct !== null && firstPct !== null ? classPct - firstPct : null;
  const status = statusFromPct(classPct);

  return (
    <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo simples</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <SimpleMiniCard label="Situacao" value={status.title} detail={status.text} />
        <SimpleMiniCard label={LABELS.classificatoria} value={`${classPct ?? "--"}%`} detail={delta !== null ? `${delta >= 0 ? "+" : ""}${delta} pontos desde o inicio` : "Sem comparativo"} />
        <SimpleMiniCard label="Simulado" value={`${simPct ?? "--"}%`} detail="Resultado mais recente" />
      </div>
    </div>
  );
}

function SubjectGrid({ enem }: { enem: EnemReportCard }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Desempenho por materia</h3>
          <p className="text-xs font-semibold text-slate-500">Notas do semestre selecionado.</p>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ENEM_SUBJECTS.map((subject) => {
          const score = enem[subject.key] as number | null;
          const Icon = subject.icon;
          const width = typeof score === "number" ? Math.min(100, score * 10) : 0;

          return (
            <div key={subject.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="truncate text-xs font-bold text-slate-700">{subject.label}</span>
                </div>
                {score !== null && score !== undefined ? (
                  <span className="text-sm font-black text-slate-950 tabular-nums">{score}</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-300">Pendente</span>
                )}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SimAttempt = { attemptNumber: number; score: number; total: number; tri: number | null; date: string; durationSeconds: number | null };

/** Formata uma duração em segundos como "1h 12min", "48min" ou "37s". */
function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}
type SimGroup = { examId: string; title: string; examType: string; counting: SimAttempt[]; totalAttempts: number; limit: number };

/**
 * Selo do vestibular. Só aparece quando a prova não é do tipo "padrão" da trilha
 * (ENEM/ETEC) — ou seja, marca FUVEST e outros vestibulares sem poluir a lista
 * com um selo repetido em toda linha.
 */
function examTypeTag(examType: string): { label: string; chip: string } | null {
  const t = (examType || "").toLowerCase();
  if (!t || t === "enem" || t === "etec" || t === "simulado_importado") return null;
  const s = examTypeStyles(t);
  return { label: s.label, chip: s.chip };
}

/**
 * Simulados feitos pelo aluno na plataforma que entram no histórico do curso.
 * Só as 2 primeiras tentativas de cada prova contam (as demais são treino e
 * ficam no gráfico de evolução, dentro da tela de Provas).
 */
function PlatformSimuladosSection({ groups }: { groups: SimGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Simulados na plataforma</h3>
        </div>
        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700">
          2o semestre
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">
        As primeiras tentativas de cada simulado compoem seu historico do 2o semestre. Tentativas extras contam apenas como treino.
      </p>

      <div className="mt-4 space-y-3">
        {groups.map((g) => (
          <div key={g.examId} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-black italic text-slate-800">{g.title}</p>
              {(() => {
                const tag = examTypeTag(g.examType);
                if (!tag) return null;
                return (
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${tag.chip}`}>
                    {tag.label}
                  </span>
                );
              })()}
              {g.limit > 2 && (
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                  +{g.limit - 2} chances extras
                </span>
              )}
              {g.totalAttempts > g.limit && (
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  +{g.totalAttempts - g.limit} treino
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Array.from({ length: g.limit }, (_, i) => i + 1).map((n) => {
                const att = g.counting.find((a) => a.attemptNumber === n);
                const pct = att && att.total > 0 ? Math.round((att.score / att.total) * 100) : null;
                return (
                  <div
                    key={n}
                    className={`rounded-xl border p-3 ${att ? "border-orange-200 bg-white" : "border-dashed border-slate-200 bg-transparent"}`}
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{n}a tentativa</p>
                    {att ? (
                      <div className="mt-1">
                        <p className="text-lg font-black italic tabular-nums text-slate-950 leading-none">
                          {att.tri != null ? att.tri : `${pct}%`}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                          {att.tri != null ? "nota TRI" : "aproveitamento"} - {att.score}/{att.total}
                        </p>
                        {formatDuration(att.durationSeconds) && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-slate-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(att.durationSeconds)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs font-bold italic text-slate-300">nao realizada</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReportCardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [simGroups, setSimGroups] = useState<SimGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<"enem" | "etec">("enem");
  const [mode, setMode] = useState<"simple" | "complete">("simple");

  useEffect(() => {
    if (!user || authLoading) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rawTarget = (profile?.exam_target || user?.user_metadata?.exam_target || "enem").toLowerCase();
        const currentTrack = rawTarget.includes("etec") ? "etec" : "enem";
        setTrack(currentTrack);

        const table = currentTrack === "etec" ? "report_card_entries" : "report_card_entries_enem";
        const [entriesRes, attemptsRes, grantsRes] = await Promise.all([
          supabase
            .from(table)
            .select("*")
            .eq("student_id", user.id)
            .eq("status", "approved")
            .order("semester", { ascending: true }),
          // Tentativas do próprio aluno que compõem o histórico de curso.
          supabase
            .from("exam_attempts")
            .select("exam_id, score, total_questions, tri_score, attempt_number, completed_at, duration_seconds, exams!inner(title, exam_type)")
            .eq("user_id", user.id)
            .eq("source", "self")
            .order("attempt_number", { ascending: true }),
          // Concessões de tentativas extras (mais chances) por prova.
          supabase
            .from("exam_report_attempt_grants")
            .select("exam_id, max_attempts")
            .eq("user_id", user.id),
        ]);

        // Limite de tentativas que contam por prova (padrão 2; grant aumenta).
        const limitByExam: Record<string, number> = {};
        (grantsRes?.data ?? []).forEach((gr: any) => {
          limitByExam[gr.exam_id] = gr.max_attempts ?? 2;
        });

        if (!entriesRes.error && active) {
          setEntries(entriesRes.data ?? []);
        }

        if (!attemptsRes.error && active) {
          const groups: Record<string, SimGroup> = {};
          (attemptsRes.data ?? []).forEach((a: any) => {
            const examType = (a.exams?.exam_type || "").toLowerCase();
            const matchesTrack = currentTrack === "etec" ? examType.includes("etec") : !examType.includes("etec");
            if (!matchesTrack) return;
            const limit = limitByExam[a.exam_id] ?? 2;
            const g = (groups[a.exam_id] ??= {
              examId: a.exam_id,
              title: a.exams?.title ?? "Simulado",
              examType,
              counting: [],
              totalAttempts: 0,
              limit,
            });
            g.totalAttempts += 1;
            if ((a.attempt_number ?? 99) <= limit) {
              g.counting.push({
                attemptNumber: a.attempt_number ?? 0,
                score: a.score ?? 0,
                total: a.total_questions ?? 0,
                tri: a.tri_score ?? null,
                date: a.completed_at,
                durationSeconds: a.duration_seconds ?? null,
              });
            }
          });
          setSimGroups(Object.values(groups).filter((g) => g.counting.length > 0));
        }
      } catch (e) {
        console.error("Erro ao carregar boletim:", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, profile, authLoading]);

  const enemEntries = useMemo(() => (track === "enem" ? (entries as EnemReportCard[]) : []), [entries, track]);
  const latestEnem = enemEntries[enemEntries.length - 1];

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasPdf1 = !!profile?.report_card_pdf_url_1sem;
  const hasPdf2 = !!profile?.report_card_pdf_url_2sem;
  const hasPdfs = hasPdf1 || hasPdf2;

  if (entries.length === 0 && !hasPdfs && simGroups.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <GraduationCap className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">
          Seu boletim ainda nao foi lancado. Assim que a secretaria publicar, ele aparece aqui automaticamente.
        </p>
      </div>
    );
  }

  const trackLabel = track === "enem" ? "Vestibular ENEM" : "Vestibulinho ETEC";
  const colegio = entries[0]?.colegio || profile?.institution;
  const sala = entries[0]?.sala || profile?.sala;
  const turno = formatTurno(entries[0]?.turno || profile?.turno);
  const latestAcertos = latestEnem?.classificatoria_score ?? null;
  const latestAcertosMax = latestEnem?.classificatoria_max ?? null;
  const latestSimAvg = latestEnem ? avg([latestEnem.simulado_1_score, latestEnem.simulado_2_score, latestEnem.simulado_3_score]) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-[2rem] aurora-dark p-6 text-white shadow-xl md:p-8">
        <Image
          src="/images/updates/boletim_update.png"
          alt="Meu Boletim"
          fill
          sizes="(max-width: 768px) 100vw, 1024px"
          className="object-cover opacity-25"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/35" />
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
              <GraduationCap className="h-3 w-3" />
              {trackLabel}
            </span>
            <h1 className="mt-3 text-3xl font-black italic tracking-tighter md:text-4xl">Meu Boletim</h1>
            <p className="mt-2 max-w-xl text-sm font-semibold text-white/60">
              Escolha uma leitura simples ou uma visao completa do desempenho.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-white/65">
              {colegio && (
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5">
                  <School className="h-3 w-3" />
                  {colegio}
                </span>
              )}
              {sala && <span className="rounded-full bg-white/10 px-3 py-1.5">Sala {sala}</span>}
              {turno && <span className="rounded-full bg-white/10 px-3 py-1.5">{turno}</span>}
            </div>
          </div>
          {track === "enem" && latestEnem && (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label={LABELS.classificatoria} value={latestAcertos !== null ? `${latestAcertos}${latestAcertosMax !== null ? `/${latestAcertosMax}` : ""}` : "--"} hint={LABELS.ultimo} icon={TrendingUp} />
              <MetricCard label="Simulados" value={latestSimAvg !== null ? `${latestSimAvg}${latestEnem?.simulado_max ? `/${latestEnem.simulado_max}` : ""}` : "--"} hint={LABELS.media} icon={Trophy} />
            </div>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="flex rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition-all ${mode === "simple" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Boletim simplificado
          </button>
          <button
            type="button"
            onClick={() => setMode("complete")}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition-all ${mode === "complete" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Boletim completo
          </button>
        </div>
      )}

      {hasPdfs && (
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-md">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Boletins oficiais em PDF</h3>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Baixe a versao oficial em PDF assinada e disponibilizada pela secretaria.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {hasPdf1 && (
              <a href={profile.report_card_pdf_url_1sem} target="_blank" rel="noopener noreferrer" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100">
                <FileText className="h-4 w-4 text-red-500" />
                Baixar boletim - 1o semestre
              </a>
            )}
            {hasPdf2 && (
              <a href={profile.report_card_pdf_url_2sem} target="_blank" rel="noopener noreferrer" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100">
                <FileText className="h-4 w-4 text-red-500" />
                Baixar boletim - 2o semestre
              </a>
            )}
          </div>
        </div>
      )}

      <PlatformSimuladosSection groups={simGroups} />

      {entries.length === 0 ? null : mode === "simple" ? (
        track === "enem" && enemEntries.length > 0 ? (
          <SimplifiedEnemReport entries={enemEntries} />
        ) : (
          <SimpleEtecReport entries={entries as EtecReportCard[]} />
        )
      ) : (
        <>
          {track === "enem" && enemEntries.length > 0 && <EnemInsights entries={enemEntries} />}

          {entries.map((entry) => {
            if (track === "enem") {
              const enem = entry as EnemReportCard;
              return (
                <section key={enem.id} className="space-y-4">
                  <p className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">
                    {enem.semester}o semestre
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ScoreCard label={LABELS.classificatoria} score={enem.classificatoria_score} max={enem.classificatoria_max} icon={TrendingUp} />
                    <ScoreCard label={LABELS.redacao} score={enem.redacao_score} max={enem.redacao_max} icon={GraduationCap} />
                    <SimuladoCard score1={enem.simulado_1_score} score2={enem.simulado_2_score} score3={enem.simulado_3_score} max={enem.simulado_max} />
                    <StatCard label="Faltas" value={enem.absences_1sem ?? 0} detail={enem.absences_2sem !== null ? `${enem.absences_2sem} no 2o sem` : undefined} icon={Calendar} />
                    <StatCard label={LABELS.saidas} value={enem.early_departures_1sem ?? 0} detail={enem.early_departures_2sem !== null ? `${enem.early_departures_2sem} no 2o sem` : undefined} icon={ArrowLeftRight} />
                  </div>

                  <SubjectGrid enem={enem} />
                </section>
              );
            }

            const etec = entry as EtecReportCard;
            return (
              <section key={etec.id} className="space-y-4">
                <p className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  {etec.semester}o semestre
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ScoreCard label={LABELS.classificatoria} score={etec.classificatoria_score} max={etec.classificatoria_max} icon={TrendingUp} />
                  <ScoreCard label="Simulado" score={etec.simulado_score} max={etec.simulado_max} icon={TrendingUp} />
                  {etec.track === "enem" && <ScoreCard label={LABELS.redacao} score={etec.redacao_score} max={etec.redacao_max} icon={GraduationCap} />}
                  <StatCard label="Faltas" value={etec.absences_1sem ?? 0} detail={etec.absences_2sem !== null ? `${etec.absences_2sem} no 2o sem` : undefined} icon={Calendar} />
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
