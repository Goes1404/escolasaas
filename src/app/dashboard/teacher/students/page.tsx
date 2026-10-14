
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Send,
  Loader2,
  ArrowUpRight,
  Clock,
  Pencil,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { fmtNumber, toDate, toNumber } from "@/lib/format";

export default function TeacherStudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "at_risk" | "financial_aid" | "etec" | "enem">("all");
  const [filterInstitution, setFilterInstitution] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [displayCount, setDisplayCount] = useState(50);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editCourse, setEditCourse] = useState("");
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false);

  const handleUpdateStudentCourse = async () => {
    if (!editingStudent) return;
    setIsSubmittingCourse(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ course: editCourse || null })
        .eq("id", editingStudent.id);

      if (error) throw error;

      setStudents((prev) =>
        prev.map((s) => (s.id === editingStudent.id ? { ...s, course: editCourse } : s))
      );
      toast({ title: "Sala atualizada" });
      setEditingStudent(null);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingCourse(false);
    }
  };

  useEffect(() => {
    async function fetchStudents() {
      if (!user) return;
      setLoading(true);
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "student")
          .order("name")
          .limit(5000);

        if (error) throw error;

        const studentProfiles = profiles || [];

        const { data: progressData } = await supabase
          .from("user_progress")
          .select("user_id, percentage");

        const mapped = studentProfiles.map((s) => {
          const userProg = progressData?.filter((p) => p.user_id === s.id) || [];
          const avg =
            userProg.length > 0
              ? Math.round(
                  userProg.reduce((acc, curr) => acc + curr.percentage, 0) / userProg.length
                )
              : 0;
          return { ...s, progress: avg };
        });

        setStudents(mapped);
      } catch (err: any) {
        toast({ title: "Não foi possível carregar os alunos", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [user, toast]);

  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (student.name || "").toLowerCase().includes(searchLower) ||
      (student.email || "").toLowerCase().includes(searchLower) ||
      (student.institution || "").toLowerCase().includes(searchLower);

    const matchesInstitution =
      filterInstitution === "all" || student.institution === filterInstitution;
    const matchesCourse = filterCourse === "all" || student.course === filterCourse;

    const baseMatches = matchesSearch && matchesInstitution && matchesCourse;

    if (activeFilter === "at_risk") {
      const sevenDaysAgo = subDays(new Date(), 7);
      const isInactive =
        !student.last_access || new Date(student.last_access) < sevenDaysAgo;
      return baseMatches && isInactive;
    }
    if (activeFilter === "financial_aid") {
      return baseMatches && student.is_financial_aid_eligible === true;
    }
    if (activeFilter === "etec") {
      return baseMatches && (student.exam_target || "").toLowerCase().includes("etec");
    }
    if (activeFilter === "enem") {
      return baseMatches && (student.exam_target || "").toLowerCase().includes("enem");
    }
    return baseMatches;
  });

  const institutions = Array.from(new Set(students.map((s) => s.institution).filter(Boolean)));
  const courses = Array.from(new Set(students.map((s) => s.course).filter(Boolean)));

  const atRiskCount = students.filter((s) => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return !s.last_access || new Date(s.last_access) < sevenDaysAgo;
  }).length;

  const aidCount = students.filter((s) => s.is_financial_aid_eligible === true).length;

  const formatTime = (seconds: number) => {
    if (!seconds || !Number.isFinite(seconds)) return "0h";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const FILTERS = [
    { key: "all", label: "Todos", count: students.length },
    { key: "etec", label: "ETEC", count: students.filter((s) => (s.exam_target || "").toLowerCase().includes("etec")).length },
    { key: "enem", label: "ENEM", count: students.filter((s) => (s.exam_target || "").toLowerCase().includes("enem")).length },
    { key: "at_risk", label: "Em risco", count: atRiskCount },
    { key: "financial_aid", label: "Isenção", count: aidCount },
  ] as const;

  const hasFilters = !!searchTerm || activeFilter !== "all" || filterInstitution !== "all" || filterCourse !== "all";
  const clearFilters = () => {
    setSearchTerm("");
    setActiveFilter("all");
    setFilterInstitution("all");
    setFilterCourse("all");
  };
  const lastAccessLabel = (value: unknown) => {
    const d = toDate(value as string);
    if (!d) return null;
    try {
      return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
    } catch {
      return null;
    }
  };

  return (
    <div className="pb-24 space-y-5">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Professor · alunos</p>
          <h1 className="u-page-title text-3xl mt-1">Alunos</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe o acesso e o progresso de cada aluno.</p>
        </div>
      </div>

      {/* ── Contadores ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Total</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(students.length)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label !text-red-600">Em risco</p>
          <p className="u-num text-2xl mt-1 text-red-600">{fmtNumber(atRiskCount)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Isenção</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(aidCount)}</p>
        </div>
      </div>

      {/* ── Busca ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou instituição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 bg-background border border-input rounded-control pl-11 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
        <Select value={filterInstitution} onValueChange={setFilterInstitution}>
          <SelectTrigger className="h-11 rounded-control text-sm font-medium" aria-label="Instituição">
            <SelectValue placeholder="Instituição" />
          </SelectTrigger>
          <SelectContent className="rounded-control">
            <SelectItem value="all">Todas as instituições</SelectItem>
            {institutions.map((inst) => (
              <SelectItem key={inst as string} value={inst as string}>
                {inst as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="h-11 rounded-control text-sm font-medium" aria-label="Sala">
            <SelectValue placeholder="Sala / turma" />
          </SelectTrigger>
          <SelectContent className="rounded-control">
            <SelectItem value="all">Todas as salas</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c as string} value={c as string}>
                {c as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key as typeof activeFilter)}
            className={`shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold transition-colors touch-manipulation border ${
              activeFilter === f.key
                ? "bg-foreground text-background border-transparent"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span
              className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                activeFilter === f.key ? "bg-background/20" : "bg-muted"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="u-label">Carregando…</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="Nenhum aluno com esses filtros"
            description="Tente outro nome ou limpe os filtros para ver todos os alunos."
            action={{ label: "Limpar filtros", onClick: clearFilters }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum aluno cadastrado ainda"
            description="Os alunos aparecem aqui assim que a secretaria fizer o cadastro."
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStudents.slice(0, displayCount).map((student) => {
              const last = toDate(student.last_access);
              const isInactive = !last || last < subDays(new Date(), 7);
              const initials = (student.name || "A").charAt(0).toUpperCase();
              const progress = Math.max(0, Math.min(100, toNumber(student.progress) ?? 0));
              const lastLabel = lastAccessLabel(student.last_access);

              return (
                <div
                  key={student.id}
                  className="u-surface p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={`h-11 w-11 rounded-control flex items-center justify-center font-bold text-sm shrink-0 border ${
                        isInactive ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:border-red-500/30" : "bg-muted text-foreground border-border"
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Dados */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate leading-tight">
                            {student.name || "Aluno"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {student.email || "—"}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {isInactive ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:border-red-500/30 text-[11px] font-bold px-2 h-5">
                              Em risco
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-[11px] font-bold px-2 h-5">
                              Ativo
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Etiquetas */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {student.institution && (
                          <span className="text-[11px] font-semibold text-muted-foreground border border-border px-2 py-0.5 rounded-full truncate max-w-[160px]">
                            {student.institution}
                          </span>
                        )}
                        {student.exam_target && (
                          <span className="text-[11px] font-semibold text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                            {student.exam_target}
                          </span>
                        )}
                        {student.course && (
                          <span className="text-[11px] font-semibold text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                            Sala {student.course}
                          </span>
                        )}
                      </div>

                      {/* Progresso */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between u-label !tracking-[0.16em]">
                          <span>Progresso</span>
                          <span className="tabular-nums">{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Rodapé */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 text-xs">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="font-semibold tabular-nums shrink-0">
                            {formatTime(student.total_time_spent)}
                          </span>
                          {lastLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{lastLabel}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingStudent(student);
                              setEditCourse(student.course || "");
                            }}
                            className="h-9 w-9 rounded-control flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Mudar sala"
                            aria-label="Mudar sala"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            href={`/dashboard/chat/${student.id}`}
                            className="h-9 w-9 rounded-control flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Conversar"
                            aria-label="Conversar"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/dashboard/teacher/analytics?user=${student.id}`}
                            className="h-9 w-9 rounded-control flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Ver desempenho"
                            aria-label="Ver desempenho"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayCount < filteredStudents.length && (
            <button
              onClick={() => setDisplayCount((prev) => prev + 100)}
              className="w-full h-11 rounded-control border border-dashed border-border text-muted-foreground hover:text-foreground font-semibold text-sm transition-colors"
            >
              Carregar mais (+{Math.min(100, filteredStudents.length - displayCount)})
            </button>
          )}
        </>
      )}

      {/* Dialog: Sala / Turma */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) setEditingStudent(null); }}>
        <DialogContent className="rounded-card p-0 overflow-hidden w-[95vw] sm:w-full max-w-md">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                  Mudar sala
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 text-muted-foreground truncate">
                  {editingStudent?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="u-label">
                Sala / turma
              </Label>
              <Select value={editCourse} onValueChange={setEditCourse}>
                <SelectTrigger className="h-11 rounded-control font-semibold">
                  <SelectValue placeholder="Selecione a sala" />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  {Array.from({ length: 12 }, (_, i) => {
                    const num = String(i + 1).padStart(2, "0");
                    return (
                      <SelectItem key={num} value={num} className="text-sm">
                        Sala {num}
                      </SelectItem>
                    );
                  })}
                  {editCourse &&
                    !Array.from({ length: 12 }, (_, i) =>
                      String(i + 1).padStart(2, "0")
                    ).includes(editCourse) && (
                      <SelectItem value={editCourse} className="text-sm">
                        {editCourse}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingStudent(null)}
                className="flex-1 h-11 rounded-control font-bold text-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateStudentCourse}
                disabled={isSubmittingCourse}
                className="flex-1 h-11 rounded-control font-bold text-sm"
              >
                {isSubmittingCourse && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
