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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EDUCATIONAL_CATEGORIES } from "@/lib/constants";
import { DOCUMENT_ACCEPT, detectKind, toClassMaterialType, describeFile, type FileKind } from "@/lib/file-types";

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
    pdf: "bg-red-500/15 text-red-400 border-red-500/25",
    video: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    link: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    imagem: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    outro: "bg-white/5 text-white/70 border-white/8",
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

      toast({ title: "Material publicado!" });
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
      toast({ title: "Material removido." });
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
    m.created_at.startsWith(new Date().toISOString().slice(0, 7))
  ).length;

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(59,130,246,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="h-3 w-3 text-orange-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
                  Acervo Pedagógico
                </p>
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
                Materiais de Aula
              </h1>
              <p className="text-white/70 text-xs font-semibold mt-1">
                PDFs, vídeos e links para alunos
              </p>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl py-2.5">
              <span className="text-lg font-black text-white leading-none">{materials.length}</span>
              <span className="text-[8px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Total</span>
            </div>
            <div className="flex flex-col items-center bg-blue-500/10 border border-blue-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-blue-400 leading-none">{totalViews}</span>
              <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-wider mt-0.5">Views</span>
            </div>
            <div className="flex flex-col items-center bg-emerald-500/10 border border-emerald-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-emerald-400 leading-none">{thisMonth}</span>
              <span className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-wider mt-0.5">Mês</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Composer toggle ── */}
      {!showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full h-12 bg-[#4CCCED] hover:bg-orange-600 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/20 text-xs uppercase tracking-widest border-none"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Novo Material
        </Button>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div className="bg-white shadow-sm border border-slate-200 rounded-[1.5rem] overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-white shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-orange-400/85" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
                Publicar Material
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(blank);
                setFile(null);
                setUrlInput("");
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-500 uppercase tracking-wider"
            >
              Fechar
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Título *
              </Label>
              <input
                type="text"
                placeholder="Ex: Slides — Funções do 2º Grau"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Matéria</Label>
                <Select value={form.subject} onValueChange={(val) => setForm((f) => ({ ...f, subject: val }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white max-h-60">
                    <SelectItem value="none" className="font-bold text-slate-600 text-xs">Nenhuma</SelectItem>
                    {EDUCATIONAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="font-bold text-slate-600 text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Tipo</Label>
                <Select value={form.file_type} onValueChange={(val) => setForm((f) => ({ ...f, file_type: val }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white">
                    {FILE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="font-bold text-slate-600 text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Público</Label>
                <Select value={form.target_group} onValueChange={(val) => setForm((f) => ({ ...f, target_group: val }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white">
                    {TARGET_GROUPS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="font-bold text-slate-600 text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Aula</Label>
                <Select value={form.session_id} onValueChange={(val) => setForm((f) => ({ ...f, session_id: val }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white">
                    <SelectItem value="none" className="font-bold text-slate-600 text-xs">Nenhuma</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-bold text-slate-600 text-xs">
                        {format(new Date(s.session_date + "T00:00:00"), "dd/MM", { locale: ptBR })} — {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upload / URL toggle */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUseUpload(true)}
                  className={`h-9 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all touch-manipulation ${
                    useUpload
                      ? "bg-[#4CCCED] text-slate-800 shadow-lg shadow-orange-500/20"
                      : "bg-white shadow-sm border border-slate-200 text-slate-600"
                  }`}
                >
                  Upload
                </button>
                <button
                  onClick={() => setUseUpload(false)}
                  className={`h-9 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all touch-manipulation ${
                    !useUpload
                      ? "bg-[#4CCCED] text-slate-800 shadow-lg shadow-orange-500/20"
                      : "bg-white shadow-sm border border-slate-200 text-slate-600"
                  }`}
                >
                  URL / Link
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
                    className="w-full h-11 rounded-xl bg-white shadow-sm border-2 border-dashed border-[#4CCCED]/20 hover:border-[#4CCCED]/40 cursor-pointer p-2 text-xs text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-[#4CCCED] file:text-slate-800"
                  />
                  <p className="text-[9px] font-bold text-slate-400 mt-1 leading-relaxed">
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
                  className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Descrição (opcional)
              </Label>
              <Textarea
                placeholder="Detalhes sobre este material..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 placeholder:text-slate-500 font-medium text-sm resize-none focus-visible:ring-orange-500/30 focus-visible:border-[#4CCCED]/30 min-h-[80px]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={saving || !form.title || (!file && !urlInput)}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Publicar Material
            </Button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      {!loading && materials.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 font-bold text-xs">
              <SelectValue placeholder="Todos tipos" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 bg-white">
              <SelectItem value="all" className="font-bold text-slate-600 text-xs">Todos os tipos</SelectItem>
              {FILE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="font-bold text-slate-600 text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subjects.length > 0 && (
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 font-bold text-xs">
                <SelectValue placeholder="Todas matérias" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="all" className="font-bold text-slate-600 text-xs">Todas matérias</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s} className="font-bold text-slate-600 text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-[1.5rem]">
          <FolderOpen className="h-8 w-8 text-white/15 mx-auto mb-2" />
          <p className="font-black italic text-xs text-slate-500 uppercase tracking-widest">
            Nenhum material publicado
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const { label: typeLabel, Icon } = describeMaterial(m);
            const viewCount = m.material_views?.[0]?.count ?? 0;
            return (
              <div
                key={m.id}
                className="bg-white shadow-sm border border-slate-200 rounded-2xl p-3.5 group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#4CCCED]/15 border border-[#4CCCED]/25 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-slate-800 text-sm truncate flex-1 italic leading-tight">
                        {m.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge className={`text-[8px] font-black border px-2 h-4 ${getTypeBadgeColor(m.file_type)}`}>
                        {typeLabel}
                      </Badge>
                      {m.subject && (
                        <Badge className="text-[8px] font-black border-none bg-white shadow-sm text-slate-600 px-2 h-4">
                          {m.subject}
                        </Badge>
                      )}
                      <Badge className="text-[8px] font-black border-none bg-white shadow-sm text-slate-600 px-2 h-4">
                        {TARGET_GROUPS.find((t) => t.value === m.target_group)?.label ?? "Todos"}
                      </Badge>
                    </div>
                    {m.description && (
                      <p className="text-[11px] text-slate-600 font-medium italic mt-1.5 truncate leading-tight">
                        {m.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>{format(new Date(m.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                      <span className="text-white/15">·</span>
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" />
                        {viewCount}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-slate-100">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all active:scale-95 touch-manipulation"
                  >
                    <BookOpen className="h-3 w-3" />
                    Abrir
                  </a>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-40 touch-manipulation"
                  >
                    {deletingId === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
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
