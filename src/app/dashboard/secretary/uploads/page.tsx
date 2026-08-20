"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  Loader2,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  FolderOpen,
  Eye,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DOC_TYPES: Record<string, string> = {
  atestado:               "Atestado Médico",
  rg:                     "RG",
  cpf:                    "CPF",
  historico:              "Histórico Escolar",
  comprovante_residencia: "Comprovante de Residência",
  certidao:               "Certidão",
  comprovante_renda:      "Comprovante de Renda",
  outro:                  "Outro",
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendente:  { label: "Aguardando",  color: "bg-amber-100 text-amber-700",   icon: Clock },
  aprovado:  { label: "Aprovado",    color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado",   color: "bg-red-100 text-red-700",       icon: XCircle },
};

interface Upload {
  id: string;
  student_id: string;
  student_name: string | null;
  doc_type: string;
  title: string;
  file_url: string;
  status: string;
  notes: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
}

export default function SecretaryUploadsPage() {
  const { userRole, loading: isUserLoading, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [reviewTarget, setReviewTarget] = useState<Upload | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"aprovado" | "rejeitado">("aprovado");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    // Teto defensivo: fila de revisão sem limite reenviaria o histórico
    // inteiro de documentos da plataforma a cada carregamento; 3000 (desc)
    // cobre qualquer fila de aprovação real sem herdar anos de uploads.
    const { data, error } = await supabase
      .from("student_uploads")
      .select("id,student_id,student_name,doc_type,title,file_url,status,notes,uploaded_at,reviewed_at")
      .order("uploaded_at", { ascending: false })
      .limit(3000);
    if (!error) setUploads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userRole === "staff" || userRole === "admin") fetchUploads();
  }, [fetchUploads, userRole]);

  const handleReview = async () => {
    if (!reviewTarget || !user) return;
    setReviewing(true);
    try {
      const { error } = await supabase
        .from("student_uploads")
        .update({
          status: reviewStatus,
          notes: reviewNotes.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", reviewTarget.id);
      if (error) throw error;
      setUploads(prev =>
        prev.map(u =>
          u.id === reviewTarget.id
            ? { ...u, status: reviewStatus, notes: reviewNotes.trim() || null, reviewed_at: new Date().toISOString() }
            : u
        )
      );
      toast({ title: reviewStatus === "aprovado" ? "Documento aprovado!" : "Documento rejeitado." });
      setReviewTarget(null);
      setReviewNotes("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setReviewing(false);
    }
  };

  const filtered = uploads.filter(u => {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const matchSearch = !search.trim() || norm(u.student_name || "").includes(norm(search)) || norm(u.title).includes(norm(search));
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchType = typeFilter === "all" || u.doc_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const pendingCount = uploads.filter(u => u.status === "pendente").length;
  const approvedCount = uploads.filter(u => u.status === "aprovado").length;
  const rejectedCount = uploads.filter(u => u.status === "rejeitado").length;

  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Carregando documentos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black text-primary italic leading-none uppercase tracking-tighter">
              Documentos dos Alunos
            </h1>
            {pendingCount > 0 && (
              <Badge className="bg-amber-500 text-white border-none font-black text-[10px] px-3 py-1 shadow-md uppercase tracking-widest">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground font-medium italic text-sm">
            Revise, aprove ou rejeite os documentos enviados pelos estudantes.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-4">
        {[
          { label: "Aguardando", value: pendingCount, color: "bg-amber-50 text-amber-600" },
          { label: "Aprovados",  value: approvedCount, color: "bg-emerald-50 text-emerald-600" },
          { label: "Rejeitados", value: rejectedCount, color: "bg-red-50 text-red-600" },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-xl rounded-2xl md:rounded-3xl bg-white">
            <CardContent className="p-4 md:p-6">
              <div className={`h-9 w-9 rounded-xl ${s.color} flex items-center justify-center mb-3 md:mb-4`}>
                <FileText className="h-4 w-4" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-primary leading-none italic">{s.value}</p>
              <p className="text-[9px] md:text-[10px] text-primary/70 font-black uppercase tracking-wider mt-2">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por aluno ou título..."
            className="pl-11 h-12 bg-white border-none shadow-md rounded-2xl font-medium w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-12 rounded-2xl bg-white border-none shadow-md font-bold">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value="all" className="font-bold text-xs">Todos os status</SelectItem>
            <SelectItem value="pendente" className="font-bold text-xs">Aguardando</SelectItem>
            <SelectItem value="aprovado" className="font-bold text-xs">Aprovados</SelectItem>
            <SelectItem value="rejeitado" className="font-bold text-xs">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-12 rounded-2xl bg-white border-none shadow-md font-bold">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value="all" className="font-bold text-xs">Todos os tipos</SelectItem>
            {Object.entries(DOC_TYPES).map(([val, label]) => (
              <SelectItem key={val} value={val} className="font-bold text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 rounded-[2rem] bg-white shadow-sm animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white">
          <CardContent className="py-20 flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-primary/30" />
            </div>
            <p className="font-black text-primary/40 italic">Nenhum documento encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(upload => {
            const statusMeta = STATUS_META[upload.status] || STATUS_META.pendente;
            const StatusIcon = statusMeta.icon;
            return (
              <Card
                key={upload.id}
                className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden hover:shadow-2xl transition-all duration-200"
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-primary/40" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-primary italic truncate">{upload.title}</p>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                          {upload.student_name || "Aluno desconhecido"}
                        </p>
                      </div>
                      <Badge className={`${statusMeta.color} border-none font-black text-[9px] uppercase px-2 shrink-0 flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusMeta.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-[9px] px-2">
                        {DOC_TYPES[upload.doc_type] || "Outro"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Enviado em {format(new Date(upload.uploaded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {upload.reviewed_at && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          · Revisado em {format(new Date(upload.reviewed_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {upload.notes && (
                      <p className="text-[11px] text-slate-500 mt-2 p-2.5 bg-slate-50 rounded-xl font-medium border border-slate-100">
                        <span className="font-black text-primary/60">Nota:</span> {upload.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      title="Abrir documento"
                      className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary"
                    >
                      <a href={upload.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {upload.status === "pendente" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Revisar documento"
                        onClick={() => { setReviewTarget(upload); setReviewStatus("aprovado"); setReviewNotes(""); }}
                        className="h-10 w-10 rounded-xl hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Revisão */}
      <Dialog open={!!reviewTarget} onOpenChange={v => { if (!v) setReviewTarget(null); }}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-primary italic leading-none uppercase tracking-tighter">
                  Revisar Documento
                </DialogTitle>
                <DialogDescription className="text-xs mt-1 font-medium text-muted-foreground">
                  {reviewTarget?.student_name} · {reviewTarget ? DOC_TYPES[reviewTarget.doc_type] : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {reviewTarget && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-primary italic truncate">{reviewTarget.title}</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {format(new Date(reviewTarget.uploaded_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-primary/10 shrink-0">
                  <a href={reviewTarget.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Decisão</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewStatus("aprovado")}
                  className={`h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                    reviewStatus === "aprovado"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                      : "bg-white text-slate-400 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5" /> Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatus("rejeitado")}
                  className={`h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                    reviewStatus === "rejeitado"
                      ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-200"
                      : "bg-white text-slate-400 border-slate-200 hover:border-red-300"
                  }`}
                >
                  <XCircle className="h-5 w-5" /> Rejeitar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Observação {reviewStatus === "rejeitado" ? "(obrigatório)" : "(opcional)"}
              </Label>
              <Textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder={reviewStatus === "rejeitado" ? "Explique o motivo da rejeição..." : "Comentário opcional..."}
                className="bg-muted/30 border-none rounded-xl font-medium text-sm resize-none min-h-[80px]"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setReviewTarget(null)} className="flex-1 h-12 rounded-2xl font-black text-xs border-slate-200">
                Cancelar
              </Button>
              <Button
                onClick={handleReview}
                disabled={reviewing || (reviewStatus === "rejeitado" && !reviewNotes.trim())}
                className={`flex-1 h-12 rounded-2xl font-black text-xs border-none shadow-lg text-white ${
                  reviewStatus === "aprovado" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"
                }`}
              >
                {reviewing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                {reviewStatus === "aprovado" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
