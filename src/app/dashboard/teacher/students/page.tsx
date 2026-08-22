
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  AlertCircle,
  UserCircle,
  Send,
  ShieldCheck,
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
      toast({ title: "Sala / Turma atualizada!" });
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
        toast({ title: "Falha na Sincronização", description: err.message, variant: "destructive" });
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
    if (!seconds) return "0h";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const FILTERS = [
    { key: "all", label: "Todos", count: students.length, color: "bg-[#4CCCED]" },
    { key: "etec", label: "ETEC", count: students.filter((s) => (s.exam_target || "").toLowerCase().includes("etec")).length, color: "bg-indigo-500" },
    { key: "enem", label: "ENEM", count: students.filter((s) => (s.exam_target || "").toLowerCase().includes("enem")).length, color: "bg-purple-500" },
    { key: "at_risk", label: "Em Risco", count: atRiskCount, color: "bg-red-500" },
    { key: "financial_aid", label: "Isenção", count: aidCount, color: "bg-emerald-500" },
  ] as const;

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Hero ── */}
      <div className="relative rounded-card overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, rgba(76,204,237,0.12) 0%, transparent 60%), radial-gradient(ellipse at 10% 80%, rgba(139,92,246,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85 mb-1">
              Gestão de Rede
            </p>
            <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
              Corpo Discente
            </h1>
            <p className="text-white/65 text-xs font-semibold mt-1">
              Monitoramento em tempo real
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl px-4 py-2.5 min-w-[72px]">
              <span className="text-xl font-black text-white leading-none">{students.length}</span>
              <span className="text-[9px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Total</span>
            </div>
            <div className="flex flex-col items-center bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-2.5 min-w-[72px]">
              <span className="text-xl font-black text-red-400 leading-none">{atRiskCount}</span>
              <span className="text-[9px] font-bold text-red-400/80 uppercase tracking-wider mt-0.5">Em Risco</span>
            </div>
            <div className="flex flex-col items-center bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5 min-w-[72px]">
              <span className="text-xl font-black text-emerald-400 leading-none">{aidCount}</span>
              <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-wider mt-0.5">Isenção</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Pesquisar por nome, e-mail ou polo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 bg-white shadow-sm border border-slate-200 rounded-2xl pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 focus:bg-white/8 transition-all"
        />
      </div>

      {/* ── Selects ── */}
      <div className="grid grid-cols-2 gap-3">
        <Select value={filterInstitution} onValueChange={setFilterInstitution}>
          <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 text-xs font-bold focus:ring-orange-500/30">
            <SelectValue placeholder="Instituição" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 bg-white shadow-2xl">
            <SelectItem value="all" className="text-slate-600 text-xs font-bold">Todas</SelectItem>
            {institutions.map((inst) => (
              <SelectItem key={inst as string} value={inst as string} className="text-slate-600 text-xs font-bold">
                {inst as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 text-xs font-bold focus:ring-orange-500/30">
            <SelectValue placeholder="Sala / Turma" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 bg-white shadow-2xl">
            <SelectItem value="all" className="text-slate-600 text-xs font-bold">Todas</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c as string} value={c as string} className="text-slate-600 text-xs font-bold">
                {c as string}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Filter chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key as typeof activeFilter)}
            className={`shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all touch-manipulation ${
              activeFilter === f.key
                ? `${f.color} text-slate-800 shadow-lg`
                : "bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-slate-800/80"
            }`}
          >
            {f.label}
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                activeFilter === f.key ? "bg-black/20 text-slate-800" : "bg-white/10 text-slate-600"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">
            Sincronizando...
          </p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-200 rounded-card">
          <Users className="h-10 w-10 mx-auto mb-3 text-white/10" />
          <p className="font-black italic text-slate-400 uppercase tracking-widest text-sm">
            Nenhum registro encontrado
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStudents.slice(0, displayCount).map((student) => {
              const isInactive =
                !student.last_access || new Date(student.last_access) < subDays(new Date(), 7);
              const initials = (student.name || "A").charAt(0).toUpperCase();
              const progress = student.progress || 0;

              return (
                <div
                  key={student.id}
                  className="group relative bg-white shadow-sm border border-slate-200 hover:border-[#4CCCED]/20 rounded-card p-4 transition-all hover:bg-white shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-sm text-slate-800 shrink-0 shadow-lg ${
                        isInactive ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-[#4CCCED]/20 text-orange-400 border border-[#4CCCED]/30"
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 text-sm italic truncate leading-tight">
                            {student.name || "Aluno"}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                            {student.email || "—"}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {isInactive ? (
                            <Badge className="bg-red-500/15 text-red-400 border-none text-[8px] font-black uppercase px-2 h-5">
                              Risco
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-none text-[8px] font-black uppercase px-2 h-5">
                              Ativo
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Tags row */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {student.institution && (
                          <span className="text-[9px] font-bold text-slate-600 bg-white shadow-sm px-2 py-0.5 rounded-full truncate max-w-[120px]">
                            {student.institution}
                          </span>
                        )}
                        {student.exam_target && (
                          <span className="text-[9px] font-bold text-orange-400/85 bg-[#4CCCED]/10 px-2 py-0.5 rounded-full">
                            {student.exam_target}
                          </span>
                        )}
                        {student.course && (
                          <span className="text-[9px] font-bold text-indigo-400/70 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                            Sala {student.course}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                          <span>Progresso</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1 w-full bg-white shadow-sm rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span className="text-[10px] font-black">
                            {formatTime(student.total_time_spent)}
                          </span>
                          {student.last_access && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="text-[10px] font-bold">
                                {formatDistanceToNow(new Date(student.last_access), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingStudent(student);
                              setEditCourse(student.course || "");
                            }}
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-orange-400 hover:bg-[#4CCCED]/10 transition-all active:scale-90"
                            title="Alterar Sala/Turma"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            href={`/dashboard/chat/${student.id}`}
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all active:scale-90"
                            title="Chat"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/dashboard/teacher/analytics?user=${student.id}`}
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90"
                            title="Analytics"
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
              className="w-full h-12 rounded-2xl border border-dashed border-slate-200 text-slate-500 hover:text-slate-500 hover:border-slate-300 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
            >
              Carregar mais (+{Math.min(100, filteredStudents.length - displayCount)})
            </button>
          )}
        </>
      )}

      {/* Dialog: Sala / Turma */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) setEditingStudent(null); }}>
        <DialogContent className="rounded-card border-none shadow-2xl p-0 overflow-hidden max-w-md bg-white">
          <DialogHeader className="p-8 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#4CCCED]/20 border border-[#4CCCED]/30 flex items-center justify-center shrink-0">
                <Pencil className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black italic text-slate-800 leading-none uppercase tracking-tight">
                  Mudar Sala / Turma
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 font-medium text-slate-600">
                  {editingStudent?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                Sala / Turma
              </Label>
              <Select value={editCourse} onValueChange={setEditCourse}>
                <SelectTrigger className="h-12 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold">
                  <SelectValue placeholder="Selecionar Sala" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 bg-white shadow-2xl">
                  {Array.from({ length: 12 }, (_, i) => {
                    const num = String(i + 1).padStart(2, "0");
                    return (
                      <SelectItem key={num} value={num} className="font-bold text-xs text-slate-600">
                        Sala {num}
                      </SelectItem>
                    );
                  })}
                  {editCourse &&
                    !Array.from({ length: 12 }, (_, i) =>
                      String(i + 1).padStart(2, "0")
                    ).includes(editCourse) && (
                      <SelectItem value={editCourse} className="font-bold text-xs text-slate-600">
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
                className="flex-1 h-12 rounded-2xl font-black text-xs bg-white shadow-sm border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateStudentCourse}
                disabled={isSubmittingCourse}
                className="flex-1 h-12 bg-[#4CCCED] hover:bg-orange-600 text-slate-800 font-black rounded-2xl shadow-xl border-none text-xs"
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
