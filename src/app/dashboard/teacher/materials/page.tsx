"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen,
  PlusCircle,
  Trash2,
  Loader2,
  FileText,
  Video,
  Link2,
  Image,
  File,
  Eye,
  BookOpen,
  Presentation,
  FileSpreadsheet,
  FileType,
  FileAudio,
  FileArchive,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { EDUCATIONAL_CATEGORIES } from "@/lib/constants";
import { DOCUMENT_ACCEPT, detectKind, toClassMaterialType, describeFile, type FileKind } from "@/lib/file-types";
import { fmtDate, fmtNumber } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

type ClassMaterial = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  file_url: string;
  file_type: string;
  target_group: string;
  teacher_id: string;
  teacher_name: string | null;
  session_id: string | null;
  is_published: boolean;
  created_at: string;
  material_views: { count: number }[];
};

type ClassSession = {
  id: string;
  title: string;
  session_date: string;
};

const FILE_TYPES = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "video", label: "Vídeo", icon: Video },
  { value: "link", label: "Link", icon: Link2 },
  { value: "imagem", label: "Imagem", icon: Image },
  { value: "outro", label: "Outro", icon: File },
];

const TARGET_GROUPS = [
  { value: "all", label: "Todos" },
  { value: "enem", label: "ENEM" },
  { value: "etec", label: "ETEC/FATEC" },
];

const blank = { title: "", description: "", subject: "none", file_type: "pdf", target_group: "all", session_id: "none" };

function getTypeBadgeColor(type: string) {
  const map: Record<string, string> = {
    // Cor categórica (diz o que o arquivo é), em par legível sobre fundo claro.
    pdf: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
    video: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
    link: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30",
    imagem: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    outro: "bg-muted text-muted-foreground border-border",
  };
  return map[type] ?? map.outro;
}

// Ícone por "kind" amplo (PowerPoint, Word, Excel, etc.)
const KIND_ICON: Record<FileKind, any> = {
  pdf: FileText,
  documento: FileType,
  apresentacao: Presentation,
  planilha: FileSpreadsheet,
  texto: FileText,
  imagem: Image,
  video: Video,
  audio: FileAudio,
  compactado: FileArchive,
  outro: File,
};

// Rótulo + ícone para exibição: deriva do arquivo (extensão) quando possível,
// senão usa o tipo escolhido manualmente.
function describeMaterial(m: { file_type: string; file_url: string }): { label: string; Icon: any } {
  if (m.file_type === "link") return { label: "Link", Icon: Link2 };
  const detected = describeFile(m.file_url);
  if (detected.kind !== "outro") return { label: detected.label, Icon: KIND_ICON[detected.kind] };
  const ft = FILE_TYPES.find((t) => t.value === m.file_type);
  return { label: ft?.label ?? "Arquivo", Icon: ft?.icon ?? File };
}

