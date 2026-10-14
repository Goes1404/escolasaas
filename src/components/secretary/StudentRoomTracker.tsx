"use client";

import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, MapPin, UserRound, ArrowLeft, DoorOpen } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { fmtDate, txt } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

interface StudentHit { id: string; name: string; course: string | null }
interface AttendanceRow {
  status: string;
  left_early: boolean | null;
  session: { session_date: string; class_label: string | null; title: string | null; subject: string | null; teacher_name: string | null } | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  presente:    { label: "Presente",    cls: "bg-emerald-50 text-emerald-700" },
  ausente:     { label: "Ausente",     cls: "bg-red-50 text-red-600" },
  justificado: { label: "Justificado", cls: "bg-muted text-foreground" },
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
      <DialogContent className="rounded-card p-0 overflow-hidden w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="u-label">Secretaria · frequência</p>
              <DialogTitle className="u-page-title text-lg mt-0.5">
                Rastrear sala
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                Veja em qual sala o aluno esteve em cada dia.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Buscar aluno pelo nome..."
                  value={query}
                  onChange={(e) => runSearch(e.target.value)}
                  className="pl-10 h-11 bg-muted/30 border-none rounded-control text-sm"
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
                      className="w-full flex items-center gap-3 p-3 rounded-control hover:bg-muted/50 border border-border transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-control bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{txt(h.name, "Aluno")}</p>
                        <p className="u-label mt-0.5 truncate">{h.course || "Sem turma"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.trim().length >= 2 ? (
                <EmptyState compact icon={Search} title="Nenhum aluno encontrado" description="Confira a grafia ou tente só o primeiro nome." />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Digite pelo menos 2 letras do nome.</p>
              )}
            </>
          ) : (
            <>
              <button onClick={reset} className="u-label flex items-center gap-1.5 hover:text-foreground transition-colors">
                <ArrowLeft className="h-3 w-3" /> Outro aluno
              </button>
              <div className="flex items-center gap-3 p-3 rounded-control border border-border">
                <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{txt(selected.name, "Aluno")}</p>
                  <p className="u-label mt-0.5 truncate">Turma atual: {selected.course || "não definida"}</p>
                </div>
              </div>

              {loadingRows ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : rows.length === 0 ? (
                <EmptyState compact icon={DoorOpen} title="Nenhuma chamada registrada" description="Quando este aluno aparecer em uma chamada, a sala de cada dia aparece aqui." secondary={{ label: "Buscar outro aluno", onClick: reset }} />
              ) : (
                <div className="space-y-2">
                  {rows.map((r, i) => {
                    const meta = STATUS_META[r.status] || { label: r.status, cls: "bg-muted text-muted-foreground" };
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-control border border-border">
                        <div className="text-center shrink-0 w-12">
                          <p className="u-label leading-none !tracking-widest">
                            {r.session?.session_date ? fmtDate(r.session.session_date, "MMM", "") : ""}
                          </p>
                          <p className="u-num text-lg leading-none mt-1">
                            {r.session?.session_date ? fmtDate(r.session.session_date, "dd") : "—"}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-sm font-semibold truncate">
                              {r.session?.class_label || "Sala não informada"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {r.session?.subject || r.session?.title || "Aula"}
                            {r.session?.teacher_name ? ` · ${r.session.teacher_name}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={`border-none font-bold text-[10px] px-2 h-5 ${meta.cls}`}>{meta.label}</Badge>
                          {r.left_early && (
                            <span className="text-[10px] font-semibold text-muted-foreground">Saiu antes</span>
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
