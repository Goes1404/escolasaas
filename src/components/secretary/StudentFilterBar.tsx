"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

const ALL = "__all__";

export interface StudentFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  course: string; // "" = todas
  onCourseChange: (v: string) => void;
  courseOptions: string[];
  courseLabel?: string;

  institution: string; // "" = todas
  onInstitutionChange: (v: string) => void;
  institutionOptions: string[];

  examTarget?: string; // omitir esconde o filtro
  onExamTargetChange?: (v: string) => void;

  /** Filtro específico da página (ex.: status), renderizado ao final da barra. */
  extra?: React.ReactNode;

  resultCount: number;
  totalCount: number;
}

/**
 * Barra de filtros padrão para listas de alunos da secretaria/admin.
 * Turma e colégio são derivados dos dados já carregados pela página
 * (sem query extra) — mantém o padrão de filtro client-side já usado
 * em enrollments/documents/income/admin-students.
 */
export function StudentFilterBar({
  search, onSearchChange, searchPlaceholder = "Buscar por nome ou e-mail...",
  course, onCourseChange, courseOptions, courseLabel = "Turma / Sala",
  institution, onInstitutionChange, institutionOptions,
  examTarget, onExamTargetChange,
  extra,
  resultCount, totalCount,
}: StudentFilterBarProps) {
  const hasActiveFilter = !!search || !!course || !!institution || !!examTarget;

  const clearAll = () => {
    onSearchChange("");
    onCourseChange("");
    onInstitutionChange("");
    onExamTargetChange?.("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11 bg-muted/30 border-none rounded-xl font-medium text-sm"
          />
        </div>

        <Select value={course || ALL} onValueChange={(v) => onCourseChange(v === ALL ? "" : v)}>
          <SelectTrigger className="h-11 w-full lg:w-44 bg-muted/30 border-none rounded-xl font-bold text-sm">
            <SelectValue placeholder={courseLabel} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value={ALL} className="font-bold text-xs">Todas as turmas</SelectItem>
            {courseOptions.map((c) => (
              <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={institution || ALL} onValueChange={(v) => onInstitutionChange(v === ALL ? "" : v)}>
          <SelectTrigger className="h-11 w-full lg:w-48 bg-muted/30 border-none rounded-xl font-bold text-sm">
            <SelectValue placeholder="Colégio / Polo" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value={ALL} className="font-bold text-xs">Todos os colégios</SelectItem>
            {institutionOptions.map((i) => (
              <SelectItem key={i} value={i} className="font-bold text-xs">{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onExamTargetChange && (
          <Select value={examTarget || ALL} onValueChange={(v) => onExamTargetChange(v === ALL ? "" : v)}>
            <SelectTrigger className="h-11 w-full lg:w-32 bg-muted/30 border-none rounded-xl font-bold text-sm">
              <SelectValue placeholder="Foco" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value={ALL} className="font-bold text-xs">ENEM + ETEC</SelectItem>
              <SelectItem value="ENEM" className="font-bold text-xs">ENEM</SelectItem>
              <SelectItem value="ETEC" className="font-bold text-xs">ETEC</SelectItem>
            </SelectContent>
          </Select>
        )}

        {extra}

        {hasActiveFilter && (
          <Button
            variant="ghost"
            onClick={clearAll}
            className="h-11 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {hasActiveFilter && (
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
          {resultCount} de {totalCount}
        </p>
      )}
    </div>
  );
}

/** Deriva as opções (valores distintos, ordenados) de turma/colégio a partir de um array de perfis já carregado. */
export function distinctOptions(rows: Record<string, any>[], key: string): string[] {
  return Array.from(
    new Set(rows.map((r) => String(r[key] ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
