"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Loader2, Eye, Globe, Lock, Trash2, Layers,
  Film, ListVideo, X, Inbox, LayoutDashboard, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { EDUCATIONAL_CATEGORIES } from "@/lib/constants";
import { getTrailCoverUrl, isPlaceholderImage } from "@/lib/trail-cover";
import { EmptyState } from "@/components/EmptyState";
import { ContentCover } from "@/components/ContentCover";
import { fmtNumber } from "@/lib/format";

export default function TeacherTrailsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [trails, setTrails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTrail, setNewTrail] = useState({ title: "", category: "Matemática", description: "", target_audience: "all", image_url: "" });
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [serieName, setSerieName] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  const fetchTrails = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("trails").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setTrails(data || []);
    } catch (e) {
      console.error("Erro ao buscar trilhas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrails(); }, [user]);

  const handleCreateTrail = async () => {
    if (!newTrail.title || !user || isSubmitting) {
      if (!newTrail.title) toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const trailData: any = {
        title: newTrail.title,
        category: newTrail.category,
        description: newTrail.description,
        teacher_id: user.id,
        teacher_name: profile?.name || user.user_metadata?.full_name || "Professor",
        status: "draft",
        trail_type: "standalone",
        image_url: newTrail.image_url,
      };

      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const filePath = `trails/cover-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("learning-contents").upload(filePath, coverFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("learning-contents").getPublicUrl(filePath);
          trailData.image_url = urlData.publicUrl;
        }
      }
      if (!trailData.image_url || isPlaceholderImage(trailData.image_url)) {
        trailData.image_url = getTrailCoverUrl(newTrail.title, newTrail.category);
      }
      if (newTrail.target_audience !== "all") {
        trailData.target_audience = newTrail.target_audience;
      }

      const { data, error } = await supabase.from("trails").insert([trailData]).select().single();
      if (error) throw new Error(error.message);

      toast({ title: "Aula criada", description: "Adicione os módulos para poder publicar." });
      setTrails((prev) => [data, ...prev]);
      setIsCreateDialogOpen(false);
      setNewTrail({ title: "", category: "Matemática", description: "", target_audience: "all", image_url: "" });
      setCoverFile(null);
      setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
    } catch (e: any) {
      toast({ title: "Erro ao criar trilha", description: e?.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrail = async (id: string) => {
    if (!confirm("Tem certeza? Todos os módulos serão removidos.")) return;
    try {
      const { error } = await supabase.from("trails").delete().eq("id", id);
      if (error) throw error;
      setTrails((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Trilha excluída" });
    } catch (e: any) {
      toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMergeTrails = async () => {
    if (selectedIds.size < 2 || !serieName.trim() || !user || isMerging) return;
    setIsMerging(true);
    const ids = Array.from(selectedIds);
    const firstTrail = trails.find((t) => t.id === ids[0]);
    try {
      const { data: serie, error: serieErr } = await supabase
        .from("trails")
        .insert({
          title: serieName.trim(),
          category: firstTrail?.category || "Geral",
          description: `Série criada a partir de ${ids.length} aulas.`,
          teacher_id: user.id,
          teacher_name: profile?.name || user.user_metadata?.full_name || "Professor",
          status: firstTrail?.status || "draft",
          trail_type: "serie",
          target_audience: firstTrail?.target_audience || "all",
          image_url: (firstTrail?.image_url && !isPlaceholderImage(firstTrail.image_url)) ? firstTrail.image_url : getTrailCoverUrl(serieName.trim(), firstTrail?.category || "Geral"),
        })
        .select("id")
        .single();

      if (serieErr || !serie) throw new Error(serieErr?.message || "Falha ao criar série");

      for (const trailId of ids) {
        const { error: modErr } = await supabase.from("modules").update({ trail_id: serie.id }).eq("trail_id", trailId);
        if (modErr) throw new Error(`Módulos de ${trailId}: ${modErr.message}`);
      }

      const { error: delErr } = await supabase.from("trails").delete().in("id", ids);
      if (delErr) throw new Error(delErr.message);

      toast({ title: "Série criada", description: `"${serieName}" agrupa ${ids.length} aulas.` });
      setIsMergeDialogOpen(false);
      setSerieName("");
      setSelectedIds(new Set());
      setMergeMode(false);
      await fetchTrails();
    } catch (e: any) {
      toast({ title: "Erro ao criar série", description: e.message, variant: "destructive" });
    } finally {
      setIsMerging(false);
    }
  };

  const filteredTrails = trails.filter(
    (t) =>
      t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = trails.filter((t) => t.status === "active" || t.status === "published").length;
  const serieCount = trails.filter((t) => t.trail_type === "serie").length;
  const selectedCount = selectedIds.size;

  return (
    <div className="pb-24 space-y-5">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" /> Professor · trilhas</p>
          <h1 className="u-page-title text-3xl mt-1">Minhas trilhas</h1>
          <p className="text-sm text-muted-foreground mt-1">Aulas avulsas e séries de aulas.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-11 px-5 flex items-center justify-center gap-2 bg-primary text-primary-foreground border-2 border-foreground shadow-hard font-bold rounded-control text-sm transition-[transform,box-shadow] touch-manipulation active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <Plus className="h-4 w-4" />
            Nova aula
          </button>
          {mergeMode ? (
            <button
              onClick={() => { setMergeMode(false); setSelectedIds(new Set()); }}
              className="h-11 px-5 flex items-center justify-center gap-2 bg-card border border-border text-foreground font-bold rounded-control text-sm hover:bg-muted transition-colors touch-manipulation"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          ) : (
            <button
              onClick={() => setMergeMode(true)}
              className="h-11 px-5 flex items-center justify-center gap-2 bg-card border border-border text-foreground font-bold rounded-control text-sm hover:bg-muted transition-colors touch-manipulation"
            >
              <Layers className="h-4 w-4" />
              Criar série
            </button>
          )}
        </div>
      </div>

      {/* ── Contadores ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Total</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(trails.length)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Publicadas</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(activeCount)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Séries</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(serieCount)}</p>
        </div>
      </div>

      {/* ── Barra do modo série ── */}
      {mergeMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/5 border border-primary/25 rounded-control px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <p className="font-semibold text-foreground text-sm">
              {selectedCount === 0 ? "Selecione 2 ou mais aulas para juntar" : `${selectedCount} aula${selectedCount > 1 ? "s" : ""} selecionada${selectedCount > 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => setIsMergeDialogOpen(true)}
            disabled={selectedCount < 2}
            className="h-9 px-4 flex items-center gap-1.5 bg-primary text-primary-foreground font-bold rounded-control text-sm disabled:opacity-40 transition-opacity touch-manipulation"
          >
            <ListVideo className="h-3.5 w-3.5" />
            Juntar em série
          </button>
        </div>
      )}

      {/* ── Busca ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar trilhas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 bg-background border border-input rounded-control pl-11 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* ── Trilhas ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />
          <p className="u-label">Carregando…</p>
        </div>
      ) : filteredTrails.length === 0 ? (
        searchTerm ? (
          <EmptyState
            icon={Search}
            title="Nenhuma trilha encontrada"
            description="Tente outro termo de busca."
            action={{ label: "Limpar busca", onClick: () => setSearchTerm("") }}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="Você ainda não criou trilhas"
            description="Crie a primeira aula. Depois você pode juntar várias aulas numa série."
            action={{ label: "Criar trilha", icon: Plus, onClick: () => setIsCreateDialogOpen(true) }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredTrails.map((trail) => {
            const isActive = trail.status === "active" || trail.status === "published";
            const isSerie = trail.trail_type === "serie";
            const isSelected = selectedIds.has(trail.id);

            return (
              <div
                key={trail.id}
                onClick={() => mergeMode && toggleSelect(trail.id)}
                className={`relative bg-card border rounded-card overflow-hidden flex flex-col transition-colors ${
                  mergeMode ? "cursor-pointer" : ""
                } ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              >
                {/* Capa */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <ContentCover
                    imageUrl={isPlaceholderImage(trail.image_url) ? null : trail.image_url}
                    subject={trail.category}
                    title={trail.title}
                    className="absolute inset-0"
                  />
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

                  {/* Seleção no modo série */}
                  {mergeMode && (
                    <div className={`absolute inset-0 transition-colors ${isSelected ? "bg-primary/20" : "bg-black/10"}`}>
                      <div className="absolute top-3 right-3">
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-black/40 border-white"}`}>
                          {isSelected && <span className="text-[11px] font-bold">✓</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Situação + tipo */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-background/90 text-foreground border-border"}`}>
                      {isActive ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {isActive ? "Publicada" : "Rascunho"}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border bg-background/90 text-foreground border-border">
                      {isSerie ? <ListVideo className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                      {isSerie ? "Série" : "Aula avulsa"}
                    </span>
                  </div>
                </div>

                {/* Dados */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="u-label mb-1">{trail.category || "Geral"}</p>
                  <h3 className="font-semibold text-foreground text-sm leading-snug flex-1 line-clamp-2">{trail.title || "Trilha sem título"}</h3>

                  {!mergeMode && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      <Link
                        href={`/dashboard/teacher/trails/${trail.id}`}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-border text-foreground rounded-control text-sm font-bold hover:bg-muted transition-colors touch-manipulation"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Gerenciar
                      </Link>
                      <Link
                        href={`/dashboard/classroom/${trail.id}`}
                        className="h-9 w-9 flex items-center justify-center border border-border text-muted-foreground rounded-control hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                        title="Ver como aluno"
                        aria-label="Ver como aluno"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDeleteTrail(trail.id)}
                        className="h-9 w-9 flex items-center justify-center border border-border text-muted-foreground rounded-control hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors touch-manipulation"
                        title="Excluir"
                        aria-label="Excluir trilha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {mergeMode && (
                    <p className="text-xs font-semibold text-muted-foreground mt-3 pt-3 border-t border-border text-center">
                      {isSelected ? "Selecionada" : "Toque para selecionar"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100);
      }}>
        <DialogContent className="rounded-card w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nova aula
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="u-label">Título *</Label>
              <input
                type="text"
                placeholder="Ex.: Funções do 2º grau"
                value={newTrail.title}
                onChange={(e) => setNewTrail({ ...newTrail, title: e.target.value })}
                disabled={isSubmitting}
                className="w-full h-11 bg-background border border-input rounded-control px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="u-label">Matéria</Label>
                <Select value={newTrail.category} onValueChange={(v) => setNewTrail({ ...newTrail, category: v })} disabled={isSubmitting}>
                  <SelectTrigger className="h-11 rounded-control text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control max-h-60">
                    {EDUCATIONAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Público</Label>
                <Select value={newTrail.target_audience} onValueChange={(v) => setNewTrail({ ...newTrail, target_audience: v })} disabled={isSubmitting}>
                  <SelectTrigger className="h-11 rounded-control text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="etec">Só ETEC</SelectItem>
                    <SelectItem value="enem">Só ENEM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="u-label">Capa (arquivo ou URL)</Label>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-control bg-background border-2 border-dashed border-border hover:border-primary/40 cursor-pointer p-2 text-xs text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground"
                />
                {!coverFile && (
                  <input
                    type="text"
                    placeholder="Ou cole o link: https://..."
                    value={newTrail.image_url}
                    onChange={(e) => setNewTrail({ ...newTrail, image_url: e.target.value })}
                    disabled={isSubmitting}
                    className="w-full h-10 bg-background border border-input rounded-control px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="u-label">Descrição</Label>
              <Textarea
                placeholder="O que o aluno aprenderá?"
                value={newTrail.description}
                onChange={(e) => setNewTrail({ ...newTrail, description: e.target.value })}
                disabled={isSubmitting}
                className="rounded-control min-h-[70px] text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter className="p-5 pt-0">
            <button
              onClick={handleCreateTrail}
              disabled={isSubmitting || !newTrail.title}
              className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-control text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity touch-manipulation"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmitting ? "Criando..." : "Criar aula"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Merge Dialog ── */}
      <Dialog open={isMergeDialogOpen} onOpenChange={(open) => {
        setIsMergeDialogOpen(open);
        if (!open) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100);
      }}>
        <DialogContent className="rounded-card w-[95vw] sm:w-full max-w-md p-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ListVideo className="h-4 w-4 text-primary" />
              Criar série
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              As <strong className="text-foreground">{selectedCount} aulas</strong> selecionadas virarão capítulos desta série. As aulas originais serão removidas.
            </p>
            <div className="space-y-1.5">
              <Label className="u-label">Nome da série</Label>
              <input
                type="text"
                placeholder="Ex.: Matemática — Funções completo"
                value={serieName}
                onChange={(e) => setSerieName(e.target.value)}
                disabled={isMerging}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleMergeTrails(); }}
                className="w-full h-11 bg-background border border-input rounded-control px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
              />
            </div>
            <div className="bg-muted/50 border border-border rounded-control p-3">
              <p className="u-label mb-1.5">Aulas que vão para a série</p>
              <ul className="space-y-0.5">
                {Array.from(selectedIds).map((id) => {
                  const t = trails.find((x) => x.id === id);
                  return <li key={id} className="text-sm text-foreground">• {t?.title}</li>;
                })}
              </ul>
            </div>
          </div>
          <DialogFooter className="p-5 pt-0 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsMergeDialogOpen(false)}
              className="h-11 flex items-center justify-center bg-card border border-border text-foreground font-bold rounded-control text-sm hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleMergeTrails}
              disabled={isMerging || !serieName.trim()}
              className="h-11 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-control text-sm disabled:opacity-40 transition-opacity"
            >
              {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListVideo className="h-4 w-4" />}
              {isMerging ? "Criando..." : "Criar série"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
