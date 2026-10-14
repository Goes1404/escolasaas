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
import { fmtLocale, fmtBRL, pct, txt } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

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
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo PDF.", variant: "destructive" });
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

      toast({ title: "Boletim enviado" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao enviar boletim", description: err.message, variant: "destructive" });
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

      toast({ title: "Boletim removido" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao remover boletim", description: err.message, variant: "destructive" });
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
      toast({ title: "Perfil atualizado" });
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
        <p className="u-label">Carregando ficha do aluno…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        className="mt-10"
        icon={Users}
        title="Aluno não encontrado"
        description="O cadastro pode ter sido removido ou o link está incorreto."
        action={{ label: "Voltar para matrículas", href: "/dashboard/secretary/enrollments", icon: ArrowLeft }}
      />
    );
  }

  const presencePct = attStats.total > 0 ? pct(attStats.present, attStats.total) : null;
  const incomeStatus = incomeLabel(profile);
  const checklistPct = pct(checklistCount, TOTAL_REQUIRED_DOCS);
  const isSuspended = editStatus === "suspended";
  const perCapita = Number(profile.income_per_capita) || 0;

  const fieldCls = "h-11 bg-muted/30 border-none rounded-control text-sm";
  const labelCls = "u-label ml-1";

  const docStatus = (st: string) =>
    st === "aprovado" ? { label: "Aprovado", cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, box: "bg-emerald-50" }
    : st === "rejeitado" ? { label: "Rejeitado", cls: "bg-red-100 text-red-700", icon: <XCircle className="h-4 w-4 text-red-600" />, box: "bg-red-50" }
    : { label: "Pendente", cls: "bg-muted text-muted-foreground", icon: <Clock className="h-4 w-4 text-muted-foreground" />, box: "bg-muted" };

  const reportCard = (semester: 1 | 2) => {
    const url = semester === 1 ? profile.report_card_pdf_url_1sem : profile.report_card_pdf_url_2sem;
    const uploading = semester === 1 ? uploading1 : uploading2;
    return (
      <div className="border border-border rounded-control p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="u-label">{semester}º semestre</span>
          {url && (
            <Badge className="bg-emerald-100 text-emerald-700 font-bold text-[10px] border-none">Disponível</Badge>
          )}
        </div>

        {url ? (
          <div className="flex flex-col gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              Abrir boletim em PDF
            </a>
            <Button
              variant="outline"
              onClick={() => handlePdfDelete(semester)}
              className="h-9 w-full rounded-control text-red-600 border-red-200 hover:bg-red-50 font-semibold text-xs"
            >
              Remover boletim
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center border border-dashed border-border rounded-control h-16 cursor-pointer hover:border-primary/50 transition-colors">
            {uploading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <>
                <FileText className="h-4 w-4 text-muted-foreground mb-0.5" />
                <span className="text-xs font-semibold text-muted-foreground">Enviar PDF</span>
              </>
            )}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handlePdfUpload(e, semester)}
            />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="rounded-control h-10 w-10 shrink-0 mt-1"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="u-label">Secretaria · ficha do aluno</p>
          <h1 className="u-page-title text-2xl sm:text-3xl mt-1 break-words">
            {txt(profile.name, "Aluno")}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={`border-none font-bold text-[11px] px-2.5 shrink-0 ${isSuspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
              {isSuspended ? "Matrícula suspensa" : "Matrícula ativa"}
            </Badge>
            {profile.exam_target && (
              <Badge variant="outline" className="font-bold text-[11px] px-2.5 shrink-0">
                {profile.exam_target}
              </Badge>
            )}
            <span className="text-muted-foreground text-sm truncate min-w-0">{txt(profile.email, "")}</span>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="flex flex-wrap gap-2">
        {profile.phone && (
          <div className="flex items-center gap-1.5 border border-border rounded-control px-3 py-2 text-xs font-semibold">
            <Phone className="h-3.5 w-3.5 text-primary" />
            {profile.phone}
          </div>
        )}
        {profile.course && (
          <div className="flex items-center gap-1.5 border border-border rounded-control px-3 py-2 text-xs font-semibold">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            {profile.course}
          </div>
        )}
        {profile.institution && (
          <div className="flex items-center gap-1.5 border border-border rounded-control px-3 py-2 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {profile.institution}
          </div>
        )}
        {presencePct !== null && (
          <div className={`flex items-center gap-1.5 border rounded-control px-3 py-2 text-xs font-semibold ${presencePct >= 75 ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-700"}`}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span className="u-num">{presencePct}%</span> de presença
          </div>
        )}
        {checklistPct > 0 && (
          <div className="flex items-center gap-1.5 border border-border rounded-control px-3 py-2 text-xs font-semibold">
            <FileCheck className="h-3.5 w-3.5 text-primary" />
            Checklist <span className="u-num">{checklistPct}%</span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Esquerda: dados cadastrais */}
        <Card className="xl:col-span-2 rounded-card shadow-none h-fit">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              Dados cadastrais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4 space-y-4">

            <div className="space-y-1.5">
              <Label className={labelCls}>Nome completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className={`${fieldCls} font-semibold`} />
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={`${fieldCls} font-mono pl-9`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(00) 00000-0000" className={`${fieldCls} pl-9`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>CPF</Label>
                <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="000.000.000-00" className={`${fieldCls} font-mono`} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Data de nascimento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} className={`${fieldCls} pl-9`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Turma / sala</Label>
                <Select value={editCourse} onValueChange={setEditCourse}>
                  <SelectTrigger className={fieldCls}>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {Array.from({ length: 12 }, (_, i) => {
                      const num = String(i + 1).padStart(2, "0");
                      return <SelectItem key={num} value={num} className="text-sm">Sala {num}</SelectItem>;
                    })}
                    {editCourse && !Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).includes(editCourse) && (
                      <SelectItem value={editCourse} className="text-sm">{editCourse}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Foco de exame</Label>
                <Select value={editExamTarget} onValueChange={setEditExamTarget}>
                  <SelectTrigger className={fieldCls}>
                    <SelectValue placeholder="Foco" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="ENEM" className="text-sm">ENEM</SelectItem>
                    <SelectItem value="ETEC" className="text-sm">ETEC / FATEC</SelectItem>
                    <SelectItem value="Outros" className="text-sm">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Escola / polo</Label>
              <Select value={editInstitution || "none"} onValueChange={(v) => setEditInstitution(v === "none" ? "" : v)}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue placeholder="Selecionar polo" />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="none" className="text-sm text-muted-foreground">Sem polo definido</SelectItem>
                  {SCHOOL_LIST.map((s) => (
                    <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Situação da matrícula */}
            <div className="flex items-center justify-between gap-3 p-4 rounded-control border border-border">
              <div className="flex gap-2.5 items-center min-w-0">
                {isSuspended ? <UserX className="h-5 w-5 text-red-600 shrink-0" /> : <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                <div className="min-w-0">
                  <span className="text-sm font-semibold leading-none">{isSuspended ? "Matrícula suspensa" : "Matrícula ativa"}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Toque para alternar</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!isSuspended}
                aria-label="Matrícula ativa"
                onClick={() => setEditStatus(isSuspended ? "active" : "suspended")}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none shrink-0 ${!isSuspended ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${!isSuspended ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Isenção */}
            <div className="flex items-center justify-between gap-3 p-4 rounded-control border border-border">
              <div className="flex gap-2.5 items-center min-w-0">
                <HandHeart className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold leading-none">Cota social / isenção</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Elegível para benefícios</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editFinancialAid}
                aria-label="Cota social / isenção"
                onClick={() => setEditFinancialAid(!editFinancialAid)}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none shrink-0 ${editFinancialAid ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${editFinancialAid ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <Button
              variant="arcade"
              onClick={handleSave}
              disabled={saving}
              className="w-full h-11 font-bold rounded-control"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        {/* Direita: acompanhamento */}
        <div className="xl:col-span-3 space-y-5 min-w-0">

          {/* Frequência */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Presenças", value: String(attStats.present), tone: "text-emerald-600", labelTone: "!text-emerald-600", icon: CheckCircle2 },
              { label: "Faltas", value: String(attStats.absent), tone: "text-red-600", labelTone: "!text-red-600", icon: XCircle },
              { label: "Justificadas", value: String(attStats.justified), tone: "", labelTone: "", icon: Clock },
              { label: "Frequência", value: presencePct !== null ? `${presencePct}%` : "—", tone: presencePct === null ? "" : presencePct >= 75 ? "text-emerald-600" : "text-red-600", labelTone: "", icon: BarChart3 },
            ].map((s) => (
              <Card key={s.label} className="rounded-card shadow-none">
                <CardContent className="p-4">
                  <p className={`u-label flex items-center gap-1.5 ${s.labelTone}`}><s.icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.label}</span></p>
                  <p className={`u-num text-2xl leading-none mt-2 ${s.tone}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Responsáveis legais */}
          {profile?.id && <GuardiansCard studentId={profile.id} />}

          {/* Observações internas (troca de sala, ocorrências) */}
          {profile?.id && <StudentNotesCard studentId={profile.id} />}

          {/* Tendência de frequência */}
          <Card className="rounded-card shadow-none">
            <CardHeader className="p-5 sm:p-6 pb-2">
              <CardTitle className="text-base font-bold flex flex-wrap items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Frequência semanal
                <span className="text-xs font-normal text-muted-foreground">(últimas 12 semanas)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-0">
              {attTrend.length === 0 ? (
                <EmptyState
                  compact
                  icon={TrendingUp}
                  title="Nenhuma chamada nas últimas 12 semanas"
                  description="A curva aparece quando este aluno tiver frequência lançada."
                />
              ) : (
                <div className="h-44">
                  <LineChartPremium data={attTrend} xKey="week" yKey="pct" color="#10b981" referenceY={75} unit="%" domainMax={100} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Renda */}
          {(Number(profile.family_income) > 0 || profile.is_financial_aid_eligible) && (
            <Card className="rounded-card shadow-none">
              <CardHeader className="p-5 sm:p-6 pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <HandHeart className="h-5 w-5 text-muted-foreground" />
                  Situação de renda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Renda familiar", value: Number(profile.family_income) > 0 ? fmtBRL(profile.family_income) : "—" },
                    { label: "Moradores", value: txt(profile.family_size) },
                    { label: "Per capita", value: perCapita > 0 ? fmtBRL(perCapita) : "—" },
                  ].map((item) => (
                    <div key={item.label} className="p-3 bg-muted/40 rounded-control">
                      <p className="u-label">{item.label}</p>
                      <p className="u-num text-base leading-none mt-1.5">{item.value}</p>
                    </div>
                  ))}
                </div>

                {perCapita > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2 u-label !tracking-wider">
                      <span>R$ 0</span>
                      <span>Limite {fmtBRL(INCOME_THRESHOLD)}</span>
                      <span className="hidden sm:inline">{fmtBRL(INCOME_THRESHOLD * 2)}+</span>
                    </div>
                    <div className="relative h-3 bg-muted rounded-full">
                      <div className="absolute left-0 top-0 h-full w-1/2 bg-emerald-100 rounded-l-full" />
                      <div className="absolute left-1/2 top-0 h-full w-1/2 bg-red-100 rounded-r-full" />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white -translate-x-1/2 z-10"
                        style={{
                          left: `${Math.min(98, Math.max(2, (perCapita / (INCOME_THRESHOLD * 2)) * 100))}%`,
                          background: incomeStatus === "ok" ? "#10b981" : "#ef4444",
                        }}
                      />
                    </div>
                    <Badge className={`border-none font-bold text-[11px] px-2.5 mt-1 ${incomeStatus === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {incomeStatus === "ok" ? "Dentro do limite: elegível para isenção" : "Acima do limite"}
                    </Badge>
                  </div>
                )}

                {profile.family_members && Array.isArray(profile.family_members) && profile.family_members.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                    <p className="u-label mb-2">Composição familiar</p>
                    {profile.family_members.map((m: any, i: number) => (
                      <div key={i} className="flex justify-between items-center gap-2 text-xs bg-muted/40 px-3 py-2 rounded-control">
                        <span className="text-muted-foreground truncate">{txt(m?.label, `Integrante ${i + 1}`)}</span>
                        <span className="u-num shrink-0">{fmtBRL(m?.income || 0, "R$ 0,00")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Boletins em PDF */}
          <Card className="rounded-card shadow-none overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Boletins oficiais em PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reportCard(1)}
              {reportCard(2)}
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card className="rounded-card shadow-none">
            <CardHeader className="p-5 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-muted-foreground" />
                  Documentos enviados
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${checklistPct}%` }} />
                  </div>
                  <span className="u-num text-xs">{checklistPct}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-0">
              {uploads.length === 0 ? (
                <EmptyState
                  compact
                  icon={FileCheck}
                  title="Nenhum documento enviado ainda"
                  description="Quando o aluno enviar documentos pela plataforma, eles aparecem aqui e na fila de revisão."
                  action={{ label: "Ver fila de documentos", href: "/dashboard/secretary/uploads" }}
                />
              ) : (
                <div className="space-y-2">
                  {uploads.map((doc) => {
                    const ds = docStatus(doc.status);
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-control border border-border">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-control flex items-center justify-center shrink-0 ${ds.box}`}>
                            {ds.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{doc.title || DOC_TYPE_LABELS[doc.doc_type] || txt(doc.doc_type, "Documento")}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtLocale(doc.uploaded_at, 'date', "pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`border-none font-bold text-[10px] px-2 h-5 ${ds.cls}`}>
                            {ds.label}
                          </Badge>
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir documento"
                              className="h-8 w-8 rounded-control border border-border flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
