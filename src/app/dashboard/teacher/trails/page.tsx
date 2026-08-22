"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Loader2, Eye, Globe, Lock, Trash2, Layers,
  Film, ListVideo, X, Sparkles, Inbox, LayoutDashboard, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { EDUCATIONAL_CATEGORIES } from "@/lib/constants";
import { getTrailCoverUrl, isPlaceholderImage } from "@/lib/trail-cover";

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

      toast({ title: "Trilha Criada!", description: "Continue editando os módulos para publicar." });
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
      toast({ title: "Trilha excluída." });
    } catch (e: any) {
      toast({ title: "Falha na exclusão", description: e.message, variant: "destructive" });
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

      toast({ title: "Série criada!", description: `"${serieName}" agrupa ${ids.length} aulas.` });
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
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-card overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(168,85,247,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-3 w-3 text-orange-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
                  Conteúdo Pedagógico
                </p>
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
                Minhas Trilhas
              </h1>
              <p className="text-white/70 text-xs font-semibold mt-1">
                Aulas avulsas e séries pedagógicas
              </p>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center bg-white/5 border border-white/8 rounded-2xl py-2.5">
              <span className="text-lg font-black text-white leading-none">{trails.length}</span>
              <span className="text-[8px] font-bold text-white/55 uppercase tracking-wider mt-0.5">Total</span>
            </div>
            <div className="flex flex-col items-center bg-emerald-500/10 border border-emerald-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-emerald-400 leading-none">{activeCount}</span>
              <span className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-wider mt-0.5">Ativas</span>
            </div>
            <div className="flex flex-col items-center bg-purple-500/10 border border-purple-500/20 rounded-2xl py-2.5">
              <span className="text-lg font-black text-purple-400 leading-none">{serieCount}</span>
              <span className="text-[8px] font-bold text-purple-400/80 uppercase tracking-wider mt-0.5">Séries</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="h-12 flex items-center justify-center gap-2 bg-[#4CCCED] hover:bg-orange-600 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/20 text-xs uppercase tracking-widest transition-all touch-manipulation active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Nova Aula
        </button>
        {mergeMode ? (
          <button
            onClick={() => { setMergeMode(false); setSelectedIds(new Set()); }}
            className="h-12 flex items-center justify-center gap-2 bg-white shadow-sm border border-slate-200 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest transition-all touch-manipulation active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
        ) : (
          <button
            onClick={() => setMergeMode(true)}
            className="h-12 flex items-center justify-center gap-2 bg-purple-500/15 border border-purple-500/25 text-purple-400 font-black rounded-2xl text-xs uppercase tracking-widest transition-all hover:bg-purple-500/20 touch-manipulation active:scale-[0.98]"
          >
            <Layers className="h-4 w-4" />
            Criar Série
          </button>
        )}
      </div>

      {/* ── Merge mode bar ── */}
      {mergeMode && (
        <div className="flex items-center justify-between bg-purple-500/8 border border-purple-500/20 rounded-2xl px-4 py-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <p className="font-black text-purple-300 text-xs">
              {selectedCount === 0 ? "Selecione 2+ aulas para unificar" : `${selectedCount} aula${selectedCount > 1 ? "s" : ""} selecionada${selectedCount > 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => setIsMergeDialogOpen(true)}
            disabled={selectedCount < 2}
            className="h-8 px-4 flex items-center gap-1.5 bg-purple-500 text-slate-800 font-black rounded-xl text-[9px] uppercase tracking-widest shadow-lg disabled:opacity-40 transition-all touch-manipulation active:scale-95"
          >
            <ListVideo className="h-3.5 w-3.5" />
            Unificar
          </button>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Pesquisar trilhas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-2xl pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
        />
      </div>

      {/* ── Trail grid ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Sparkles className="h-7 w-7 text-orange-400 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sincronizando...</p>
        </div>
      ) : filteredTrails.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-card">
          <Inbox className="h-8 w-8 mx-auto mb-2 text-white/15" />
          <p className="font-black italic text-xs text-slate-500 uppercase tracking-widest">Nenhuma trilha encontrada</p>
          <p className="text-[10px] text-slate-600 mt-1">Crie uma nova aula ou ajuste a pesquisa</p>
        </div>
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
                className={`group relative bg-white shadow-sm border rounded-card overflow-hidden flex flex-col transition-all duration-200 ${
                  mergeMode ? "cursor-pointer" : ""
                } ${isSelected ? "border-purple-500/50 bg-purple-500/5" : "border-slate-200 hover:border-slate-200"}`}
              >
                {/* Cover */}
                <div className="relative aspect-video overflow-hidden bg-black/30">
                  <img
                    src={(!trail.image_url || isPlaceholderImage(trail.image_url)) ? getTrailCoverUrl(trail.title, trail.category) : trail.image_url}
                    alt={trail.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getTrailCoverUrl(trail.title, trail.category);
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Merge selection overlay */}
                  {mergeMode && (
                    <div className={`absolute inset-0 transition-all ${isSelected ? "bg-purple-500/25" : "bg-black/10"}`}>
                      <div className="absolute top-3 right-3">
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shadow-lg transition-all ${isSelected ? "bg-purple-500 border-purple-500" : "bg-black/40 border-slate-2000"}`}>
                          {isSelected && <span className="text-slate-800 text-[10px] font-black">✓</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status + type badges */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 border ${isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                      {isActive ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                      {isActive ? "Pública" : "Rascunho"}
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 border ${isSerie ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                      {isSerie ? <ListVideo className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
                      {isSerie ? "Série" : "Aula"}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400/85 mb-0.5">{trail.category || "Geral"}</p>
                  <h3 className="font-black italic text-slate-800 text-sm leading-snug flex-1">{trail.title}</h3>

                  {!mergeMode && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <Link
                        href={`/dashboard/teacher/trails/${trail.id}`}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-[#4CCCED]/15 border border-[#4CCCED]/25 text-orange-400 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-[#4CCCED]/20 transition-all touch-manipulation active:scale-95"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Gerenciar
                      </Link>
                      <Link
                        href={`/dashboard/classroom/${trail.id}`}
                        className="h-9 w-9 flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 rounded-xl hover:text-slate-800 hover:bg-slate-50 transition-all touch-manipulation active:scale-95"
                        title="Ver como aluno"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDeleteTrail(trail.id)}
                        className="h-9 w-9 flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-500 rounded-xl hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all touch-manipulation active:scale-95"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {mergeMode && (
                    <p className="text-[10px] font-black text-purple-400/80 uppercase tracking-widest mt-3 pt-3 border-t border-slate-100 text-center">
                      {isSelected ? "Selecionada ✓" : "Toque para selecionar"}
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
        <DialogContent className="rounded-card bg-white border border-slate-200 shadow-2xl w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-lg font-black italic text-slate-800 flex items-center gap-2">
              <Plus className="h-4 w-4 text-orange-400" />
              Nova Aula / Trilha
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Título *</Label>
              <input
                type="text"
                placeholder="Ex: Funções do 2º Grau"
                value={newTrail.title}
                onChange={(e) => setNewTrail({ ...newTrail, title: e.target.value })}
                disabled={isSubmitting}
                className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Categoria</Label>
                <Select value={newTrail.category} onValueChange={(v) => setNewTrail({ ...newTrail, category: v })} disabled={isSubmitting}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white max-h-60">
                    {EDUCATIONAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="font-bold text-slate-600 text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Público-Alvo</Label>
                <Select value={newTrail.target_audience} onValueChange={(v) => setNewTrail({ ...newTrail, target_audience: v })} disabled={isSubmitting}>
                  <SelectTrigger className="h-11 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 bg-white">
                    <SelectItem value="all" className="font-bold text-slate-600 text-xs">Todos</SelectItem>
                    <SelectItem value="etec" className="font-bold text-slate-600 text-xs">Apenas ETEC</SelectItem>
                    <SelectItem value="enem" className="font-bold text-slate-600 text-xs">Apenas ENEM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Capa (arquivo ou URL)</Label>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl bg-white shadow-sm border-2 border-dashed border-[#4CCCED]/20 hover:border-[#4CCCED]/40 cursor-pointer p-2 text-xs text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-[#4CCCED] file:text-slate-800"
                />
                {!coverFile && (
                  <input
                    type="text"
                    placeholder="Ou URL: https://..."
                    value={newTrail.image_url}
                    onChange={(e) => setNewTrail({ ...newTrail, image_url: e.target.value })}
                    disabled={isSubmitting}
                    className="w-full h-10 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-xs font-medium text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all disabled:opacity-50"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Descrição</Label>
              <Textarea
                placeholder="O que o aluno aprenderá?"
                value={newTrail.description}
                onChange={(e) => setNewTrail({ ...newTrail, description: e.target.value })}
                disabled={isSubmitting}
                className="rounded-xl min-h-[70px] bg-white shadow-sm border-slate-200 text-slate-800 placeholder:text-slate-500 text-sm resize-none focus-visible:ring-orange-500/30 focus-visible:border-[#4CCCED]/30"
              />
            </div>
          </div>
          <DialogFooter className="p-5 pt-0">
            <button
              onClick={handleCreateTrail}
              disabled={isSubmitting || !newTrail.title}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2 transition-all touch-manipulation active:scale-[0.99]"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmitting ? "Criando..." : "Criar Aula"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Merge Dialog ── */}
      <Dialog open={isMergeDialogOpen} onOpenChange={(open) => {
        setIsMergeDialogOpen(open);
        if (!open) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100);
      }}>
        <DialogContent className="rounded-card bg-white border border-slate-200 shadow-2xl max-w-md p-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-lg font-black italic text-slate-800 flex items-center gap-2">
              <ListVideo className="h-4 w-4 text-purple-400" />
              Criar Série
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <p className="text-xs font-medium text-slate-600">
              As <strong className="text-slate-800">{selectedCount} aulas</strong> selecionadas virarão capítulos desta série. As aulas originais serão removidas.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Nome da Série</Label>
              <input
                type="text"
                placeholder="Ex: Matemática — Funções Completo"
                value={serieName}
                onChange={(e) => setSerieName(e.target.value)}
                disabled={isMerging}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleMergeTrails(); }}
                className="w-full h-11 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-purple-500/40 transition-all disabled:opacity-50"
              />
            </div>
            <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-3">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-1.5">Aulas que serão unificadas:</p>
              <ul className="space-y-0.5">
                {Array.from(selectedIds).map((id) => {
                  const t = trails.find((x) => x.id === id);
                  return <li key={id} className="text-xs text-slate-600 font-medium">• {t?.title}</li>;
                })}
              </ul>
            </div>
          </div>
          <DialogFooter className="p-5 pt-0 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsMergeDialogOpen(false)}
              className="h-11 flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleMergeTrails}
              disabled={isMerging || !serieName.trim()}
              className="h-11 flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-slate-800 font-black rounded-xl text-xs uppercase tracking-widest shadow-lg disabled:opacity-40 transition-all"
            >
              {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListVideo className="h-4 w-4" />}
              {isMerging ? "Criando..." : "Criar Série"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
