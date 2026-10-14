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
import { fmtDate, txt } from '@/lib/format';
import { EmptyState } from "@/components/EmptyState";

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
  // Aguardando é ausência de decisão: neutro. Cor só em aprovado/rejeitado.
  pendente:  { label: "Aguardando",  color: "bg-muted text-muted-foreground", icon: Clock },
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
      toast({ title: reviewStatus === "aprovado" ? "Documento aprovado" : "Documento rejeitado" });
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
        <p className="u-label">Carregando documentos…</p>
      </div>
    );
  }

  const hasFilter = !!search.trim() || statusFilter !== "all" || typeFilter !== "all";
  const fieldCls = "h-11 rounded-control bg-muted/30 border-none text-sm";

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div>
        <p className="u-label flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5" /> Secretaria · documentos enviados</p>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="u-page-title text-3xl">Documentos dos alunos</h1>
          {pendingCount > 0 && (
            <Badge variant="outline" className="font-bold text-xs px-2.5">
              <span className="u-num mr-1">{pendingCount}</span> pendente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          Revise, aprove ou rejeite os documentos enviados pelos alunos.
        </p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-4">
        {[
          { label: "Aguardando", value: pendingCount, tone: "", labelTone: "" },
          { label: "Aprovados",  value: approvedCount, tone: "text-emerald-600", labelTone: "!text-emerald-600" },
          { label: "Rejeitados", value: rejectedCount, tone: "text-red-600", labelTone: "!text-red-600" },
        ].map(s => (
          <Card key={s.label} className="rounded-card shadow-none">
            <CardContent className="p-4 md:p-6">
              <p className={`u-label truncate ${s.labelTone}`}>{s.label}</p>
              <p className={`u-num text-2xl md:text-3xl leading-none mt-2 ${s.tone}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por aluno ou título..."
            className={`pl-10 w-full ${fieldCls}`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={fieldCls}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-control">
            <SelectItem value="all" className="text-sm">Todos os status</SelectItem>
            <SelectItem value="pendente" className="text-sm">Aguardando</SelectItem>
            <SelectItem value="aprovado" className="text-sm">Aprovados</SelectItem>
            <SelectItem value="rejeitado" className="text-sm">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className={fieldCls}>
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent className="rounded-control">
            <SelectItem value="all" className="text-sm">Todos os tipos</SelectItem>
            {Object.entries(DOC_TYPES).map(([val, label]) => (
              <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 rounded-card bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={uploads.length === 0 ? "Nenhum documento enviado ainda" : "Nenhum documento com esses filtros"}
          description={uploads.length === 0
            ? "Quando um aluno enviar atestado, RG ou outro documento pela plataforma, ele aparece aqui para revisão."
            : "Tente outro nome ou limpe os filtros para ver todos."}
          action={hasFilter ? { label: "Limpar filtros", onClick: () => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); } } : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map(upload => {
            const statusMeta = STATUS_META[upload.status] || STATUS_META.pendente;
            const StatusIcon = statusMeta.icon;
            return (
              <Card key={upload.id} className="rounded-card shadow-none overflow-hidden">
                <CardContent className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                  <div className="hidden sm:flex h-11 w-11 rounded-control bg-muted items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{txt(upload.title, "Sem título")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {upload.student_name || "Aluno desconhecido"}
                        </p>
                      </div>
                      <Badge className={`${statusMeta.color} border-none font-bold text-[10px] px-2 shrink-0 flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusMeta.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-x-2 gap-y-1 mt-2 flex-wrap">
                      <Badge variant="outline" className="font-semibold text-[10px] px-2">
                        {DOC_TYPES[upload.doc_type] || "Outro"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Enviado em {fmtDate(upload.uploaded_at, "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                      {upload.reviewed_at && (
                        <span className="text-xs text-muted-foreground">
                          · Revisado em {fmtDate(upload.reviewed_at, "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>

                    {upload.notes && (
                      <p className="text-xs text-muted-foreground mt-2 p-2.5 bg-muted/40 rounded-control">
                        <span className="font-semibold text-foreground">Observação:</span> {upload.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0">
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      title="Abrir documento"
                      className="h-9 w-9 rounded-control"
                    >
                      <a href={upload.file_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir documento">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {upload.status === "pendente" && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Revisar documento"
                        aria-label="Revisar documento"
                        onClick={() => { setReviewTarget(upload); setReviewStatus("aprovado"); setReviewNotes(""); }}
                        className="h-9 w-9 rounded-control"
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

      {/* Revisão */}
      <Dialog open={!!reviewTarget} onOpenChange={v => { if (!v) setReviewTarget(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-card p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b text-left">
            <p className="u-label">Secretaria · documentos</p>
            <DialogTitle className="u-page-title text-xl mt-0.5">
              Revisar documento
            </DialogTitle>
            <DialogDescription className="text-xs mt-1 text-muted-foreground">
              {txt(reviewTarget?.student_name, "Aluno")} · {reviewTarget ? (DOC_TYPES[reviewTarget.doc_type] || "Outro") : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {reviewTarget && (
              <div className="flex items-center gap-3 p-3.5 rounded-control border border-border">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{txt(reviewTarget.title, "Sem título")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(reviewTarget.uploaded_at, "dd 'de' MMM 'de' yyyy")}
                  </p>
                </div>
                <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-control shrink-0">
                  <a href={reviewTarget.file_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir documento">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label className="u-label ml-1">Decisão</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewStatus("aprovado")}
                  aria-pressed={reviewStatus === "aprovado"}
                  className={`h-12 rounded-control font-bold text-sm flex items-center justify-center gap-2 transition-colors border-2 ${
                    reviewStatus === "aprovado"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-background text-muted-foreground border-border hover:border-emerald-300"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5" /> Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatus("rejeitado")}
                  aria-pressed={reviewStatus === "rejeitado"}
                  className={`h-12 rounded-control font-bold text-sm flex items-center justify-center gap-2 transition-colors border-2 ${
                    reviewStatus === "rejeitado"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-background text-muted-foreground border-border hover:border-red-300"
                  }`}
                >
                  <XCircle className="h-5 w-5" /> Rejeitar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="u-label ml-1">
                Observação {reviewStatus === "rejeitado" ? "(obrigatória)" : "(opcional)"}
              </Label>
              <Textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder={reviewStatus === "rejeitado" ? "Explique o motivo da rejeição..." : "Comentário opcional..."}
                className="bg-muted/30 border-none rounded-control text-sm resize-none min-h-[80px]"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setReviewTarget(null)} className="flex-1 h-11 rounded-control font-bold">
                Cancelar
              </Button>
              <Button
                onClick={handleReview}
                disabled={reviewing || (reviewStatus === "rejeitado" && !reviewNotes.trim())}
                className={`flex-1 h-11 rounded-control font-bold text-white ${
                  reviewStatus === "aprovado" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {reviewing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                {reviewStatus === "aprovado" ? "Confirmar aprovação" : "Confirmar rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
