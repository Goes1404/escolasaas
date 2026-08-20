"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PenTool,
  CheckCircle2,
  Clock,
  Plus,
  ChevronRight,
  TrendingUp,
  FilePenLine,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";

// ──────────────────────────────────────────────
// Tipagens (espelham as tabelas do Supabase)
// ──────────────────────────────────────────────

interface StudentMetrics {
  essaysSubmitted: number;
  /** Média das notas corrigidas (modelo ENEM 0–1000) */
  averageGrade: number;
  /** Progresso geral calculado a partir de user_progress */
  overallProgress: number;
}

interface EssayRow {
  id: string;
  theme: string;
  created_at: string;
  /** "pending" | "reviewed" | null */
  status: string | null;
  score: number | null;
}

// ──────────────────────────────────────────────
// Hook de dados
// ──────────────────────────────────────────────

function useStudentDashboard(userId: string | undefined) {
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const [essayRes, progressRes] = await Promise.all([
        supabase
          .from("essay_submissions")
          .select("id, theme, created_at, status, score")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("user_progress")
          .select("percentage")
          .eq("user_id", userId),
      ]);

      const essayData: EssayRow[] = essayRes.data ?? [];
      const progressData = progressRes.data ?? [];

      const scored = essayData.filter((e) => e.score !== null && e.score > 0);
      const avg =
        scored.length > 0
          ? Math.round(
              scored.reduce((acc, e) => acc + Number(e.score), 0) /
                scored.length
            )
          : 0;

      const overallProgress =
        progressData.length > 0
          ? Math.round(
              progressData.reduce(
                (acc, p) => acc + (Number(p.percentage) || 0),
                0
              ) / progressData.length
            )
          : 0;

      setEssays(essayData);
      setMetrics({
        essaysSubmitted: essayData.length,
        averageGrade: avg,
        overallProgress,
      });
    } catch {
      setError("Não foi possível carregar seus dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { metrics, essays, loading, error, reload: load };
}

// ──────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon,
  trend,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-muted/20 shadow-sm flex items-start gap-4">
      <div className="p-3 bg-slate-50 rounded-xl shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        {loading ? (
          <Skeleton className="h-8 w-20 mt-2" />
        ) : (
          <p className="text-2xl font-black text-primary mt-1">{value}</p>
        )}
        {trend && !loading && (
          <span className="inline-block text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1.5">
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function EssayStatusBadge({ status }: { status: string | null }) {
  const isReviewed = status === "reviewed" || status === "corrected";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        isReviewed
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {isReviewed ? (
        <CheckCircle2 size={12} />
      ) : (
        <Clock size={12} />
      )}
      {isReviewed ? "Corrigida" : "Em correção"}
    </span>
  );
}

function EssaySkeleton() {
  return (
    <div className="divide-y divide-slate-50">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const { metrics, essays, loading, error, reload } = useStudentDashboard(
    user?.id
  );

  const nameToUse = profile?.name || user?.user_metadata?.full_name || "";
  const firstName = nameToUse.trim().split(" ")[0] || "Estudante";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">

      {/* ── Cabeçalho ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary">
            Olá, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe seu progresso e envie sua próxima redação.
          </p>
        </div>
        <Button
          asChild
          className="bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all h-11 px-6 gap-2 w-full sm:w-auto"
        >
          <Link href="/dashboard/student/essays">
            <Plus size={18} />
            Novo Envio de Redação
          </Link>
        </Button>
      </header>

      {/* ── Métricas ── */}
      <section
        aria-label="Resumo de desempenho"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <MetricCard
          title="Redações Enviadas"
          value={metrics?.essaysSubmitted.toString() ?? "0"}
          icon={<PenTool className="text-primary" size={20} />}
          loading={loading}
        />
        <MetricCard
          title="Média de Notas"
          value={
            metrics?.averageGrade
              ? `${metrics.averageGrade} pts`
              : "–"
          }
          icon={<TrendingUp className="text-emerald-600" size={20} />}
          loading={loading}
        />
        {/* Progresso geral com barra */}
        <div className="bg-white rounded-2xl p-5 border border-muted/20 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 rounded-xl shrink-0">
              <FilePenLine className="text-violet-600" size={20} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Progresso do Curso
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-4 w-full rounded-full" />
          ) : (
            <>
              <Progress
                value={metrics?.overallProgress ?? 0}
                className="h-2"
              />
              <p className="text-xs font-bold text-primary text-right">
                {metrics?.overallProgress ?? 0}% concluído
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Redações Recentes ── */}
      <section aria-label="Últimas redações">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-base font-black text-primary">
            Últimos Envios
          </h2>
          <Link
            href="/dashboard/student/essays"
            className="text-xs font-semibold text-accent hover:text-primary transition-colors flex items-center gap-1"
          >
            Ver laboratório
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-muted/20 shadow-sm overflow-hidden">
          {/* Estado de erro */}
          {error && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="text-red-400" size={32} />
              <p className="text-sm font-semibold text-slate-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={reload}
                className="rounded-xl font-bold"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Skeleton */}
          {!error && loading && <EssaySkeleton />}

          {/* Empty state */}
          {!error && !loading && essays.length === 0 && (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                <PenTool className="text-primary/40" size={28} />
              </div>
              <h3 className="text-sm font-black text-primary">
                Nenhuma redação enviada ainda
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Comece a praticar agora. A correção é automática e o feedback
                chega em segundos.
              </p>
              <Button
                asChild
                size="sm"
                className="mt-2 bg-primary text-white rounded-xl font-bold border-none"
              >
                <Link href="/dashboard/student/essays">
                  Fazer minha primeira redação
                </Link>
              </Button>
            </div>
          )}

          {/* Lista */}
          {!error && !loading && essays.length > 0 && (
            <ul className="divide-y divide-slate-50" role="list">
              {essays.map((essay) => {
                const isReviewed =
                  essay.status === "reviewed" ||
                  essay.status === "corrected";
                return (
                  <li key={essay.id}>
                    <Link
                      href="/dashboard/student/essays"
                      className="flex items-center gap-4 p-5 hover:bg-slate-50/80 transition-colors group"
                      aria-label={`Redação: ${essay.theme}`}
                    >
                      {/* Ícone de status */}
                      <div
                        className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
                          isReviewed
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                        aria-hidden
                      >
                        {isReviewed ? (
                          <CheckCircle2 size={20} />
                        ) : (
                          <Clock size={20} />
                        )}
                      </div>

                      {/* Tema e data */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">
                          {essay.theme}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(essay.created_at).toLocaleDateString(
                            "pt-BR",
                            { day: "2-digit", month: "short", year: "numeric" }
                          )}
                        </p>
                      </div>

                      {/* Nota + badge + seta */}
                      <div className="flex items-center gap-3 shrink-0">
                        {isReviewed && essay.score !== null ? (
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">
                              Nota
                            </p>
                            <p className="text-lg font-black text-emerald-600 leading-none">
                              {essay.score}
                            </p>
                          </div>
                        ) : (
                          <EssayStatusBadge status={essay.status} />
                        )}
                        <ChevronRight
                          size={16}
                          className="text-muted-foreground/40 group-hover:text-accent transition-colors"
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── CTA secundário ── */}
      {!loading && (metrics?.essaysSubmitted ?? 0) > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-primary">
              Continue evoluindo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
              Acesse o laboratório completo para ver todo o seu histórico e
              evolução de notas.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shrink-0"
          >
            <Link href="/dashboard/student/essays" className="gap-2 flex items-center">
              Ver Laboratório de Redação
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
