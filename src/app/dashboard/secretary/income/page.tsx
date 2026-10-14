"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  HandHeart,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { StudentFilterBar, distinctOptions } from "@/components/secretary/StudentFilterBar";
import { EmptyState } from "@/components/EmptyState";
import { fmtNumber, toNumber, txt } from "@/lib/format";

// Limite de renda per capita vigente (1,5 salário mínimo ≈ R$ 2.431,50)
const THRESHOLD = 2431.50;

type StatusFilter = "all" | "ok" | "exceeded" | "pending";
type SortDir = "desc" | "asc";

function incomeStatus(u: any): "ok" | "exceeded" | "pending" {
  const inc = Number(u.family_income) || 0;
  const cap = Number(u.income_per_capita) || 0;
  if (inc === 0 || cap === 0) return "pending";
  return cap <= THRESHOLD ? "ok" : "exceeded";
}

// Valor ilegível vira 0 (nunca "NaN") — mesmo critério de incomeStatus().
function fmt(val: unknown) {
  return fmtNumber(toNumber(val) ?? 0, 2);
}

function fmtShort(val: unknown) {
  return fmtNumber(toNumber(val) ?? 0, 0);
}

export default function SecretaryIncomePage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, email, course, institution, family_income, family_size, income_per_capita, family_members, is_financial_aid_eligible, status")
          .eq("role", "student")
          .order("name");
        if (error) {
          toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
        } else {
          setStudents(data || []);
        }
      } catch (e) {
        console.error('Erro ao carregar renda per capita:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const ok       = students.filter(s => incomeStatus(s) === "ok").length;
    const exceeded = students.filter(s => incomeStatus(s) === "exceeded").length;
    const pending  = students.filter(s => incomeStatus(s) === "pending").length;
    return { total: students.length, ok, exceeded, pending };
  }, [students]);

  const courseOptions = useMemo(() => distinctOptions(students, "course"), [students]);
  const institutionOptions = useMemo(() => distinctOptions(students, "institution"), [students]);

  const filtered = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const terms = norm(search).trim().split(/\s+/).filter(Boolean);

    return students
      .filter(u => {
        const matchesSearch = terms.length === 0 ||
          terms.every(t => norm(u.name).includes(t) || norm(u.email || "").includes(t));
        const matchesStatus = statusFilter === "all" || incomeStatus(u) === statusFilter;
        const matchesCourse = !courseFilter || (u.course || "") === courseFilter;
        const matchesInstitution = !institutionFilter || (u.institution || "") === institutionFilter;
        return matchesSearch && matchesStatus && matchesCourse && matchesInstitution;
      })
      .sort((a, b) => {
        const av = Number(a.income_per_capita) || 0;
        const bv = Number(b.income_per_capita) || 0;
        if (av === 0 && bv === 0) return 0;
        if (av === 0) return 1;   // pendentes vão para o final
        if (bv === 0) return -1;
        return sortDir === "desc" ? bv - av : av - bv;
      });
  }, [students, search, statusFilter, courseFilter, institutionFilter, sortDir]);

  const hasFilter = !!search || !!courseFilter || !!institutionFilter || statusFilter !== "all";
  const clearFilters = () => { setSearch(""); setCourseFilter(""); setInstitutionFilter(""); setStatusFilter("all"); };
  const toggleSort = () => setSortDir(d => d === "desc" ? "asc" : "desc");

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div>
        <p className="u-label flex items-center gap-2"><HandHeart className="h-3.5 w-3.5" /> Secretaria · socioeconômico</p>
        <h1 className="u-page-title text-3xl mt-1">Renda per capita</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Acompanhe a situação socioeconômica dos alunos. Limite atual:{" "}
          <strong className="text-foreground">R$ {fmt(THRESHOLD)} por morador</strong>.
        </p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total de alunos" value={stats.total} sub="cadastrados" icon={Users} />
        <StatCard label="Dentro do limite" value={stats.ok} sub="elegíveis" tone="green" icon={CheckCircle2} />
        <StatCard label="Acima do limite" value={stats.exceeded} sub="não elegíveis" tone="red" icon={XCircle} />
        <StatCard label="Pendentes" value={stats.pending} sub="sem dados de renda" icon={HelpCircle} />
      </div>

      {/* Alerta se há alunos acima do limite */}
      {stats.exceeded > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-control text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">
            {stats.exceeded} aluno{stats.exceeded > 1 ? "s" : ""} com renda per capita acima do limite de{" "}
            <span className="font-bold">R$ {fmt(THRESHOLD)}</span>. Confira as fichas abaixo.
          </p>
        </div>
      )}

      {/* Filtros */}
      <StudentFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar aluno por nome ou e-mail..."
        course={courseFilter}
        onCourseChange={setCourseFilter}
        courseOptions={courseOptions}
        institution={institutionFilter}
        onInstitutionChange={setInstitutionFilter}
        institutionOptions={institutionOptions}
        resultCount={filtered.length}
        totalCount={students.length}
        extra={
          <>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-11 w-full lg:w-52 bg-muted/30 border-none rounded-control font-semibold text-sm shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all"      className="text-sm">Todos os alunos</SelectItem>
                <SelectItem value="ok"       className="text-sm">Dentro do limite</SelectItem>
                <SelectItem value="exceeded" className="text-sm">Acima do limite</SelectItem>
                <SelectItem value="pending"  className="text-sm">Pendentes (sem dados)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={toggleSort}
              className="h-11 px-5 rounded-control font-semibold text-sm gap-2 shrink-0"
            >
              {sortDir === "desc"
                ? <><TrendingDown className="h-4 w-4" /> Maior → menor</>
                : <><TrendingUp   className="h-4 w-4" /> Menor → maior</>
              }
            </Button>
          </>
        }
      />

      {/* Lista */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={students.length === 0 ? "Nenhum aluno cadastrado" : "Nenhum aluno com esses filtros"}
          description={students.length === 0
            ? "Quando houver alunos cadastrados, a renda declarada por eles aparece aqui."
            : "Tente outro nome ou limpe os filtros para ver todos."}
          action={hasFilter ? { label: "Limpar filtros", onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          {/* Celular: cartões empilhados */}
          <div className="sm:hidden space-y-2">
            {filtered.map(u => {
              const status = incomeStatus(u);
              const isExpanded = expandedId === u.id;
              const hasPerCapita = Number(u.income_per_capita) > 0;
              return (
                <div key={u.id} className="rounded-card border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="w-full p-4 text-left space-y-3"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{txt(u.name)}</p>
                        <p className="text-xs text-muted-foreground truncate">{txt(u.course, "Sem turma")}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={status} />
                        {isExpanded
                          ? <ChevronDown  className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="min-w-0">
                        <p className="u-label !tracking-wider">Renda</p>
                        <p className="u-num text-sm mt-1 truncate">{Number(u.family_income) > 0 ? `R$ ${fmtShort(u.family_income)}` : "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="u-label !tracking-wider">Moradores</p>
                        <p className="u-num text-sm mt-1">{Number(u.family_income) > 0 ? (u.family_size || 1) : "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="u-label !tracking-wider">Per capita</p>
                        <p className={`u-num text-sm mt-1 truncate ${hasPerCapita ? (status === "exceeded" ? "text-red-600" : "text-emerald-700") : ""}`}>
                          {hasPerCapita ? `R$ ${fmtShort(u.income_per_capita)}` : "—"}
                        </p>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <IncomeDetail u={u} status={status} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Telas maiores: tabela */}
          <Card className="hidden sm:block rounded-card shadow-none overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="h-12">
                      <TableHead className="px-6 u-label">Aluno</TableHead>
                      <TableHead className="u-label">Turma</TableHead>
                      <TableHead className="u-label text-right">Renda familiar</TableHead>
                      <TableHead className="u-label text-center">Moradores</TableHead>
                      <TableHead className="u-label text-right">
                        <button
                          onClick={toggleSort}
                          className="flex items-center gap-1 ml-auto u-label hover:text-foreground transition-colors"
                        >
                          Per capita
                          {sortDir === "desc"
                            ? <ArrowDown className="h-3 w-3" />
                            : <ArrowUp   className="h-3 w-3" />
                          }
                        </button>
                      </TableHead>
                      <TableHead className="u-label text-right pr-6">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => {
                      const status     = incomeStatus(u);
                      const isExpanded = expandedId === u.id;
                      const perCapita  = toNumber(u.income_per_capita) ?? 0;
                      const delta      = perCapita > 0 ? Math.abs(perCapita - THRESHOLD) : null;

                      return (
                        <Fragment key={u.id}>
                          {/* Linha principal */}
                          <TableRow
                            className={`h-16 cursor-pointer transition-colors border-b last:border-0 hover:bg-muted/30 ${isExpanded ? "bg-muted/20" : ""}`}
                            onClick={() => setExpandedId(isExpanded ? null : u.id)}
                          >
                            <TableCell className="px-6">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-control flex items-center justify-center font-bold text-xs bg-muted text-foreground shrink-0">
                                  {u.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate leading-tight">{txt(u.name)}</p>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{txt(u.email, "")}</p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="text-sm text-muted-foreground">{txt(u.course)}</span>
                            </TableCell>

                            <TableCell className="text-right">
                              {Number(u.family_income) > 0 ? (
                                <span className="u-num text-sm">R$ {fmtShort(u.family_income)}</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <span className="u-num text-sm">
                                {Number(u.family_income) > 0 ? (u.family_size || 1) : "—"}
                              </span>
                            </TableCell>

                            <TableCell className="text-right">
                              {perCapita > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className={`u-num text-sm ${status === "exceeded" ? "text-red-600" : "text-emerald-700"}`}>
                                    R$ {fmt(perCapita)}
                                  </span>
                                  {delta !== null && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {status === "exceeded"
                                        ? `R$ ${fmtShort(delta)} acima`
                                        : `R$ ${fmtShort(delta)} abaixo`
                                      }
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-2">
                                <StatusBadge status={status} />
                                {isExpanded
                                  ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                }
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Linha expandida — composição familiar */}
                          {isExpanded && (
                            <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={6} className="px-6 pb-5 pt-1">
                                <IncomeDetail u={u} status={status} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

/** Detalhe da ficha (barra do limite, resumo e composição familiar) — igual no celular e na tabela. */
function IncomeDetail({ u, status }: { u: any; status: "ok" | "exceeded" | "pending" }) {
  const perCapita = toNumber(u.income_per_capita) ?? 0;
  return (
    <div className="rounded-control bg-card border border-border p-4 space-y-4">
      {Number(u.family_income) > 0 ? (
        <>
          <ThresholdBar perCapita={perCapita} threshold={THRESHOLD} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoBox label="Renda familiar total" value={`R$ ${fmt(u.family_income)}`} />
            <InfoBox label="Moradores" value={`${u.family_size || 1} pessoa${(u.family_size || 1) !== 1 ? "s" : ""}`} />
            <InfoBox
              label="Renda per capita"
              value={`R$ ${fmt(perCapita)}`}
              highlight={status === "exceeded" ? "red" : "green"}
            />
          </div>

          {Array.isArray(u.family_members) && u.family_members.length > 0 && (
            <div className="space-y-1.5">
              <p className="u-label">Composição familiar</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {u.family_members.map((m: any, i: number) => (
                  <div key={i} className="flex justify-between items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-control">
                    <span className="text-xs text-muted-foreground truncate">
                      {txt(m?.label, `Integrante ${i + 1}`)}
                    </span>
                    <span className="u-num text-xs shrink-0">
                      R$ {fmt(m?.income || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {u.is_financial_aid_eligible && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-control border border-border">
              <HandHeart className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs font-semibold">
                Marcado pela secretaria como elegível para isenção social
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">
          Este aluno ainda não informou a renda familiar na plataforma.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone, icon: Icon }: {
  label: string; value: number; sub: string; tone?: "green" | "red"; icon: React.ElementType;
}) {
  const color = tone === "green" ? "!text-emerald-600" : tone === "red" ? "!text-red-600" : "";
  const numColor = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "";
  return (
    <Card className="rounded-card shadow-none">
      <CardContent className="p-4 sm:p-5">
        <p className={`u-label flex items-center gap-2 ${color}`}><Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span></p>
        <p className={`u-num text-2xl sm:text-3xl leading-none mt-2 ${numColor}`}>{fmtNumber(value)}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "ok" | "exceeded" | "pending" }) {
  if (status === "ok") return (
    <Badge className="border-none font-bold text-[10px] px-2 h-5 bg-emerald-100 text-emerald-700 flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" /> Dentro
    </Badge>
  );
  if (status === "exceeded") return (
    <Badge className="border-none font-bold text-[10px] px-2 h-5 bg-red-100 text-red-700 flex items-center gap-1">
      <XCircle className="h-3 w-3" /> Acima
    </Badge>
  );
  return (
    <Badge className="border-none font-bold text-[10px] px-2 h-5 bg-muted text-muted-foreground flex items-center gap-1">
      <HelpCircle className="h-3 w-3" /> Pendente
    </Badge>
  );
}

function ThresholdBar({ perCapita, threshold }: { perCapita: number; threshold: number }) {
  // Barra mostra a posição da renda per capita relativa ao limite (0–200% do limite)
  const max = threshold * 2;
  const pct = max > 0 ? Math.max(0, Math.min(100, (perCapita / max) * 100)) : 0;
  const limitPct = 50; // threshold é em 50% da barra (threshold/max = 0.5)
  const exceeded = perCapita > threshold;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 u-label !tracking-wider">
        <span>R$ 0</span>
        <span className={exceeded ? "text-red-600" : "text-emerald-600"}>
          Limite: R$ {fmt(threshold)}
        </span>
        <span className="hidden sm:inline">R$ {fmt(threshold * 2)}</span>
      </div>
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 h-full bg-emerald-100 rounded-full" style={{ width: `${limitPct}%` }} />
        <div className="absolute top-0 h-full bg-red-100 rounded-full" style={{ left: `${limitPct}%`, right: 0 }} />
        <div className="absolute top-0 h-full w-0.5 bg-muted-foreground/60" style={{ left: `${limitPct}%` }} />
        <div
          className={`absolute top-0.5 h-2 w-2 rounded-full ${exceeded ? "bg-red-600" : "bg-emerald-600"}`}
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: "red" | "green" }) {
  return (
    <div className={`rounded-control p-3 border ${
      highlight === "red"   ? "bg-red-50 border-red-100" :
      highlight === "green" ? "bg-emerald-50 border-emerald-100" :
                              "bg-muted/40 border-border"
    }`}>
      <p className="u-label !tracking-wider">{label}</p>
      <p className={`u-num text-base mt-1 leading-tight ${
        highlight === "red"   ? "text-red-700" :
        highlight === "green" ? "text-emerald-700" :
                                ""
      }`}>{value}</p>
    </div>
  );
}
