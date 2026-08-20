"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuardiansCard } from "@/components/student/GuardiansCard";
import { StudentNotesCard } from "@/components/student/StudentNotesCard";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Mail,
  GraduationCap,
  MapPin,
  Calendar,
  UserCheck,
  UserX,
  Save,
  FileCheck,
  TrendingUp,
  ClipboardCheck,
  AlertTriangle,
  HandHeart,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Users,
  BarChart3,
  FileText
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { SCHOOL_LIST } from "@/lib/constants";
import Link from "next/link";
import { LineChartPremium } from "@/components/charts/premium";

/* ── helpers ──────────────────────────────────────────────────── */

const INCOME_THRESHOLD = 2431.5;
const TOTAL_REQUIRED_DOCS = 12;

function incomeLabel(p: any) {
  if (!p?.income_per_capita || p.income_per_capita === 0) return "pending";
  return p.income_per_capita <= INCOME_THRESHOLD ? "ok" : "exceeded";
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  rg: "RG",
  cpf: "CPF",
  historico: "Histórico Escolar",
  comprovante_residencia: "Comprovante de Residência",
  certidao: "Certidão de Nascimento",
  comprovante_renda: "Comprovante de Renda",
  atestado: "Atestado",
  outro: "Outro",
};

/* ── page ─────────────────────────────────────────────────────── */

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile data
  const [profile, setProfile] = useState<any>(null);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editExamTarget, setEditExamTarget] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editFinancialAid, setEditFinancialAid] = useState(false);

  // Analytics
  const [attStats, setAttStats] = useState({ present: 0, absent: 0, justified: 0, total: 0 });
  const [attTrend, setAttTrend] = useState<{ week: string; pct: number }[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [checklistCount, setChecklistCount] = useState(0);
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, semester: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Selecione um arquivo PDF válido.");
      return;
    }

    const setUploading = semester === 1 ? setUploading1 : setUploading2;
    setUploading(true);

    const path = `${id}/boletim_${semester}sem.pdf`;

    try {
      const { data, error: uploadError } = await supabase.storage
        .from("report-cards")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("report-cards")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      const fieldUrl = semester === 1 ? "report_card_pdf_url_1sem" : "report_card_pdf_url_2sem";
      const fieldPath = semester === 1 ? "report_card_pdf_path_1sem" : "report_card_pdf_path_2sem";

      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          [fieldUrl]: publicUrl,
          [fieldPath]: path
        })
        .eq("id", id);

      if (dbError) throw dbError;

      setProfile((s: any) => ({
        ...s,
        [fieldUrl]: publicUrl,
        [fieldPath]: path
      }));

      alert("Boletim em PDF enviado com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao enviar boletim: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handlePdfDelete = async (semester: 1 | 2) => {
    if (!confirm("Tem certeza que deseja remover este boletim em PDF?")) return;

    const fieldUrl = semester === 1 ? "report_card_pdf_url_1sem" : "report_card_pdf_url_2sem";
    const fieldPath = semester === 1 ? "report_card_pdf_path_1sem" : "report_card_pdf_path_2sem";
    const path = profile[fieldPath];

    try {
      if (path) {
        await supabase.storage.from("report-cards").remove([path]);
      }

      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          [fieldUrl]: null,
          [fieldPath]: null
        })
        .eq("id", id);

      if (dbError) throw dbError;

      setProfile((s: any) => ({
        ...s,
        [fieldUrl]: null,
        [fieldPath]: null
      }));

      alert("Boletim removido com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao remover boletim: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Profile
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (pErr) throw pErr;

      setProfile(p);
      setEditName(p.name || "");
      setEditEmail(p.email || "");
      setEditPhone(p.phone || "");
      setEditCourse(p.course || "");
      setEditInstitution(p.institution || "");
      setEditExamTarget(p.exam_target || "");
      setEditBirthDate(p.birth_date ? p.birth_date.slice(0, 10) : "");
      setEditCpf(p.cpf || "");
      setEditStatus(p.status || "active");
      setEditFinancialAid(!!p.is_financial_aid_eligible);

      // 2. Attendance — last 12 weeks
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      const { data: sessions } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .gte("session_date", twelveWeeksAgo.toISOString().split("T")[0]);

      const sessionIds = (sessions || []).map((s: any) => s.id);

      if (sessionIds.length > 0) {
        const { data: recs } = await supabase
          .from("attendance_records")
          .select("session_id, status")
          .eq("student_id", id)
          .in("session_id", sessionIds);

        const records = recs || [];
        const present = records.filter((r: any) => r.status === "presente").length;
        const absent = records.filter((r: any) => r.status === "ausente").length;
        const justified = records.filter((r: any) => r.status === "justificado").length;
        setAttStats({ present, absent, justified, total: records.length });

        // Weekly trend
        const sessionDateMap: Record<string, string> = {};
        (sessions || []).forEach((s: any) => { sessionDateMap[s.id] = s.session_date; });

        const weekMap: Record<string, { present: number; total: number; date: Date }> = {};
        records.forEach((r: any) => {
          const dateStr = sessionDateMap[r.session_id];
          if (!dateStr) return;
          const ws = startOfWeek(new Date(dateStr));
          const key = ws.toISOString();
          if (!weekMap[key]) weekMap[key] = { present: 0, total: 0, date: ws };
          weekMap[key].total++;
          if (r.status === "presente") weekMap[key].present++;
        });

        setAttTrend(
          Object.values(weekMap)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((w) => ({ week: weekLabel(w.date), pct: w.total > 0 ? Math.round((w.present / w.total) * 100) : 0 }))
        );
      }

      // 3. Documents
      const { data: docs } = await supabase
        .from("student_uploads")
        .select("id, doc_type, title, status, uploaded_at, file_url")
        .eq("student_id", id)
        .order("uploaded_at", { ascending: false });
      setUploads(docs || []);

      // 4. Checklist
      try {
        const { data: cl } = await supabase
          .from("student_checklists")
          .select("user_id")
          .eq("user_id", id);
        setChecklistCount(cl?.length || 0);
      } catch {
        setChecklistCount(0);
      }
    } catch (err) {
      console.error("[STUDENT DETAIL]", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (userRole === "staff" || userRole === "admin") fetchAll();
  }, [fetchAll, userRole]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        course: editCourse.trim(),
        institution: editInstitution.trim(),
        exam_target: editExamTarget,
        status: editStatus,
        is_financial_aid_eligible: editFinancialAid,
      };
      if (editBirthDate) updates.birth_date = editBirthDate;
      if (editCpf.trim()) updates.cpf = editCpf.trim();

      const { error } = await supabase.from("profiles").update(updates).eq("id", profile.id);
      if (error) throw error;

      setProfile((prev: any) => ({ ...prev, ...updates }));
      toast({ title: "Perfil atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isUserLoading || loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Carregando perfil do aluno...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Users className="h-12 w-12 opacity-20" />
        <p className="text-sm font-bold italic">Aluno não encontrado.</p>
        <Button asChild variant="ghost" className="rounded-xl">
          <Link href="/dashboard/secretary/enrollments">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Link>
        </Button>
      </div>
    );
  }

  const presencePct = attStats.total > 0 ? Math.round((attStats.present / attStats.total) * 100) : null;
  const incomeStatus = incomeLabel(profile);
  const checklistPct = Math.min(100, Math.round((checklistCount / TOTAL_REQUIRED_DOCS) * 100));
  const isSuspended = editStatus === "suspended";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-1">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-2xl h-11 w-11 bg-white shadow-md shrink-0 mt-0.5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-primary italic leading-none uppercase tracking-tighter truncate">
              {profile.name || "Aluno"}
            </h1>
            <Badge className={`border-none font-black text-[10px] px-3 py-1 uppercase tracking-wide shrink-0 ${isSuspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
              {isSuspended ? "Suspensa" : "Ativa"}
            </Badge>
            {profile.exam_target && (
              <Badge className="border-none font-black text-[10px] px-3 py-1 bg-blue-100 text-blue-700 shrink-0">
                {profile.exam_target}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground font-medium text-sm italic truncate">{profile.email}</p>
        </div>
      </div>

      {/* Stat chips row */}
      <div className="flex flex-wrap gap-3">
        {profile.phone && (
          <div className="flex items-center gap-1.5 bg-white shadow-md rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700">
            <Phone className="h-3.5 w-3.5 text-emerald-500" />
            {profile.phone}
          </div>
        )}
        {profile.course && (
          <div className="flex items-center gap-1.5 bg-white shadow-md rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700">
            <GraduationCap className="h-3.5 w-3.5 text-blue-500" />
            {profile.course}
          </div>
        )}
        {profile.institution && (
          <div className="flex items-center gap-1.5 bg-white shadow-md rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700">
            <MapPin className="h-3.5 w-3.5 text-purple-500" />
            {profile.institution}
          </div>
        )}
        {presencePct !== null && (
          <div className={`flex items-center gap-1.5 shadow-md rounded-2xl px-4 py-2.5 text-xs font-bold ${presencePct >= 75 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            {presencePct}% presença
          </div>
        )}
        {checklistPct > 0 && (
          <div className="flex items-center gap-1.5 bg-indigo-50 shadow-md rounded-2xl px-4 py-2.5 text-xs font-bold text-indigo-700">
            <FileCheck className="h-3.5 w-3.5" />
            Checklist {checklistPct}%
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Left: Edit form */}
        <Card className="xl:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-lg font-black text-primary italic flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Dados Cadastrais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-4">

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Nome Completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11 bg-muted/30 border-none rounded-xl font-bold text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-11 bg-muted/30 border-none rounded-xl font-mono text-sm pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-11 bg-muted/30 border-none rounded-xl font-medium text-sm pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">CPF</Label>
                <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="000.000.000-00" className="h-11 bg-muted/30 border-none rounded-xl font-mono text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Data de Nascimento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} className="h-11 bg-muted/30 border-none rounded-xl font-medium text-sm pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Turma / Sala</Label>
                <Select value={editCourse} onValueChange={setEditCourse}>
                  <SelectTrigger className="h-11 bg-muted/30 border-none rounded-xl font-medium text-sm">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {Array.from({ length: 12 }, (_, i) => {
                      const num = String(i + 1).padStart(2, "0");
                      return <SelectItem key={num} value={num} className="font-bold text-xs">Sala {num}</SelectItem>;
                    })}
                    {editCourse && !Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).includes(editCourse) && (
                      <SelectItem value={editCourse} className="font-bold text-xs">{editCourse}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Foco de Exame</Label>
                <Select value={editExamTarget} onValueChange={setEditExamTarget}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                    <SelectValue placeholder="Foco" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="ENEM" className="font-bold text-xs">ENEM</SelectItem>
                    <SelectItem value="ETEC" className="font-bold text-xs">ETEC / FATEC</SelectItem>
                    <SelectItem value="Outros" className="font-bold text-xs">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest ml-1">Escola / Polo</Label>
              <Select value={editInstitution || "none"} onValueChange={(v) => setEditInstitution(v === "none" ? "" : v)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium text-sm">
                  <SelectValue placeholder="Selecionar polo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="none" className="font-bold text-xs text-slate-400">Sem polo definido</SelectItem>
                  {SCHOOL_LIST.map((s) => (
                    <SelectItem key={s} value={s} className="font-bold text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex gap-2.5 items-center">
                {isSuspended ? <UserX className="h-5 w-5 text-red-500 shrink-0" /> : <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                <div>
                  <span className="text-[11px] font-black text-slate-700 leading-none">{isSuspended ? "Matrícula Suspensa" : "Matrícula Ativa"}</span>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Clique para alternar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditStatus(isSuspended ? "active" : "suspended")}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none ${!isSuspended ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${!isSuspended ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Financial aid toggle */}
            <div className="flex items-center justify-between p-4 bg-orange-50/60 rounded-2xl border border-orange-100">
              <div className="flex gap-2.5 items-center">
                <HandHeart className="h-5 w-5 text-orange-600 shrink-0" />
                <div>
                  <span className="text-[11px] font-black text-slate-700 leading-none">Cota Social / Isenção</span>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Elegível para benefícios</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditFinancialAid(!editFinancialAid)}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none ${editFinancialAid ? "bg-orange-600" : "bg-slate-200"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${editFinancialAid ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl border-none text-xs uppercase tracking-widest"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>

        {/* Right: Analytics */}
        <div className="xl:col-span-3 space-y-6">

          {/* Attendance stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Presenças", value: attStats.present, color: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
              { label: "Faltas", value: attStats.absent, color: "bg-red-50 text-red-600", icon: XCircle },
              { label: "Justificadas", value: attStats.justified, color: "bg-amber-50 text-amber-600", icon: Clock },
              { label: "Freq. Geral", value: presencePct !== null ? `${presencePct}%` : "—", color: presencePct !== null && presencePct >= 75 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600", icon: BarChart3 },
            ].map((s) => (
              <Card key={s.label} className="border-none shadow-xl rounded-3xl bg-white">
                <CardContent className="p-5">
                  <div className={`h-8 w-8 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-black text-primary leading-none italic">{s.value}</p>
                  <p className="text-[9px] font-black uppercase tracking-wider text-primary/60 mt-1.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Responsáveis legais */}
          {profile?.id && <GuardiansCard studentId={profile.id} />}

          {/* Observações internas (troca de sala, ocorrências) */}
          {profile?.id && <StudentNotesCard studentId={profile.id} />}

          {/* Attendance trend chart */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black text-primary italic flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Frequência Semanal
                <span className="text-xs font-semibold text-muted-foreground not-italic ml-1">(últimas 12 semanas)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {attTrend.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-muted-foreground text-sm italic opacity-40">
                  Sem dados de chamada ainda.
                </div>
              ) : (
                <div className="h-44">
                  <LineChartPremium data={attTrend} xKey="week" yKey="pct" color="#10b981" referenceY={75} unit="%" domainMax={100} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income */}
          {(Number(profile.family_income) > 0 || profile.is_financial_aid_eligible) && (
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-primary italic flex items-center gap-2">
                  <HandHeart className="h-5 w-5 text-orange-500" />
                  Situação de Renda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Renda Familiar", value: Number(profile.family_income) > 0 ? `R$ ${Number(profile.family_income).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—" },
                    { label: "Moradores", value: profile.family_size || "—" },
                    { label: "Per Capita", value: profile.income_per_capita > 0 ? `R$ ${Number(profile.income_per_capita).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—" },
                  ].map((item) => (
                    <div key={item.label} className="p-3 bg-slate-50 rounded-2xl text-center">
                      <p className="text-xs font-black text-primary italic leading-none">{item.value}</p>
                      <p className="text-[9px] font-bold uppercase text-muted-foreground mt-1.5 tracking-wide">{item.label}</p>
                    </div>
                  ))}
                </div>

                {profile.income_per_capita > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <span>R$ 0</span>
                      <span className="text-amber-600">Limite R$ {INCOME_THRESHOLD.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span>R$ {(INCOME_THRESHOLD * 2).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}+</span>
                    </div>
                    <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="absolute left-0 top-0 h-full w-1/2 bg-emerald-200 rounded-l-full" />
                      <div className="absolute left-1/2 top-0 h-full w-1/2 bg-red-200 rounded-r-full" />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 z-10"
                        style={{
                          left: `${Math.min(98, Math.max(2, (profile.income_per_capita / (INCOME_THRESHOLD * 2)) * 100))}%`,
                          background: incomeStatus === "ok" ? "#10b981" : "#ef4444",
                        }}
                      />
                    </div>
                    <Badge className={`border-none font-bold text-[9px] uppercase px-3 mt-1 ${incomeStatus === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {incomeStatus === "ok" ? "Dentro do limite — Elegível para isenção" : "Excedeu o limite"}
                    </Badge>
                  </div>
                )}

                {profile.family_members && Array.isArray(profile.family_members) && profile.family_members.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Composição Familiar</p>
                    {profile.family_members.map((m: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        <span>{m.label || `Integrante ${i + 1}`}</span>
                        <span className="font-mono font-bold">R$ {Number(m.income || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Boletins em PDF */}
          {profile && (
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-primary italic flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  Boletins Oficiais em PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 grid grid-cols-1 gap-4">
                {/* 1º Semestre */}
                <div className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1º Semestre</span>
                    {profile.report_card_pdf_url_1sem && (
                      <Badge className="bg-emerald-500 text-white font-black text-[8px] uppercase border-none">Disponível</Badge>
                    )}
                  </div>
                  
                  {profile.report_card_pdf_url_1sem ? (
                    <div className="flex flex-col gap-2">
                      <a
                        href={profile.report_card_pdf_url_1sem}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                        Visualizar Boletim PDF
                      </a>
                      <Button
                        variant="outline"
                        onClick={() => handlePdfDelete(1)}
                        className="h-8 w-full rounded-lg text-red-500 border-red-200 hover:bg-red-50 font-bold text-[10px]"
                      >
                        Remover Boletim
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg h-16 cursor-pointer hover:border-primary/50 transition-colors">
                        {uploading1 ? (
                          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-slate-400 mb-0.5" />
                            <span className="text-[10px] font-bold text-slate-500">Enviar PDF</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={uploading1}
                          onChange={(e) => handlePdfUpload(e, 1)}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* 2º Semestre */}
                <div className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2º Semestre</span>
                    {profile.report_card_pdf_url_2sem && (
                      <Badge className="bg-emerald-500 text-white font-black text-[8px] uppercase border-none">Disponível</Badge>
                    )}
                  </div>
                  
                  {profile.report_card_pdf_url_2sem ? (
                    <div className="flex flex-col gap-2">
                      <a
                        href={profile.report_card_pdf_url_2sem}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                        Visualizar Boletim PDF
                      </a>
                      <Button
                        variant="outline"
                        onClick={() => handlePdfDelete(2)}
                        className="h-8 w-full rounded-lg text-red-500 border-red-200 hover:bg-red-50 font-bold text-[10px]"
                      >
                        Remover Boletim
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg h-16 cursor-pointer hover:border-primary/50 transition-colors">
                        {uploading2 ? (
                          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-slate-400 mb-0.5" />
                            <span className="text-[10px] font-bold text-slate-500">Enviar PDF</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={uploading2}
                          onChange={(e) => handlePdfUpload(e, 2)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white">
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black text-primary italic flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-purple-500" />
                  Documentos Enviados
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full transition-all duration-700" style={{ width: `${checklistPct}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-purple-600">{checklistPct}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {uploads.length === 0 ? (
                <div className="py-8 text-center opacity-40 italic font-bold border-2 border-dashed rounded-[2rem] text-slate-500 text-sm">
                  Nenhum documento enviado ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {uploads.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                          doc.status === "aprovado" ? "bg-emerald-100" : doc.status === "rejeitado" ? "bg-red-100" : "bg-amber-100"
                        }`}>
                          {doc.status === "aprovado" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                           doc.status === "rejeitado" ? <XCircle className="h-4 w-4 text-red-600" /> :
                           <Clock className="h-4 w-4 text-amber-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{doc.title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</p>
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                            {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`border-none font-bold text-[9px] uppercase px-2 h-5 ${
                          doc.status === "aprovado" ? "bg-emerald-100 text-emerald-700" :
                          doc.status === "rejeitado" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {doc.status === "aprovado" ? "Aprovado" : doc.status === "rejeitado" ? "Rejeitado" : "Pendente"}
                        </Badge>
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:shadow-md transition-all text-slate-400 hover:text-primary">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
