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

function fmt(val: number) {
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(val: number) {
  return Number(val).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-primary italic leading-none">
          Renda Per Capita
        </h1>
        <p className="text-muted-foreground font-medium italic text-sm">
          Monitore a situação socioeconômica dos alunos. Limite vigente:{" "}
          <strong className="text-primary not-italic">R$ {fmt(THRESHOLD)}/morador</strong>.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de Alunos"
          value={stats.total}
          sub="cadastrados"
          colorClass="bg-primary"
          icon={Users}
        />
        <StatCard
          label="Dentro do Limite"
          value={stats.ok}
          sub="elegíveis"
          colorClass="bg-emerald-600"
          icon={CheckCircle2}
        />
        <StatCard
          label="Excedeu Limite"
          value={stats.exceeded}
          sub="reprovados"
          colorClass="bg-red-600"
          icon={XCircle}
        />
        <StatCard
          label="Pendente"
          value={stats.pending}
          sub="sem dados de renda"
          colorClass="bg-slate-400"
          icon={HelpCircle}
        />
      </div>

      {/* Alerta se há excedidos */}
      {stats.exceeded > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            {stats.exceeded} aluno{stats.exceeded > 1 ? "s" : ""} com renda per capita acima do limite de{" "}
            <span className="font-black">R$ {fmt(THRESHOLD)}</span>. Verifique as fichas abaixo.
          </p>
        </div>
      )}

      {/* Barra de Filtros */}
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
              <SelectTrigger className="h-11 w-full lg:w-52 bg-muted/30 border-none rounded-xl font-bold text-sm shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all"      className="font-bold text-xs">Todos os Alunos</SelectItem>
                <SelectItem value="ok"       className="font-bold text-xs">Dentro do Limite</SelectItem>
                <SelectItem value="exceeded" className="font-bold text-xs">Excedeu Limite</SelectItem>
                <SelectItem value="pending"  className="font-bold text-xs">Pendente (sem dados)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
              className="h-11 px-5 rounded-xl font-black text-xs border-slate-200 bg-white gap-2 shrink-0"
            >
              {sortDir === "desc"
                ? <><TrendingDown className="h-4 w-4" /> Maior → Menor</>
                : <><TrendingUp   className="h-4 w-4" /> Menor → Maior</>
              }
            </Button>
          </>
        }
      />

      {/* Tabela */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground italic text-sm">
              Nenhum aluno encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="h-12">
                    <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Aluno</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest hidden sm:table-cell">Turma</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Renda Familiar</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Membros</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">
                      <button
                        onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-1 ml-auto font-black uppercase text-[10px] tracking-widest hover:text-primary transition-colors"
                      >
                        Per Capita
                        {sortDir === "desc"
                          ? <ArrowDown className="h-3 w-3" />
                          : <ArrowUp   className="h-3 w-3" />
                        }
                      </button>
                    </TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => {
                    const status    = incomeStatus(u);
                    const isExpanded = expandedId === u.id;
                    const delta     = u.income_per_capita > 0 ? Math.abs(u.income_per_capita - THRESHOLD) : null;

                    const rowBg = isExpanded
                      ? status === "exceeded" ? "bg-red-50/50" : status === "ok" ? "bg-emerald-50/50" : "bg-muted/10"
                      : "";
                    const rowHover =
                      status === "exceeded" ? "hover:bg-red-50/40" :
                      status === "ok"       ? "hover:bg-emerald-50/40" :
                                              "hover:bg-muted/5";

                    return (
                      <Fragment key={u.id}>
                        {/* Linha principal */}
                        <TableRow
                          className={`h-16 cursor-pointer transition-colors border-b last:border-0 ${rowBg} ${rowHover}`}
                          onClick={() => setExpandedId(isExpanded ? null : u.id)}
                        >
                          <TableCell className="px-6">
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                                status === "exceeded" ? "bg-red-500"
                                : status === "ok"     ? "bg-emerald-600"
                                :                       "bg-slate-400"
                              }`}>
                                {u.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-slate-800 truncate leading-tight">{u.name || "—"}</p>
                                <p className="text-[9px] font-black uppercase text-slate-400 truncate mt-0.5">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs font-bold text-slate-600">{u.course || "—"}</span>
                          </TableCell>

                          <TableCell className="text-right">
                            {Number(u.family_income) > 0 ? (
                              <span className="font-mono text-sm font-bold text-slate-700">
                                R$ {fmtShort(u.family_income)}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="font-black text-sm text-slate-700">
                              {Number(u.family_income) > 0 ? (u.family_size || 1) : "—"}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            {u.income_per_capita > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className={`font-black text-sm font-mono ${
                                  status === "exceeded" ? "text-red-600" : "text-emerald-700"
                                }`}>
                                  R$ {fmt(u.income_per_capita)}
                                </span>
                                {delta !== null && (
                                  <span className={`text-[9px] font-bold ${
                                    status === "exceeded" ? "text-red-400" : "text-emerald-500"
                                  }`}>
                                    {status === "exceeded"
                                      ? `+R$ ${fmtShort(delta)} acima`
                                      : `-R$ ${fmtShort(delta)} abaixo`
                                    }
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <StatusBadge status={status} />
                              {isExpanded
                                ? <ChevronDown  className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                              }
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Linha expandida — detalhes da composição familiar */}
                        {isExpanded && (
                          <TableRow className={`border-b ${
                            status === "exceeded" ? "bg-red-50/40" :
                            status === "ok"       ? "bg-emerald-50/40" :
                                                    "bg-muted/5"
                          }`}>
                            <TableCell colSpan={6} className="px-6 pb-5 pt-1">
                              <div className="rounded-2xl bg-white border border-slate-100 p-4 space-y-4">
                                {Number(u.family_income) > 0 ? (
                                  <>
                                    {/* Barra indicadora de posição em relação ao limite */}
                                    <ThresholdBar perCapita={u.income_per_capita} threshold={THRESHOLD} />

                                    {/* Resumo numérico */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <InfoBox label="Renda Familiar Total" value={`R$ ${fmt(u.family_income)}`} />
                                      <InfoBox label="Moradores" value={`${u.family_size || 1} pessoa${(u.family_size || 1) !== 1 ? "s" : ""}`} />
                                      <InfoBox
                                        label="Renda Per Capita"
                                        value={`R$ ${fmt(u.income_per_capita)}`}
                                        highlight={status === "exceeded" ? "red" : "green"}
                                      />
                                    </div>

                                    {/* Composição familiar */}
                                    {Array.isArray(u.family_members) && u.family_members.length > 0 && (
                                      <div className="space-y-1.5">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Composição Familiar</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                          {u.family_members.map((m: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                              <span className="text-[11px] font-semibold text-slate-600 truncate">
                                                {m.label || `Integrante ${i + 1}`}
                                              </span>
                                              <span className="font-mono text-[11px] font-bold text-slate-700 shrink-0 ml-2">
                                                R$ {fmt(m.income || 0)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Flag isenção manual */}
                                    {u.is_financial_aid_eligible && (
                                      <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-100">
                                        <HandHeart className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                        <p className="text-[10px] font-bold text-orange-700">
                                          Marcado como elegível para isenção social pela secretaria
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic text-center py-3">
                                    Este aluno ainda não declarou dados de renda familiar na plataforma.
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-componentes ────────���───────────────────────────────────────────────────

function StatCard({ label, value, sub, colorClass, icon: Icon }: {
  label: string; value: number; sub: string; colorClass: string; icon: React.ElementType;
}) {
  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardContent className="p-6">
        <div className={`h-10 w-10 rounded-2xl ${colorClass} flex items-center justify-center mb-3 shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-3xl font-black leading-none text-slate-900">{value}</p>
        <p className="text-sm font-black text-primary italic mt-1 leading-tight">{label}</p>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "ok" | "exceeded" | "pending" }) {
  if (status === "ok") return (
    <Badge className="border-none font-bold text-[9px] uppercase px-2 h-5 bg-emerald-100 text-emerald-700 flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" /> OK
    </Badge>
  );
  if (status === "exceeded") return (
    <Badge className="border-none font-bold text-[9px] uppercase px-2 h-5 bg-red-100 text-red-700 flex items-center gap-1">
      <XCircle className="h-3 w-3" /> Excedeu
    </Badge>
  );
  return (
    <Badge className="border-none font-bold text-[9px] uppercase px-2 h-5 bg-slate-100 text-slate-500 flex items-center gap-1">
      <HelpCircle className="h-3 w-3" /> Pendente
    </Badge>
  );
}