export default function TeacherMaterialsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [materials, setMaterials] = useState<ClassMaterial[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [useUpload, setUseUpload] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchData() {
    if (!user) return;
    setLoading(true);
    const [matRes, sesRes] = await Promise.all([
      supabase
        .from("class_materials")
        .select("*, material_views(count)")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("class_sessions")
        .select("id, title, session_date")
        .eq("teacher_id", user.id)
        .order("session_date", { ascending: false }),
    ]);
    setMaterials(matRes.data ?? []);
    setSessions(sesRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  async function handleSubmit() {
    if (!form.title || (!file && !urlInput) || !user) return;
    setSaving(true);
    try {
      let finalUrl = urlInput;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `materials/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("learning-contents").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("learning-contents").getPublicUrl(path);
        finalUrl = urlData.publicUrl;
      }

      const payload = {
        title: form.title,
        description: form.description || null,
        subject: form.subject === "none" ? null : form.subject,
        file_url: finalUrl,
        file_type: form.file_type,
        target_group: form.target_group,
        session_id: form.session_id === "none" ? null : form.session_id,
        teacher_id: user.id,
        teacher_name: profile?.full_name ?? null,
        is_published: true,
      };

      const { data: matData, error } = await supabase
        .from("class_materials")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "material", materialId: matData.id }),
      }).catch(() => {});

      toast({ title: "Material publicado" });
      setForm(blank);
      setFile(null);
      setUrlInput("");
      setShowForm(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este material?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("class_materials").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Material removido" });
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    }
    setDeletingId(null);
  }

  const subjects = Array.from(new Set(materials.map((m) => m.subject).filter(Boolean))) as string[];

  const filtered = materials.filter((m) => {
    if (filterType !== "all" && m.file_type !== filterType) return false;
    if (filterSubject !== "all" && m.subject !== filterSubject) return false;
    return true;
  });

  const totalViews = materials.reduce((acc, m) => acc + (m.material_views?.[0]?.count ?? 0), 0);
  const thisMonth = materials.filter((m) =>
    (m.created_at ?? "").startsWith(new Date().toISOString().slice(0, 7))
  ).length;

  const closeForm = () => {
    setShowForm(false);
    setForm(blank);
    setFile(null);
    setUrlInput("");
  };

  return (
    <div className="pb-24 space-y-5">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5" /> Professor · materiais</p>
          <h1 className="u-page-title text-3xl mt-1">Materiais de aula</h1>
          <p className="text-sm text-muted-foreground mt-1">PDFs, vídeos e links para os alunos.</p>
        </div>
        {!showForm && (
          <Button
            variant="arcade"
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto h-11 px-5 rounded-control font-bold"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Novo material
          </Button>
        )}
      </div>

      {/* ── Contadores ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Total</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(materials.length)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Visualizações</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(totalViews)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Este mês</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(thisMonth)}</p>
        </div>
      </div>

      {/* ── Formulário ── */}
      {showForm && (
        <div className="u-surface overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between gap-3">
            <p className="font-bold text-base text-foreground flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" />
              Publicar material
            </p>
            <button
              onClick={closeForm}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="u-label">Título *</Label>
              <input
                type="text"
                placeholder="Ex.: Slides — Funções do 2º grau"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full h-11 bg-background border border-input rounded-control px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="u-label">Matéria</Label>
                <Select value={form.subject} onValueChange={(val) => setForm((f) => ({ ...f, subject: val }))}>
                  <SelectTrigger className="h-11 rounded-control text-sm font-medium">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control max-h-60">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {EDUCATIONAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Tipo</Label>
                <Select value={form.file_type} onValueChange={(val) => setForm((f) => ({ ...f, file_type: val }))}>
                  <SelectTrigger className="h-11 rounded-control text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {FILE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Público</Label>
                <Select value={form.target_group} onValueChange={(val) => setForm((f) => ({ ...f, target_group: val }))}>
                  <SelectTrigger className="h-11 rounded-control text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    {TARGET_GROUPS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Aula</Label>
                <Select value={form.session_id} onValueChange={(val) => setForm((f) => ({ ...f, session_id: val }))}>
                  <SelectTrigger className="h-11 rounded-control text-sm font-medium">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {fmtDate(s.session_date + "T00:00:00", "dd/MM")} — {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arquivo ou link */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-control bg-muted">
                <button
                  onClick={() => setUseUpload(true)}
                  className={`h-9 text-sm font-semibold rounded-control transition-colors touch-manipulation ${
                    useUpload ? "bg-background text-foreground border border-border" : "text-muted-foreground"
                  }`}
                >
                  Enviar arquivo
                </button>
                <button
                  onClick={() => setUseUpload(false)}
                  className={`h-9 text-sm font-semibold rounded-control transition-colors touch-manipulation ${
                    !useUpload ? "bg-background text-foreground border border-border" : "text-muted-foreground"
                  }`}
                >
                  Colar link
                </button>
              </div>
              {useUpload ? (
                <>
                  <input
                    key="file-input"
                    type="file"
                    accept={DOCUMENT_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      // Detecta automaticamente o tipo a partir da extensão
                      if (f) setForm((prev) => ({ ...prev, file_type: toClassMaterialType(detectKind(f.name)) }));
                    }}
                    className="w-full h-11 rounded-control bg-background border-2 border-dashed border-border hover:border-primary/40 cursor-pointer p-2 text-xs text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Aceita PDF, Word, PowerPoint, Excel, texto, imagens, vídeo, áudio e mais.
                  </p>
                </>
              ) : (
                <input
                  key="url-input"
                  type="text"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full h-11 bg-background border border-input rounded-control px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="u-label">Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes sobre este material..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-control text-sm resize-none min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={saving || !form.title || (!file && !urlInput)}
              className="w-full h-11 rounded-control font-bold"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Publicar material
            </Button>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      {!loading && materials.length > 0 && (
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 rounded-control text-sm font-medium">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all">Todos os tipos</SelectItem>
              {FILE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subjects.length > 0 && (
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="h-10 rounded-control text-sm font-medium">
                <SelectValue placeholder="Todas as matérias" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Todas as matérias</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* ── Lista ── */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        materials.length > 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Nenhum material com esses filtros"
            description="Troque o tipo ou a matéria para ver os outros materiais."
            action={{ label: "Limpar filtros", onClick: () => { setFilterType("all"); setFilterSubject("all"); } }}
          />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="Você ainda não publicou materiais"
            description="Envie um PDF, vídeo ou link e ele aparece para os alunos da turma."
            action={showForm ? undefined : { label: "Novo material", icon: PlusCircle, onClick: () => setShowForm(true) }}
          />
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const { label: typeLabel, Icon } = describeMaterial(m);
            const viewCount = m.material_views?.[0]?.count ?? 0;
            return (
              <div
                key={m.id}
                className="u-surface p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate leading-tight">
                      {m.title || "Material sem título"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] font-bold border px-2 h-5 ${getTypeBadgeColor(m.file_type)}`}>
                        {typeLabel}
                      </Badge>
                      {m.subject && (
                        <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground px-2 h-5">
                          {m.subject}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground px-2 h-5">
                        {TARGET_GROUPS.find((t) => t.value === m.target_group)?.label ?? "Todos"}
                      </Badge>
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 truncate leading-tight">
                        {m.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 u-label !tracking-[0.12em]">
                      <span>{fmtDate(m.created_at, "dd/MM/yy")}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1" title="Visualizações">
                        <Eye className="h-3 w-3" />
                        {fmtNumber(viewCount)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 rounded-control flex items-center gap-1.5 text-xs font-bold text-foreground border border-border hover:bg-muted transition-colors touch-manipulation"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    aria-label="Remover material"
                    className="h-9 w-9 rounded-control flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40 touch-manipulation"
                  >
                    {deletingId === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
