"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { BookOpen, Plus, Search, Loader2, Trash2, FileText, Video, ExternalLink, Filter, Pencil, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import Image from "next/image";
import { EmptyState } from "@/components/EmptyState";
import { ContentCover } from "@/components/ContentCover";

const BOOK_CATEGORIES = ["Didáticos", "Literatura", "Técnicos", "Guias"];
const RESOURCE_TYPES = ["PDF", "E-book", "Interativo"];

export default function BooksManagementPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Didáticos",
    type: "PDF",
    url: "",
    image_url: "",
    target_audience: "all"
  });
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function fetchResources() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('library_resources')
        .select('*')
        .ilike('category', 'LIVRO|%')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setResources(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao carregar", description: "Não foi possível carregar os livros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResources();
  }, []);

  const handleSave = async () => {
    if (!formData.title || (!formData.url && !file)) {
      toast({ title: "Campos obrigatórios", description: "Informe o título e envie o arquivo (ou cole o link).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      let finalUrl = formData.url;

      if (file) {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `books/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('learning-contents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('learning-contents')
          .getPublicUrl(filePath);

        finalUrl = publicUrlData.publicUrl;
        setUploading(false);
      }

      let finalImageUrl = formData.image_url;

      if (coverFile) {
        setUploading(true);
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `cover-${Date.now()}.${fileExt}`;
        const filePath = `books/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('learning-contents')
          .upload(filePath, coverFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('learning-contents')
            .getPublicUrl(filePath);
          finalImageUrl = publicUrlData.publicUrl;
        }
        setUploading(false);
      }

      // IMPORTANTE: Adiciona o prefixo LIVRO| na categoria para separação no banco
      const categoryWithPrefix = formData.category.startsWith('LIVRO|') 
        ? formData.category 
        : `LIVRO|${formData.category}`;

      const payload: any = {
        title: formData.title,
        description: formData.description,
        category: categoryWithPrefix,
        type: formData.type,
        url: finalUrl,
        image_url: finalImageUrl,
        target_audience: formData.target_audience
      };

      let { error } = await (editingId 
        ? supabase.from('library_resources').update(payload).eq('id', editingId)
        : supabase.from('library_resources').insert([payload])
      );

      if (error) throw error;
      
      toast({ title: editingId ? "Livro atualizado!" : "Livro cadastrado!" });
      
      await fetchResources();
      
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      console.error("Save Error:", e);
      toast({ title: "Erro ao salvar", description: e?.message || "Ocorreu um erro ao processar os dados.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", category: "Didáticos", type: "PDF", url: "", image_url: "", target_audience: "all" });
    setFile(null);
    setCoverFile(null);
    setEditingId(null);
    setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este livro?")) return;
    
    try {
      const { error } = await supabase.from('library_resources').delete().eq('id', id);
      if (error) throw error;
      setResources(prev => prev.filter(r => r.id !== id));
      toast({ title: "Removido da biblioteca." });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (resource: any) => {
    setEditingId(resource.id);
    setFile(null);
    setCoverFile(null);
    setFormData({
      title: resource.title,
      description: resource.description || "",
      category: resource.category?.replace('LIVRO|', '') || "Didáticos",
      type: resource.type || "PDF",
      url: resource.url || "",
      image_url: resource.image_url || "",
      target_audience: resource.target_audience || "all"
    });
    setIsDialogOpen(true);
  };

  const filtered = resources.filter(r => 
    r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const labelCls = "u-label";
  const fieldCls = "h-10 rounded-control bg-background border-border";
  const fileCls = "h-10 rounded-control bg-background border border-dashed border-border cursor-pointer p-1.5 file:mr-3 file:py-1 file:px-3 file:rounded-control file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Professor · biblioteca</p>
          <h1 className="u-page-title text-3xl mt-1">Livros</h1>
          <p className="text-muted-foreground text-sm mt-2">Cadastre e organize os livros digitais que os alunos podem ler.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if(!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="arcade" className="rounded-control h-11 font-bold px-5 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Novo livro
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-card p-5 md:p-6 w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{editingId ? "Editar livro" : "Novo livro"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label className={labelCls}>Título</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex.: Dom Casmurro — edição especial" className={fieldCls} />
              </div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={labelCls}>Categoria</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                    <SelectContent>{BOOK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Formato</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                    <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Quem pode ver</Label>
                <Select value={formData.target_audience} onValueChange={v => setFormData({...formData, target_audience: v})}>
                  <SelectTrigger className={fieldCls}>
                    <SelectValue placeholder="Todos os alunos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="all">Todos os alunos</SelectItem>
                    <SelectItem value="etec">Só alunos ETEC</SelectItem>
                    <SelectItem value="enem">Só alunos ENEM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Arquivo do livro (PDF/EPUB)</Label>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className={fileCls}
                  />
                  {!file && (
                    <Input
                      value={formData.url}
                      onChange={e => setFormData({...formData, url: e.target.value})}
                      placeholder="Ou cole o link do livro…"
                      className={`${fieldCls} text-xs`}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Capa (arquivo ou link)</Label>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={e => setCoverFile(e.target.files?.[0] || null)}
                    className={fileCls}
                  />
                  {!coverFile && (
                    <Input value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="Ou cole o link da imagem…" className={`${fieldCls} text-xs`} />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Sinopse</Label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Resumo breve da obra…" className="min-h-[60px] w-full rounded-control bg-background border border-border px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button onClick={handleSave} disabled={isSubmitting || uploading} className="w-full h-11 rounded-control font-bold">
                {(isSubmitting || uploading) ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {uploading ? "Enviando arquivo…" : (editingId ? "Salvar alterações" : "Cadastrar livro")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou categoria…"
          className="pl-9 h-11 rounded-control bg-background border-border"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="u-label">Carregando livros…</p>
        </div>
      ) : filtered.length === 0 ? (
        resources.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhum livro cadastrado ainda"
            description="Envie um PDF ou cole um link para o livro aparecer na biblioteca dos alunos."
            action={{ label: "Novo livro", onClick: () => setIsDialogOpen(true), icon: Plus }}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Nenhum livro encontrado"
            description={`Nada corresponde a "${searchTerm}".`}
            secondary={{ label: "Limpar busca", onClick: () => setSearchTerm("") }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {filtered.map((item) => {
            const categoria = item.category?.replace('LIVRO|', '') || null;
            return (
              <Card key={item.id} className="overflow-hidden rounded-card flex flex-col">
                <div className="relative aspect-[3/4] bg-muted">
                  <ContentCover
                    imageUrl={item.image_url}
                    subject={categoria}
                    title={item.title}
                    label={categoria}
                    className="absolute inset-0"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-background/90 text-foreground border border-border px-2 py-0.5 font-semibold text-[10px] rounded-control flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      {item.type || "Livro"}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="p-4 pb-2">
                  {categoria && <span className="u-label">{categoria}</span>}
                  <CardTitle className="text-base font-bold leading-snug line-clamp-2 mt-1">{item.title}</CardTitle>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description || "Sem sinopse."}</p>
                </CardHeader>
                <CardFooter className="p-4 pt-3 border-t border-border mt-auto flex justify-between gap-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(item)} className="h-9 w-9 rounded-control" title="Editar" aria-label="Editar livro">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-9 w-9 rounded-control text-muted-foreground hover:text-red-600 hover:bg-red-500/10" title="Excluir" aria-label="Excluir livro">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" asChild className="rounded-control text-xs font-semibold">
                    <a href={item.url} target="_blank" rel="noopener noreferrer">Abrir arquivo</a>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
