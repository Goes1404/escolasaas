"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ClipboardCheck,
  Loader2,
  Search,
  PlusCircle,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  UserMinus,
  BookOpen,
  Users,
  X,
  FileText,
  UserCheck,
  Camera,
  ImageIcon,
  FileSpreadsheet,
  Link2,
  LogOut,
  MapPin,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StudentRoomTracker } from "@/components/secretary/StudentRoomTracker";
import { fmtDate, txt } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

type AttendanceStatus = "presente" | "ausente" | "justificado";
type AttendanceMethod = "app" | "manual" | "override";
interface AttendanceCell {
  status: AttendanceStatus;
  justification: string;
  method: AttendanceMethod;
  leftEarly: boolean;
  leftEarlyTime: string;
}
interface ImportRow {
  rawName: string;
  matchedStudent: any | null;
  manualStudentId: string;
  status: "presente" | "ausente";
}

export default function SecretaryAttendancePage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();

  // Lista de sessões e professores
  const [sessions, setSessions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // Loading
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [savingSession, setSavingSession] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Diálogos / Estados
  const [createOpen, setCreateOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [classFilter, setClassFilter] = useState("all");

  // Formulário Nova Sessão
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newClassLabel, setNewClassLabel] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newType, setNewType] = useState("presencial");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  // Estado da Chamada
  const [records, setRecords] = useState<Record<string, AttendanceCell>>({});
  // Snapshot do estado inicial para detectar sobrescritas em check-ins via app
  const [originals, setOriginals] = useState<Record<string, { status: AttendanceStatus; method: AttendanceMethod }>>({});
  const [searchStudent, setSearchStudent] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);

  // Upload de foto da chamada em papel
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Importação de planilha Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Diálogo de confirmação para sobrescritas (audit)
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingOverrides, setPendingOverrides] = useState<string[]>([]); // student ids

  // Título gerado a partir da data + turma + matéria (ex.: "10/07 · Sala 05 · Matemática"),
  // pra deixar o Histórico de Aulas legível sem depender de digitação manual.
  // Some enquanto o campo não for editado à mão (titleTouched).
  const generateSessionTitle = useCallback((dateStr: string, classLabel: string, subject: string) => {
    const parts: string[] = [];
    if (dateStr) {
      const [y, m, d] = dateStr.split("-");
      if (y && m && d) parts.push(`${d}/${m}`);
    }
    if (classLabel) parts.push(classLabel.startsWith("Sala") ? classLabel : `Sala ${classLabel}`);
    if (subject.trim()) parts.push(subject.trim());
    return parts.join(" · ");
  }, []);

  useEffect(() => {
    if (!createOpen || titleTouched) return;
    setNewTitle(generateSessionTitle(newDate, newClassLabel, newSubject));
  }, [createOpen, titleTouched, newDate, newClassLabel, newSubject, generateSessionTitle]);

  // Busca inicial: sessões, professores e alunos
  const fetchData = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const [sessionsRes, teachersRes, studentsRes] = await Promise.all([
        supabase.from("class_sessions").select("*").order("session_date", { ascending: false }),
        supabase.from("profiles").select("id, name").in("role", ["teacher", "admin"]),
        supabase.from("profiles").select("id, name, course, institution").eq("role", "student").order("name"),
      ]);

      setSessions(sessionsRes.data || []);
      setTeachers(teachersRes.data || []);
      setStudents(studentsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Criação de nova sessão
  const handleCreateSession = async () => {
    if (!newTitle.trim() || !newTeacherId || !newClassLabel) {
      toast({ title: "Erro", description: "Título, professor e sala/turma são obrigatórios.", variant: "destructive" });
      return;
    }
    setSavingSession(true);
    try {
      const teacher = teachers.find(t => t.id === newTeacherId);
      const payload = {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        subject: newSubject.trim() || null,
        class_label: newClassLabel,
        session_date: newDate,
        session_type: newType,
        teacher_id: newTeacherId,
        teacher_name: teacher ? teacher.name : "Professor",
      };

      const { data, error } = await supabase.from("class_sessions").insert(payload).select().single();
      if (error) throw error;

      toast({ title: "Aula criada" });
      setSessions(prev => [data, ...prev]);
      setCreateOpen(false);

      // Abre automaticamente a chamada para a sessão criada
      handleOpenAttendance(data);
    } catch (err: any) {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    } finally {
      setSavingSession(false);
    }
  };

  // Abre os detalhes da chamada de uma sessão
  const handleOpenAttendance = async (sessionItem: any) => {
    setSelectedSession(sessionItem);
    setLoadingDetails(true);
    setRecords({});
    setOriginals({});
    try {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("student_id, status, justification, method, left_early, left_early_time")
        .eq("session_id", sessionItem.id);

      if (error) throw error;

      const initial: Record<string, AttendanceCell> = {};
      const snap: Record<string, { status: AttendanceStatus; method: AttendanceMethod }> = {};

      // Popula com o que já foi salvo
      data.forEach((r: any) => {
        const cell: AttendanceCell = {
          status: r.status,
          justification: r.justification || "",
          method: (r.method as AttendanceMethod) || "manual",
          leftEarly: !!r.left_early,
          leftEarlyTime: r.left_early_time || "",
        };
        initial[r.student_id] = cell;
        snap[r.student_id] = { status: cell.status, method: cell.method };
      });

      // Pré-carrega alunos da mesma turma da sessão (se houver) como "ausente" para facilitar bulk
      const sessionClass = sessionItem.class_label;
      const rosterPool = sessionClass
        ? students.filter(s => (s.course || "").trim() === sessionClass)
        : students;

      rosterPool.forEach(s => {
        if (!initial[s.id]) {
          initial[s.id] = { status: "ausente", justification: "", method: "manual", leftEarly: false, leftEarlyTime: "" };
        }
      });

      setRecords(initial);
      setOriginals(snap);
    } catch (err: any) {
      toast({ title: "Erro ao carregar detalhes", description: err.message, variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Atualiza presença localmente
  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        // "Saiu antes" só faz sentido se o aluno esteve presente.
        ...(status !== "presente" ? { leftEarly: false, leftEarlyTime: "" } : {}),
      },
    }));
  };

  const toggleLeftEarly = (studentId: string) => {
    setRecords(prev => {
      const current = prev[studentId];
      const next = !current.leftEarly;
      return { ...prev, [studentId]: { ...current, leftEarly: next, leftEarlyTime: next ? current.leftEarlyTime : "" } };
    });
  };

  const setLeftEarlyTime = (studentId: string, time: string) => {
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], leftEarlyTime: time } }));
  };

  const setJustification = (studentId: string, text: string) => {
    setRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], justification: text } }));
  };

  // Adiciona um aluno à chamada manualmente
  const handleAddStudent = async (studentId: string) => {
    if (!selectedSession) return;
    setAddingId(studentId);
    try {
      const { error } = await supabase.from("attendance_records").insert({
        session_id: selectedSession.id,
        student_id: studentId,
        status: "ausente",
        method: "manual"
      });
      if (error) throw error;
      setRecords(prev => ({
        ...prev,
        [studentId]: { status: "ausente", justification: "", method: "manual", leftEarly: false, leftEarlyTime: "" }
      }));
      toast({ title: "Aluno adicionado à lista" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar aluno", description: err.message, variant: "destructive" });
    } finally {
      setAddingId(null);
    }
  };

  // Remove um aluno da chamada
  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedSession) return;
    setRemovingId(studentId);
    try {
      const { error } = await supabase
        .from("attendance_records")
        .delete()
        .eq("session_id", selectedSession.id)
        .eq("student_id", studentId);
      if (error) throw error;
      setRecords(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setOriginals(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      toast({ title: "Aluno removido da lista" });
    } catch (err: any) {
      toast({ title: "Erro ao remover aluno", description: err.message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  // Adiciona todos os alunos à chamada
  const handleAddAll = async () => {
    if (!selectedSession) return;
    const toAdd = students.filter(s => !records[s.id]);
    if (toAdd.length === 0) {
      toast({ title: "Todos os alunos já estão na lista" });
      return;
    }
    setAddingAll(true);
    try {
      const payload = toAdd.map(s => ({
        session_id: selectedSession.id,
        student_id: s.id,
        status: "ausente",
        method: "manual"
      }));
      const { error } = await supabase
        .from("attendance_records")
        .upsert(payload, { onConflict: "session_id,student_id" });
      if (error) throw error;
      
      setRecords(prev => {
        const next = { ...prev };
        toAdd.forEach(s => {
          next[s.id] = { status: "ausente", justification: "", method: "manual", leftEarly: false, leftEarlyTime: "" };
        });
        return next;
      });
      toast({ title: `${toAdd.length} alunos adicionados à lista` });
      setShowAddPanel(false);
    } catch (err: any) {
      toast({ title: "Erro ao adicionar todos", description: err.message, variant: "destructive" });
    } finally {
      setAddingAll(false);
    }
  };

  // Detecta sobrescritas de check-ins originados no app (method='app')
  const computeOverrides = (): string[] => {
    return Object.entries(records)
      .filter(([studentId, rec]) => {
        const orig = originals[studentId];
        if (!orig || orig.method !== "app") return false;
        return orig.status !== rec.status;
      })
      .map(([studentId]) => studentId);
  };

  // Passo 1 do save: se há sobrescritas de app, exige justificativa via dialog
  const handleSaveAttendance = () => {
    if (!selectedSession) return;
    const overrides = computeOverrides();
    if (overrides.length > 0) {
      setPendingOverrides(overrides);
      setOverrideReason("");
      setOverrideOpen(true);
      return;
    }
    persistAttendance([]);
  };

  // Passo 2: executa o upsert e, se houver overrides, registra audit log
  const persistAttendance = async (overrideIds: string[]) => {
    if (!selectedSession || !user) return;
    if (overrideIds.length > 0 && !overrideReason.trim()) {
      toast({ title: "Motivo obrigatório", description: "Explique a alteração para ficar no registro de auditoria.", variant: "destructive" });
      return;
    }
    setSavingAttendance(true);
    try {
      const overrideSet = new Set(overrideIds);
      const payload = Object.entries(records).map(([studentId, rec]) => {
        const orig = originals[studentId];
        let method: AttendanceMethod;
        if (overrideSet.has(studentId)) {
          method = "override";
        } else if (orig?.method === "app") {
          method = "app"; // não foi tocado, mantém origem
        } else {
          method = "manual";
        }
        return {
          session_id: selectedSession.id,
          student_id: studentId,
          status: rec.status,
          justification: rec.justification || null,
          method,
          left_early: rec.status === "presente" && rec.leftEarly,
          left_early_time: rec.status === "presente" && rec.leftEarly ? (rec.leftEarlyTime || null) : null,
          recorded_by: user.id, // auditoria: quem lançou/atualizou a chamada
        };
      });

      const { data: upserted, error } = await supabase
        .from("attendance_records")
        .upsert(payload, { onConflict: "session_id,student_id" })
        .select("id, student_id, status, method");
      if (error) throw error;

      // Audit log para sobrescritas de app
      if (overrideIds.length > 0 && upserted) {
        const lookup: Record<string, { id: string; status: string; method: string }> = {};
        upserted.forEach((r: any) => { lookup[r.student_id] = r; });
        const auditPayload = overrideIds.map(studentId => {
          const rec = lookup[studentId];
          const orig = originals[studentId];
          return {
            attendance_record_id: rec.id,
            session_id: selectedSession.id,
            student_id: studentId,
            changed_by: user.id,
            changed_by_name: profile?.name || profile?.full_name || null,
            previous_status: orig?.status || null,
            new_status: rec.status,
            previous_method: orig?.method || null,
            new_method: rec.method,
            reason: overrideReason.trim(),
          };
        });
        const { error: auditErr } = await supabase.from("attendance_audit").insert(auditPayload);
        if (auditErr) throw auditErr;
      }

      toast({
        title: "Frequência salva",
        description: overrideIds.length > 0
          ? `${overrideIds.length} sobrescrita${overrideIds.length > 1 ? "s" : ""} registrada${overrideIds.length > 1 ? "s" : ""} no registro de auditoria.`
          : undefined,
      });
      setOverrideOpen(false);
      setOverrideReason("");
      setPendingOverrides([]);
      setSelectedSession(null);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingAttendance(false);
    }
  };

  // Upload da foto da chamada em papel
  const handleUploadPhoto = async (file: File) => {
    if (!selectedSession || !user) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `attendance-photos/${selectedSession.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("learning-contents")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from("learning-contents")
        .getPublicUrl(path);
      const { error: updateErr } = await supabase
        .from("class_sessions")
        .update({ paper_photo_url: urlData.publicUrl })
        .eq("id", selectedSession.id);
      if (updateErr) throw updateErr;
      setSelectedSession((prev: any) => ({ ...prev, paper_photo_url: urlData.publicUrl }));
      setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, paper_photo_url: urlData.publicUrl } : s));
      toast({ title: "Foto da chamada salva" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Helpers de matching por nome ──────────────────────────────
  const normalizeName = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z\s]/g, "")
      .trim()
      .replace(/\s+/g, " ");

  const matchStudentByName = (rawName: string): any | null => {
    const norm = normalizeName(rawName);
    if (!norm || norm.length < 2) return null;
    // 1. Exact match
    const exact = students.find(s => normalizeName(s.name) === norm);
    if (exact) return exact;
    // 2. All Excel words found in profile name
    const words = norm.split(" ").filter(w => w.length > 2);
    if (words.length >= 2) {
      const wordMatch = students.find(s => {
        const pn = normalizeName(s.name);
        return words.every(w => pn.includes(w));
      });
      if (wordMatch) return wordMatch;
    }
    // 3. All profile name words found in Excel name (handles abbreviated names)
    const partialMatch = students.find(s => {
      const profileWords = normalizeName(s.name).split(" ").filter(w => w.length > 2);
      return profileWords.length >= 2 && profileWords.every(w => norm.includes(w));
    });
    return partialMatch || null;
  };

  // ── Processa o arquivo Excel/CSV ──────────────────────────────
  const handleExcelFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (!rows || rows.length === 0) {
        toast({ title: "Planilha vazia", variant: "destructive" }); return;
      }

      // Detecta coluna de nome e de status a partir do cabeçalho
      const headerRow = (rows[0] || []).map((h: any) => String(h ?? "").toLowerCase());
      const nameKw = ["nome", "aluno", "name", "estudante", "student"];
      const statusKw = ["status", "presen", "frequen", "sit", "chamada"];

      let nameColIdx = 0;
      let statusColIdx = -1;
      const hasHeader = headerRow.some(h => nameKw.some(k => h.includes(k)));

      if (hasHeader) {
        const ni = headerRow.findIndex(h => nameKw.some(k => h.includes(k)));
        if (ni >= 0) nameColIdx = ni;
        const si = headerRow.findIndex(h => statusKw.some(k => h.includes(k)));
        if (si >= 0) statusColIdx = si;
      }

      const dataRows = hasHeader ? rows.slice(1) : rows;
      const parsed: ImportRow[] = [];

      for (const row of dataRows) {
        const rawName = String(row[nameColIdx] ?? "").trim();
        if (!rawName || rawName.length < 2) continue;

        let status: "presente" | "ausente" = "presente";
        if (statusColIdx >= 0) {
          const rs = String(row[statusColIdx] ?? "").toLowerCase().trim();
          if (["a", "f", "ausente", "falta", "0", "nao", "não", "false"].includes(rs)) {
            status = "ausente";
          }
        }

        parsed.push({
          rawName,
          matchedStudent: matchStudentByName(rawName),
          manualStudentId: "",
          status,
        });
      }

      if (parsed.length === 0) {
        toast({ title: "Nenhum nome válido encontrado na planilha", variant: "destructive" }); return;
      }

      setImportRows(parsed);
      setImportModalOpen(true);
    } catch (err: any) {
      toast({ title: "Erro ao ler planilha", description: err.message, variant: "destructive" });
    }
  };

  // ── Confirma importação e grava no banco ──────────────────────
  const handleConfirmImport = async () => {
    if (!selectedSession) return;
    setImportingExcel(true);
    try {
      const toInsert = importRows
        .map(row => ({
          session_id: selectedSession.id,
          student_id: row.matchedStudent?.id || row.manualStudentId || null,
          status: row.status,
          method: "manual" as AttendanceMethod,
        }))
        .filter(r => r.student_id);

      if (toInsert.length === 0) {
        toast({ title: "Nenhum aluno vinculado para importar", variant: "destructive" }); return;
      }

      const { error } = await supabase
        .from("attendance_records")
        .upsert(toInsert, { onConflict: "session_id,student_id" });
      if (error) throw error;

      // Atualiza estado local
      setRecords(prev => {
        const next = { ...prev };
        for (const item of toInsert) {
          next[item.student_id!] = { status: item.status as AttendanceStatus, justification: "", method: "manual", leftEarly: false, leftEarlyTime: "" };
        }
        return next;
      });

      const skipped = importRows.filter(r => !r.matchedStudent?.id && !r.manualStudentId).length;
      toast({
        title: `${toInsert.length} aluno(s) importados`,
        description: skipped > 0 ? `${skipped} nome(s) ignorados por não terem sido vinculados.` : undefined,
      });
      setImportModalOpen(false);
      setImportRows([]);
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setImportingExcel(false);
    }
  };

  // Filtra alunos na lista de chamada
  const filteredStudents = students.filter(s => {
    if (!records[s.id]) return false; // apenas na chamada
    return (s.name || "").toLowerCase().includes(searchStudent.toLowerCase());
  });

  const availableStudents = students.filter(
    (s) =>
      records[s.id] === undefined &&
      (!addSearch || s.name?.toLowerCase().includes(addSearch.toLowerCase()))
  );

  // Turmas distintas extraídas das sessões (consistente com o filtro visibleSessions)
  const classOptions = Array.from(
    new Set(sessions.map(s => (s.class_label || "").trim()).filter(Boolean))
  ).sort();

  // Sessões visíveis após o filtro de turma
  const visibleSessions = classFilter === "all"
    ? sessions
    : sessions.filter(s => s.class_label === classFilter);

  const notInRoster = students.filter((s) => !records[s.id]).length;
  const SESSION_TYPE: Record<string, string> = { presencial: "Presencial", live: "Online" };
  const STATUS_SHORT: Record<AttendanceStatus, { key: string; label: string; on: string }> = {
    presente:    { key: "P", label: "Presente",    on: "bg-emerald-600 text-white" },
    ausente:     { key: "A", label: "Ausente",     on: "bg-red-600 text-white" },
    justificado: { key: "J", label: "Justificado", on: "bg-foreground text-background" },
  };
  const fieldCls = "h-11 bg-muted/30 border-none rounded-control text-sm";

  const openCreate = () => {
    setNewTitle("");
    setNewDesc("");
    setNewSubject("");
    setNewTeacherId("");
    setTitleTouched(false);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" /> Secretaria · frequência</p>
          <h1 className="u-page-title text-3xl mt-1">Diário de classe</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Agende aulas, defina o professor responsável e lance a chamada de cada turma.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          <Button
            onClick={() => setTrackerOpen(true)}
            variant="outline"
            className="rounded-control h-11 px-4 gap-2 font-bold"
          >
            <MapPin className="h-4 w-4" /> Rastrear sala
          </Button>
          <Button
            variant="arcade"
            onClick={openCreate}
            className="rounded-control h-11 px-5 gap-2 font-bold"
          >
            <PlusCircle className="h-4 w-4" /> Nova aula
          </Button>
        </div>
      </div>

      <StudentRoomTracker open={trackerOpen} onClose={() => setTrackerOpen(false)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Histórico de aulas */}
        <Card className="rounded-card shadow-none overflow-hidden p-5 sm:p-6 space-y-5 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" /> Aulas registradas
            </h2>
            <span className="u-label shrink-0"><span className="u-num">{visibleSessions.length}</span> de <span className="u-num">{sessions.length}</span></span>
          </div>

          <div className="space-y-1.5">
            <Label className="u-label ml-1">Filtrar por sala / turma</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className={fieldCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all" className="text-sm">Todas as turmas</SelectItem>
                {classOptions.map(c => (
                  <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingSessions ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : visibleSessions.length === 0 ? (
            <EmptyState
              compact
              icon={Calendar}
              title={sessions.length === 0 ? "Nenhuma aula registrada ainda" : "Nenhuma aula nesta turma"}
              description={sessions.length === 0 ? "Crie a primeira aula para começar a lançar a chamada." : "Escolha outra turma ou crie uma aula para esta."}
              action={{ label: "Nova aula", onClick: openCreate, icon: PlusCircle }}
              secondary={classFilter !== "all" ? { label: "Ver todas as turmas", onClick: () => setClassFilter("all") } : undefined}
            />
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {visibleSessions.map(s => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => handleOpenAttendance(s)}
                  aria-pressed={selectedSession?.id === s.id}
                  className={`w-full text-left p-3.5 rounded-control border transition-colors flex justify-between items-center gap-3 ${
                    selectedSession?.id === s.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight truncate">{txt(s.title, "Aula sem título")}</p>
                    <div className="flex items-center gap-x-2 gap-y-1 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(s.session_date, "dd 'de' MMM")}
                      </span>
                      {s.teacher_name && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground truncate">{s.teacher_name}</span>
                        </>
                      )}
                      {s.class_label && (
                        <Badge variant="outline" className="text-[10px] font-semibold px-1.5 h-5">
                          {s.class_label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="u-label shrink-0">
                    {SESSION_TYPE[s.session_type] || txt(s.session_type, "")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Lançamento da chamada */}
        <Card className="rounded-card shadow-none overflow-hidden p-5 sm:p-6 flex flex-col min-h-[400px] min-w-0">
          {selectedSession ? (
            <div className="space-y-5 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <span className="u-label">Lançamento de presença</span>
                  <h3 className="font-bold text-lg leading-snug truncate mt-0.5">{txt(selectedSession.title, "Aula sem título")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtDate(selectedSession.session_date, "dd 'de' MMMM 'de' yyyy")}{selectedSession.teacher_name ? ` · ${selectedSession.teacher_name}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-control shrink-0" onClick={() => setSelectedSession(null)} aria-label="Fechar chamada">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Chamada em papel */}
              <div className="p-3 rounded-control border border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="u-label truncate">Chamada em papel</span>
                    {selectedSession.paper_photo_url && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">Enviada</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="h-8 px-3 text-xs font-bold rounded-control gap-1 shrink-0"
                  >
                    {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                    {selectedSession.paper_photo_url ? "Trocar" : "Enviar foto"}
                  </Button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadPhoto(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                {selectedSession.paper_photo_url ? (
                  <a href={selectedSession.paper_photo_url} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
                    <img loading="lazy" decoding="async"
                      src={selectedSession.paper_photo_url}
                      alt="Lista de presença em papel"
                      className="w-full rounded-control object-cover max-h-40 border border-border hover:opacity-90 transition-opacity cursor-zoom-in"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Fotografe a lista de presença em papel e envie para arquivar. Ela é comparada com os check-ins do app.
                  </p>
                )}
              </div>

              {loadingDetails ? (
                <div className="py-20 flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filtrar aluno..."
                        className="h-10 pl-9 pr-3 rounded-control bg-muted/30 border-none text-sm"
                        value={searchStudent}
                        onChange={e => setSearchStudent(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-10 rounded-control font-semibold text-xs shrink-0"
                      onClick={() => { setShowAddPanel((v) => !v); setAddSearch(""); }}
                      title="Adicionar aluno"
                      aria-label="Adicionar aluno"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Adicionar aluno</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-10 rounded-control font-semibold text-xs shrink-0"
                      onClick={() => excelInputRef.current?.click()}
                      title="Importar planilha"
                      aria-label="Importar planilha"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Importar planilha</span>
                    </Button>
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleExcelFile(f);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {showAddPanel && (
                    <div className="border border-border rounded-control p-3 sm:p-4 bg-muted/20 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Adicionar à chamada
                          {availableStudents.length < notInRoster && (
                            <span className="text-muted-foreground font-normal"> — {availableStudents.length} resultado(s)</span>
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2 text-xs text-muted-foreground font-semibold h-8"
                          onClick={handleAddAll}
                          disabled={addingAll || notInRoster === 0}
                        >
                          {addingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                          Adicionar todos ({notInRoster})
                        </Button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          className="pl-9 h-9 text-sm bg-background rounded-control"
                          placeholder="Buscar aluno pelo nome..."
                          value={addSearch}
                          onChange={(e) => setAddSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {notInRoster === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Todos os alunos já estão na lista.
                        </p>
                      ) : availableStudents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhum aluno encontrado para “{addSearch}”.
                        </p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {availableStudents.map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-control bg-background border border-border"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{student.name || "Sem nome"}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {student.course || "Turma não definida"} · {student.institution || "Polo não definido"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-8 text-xs font-semibold rounded-control shrink-0"
                                onClick={() => handleAddStudent(student.id)}
                                disabled={addingId === student.id}
                              >
                                {addingId === student.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3" />
                                )}
                                Adicionar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[360px] pr-1">
                    {filteredStudents.length === 0 ? (
                      <EmptyState
                        compact
                        icon={Users}
                        title={Object.keys(records).length === 0 ? "Nenhum aluno nesta chamada" : "Nenhum aluno com esse nome"}
                        description={Object.keys(records).length === 0
                          ? "Adicione alunos um a um, todos de uma vez ou importe uma planilha."
                          : "Confira a grafia ou limpe o filtro."}
                        action={Object.keys(records).length === 0
                          ? { label: "Adicionar alunos", onClick: () => { setShowAddPanel(true); setAddSearch(""); }, icon: UserPlus }
                          : { label: "Limpar filtro", onClick: () => setSearchStudent("") }}
                      />
                    ) : (
                      filteredStudents.map(student => {
                        const rec = records[student.id];
                        const orig = originals[student.id];
                        const checkedInViaApp = orig?.method === "app";
                        const isOverriding = checkedInViaApp && orig.status !== rec.status;
                        return (
                          <div
                            key={student.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-control border transition-colors ${
                              isOverriding
                                ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
                                : rec.status === 'presente'
                                ? 'bg-emerald-50 border-emerald-200'
                                : rec.status === 'justificado'
                                ? 'bg-muted/50 border-border'
                                : 'border-border'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm leading-tight truncate">{txt(student.name, "Sem nome")}</p>
                                {checkedInViaApp && (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] px-1.5 h-5 shrink-0" title="O aluno fez check-in pelo app">
                                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Pelo app
                                  </Badge>
                                )}
                                {isOverriding && (
                                  <Badge className="bg-red-600 text-white border-none font-bold text-[10px] px-1.5 h-5 shrink-0">
                                    Alterado
                                  </Badge>
                                )}
                              </div>
                              <p className="u-label mt-1">{student.course || 'Sem turma'}</p>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                {rec.status === 'justificado' && (
                                  <Input
                                    placeholder="Justificativa..."
                                    value={rec.justification}
                                    onChange={e => setJustification(student.id, e.target.value)}
                                    className="h-8 text-xs flex-1 min-w-0 sm:w-28 sm:flex-none rounded-control bg-background"
                                  />
                                )}
                                <div className="flex rounded-control overflow-hidden border border-border shrink-0 ml-auto sm:ml-0" role="group" aria-label="Situação na chamada">
                                  {(["presente", "ausente", "justificado"] as AttendanceStatus[]).map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => setStatus(student.id, st)}
                                      title={STATUS_SHORT[st].label}
                                      aria-label={STATUS_SHORT[st].label}
                                      aria-pressed={rec.status === st}
                                      className={`h-8 w-9 text-xs font-bold transition-colors ${
                                        rec.status === st
                                          ? STATUS_SHORT[st].on
                                          : "bg-background hover:bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {STATUS_SHORT[st].key}
                                    </button>
                                  ))}
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-control shrink-0"
                                  title="Remover da chamada"
                                  aria-label="Remover da chamada"
                                  onClick={() => handleRemoveStudent(student.id)}
                                  disabled={removingId === student.id}
                                >
                                  {removingId === student.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserMinus className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>

                              {rec.status === 'presente' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleLeftEarly(student.id)}
                                    aria-pressed={rec.leftEarly}
                                    className={`flex items-center gap-1 h-7 px-2 rounded-control text-[11px] font-semibold transition-colors ${
                                      rec.leftEarly
                                        ? "bg-foreground text-background"
                                        : "bg-background border border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                    title="Marcar saída antecipada"
                                  >
                                    <LogOut className="h-3 w-3" />
                                    Saiu antes
                                  </button>
                                  {rec.leftEarly && (
                                    <input
                                      type="time"
                                      value={rec.leftEarlyTime}
                                      onChange={e => setLeftEarlyTime(student.id, e.target.value)}
                                      aria-label="Horário da saída"
                                      className="h-7 text-xs font-semibold rounded-control border border-border bg-background px-1.5 outline-none focus:border-primary"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <Button
                    variant="arcade"
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="w-full h-11 font-bold rounded-control mt-auto"
                  >
                    {savingAttendance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="mr-2" />}
                    Salvar chamada
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              className="flex-1 border-none bg-transparent"
              icon={ClipboardCheck}
              title="Nenhuma aula selecionada"
              description="Escolha uma aula na lista para lançar ou corrigir a chamada."
              secondary={{ label: "Criar nova aula", onClick: openCreate }}
            />
          )}
        </Card>
      </div>

      {/* Importação de planilha */}
      <Dialog open={importModalOpen} onOpenChange={(v) => { if (!v) { setImportModalOpen(false); setImportRows([]); } }}>
        <DialogContent className="rounded-card p-0 overflow-y-auto max-h-[92vh] w-[95vw] sm:max-w-2xl">
          <DialogHeader className="p-6 pb-4 border-b text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="u-label">Secretaria · frequência</p>
                <DialogTitle className="u-page-title text-lg mt-0.5">
                  Importar chamada
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                  {importRows.filter(r => r.matchedStudent).length} encontrado(s) ·{" "}
                  <span className="text-amber-700 font-semibold">{importRows.filter(r => !r.matchedStudent).length} não identificado(s)</span>
                  {" "}· {importRows.length} no total
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto space-y-2">
            {importRows.map((row, idx) => (
              <div
                key={idx}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-control border ${
                  row.matchedStudent
                    ? "border-border"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate leading-tight">{row.rawName}</p>
                  {row.matchedStudent ? (
                    <p className="text-xs text-emerald-700 mt-0.5 truncate">
                      Vinculado a {txt(row.matchedStudent.name, "aluno")}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 mt-0.5">Não encontrado</p>
                  )}
                </div>

                {!row.matchedStudent && (
                  <Select
                    value={row.manualStudentId}
                    onValueChange={(val) =>
                      setImportRows(prev =>
                        prev.map((r, i) => i === idx ? { ...r, manualStudentId: val } : r)
                      )
                    }
                  >
                    <SelectTrigger className="h-9 w-full sm:w-48 rounded-control bg-background border-amber-200 text-sm shrink-0">
                      <SelectValue placeholder="Vincular manualmente…" />
                    </SelectTrigger>
                    <SelectContent className="rounded-control max-h-60">
                      {students.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex rounded-control overflow-hidden border border-border shrink-0 self-end sm:self-auto" role="group" aria-label="Situação na chamada">
                  {(["presente", "ausente"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        setImportRows(prev =>
                          prev.map((r, i) => i === idx ? { ...r, status: st } : r)
                        )
                      }
                      title={STATUS_SHORT[st].label}
                      aria-label={STATUS_SHORT[st].label}
                      aria-pressed={row.status === st}
                      className={`h-8 w-10 text-xs font-bold transition-colors ${
                        row.status === st
                          ? STATUS_SHORT[st].on
                          : "bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_SHORT[st].key}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-6 pt-4 border-t border-border flex flex-col-reverse sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-control font-bold"
              onClick={() => { setImportModalOpen(false); setImportRows([]); }}
            >
              Cancelar
            </Button>
            <Button
              variant="arcade"
              onClick={handleConfirmImport}
              disabled={importingExcel}
              className="flex-1 h-11 rounded-control font-bold whitespace-normal"
            >
              {importingExcel ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Confirmar importação ({importRows.filter(r => r.matchedStudent?.id || r.manualStudentId).length} alunos)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova aula */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-card p-0 overflow-y-auto max-h-[92vh] w-[95vw] sm:max-w-md">
          <DialogHeader className="p-6 pb-4 border-b text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="u-label">Secretaria · frequência</p>
                <DialogTitle className="u-page-title text-lg mt-0.5">
                  Nova aula
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                  Crie uma aula no diário de classe.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 ml-1">
                <Label className="u-label">Título da aula *</Label>
                {titleTouched && (
                  <button
                    type="button"
                    onClick={() => { setTitleTouched(false); setNewTitle(generateSessionTitle(newDate, newClassLabel, newSubject)); }}
                    className="u-label !text-primary hover:underline"
                  >
                    Gerar automaticamente
                  </button>
                )}
              </div>
              <Input
                value={newTitle}
                onChange={e => { setNewTitle(e.target.value); setTitleTouched(true); }}
                placeholder="Ex.: Revisão - Funções quadráticas"
                className={`${fieldCls} font-semibold`}
              />
              {!titleTouched && newTitle && (
                <p className="text-xs text-muted-foreground ml-1">
                  Gerado pela data, turma e matéria. Edite se quiser.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Matéria (opcional)</Label>
                <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Ex.: Matemática" className={fieldCls} />
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Tipo</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className={fieldCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="presencial" className="text-sm">Presencial</SelectItem>
                    <SelectItem value="live" className="text-sm">Ao vivo / online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Data da aula</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={fieldCls} />
                {newDate && newDate < format(new Date(), "yyyy-MM-dd") && (
                  <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-700 ml-1 mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    Aula com data passada: o lançamento fica registrado no seu nome.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="u-label ml-1">Professor *</Label>
                <Select value={newTeacherId} onValueChange={setNewTeacherId}>
                  <SelectTrigger className={fieldCls}>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="u-label ml-1">Sala / turma *</Label>
              <Select value={newClassLabel} onValueChange={setNewClassLabel}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue placeholder="Selecionar turma..." />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  {classOptions.length === 0 ? (
                    <SelectItem value="__none__" disabled className="text-sm">Nenhuma turma cadastrada</SelectItem>
                  ) : (
                    classOptions.map(c => (
                      <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCreateSession} disabled={savingSession} className="w-full h-11 rounded-control font-bold mt-2">
              {savingSession ? <Loader2 className="animate-spin mr-2" /> : <ClipboardCheck className="mr-2" />}
              Criar aula e abrir chamada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de alteração de check-in feito pelo app (auditoria) */}
      <Dialog open={overrideOpen} onOpenChange={(v) => { if (!v) { setOverrideOpen(false); setOverrideReason(""); } }}>
        <DialogContent className="rounded-card p-0 overflow-y-auto max-h-[92vh] w-[95vw] sm:max-w-md">
          <DialogHeader className="p-6 pb-4 border-b border-red-200 text-left">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-control bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="u-label !text-red-600">Auditoria</p>
                <DialogTitle className="text-lg font-bold text-red-700 leading-snug mt-0.5">
                  Alterar check-in feito pelo app?
                </DialogTitle>
                <DialogDescription className="text-xs mt-1 font-semibold text-red-600">
                  {pendingOverrides.length} aluno{pendingOverrides.length > 1 ? "s" : ""} com check-in digital ser{pendingOverrides.length > 1 ? "ão" : "á"} alterado{pendingOverrides.length > 1 ? "s" : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="p-4 bg-red-50 border border-red-200 rounded-control">
              <p className="text-sm text-red-700 leading-relaxed">
                Estes alunos marcaram presença pelo app com o código da aula. A alteração fica no <strong>registro de auditoria</strong> com seu nome, a data e o motivo.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="u-label ml-1">
                Motivo da alteração *
              </Label>
              <Input
                placeholder="Ex.: a lista de papel da sala confirma a ausência"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className={fieldCls}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo de 5 caracteres. Fica visível na auditoria.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setOverrideOpen(false); setOverrideReason(""); setPendingOverrides([]); }}
                className="flex-1 h-11 rounded-control font-bold"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => persistAttendance(pendingOverrides)}
                disabled={savingAttendance || overrideReason.trim().length < 5}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-control font-bold"
              >
                {savingAttendance ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                Confirmar alteração
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
