"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Loader2, FileCheck, Clock, GraduationCap, School, Search, UserCheck, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { PendingEntry } from "@/app/api/admin/report-card-approvals/route";

type StudentOption = { id: string; name: string };

function StudentPicker({
  students,
  selectedId,
  onSelect,
}: {
  students: StudentOption[];
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return students.slice(0, 8);
    const q = query.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, students]);

  const selected = students.find((s) => s.id === selectedId);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={open ? query : selected?.name || query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar aluno..."
          className="h-9 pl-8 text-xs rounded-lg"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-64 max-h-56 overflow-y-auto rounded-xl border bg-white shadow-xl">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => { onSelect(s.id, s.name); setQuery(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-accent/10 transition-colors"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportCardApprovalsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Record<string, { id: string; name: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Filtros de localização
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<"all" | "enem" | "etec">("all");
  const [semesterFilter, setSemesterFilter] = useState<"all" | "1" | "2">("all");

  // O aluno atualmente vinculado a uma entry já tem boletim deste track+semestre?
  const hasReport = (entry: PendingEntry) => {
    const chosen = selections[entry.id];
    const sid = chosen?.id ?? entry.suggested_match.profileId;
    if (!sid) return false;
    return existingKeys.has(`${entry.track}:${sid}:${entry.semester}`);
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/report-card-approvals");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const fetchedEntries: PendingEntry[] = data.entries || [];
      setEntries(fetchedEntries);
      setStudents(data.students || []);
      setExistingKeys(new Set<string>(data.existing_report_keys || []));

      const initial: Record<string, { id: string; name: string }> = {};
      for (const e of fetchedEntries) {
        if (e.suggested_match.profileId && e.suggested_match.profileName) {
          initial[e.id] = { id: e.suggested_match.profileId, name: e.suggested_match.profileName };
        }
      }
      setSelections(initial);
    } catch (err: any) {
      toast({ title: "Erro ao carregar boletins pendentes", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (entry: PendingEntry) => {
    const chosen = selections[entry.id];
    if (!chosen) {
      toast({ title: "Selecione um aluno antes de aprovar", variant: "destructive" });
      return;
    }
    setBusyId(entry.id);
    try {
      const res = await fetch("/api/admin/report-card-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id: entry.id, student_id: chosen.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast({ title: "Boletim aprovado", description: `${chosen.name} · ${entry.semester}º semestre` });
    } catch (err: any) {
      toast({ title: "Falha ao aprovar", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (entry: PendingEntry, reason?: string) => {
    setBusyId(entry.id);
    try {
      const res = await fetch("/api/admin/report-card-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", id: entry.id, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast({ title: "Boletim rejeitado", description: `${entry.full_name} · ${entry.semester}º semestre` });
    } catch (err: any) {
      toast({ title: "Falha ao rejeitar", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
      setRejectReason("");
    }
  };

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const visibleEntries = useMemo(() => {
    const terms = norm(search).trim().split(/\s+/).filter(Boolean);
    return entries.filter((e) => {
      const matchesSearch = terms.length === 0 || terms.every((t) =>
        norm(e.full_name).includes(t) || norm(e.suggested_match.profileName || "").includes(t)
      );
      const matchesTrack = trackFilter === "all" || e.track === trackFilter;
      const matchesSemester = semesterFilter === "all" || String(e.semester) === semesterFilter;
      return matchesSearch && matchesTrack && matchesSemester;
    });
  }, [entries, search, trackFilter, semesterFilter]);

  const hasActiveFilter = !!search || trackFilter !== "all" || semesterFilter !== "all";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-1">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-primary italic leading-none">Boletins Pendentes</h1>
          <FileCheck className="h-6 w-6 text-accent" />
        </div>
        <p className="text-muted-foreground font-medium italic">
          Boletins importados aguardando revisão. Confirme o aluno correspondente antes de aprovar.
        </p>
      </div>

      {/* Filtros de localização */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-2.5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno na fila..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-muted/30 border-none rounded-xl font-medium text-sm"
            />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(["all", "enem", "etec"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTrackFilter(t)}
                className={`flex-1 lg:flex-none rounded-lg px-4 py-2 text-xs font-black uppercase transition-all ${trackFilter === t ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {t === "all" ? "Todos" : t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(["all", "1", "2"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSemesterFilter(s)}
                className={`flex-1 lg:flex-none rounded-lg px-4 py-2 text-xs font-black uppercase transition-all ${semesterFilter === s ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {s === "all" ? "Semestre" : `${s}º`}
              </button>
            ))}
          </div>
          {hasActiveFilter && (
            <Button variant="ghost" onClick={() => { setSearch(""); setTrackFilter("all"); setSemesterFilter("all"); }} className="h-11 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 shrink-0">
              Limpar
            </Button>
          )}
        </div>
      )}

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Clock className="h-12 w-12 text-accent animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Carregando fila de aprovação...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-300" />
              <p className="font-black italic text-xl text-primary/40 uppercase tracking-widest">Nenhum boletim pendente</p>
              <p className="text-sm text-muted-foreground font-medium">Tudo revisado. Novas importações aparecem aqui.</p>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-6">
              <Search className="h-10 w-10 text-slate-200" />
              <p className="font-black italic text-lg text-primary/40 uppercase tracking-widest">Nenhum resultado</p>
              <p className="text-sm text-muted-foreground font-medium">Nenhum boletim na fila corresponde aos filtros.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {hasActiveFilter && (
                <p className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {visibleEntries.length} de {entries.length} na fila
                </p>
              )}
              {visibleEntries.map((entry) => {
                const chosen = selections[entry.id];
                const match = entry.suggested_match;
                const alreadyHas = hasReport(entry);
                return (
                  <div key={entry.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-6 hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shadow-sm shrink-0">
                        {entry.full_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-primary text-sm italic truncate">{entry.full_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] uppercase gap-1">
                            <GraduationCap className="h-2.5 w-2.5" /> {entry.track === "enem" ? "ENEM" : "ETEC"} · {entry.semester}º sem
                          </Badge>
                          {alreadyHas && (
                            <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px] uppercase gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Já tem boletim
                            </Badge>
                          )}
                          {entry.colegio && (
                            <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                              <School className="h-2.5 w-2.5" /> {entry.colegio}{entry.sala ? ` · Sala ${entry.sala}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mt-1">
                          Importado {format(new Date(entry.imported_at), "dd/MM HH:mm")}
                          {entry.created_by_name ? ` por ${entry.created_by_name}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <p className="text-[8px] font-black uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                        <UserCheck className="h-2.5 w-2.5" /> Aluno correspondente
                      </p>
                      <StudentPicker
                        students={students}
                        selectedId={chosen?.id ?? null}
                        onSelect={(id, name) => setSelections((prev) => ({ ...prev, [entry.id]: { id, name } }))}
                      />
                      {!chosen && match.confidence === "none" && (
                        <p className="text-[9px] font-bold text-red-500 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Nenhum aluno encontrado — busque manualmente</p>
                      )}
                      {chosen && match.confidence === "low" && chosen.id === match.profileId && (
                        <p className="text-[9px] font-bold text-amber-600">Match parcial — confira antes de aprovar</p>
                      )}
                      {alreadyHas && (
                        <p className="text-[9px] font-bold text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> Este aluno já tem boletim {entry.semester}º sem — aprovar vai atualizá-lo
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center px-2">
                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-wide">Classif.</p>
                        <p className="text-sm font-black text-primary">{(entry.payload.classificatoria_score as number) ?? "--"}</p>
                      </div>
                      <div className="text-center px-2">
                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-wide">Redação</p>
                        <p className="text-sm font-black text-primary">{(entry.payload.redacao_score as number) ?? "--"}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busyId === entry.id} className="h-10 w-10 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50">
                              {busyId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-10 max-w-sm bg-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-2xl font-black italic text-primary">Rejeitar Boletim?</AlertDialogTitle>
                              <AlertDialogDescription className="font-medium text-sm">
                                O boletim de <strong>{entry.full_name}</strong> não será publicado. Descreva o motivo (opcional).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Ex: nome não encontrado no sistema, dado divergente da planilha oficial"
                              className="rounded-xl mt-2"
                            />
                            <AlertDialogFooter className="gap-3 mt-6">
                              <AlertDialogCancel onClick={() => setRejectReason("")} className="rounded-xl font-bold border-none bg-muted/30 h-12">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleReject(entry, rejectReason)}
                                className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white h-12 px-8"
                              >
                                Rejeitar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button
                          onClick={() => handleApprove(entry)}
                          disabled={busyId === entry.id || !chosen}
                          className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase rounded-xl shadow-lg disabled:opacity-40"
                        >
                          {busyId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
