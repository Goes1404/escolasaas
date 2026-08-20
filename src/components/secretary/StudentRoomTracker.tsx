"use client";

import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, MapPin, UserRound, ArrowLeft, DoorOpen } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StudentHit { id: string; name: string; course: string | null }
interface AttendanceRow {
  status: string;
  left_early: boolean | null;
  session: { session_date: string; class_label: string | null; title: string | null; subject: string | null; teacher_name: string | null } | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  presente:    { label: "Presente",    cls: "bg-emerald-50 text-emerald-700" },
  ausente:     { label: "Ausente",     cls: "bg-red-50 text-red-600" },
  justificado: { label: "Justificado", cls: "bg-amber-50 text-amber-700" },
};

/**
 * Rastreamento de sala: consulta exata da sala/turma que um aluno
 * frequentou em cada dia. Lê attendance_records (RLS staff/admin/teacher)
 * juntando class_sessions para trazer a sala (class_label) e a data.
 */
export function StudentRoomTracker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const safe = q.replace(/[%_,()]/g, " ");
    const { data } = await supabase
      .from("profiles")
      .select("id, name, course")
      .eq("role", "student")
      .ilike("name", `%${safe}%`)
      .order("name")
      .limit(8);
    setHits((data as StudentHit[]) || []);
    setSearching(false);
  }, []);

  const selectStudent = useCallback(async (student: StudentHit) => {
    setSelected(student);
    setLoadingRows(true);
    setRows([]);
    const { data } = await supabase
      .from("attendance_records")
      .select("status, left_early, session:class_sessions(session_date, class_label, title, subject, teacher_name)")
      .eq("student_id", student.id);
    const sorted = ((data as any[]) || [])
      .filter(r => r.session)
      .sort((a, b) => (b.session.session_date || "").localeCompare(a.session.session_date || ""));
    setRows(sorted as AttendanceRow[]);
    setLoadingRows(false);
  }, []);

  const reset = () => { setSelected(null); setRows([]); };
  const handleClose = () => { setQuery(""); setHits([]); reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b border-primary/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black italic text-primary leading-none uppercase tracking-tight">
                Rastrear Sala
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 font-medium text-muted-foreground">
                Veja em qual sala o aluno esteve em cada dia.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  autoFocus
                  placeholder="Buscar aluno pelo nome..."
                  value={query}
                  onChange={(e) => runSearch(e.target.value)}
                  className="pl-10 h-11 bg-muted/30 border-none rounded-xl font-medium text-sm"
                />
              </div>
              {searching ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : hits.length > 0 ? (
                <div className="space-y-1.5">
                  {hits.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => selectStudent(h)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary shrink-0">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 truncate">{h.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{h.course || "Sem turma"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.trim().length >= 2 ? (
                <p className="py-8 text-center text-xs text-slate-400 italic">Nenhum aluno encontrado.</p>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400 italic">Digite ao menos 2 letras do nome.</p>
              )}
            </>
          ) : (
            <>
              <button onClick={reset} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors">
                <ArrowLeft className="h-3 w-3" /> Outro aluno
              </button>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary shrink-0">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{selected.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Turma atual: {selected.course || "não definida"}</p>
                </div>
              </div>

              {loadingRows ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400 italic">Nenhum registro de presença encontrado para este aluno.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((r, i) => {
                    const meta = STATUS_META[r.status] || { label: r.status, cls: "bg-slate-100 text-slate-500" };
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-center shrink-0 w-12">
                          <p className="text-[9px] font-black uppercase text-slate-400 leading-none">
                            {r.session?.session_date ? format(new Date(r.session.session_date + "T12:00:00"), "MMM", { locale: ptBR }) : ""}
                          </p>
                          <p className="text-lg font-black text-slate-800 leading-none">
                            {r.session?.session_date ? format(new Date(r.session.session_date + "T12:00:00"), "dd") : "--"}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-sm font-black text-slate-800 truncate">
                              {r.session?.class_label || "Sala não informada"}
                            </span>
                          </div>
                          <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">
                            {r.session?.subject || r.session?.title || "Aula"}
                            {r.session?.teacher_name ? ` · ${r.session.teacher_name}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={`border-none font-black text-[9px] uppercase px-2 h-5 ${meta.cls}`}>{meta.label}</Badge>
                          {r.left_early && (
                            <span className="text-[8px] font-black uppercase text-orange-600">Saiu antes</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