function ThresholdBar({ perCapita, threshold }: { perCapita: number; threshold: number }) {
  // Barra mostra a posição da renda per capita relativa ao limite (0–200% do limite)
  const max = threshold * 2;
  const pct = Math.min(100, (perCapita / max) * 100);
  const limitPct = 50; // threshold é em 50% da barra (threshold/max = 0.5)
  const exceeded = perCapita > threshold;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
        <span className="text-slate-400">R$ 0</span>
        <span className={exceeded ? "text-red-500" : "text-emerald-600"}>
          Limite: R$ {fmt(threshold)}
        </span>
        <span className="text-slate-400">R$ {fmt(threshold * 2)}</span>
      </div>
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        {/* Zona verde (até o limite) */}
        <div className="absolute left-0 top-0 h-full bg-emerald-100 rounded-full" style={{ width: `${limitPct}%` }} />
        {/* Zona vermelha (acima do limite) */}
        <div className="absolute top-0 h-full bg-red-100 rounded-full" style={{ left: `${limitPct}%`, right: 0 }} />
        {/* Linha do limite */}
        <div className="absolute top-0 h-full w-0.5 bg-slate-400" style={{ left: `${limitPct}%` }} />
        {/* Marcador da renda */}
        <div
          className={`absolute top-0.5 h-2 w-2 rounded-full shadow-sm transition-all ${exceeded ? "bg-red-600" : "bg-emerald-600"}`}
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: "red" | "green" }) {
  return (
    <div className={`rounded-xl p-3 ${
      highlight === "red"   ? "bg-red-50 border border-red-100" :
      highlight === "green" ? "bg-emerald-50 border border-emerald-100" :
                              "bg-slate-50 border border-slate-100"
    }`}>
      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wide">{label}</p>
      <p className={`font-black text-base mt-0.5 leading-tight ${
        highlight === "red"   ? "text-red-700" :
        highlight === "green" ? "text-emerald-700" :
                                "text-slate-800"
      }`}>{value}</p>
    </div>
  );
}
