
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  FileText,
  ArrowLeft,
  Inbox,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtDate, fmtNumber } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

const VALID_SCORES = [0, 40, 80, 120, 160, 200];
const COMP_KEYS = ["c1", "c2", "c3", "c4", "c5"] as const;
const COMP_SHORT: Record<string, string> = {
  c1: "C1 · Norma",
  c2: "C2 · Tema",
  c3: "C3 · Argum.",
  c4: "C4 · Coesão",
  c5: "C5 · Interv.",
};

/** Extrai as notas por competência que a IA atribuiu a uma submissão. */
function aiComps(essay: any): Record<string, number> {
  const src = essay?.result_data?.competencies || essay?.competencies || {};
  const out: Record<string, number> = {};
  for (const k of COMP_KEYS) out[k] = Number(src?.[k]?.score ?? src?.[k] ?? 0) || 0;
  return out;
}

export default function AssessmentsGraderPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEssay, setSelectedEssay] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [mentorFeedback, setMentorFeedback] = useState("");
  // Notas humanas por competência para o aluno selecionado (calibração da IA).
  const [teacherComps, setTeacherComps] = useState<Record<string, number>>({});

  const teacherTotal = useMemo(
    () => COMP_KEYS.reduce((sum, k) => sum + (teacherComps[k] || 0), 0),
    [teacherComps]
  );

  // ── Estatística de calibração: viés médio da IA vs. correção humana ──
  const calibration = useMemo(() => {
    const reviewed = submissions.filter(
      (s) => s.teacher_score !== null && s.teacher_score !== undefined
    );
    if (reviewed.length === 0) return null;
    let totalBias = 0;
    const compBias: Record<string, number> = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
    reviewed.forEach((s) => {
      totalBias += Number(s.score || 0) - Number(s.teacher_score || 0);
      const ai = aiComps(s);
      const human = s.teacher_competencies || {};
      for (const k of COMP_KEYS) {
        compBias[k] += (ai[k] || 0) - (Number(human?.[k] ?? ai[k]) || 0);
      }
    });
    const n = reviewed.length;
    return {
      n,
      avgBias: Math.round(totalBias / n),
      compBias: Object.fromEntries(COMP_KEYS.map((k) => [k, Math.round(compBias[k] / n)])),
    };
  }, [submissions]);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: essays, error: essayError } = await supabase
        .from("essay_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (essayError) throw essayError;

      const loadedSubmissions = essays || [];

      if (loadedSubmissions.length > 0) {
        const userIds = [...new Set(loadedSubmissions.map((s) => s.user_id).filter(Boolean))];

        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name, profile_type")
            .in("id", userIds);

          loadedSubmissions.forEach((sub) => {
            const matchedProfile = profilesData?.find((p) => p.id === sub.user_id);
            sub.profiles = matchedProfile || { name: "Aluno" };
          });
        }
      }

      setSubmissions(loadedSubmissions);
    } catch (e: any) {
      console.error("Erro explícito no Supabase:", e.message || JSON.stringify(e));
      toast({
        title: "Erro ao carregar",
        description: e.message || "Não foi possível carregar as redações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  /** Espelho da banca gravado pela correção, quando existe. */
  const banca = useMemo(
    () => selectedEssay?.result_data?._banca ?? null,
    [selectedEssay],
  );

  const handleSelectEssay = (essay: any) => {
    setSelectedEssay(essay);
    setMentorFeedback(essay.mentor_notes || "");
    // Pré-preenche com a correção humana anterior, ou com a nota da IA como ponto de partida.
    const existing = essay.teacher_competencies;
    setTeacherComps(existing && Object.keys(existing).length ? { ...existing } : aiComps(essay));
  };

  const handleSaveFeedback = async () => {
    if (!selectedEssay || isSaving) return;
    setIsSaving(true);
    try {
      const teacher_competencies = { ...teacherComps };
      const teacher_score = teacherTotal;

      const { error } = await supabase
        .from("essay_submissions")
        .update({
          mentor_notes: mentorFeedback,
          status: "reviewed",
          teacher_competencies,
          teacher_score,
          teacher_reviewed_at: new Date().toISOString(),
          teacher_reviewed_by: user?.id ?? null,
        })
        .eq("id", selectedEssay.id);

      if (error) throw error;

      toast({ title: "Correção salva!", description: "Sua nota foi registrada e ajuda a calibrar a Aurora." });

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedEssay.id
            ? {
                ...s,
                mentor_notes: mentorFeedback,
                status: "reviewed",
                teacher_competencies,
                teacher_score,
                teacher_reviewed_at: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (e: any) {
      toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSubmissions = submissions.filter(
    (s) =>
      s.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.theme?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = submissions.filter((s) => s.status !== "reviewed").length;
  const reviewedCount = submissions.filter((s) => s.status === "reviewed").length;

  const hideOnMobileWhenSelected = selectedEssay ? "hidden lg:block" : "block";

  return (
    <div className="pb-24 space-y-6">
      {/* ── Cabeçalho (nível médio) — some no celular quando uma redação está aberta ── */}
      <div className={hideOnMobileWhenSelected}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="u-label flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" /> Professor · redações</p>
            <h1 className="u-page-title text-3xl mt-1">Correção de redações</h1>
            <p className="text-muted-foreground text-sm mt-2">Revise a nota da Aurora IA e registre a sua correção.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-64 shrink-0">
            <div className="u-surface p-3">
              <p className="u-label">A corrigir</p>
              <p className="u-num text-xl mt-1">{pendingCount}</p>
            </div>
            <div className="u-surface p-3">
              <p className="u-label !text-emerald-600">Corrigidas</p>
              <p className="u-num text-xl mt-1 text-emerald-600">{reviewedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Calibração da IA (viés médio vs. correção humana) ── */}
      {calibration && (
        <div className={hideOnMobileWhenSelected}>
          <div className="u-surface p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <p className="u-label flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Calibração da Aurora · <span className="tabular-nums">{calibration.n}</span> corrigidas
              </p>
              <span
                className={`ml-auto text-[11px] font-semibold ${
                  Math.abs(calibration.avgBias) <= 40 ? "text-emerald-600" : "text-foreground"
                }`}
              >
                {calibration.avgBias > 0
                  ? `IA dá ${calibration.avgBias} pts a mais`
                  : calibration.avgBias < 0
                  ? `IA dá ${Math.abs(calibration.avgBias)} pts a menos`
                  : "IA calibrada"}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {COMP_KEYS.map((k) => {
                const b = (calibration.compBias as any)[k] as number;
                return (
                  <div key={k} className="text-center border border-border rounded-control py-2 px-1 min-w-0" title={COMP_SHORT[k]}>
                    <p className="u-label !tracking-[0.12em] truncate">
                      <span className="sm:hidden">{k.toUpperCase()}</span>
                      <span className="hidden sm:inline">{COMP_SHORT[k]}</span>
                    </p>
                    <p className={`u-num text-sm leading-none mt-1.5 ${Math.abs(b) <= 8 ? "text-emerald-600" : ""}`}>
                      {b > 0 ? `+${b}` : b}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-snug">
              Diferença média entre a nota da IA e a sua. Positivo: a IA está dando nota demais; negativo: de menos.
            </p>
          </div>
        </div>
      )}

      {/* ── Busca ── */}
      <div className={`${hideOnMobileWhenSelected} relative`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar aluno ou tema…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 bg-background border border-border rounded-control pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* ── Lista + detalhe ── */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">

        {/* === LISTA === */}
        <div className={`${hideOnMobileWhenSelected} w-full lg:w-[320px] shrink-0`}>
          <div className="u-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="u-label flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Redações · <span className="tabular-nums">{filteredSubmissions.length}</span>
              </p>
            </div>

            <div className="max-h-[60vh] lg:max-h-[600px] overflow-y-auto scrollbar-hide">
              {loading ? (
                <div className="p-10 flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="u-label">Carregando redações…</p>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="p-4">
                  {submissions.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Inbox}
                      title="Nenhuma redação enviada ainda"
                      description="Quando os alunos enviarem redações, elas aparecem aqui para você corrigir."
                    />
                  ) : (
                    <EmptyState
                      compact
                      icon={Search}
                      title="Nenhuma redação encontrada"
                      description={`Nada corresponde a "${searchTerm}".`}
                      secondary={{ label: "Limpar busca", onClick: () => setSearchTerm("") }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredSubmissions.map((item) => {
                    const isSelected = selectedEssay?.id === item.id;
                    const isPending = item.status !== "reviewed";
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectEssay(item)}
                        className={`relative p-4 text-left border-b border-border last:border-0 transition-colors touch-manipulation ${
                          isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                        )}
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <p className="font-semibold text-foreground text-sm leading-tight truncate flex-1">
                            {item.profiles?.name || "Aluno"}
                          </p>
                          <span className={`text-[11px] font-semibold shrink-0 ${isPending ? "text-muted-foreground" : "text-emerald-600"}`}>
                            {isPending ? "A corrigir" : "Corrigida"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-2 leading-tight">
                          {item.theme || "Sem tema"}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                          <span className="font-semibold text-foreground">{fmtNumber(item.score)} pts</span>
                          <span>{fmtDate(item.created_at, "dd/MM HH:mm")}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === DETALHE === */}
        <div className={`${selectedEssay ? "block" : "hidden lg:block"} flex-1 min-w-0`}>
          {selectedEssay ? (
            <div className="u-surface overflow-hidden">

              <div className="lg:hidden p-3 border-b border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEssay(null)}
                  className="h-9 rounded-control text-xs font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Voltar para a lista
                </Button>
              </div>

              <div className="p-4 sm:p-5 lg:p-6 space-y-5">

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    {selectedEssay.profiles?.name?.charAt(0)?.toUpperCase() || "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-foreground truncate leading-tight">
                      {selectedEssay.profiles?.name || "Aluno"}
                    </p>
                    <p className="u-label mt-1">Enviada em {fmtDate(selectedEssay.created_at, "dd/MM/yyyy 'às' HH:mm")}</p>
                  </div>
                </div>

                <div className="border border-border rounded-control p-4">
                  <p className="u-label mb-1">Tema</p>
                  <h3 className="text-sm font-semibold text-foreground leading-snug break-words">
                    {selectedEssay.theme || "Sem tema"}
                  </h3>
                </div>

                <div className="border border-border rounded-control p-4">
                  <p className="u-label mb-2">Texto do aluno</p>
                  <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
                    {selectedEssay.content}
                  </div>
                </div>

                {/* Nota da IA */}
                <div className="border border-border rounded-control p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <p className="u-label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Correção da Aurora IA</p>
                  </div>
                  <p className="u-label mb-1">Nota</p>
                  <p className="u-num text-4xl sm:text-5xl leading-none">{fmtNumber(selectedEssay.score)}</p>
                  {selectedEssay.feedback && (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border whitespace-pre-line break-words">
                      {selectedEssay.feedback}
                    </p>
                  )}

                  {/* Espelho da banca: as correções independentes e o que o
                      protocolo do INEP fez com elas. É o que diz ao professor
                      se a nota foi tranquila ou disputada — e, portanto, onde
                      a revisão humana rende mais. */}
                  {banca && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      <p className="u-label">
                        Banca · <span className="tabular-nums">{banca.corretores?.length ?? 0}</span> correções independentes
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(banca.corretores ?? []).map((c: any, i: number) => (
                          <span
                            key={i}
                            className={`rounded-control px-2 py-1 text-[11px] font-mono border ${
                              banca.usadas?.includes(i)
                                ? 'border-primary text-foreground bg-primary/10'
                                : 'border-border text-muted-foreground line-through'
                            }`}
                            title={banca.usadas?.includes(i) ? 'Usada na nota final' : 'Descartada pelo protocolo'}
                          >
                            {c.vetor?.join('·')} = {c.total}
                          </span>
                        ))}
                      </div>
                      {banca.houveDiscrepancia && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Divergência acima do limite do INEP: {banca.motivos?.join('; ')}.
                        </p>
                      )}
                      {banca.revisaoRecomendada && (
                        <p className="text-xs font-semibold text-red-600 leading-relaxed">
                          Caso no limite — aqui a sua correção pesa mais que a média.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Correção humana por competência (calibra a IA) */}
                <div className="space-y-3 border border-border rounded-control p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="u-label flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5" /> Sua correção
                    </Label>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                      <span>IA: {fmtNumber(selectedEssay.score)}</span>
                      <span className="u-num text-sm text-foreground">{teacherTotal} pts</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {COMP_KEYS.map((k) => {
                      const ai = aiComps(selectedEssay)[k];
                      return (
                        <div key={k} className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-1.5 min-[420px]:gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground min-[420px]:w-[76px] shrink-0">
                            {COMP_SHORT[k]}
                          </span>
                          <div className="flex gap-1 flex-1">
                            {VALID_SCORES.map((v) => {
                              const active = teacherComps[k] === v;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setTeacherComps((prev) => ({ ...prev, [k]: v }))}
                                  aria-pressed={active}
                                  className={`flex-1 h-9 rounded-control text-[11px] font-semibold tabular-nums transition-colors relative border ${
                                    active
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                                  }`}
                                  title={ai === v ? "Nota que a IA deu" : undefined}
                                >
                                  {v}
                                  {ai === v && !active && (
                                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    O ponto azul marca a nota que a IA deu. Ajuste onde discordar — isso ajuda a calibrar a Aurora.
                  </p>
                </div>

                {/* Comentário do professor */}
                <div className="space-y-2">
                  <Label className="u-label flex items-center gap-1.5 ml-0.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Comentário para o aluno
                  </Label>
                  <Textarea
                    value={mentorFeedback}
                    onChange={(e) => setMentorFeedback(e.target.value)}
                    placeholder="Escreva orientações para o aluno melhorar a redação…"
                    className="min-h-[140px] rounded-control bg-background border-border p-3 text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveFeedback}
                      disabled={isSaving}
                      variant="arcade"
                      className="flex-1 h-12 rounded-control font-bold"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Salvar correção
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 w-12 rounded-control shrink-0 p-0"
                      title="Conversar com o aluno"
                    >
                      <Link href={`/dashboard/chat/${selectedEssay.user_id}`} aria-label="Conversar com o aluno">
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Escolha uma redação na lista"
              description="Abra a redação de um aluno para ver o texto, a nota da IA e registrar a sua correção."
              className="hidden lg:flex min-h-[400px] justify-center"
            />
          )}
        </div>
      </div>
    </div>
  );
}
