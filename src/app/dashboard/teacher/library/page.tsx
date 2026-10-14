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
import { EDUCATIONAL_CATEGORIES, RESOURCE_TYPES } from "@/lib/constants";
import { DOCUMENT_ACCEPT } from "@/lib/file-types";
import { EmptyState } from "@/components/EmptyState";
import { ContentCover } from "@/components/ContentCover";

/** O valor gravado continua "Video"; só o rótulo na tela ganha acento. */
const tipoLabel = (t?: string | null) => (t === "Video" ? "Vídeo" : t || "Material");

export default function LibraryManagementPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setQuestionToEdit] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Matemática",
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
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setResources(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Não foi possível carregar", description: "Falha ao carregar a biblioteca.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResources();
  }, []);

  const handleSave = async () => {
    if (!formData.title || (!formData.url && !file)) {
      toast({ title: "Campos obrigatórios", description: "Informe o título e um arquivo (ou link).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      let finalUrl = formData.url;

      if (file) {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `library/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('learning-contents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('learning-contents')
          .getPublicUrl(filePath);

        finalUrl = publicUrlData.publicUrl;
        setUploading(false); // Reset assim que o upload for concluído
      }

      let finalImageUrl = formData.image_url;

      if (coverFile) {
        setUploading(true);
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `cover-${Date.now()}.${fileExt}`;
        const filePath = `library/${fileName}`;

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

      // O payload flexível que tentará incluir segmentação e outros campos, com fallback.
      const payload: any = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        type: formData.type,
        url: finalUrl,
        image_url: finalImageUrl
      };

      if (formData.target_audience !== "all") {
         payload.target_audience = formData.target_audience;
      }

      let { error } = await (editingId 
        ? supabase.from('library_resources').update(payload).eq('id', editingId)
        : supabase.from('library_resources').insert([payload])
      );

      if (error && error?.code === '42703') {
          console.warn("Retrying with minimal payload due to missing columns...");
          const { target_audience, image_url, ...fallbackPayload } = payload as any;
          const retry = await (editingId 
            ? supabase.from('library_resources').update(fallbackPayload).eq('id', editingId)
            : supabase.from('library_resources').insert([fallbackPayload])
          );
          error = retry.error;
      }

      if (error) throw error;
      
      toast({ title: editingId ? "Material atualizado" : "Material cadastrado" });
      
      await fetchResources(); // Sempre re-sincronize do banco para garantir integridade.
      
      setIsDialogOpen(false);
      setFormData({ title: "", description: "", category: "Matemática", type: "PDF", url: "", image_url: "", target_audience: "all" });
      setFile(null);
      setCoverFile(null);
      setQuestionToEdit(null);
      setTimeout(() => { document.body.style.pointerEvents = ""; }, 500); // Fix Radix UI body lock bug
    } catch (e: any) {
      console.error("Save Error:", e);
      toast({ title: "Erro ao salvar", description: e?.message || "Ocorreu um erro ao processar os dados.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUploading(false); // Garantia final
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este material?")) return;
    
    try {
      const { error } = await supabase.from('library_resources').delete().eq('id', id);
      if (error) throw error;
      setResources(prev => prev.filter(r => r.id !== id));
      toast({ title: "Material removido da biblioteca" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (resource: any) => {
    setQuestionToEdit(resource.id);
    setFile(null);
    setCoverFile(null);
    setFormData({
      title: resource.title,
      description: resource.description || "",
      category: resource.category || "Matemática",
      type: resource.type || "PDF",
      url: resource.url || "",
      image_url: resource.image_url || "",
      target_audience: resource.target_audience || "all"
    });
    setIsDialogOpen(true);
  };

  const filtered = resources.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const isBook = r.category?.startsWith('LIVRO|');
    return matchesSearch && !isBook;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Professor · biblioteca</p>
          <h1 className="u-page-title text-3xl mt-1">Biblioteca</h1>
          <p className="text-sm text-muted-foreground mt-1">Materiais de apoio que os alunos encontram na biblioteca.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if(!open) {
            setQuestionToEdit(null);
            setFile(null);
            setCoverFile(null);
            setFormData({ title: "", description: "", category: "Matemática", type: "PDF", url: "", image_url: "", target_audience: "all" });
            setTimeout(() => document.body.style.pointerEvents = "", 100);
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="arcade" className="rounded-control h-11 px-5 font-bold w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Novo material
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-card p-5 md:p-6 w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">{editingId ? "Editar material" : "Novo material"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label className="u-label">Título</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Guia de Trigonometria" className="h-10 rounded-control font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="u-label">Categoria</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className="h-10 rounded-control font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>{EDUCATIONAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="u-label">Tipo</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                    <SelectTrigger className="h-10 rounded-control font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{tipoLabel(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Público-alvo</Label>
                <Select value={formData.target_audience} onValueChange={v => setFormData({...formData, target_audience: v})}>
                  <SelectTrigger className="h-10 rounded-control font-medium">
                    <SelectValue placeholder="Todos os alunos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-control">
                    <SelectItem value="all">Todos os alunos</SelectItem>
                    <SelectItem value="etec">Só a turma ETEC</SelectItem>
                    <SelectItem value="enem">Só a turma ENEM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Arquivo (ou link externo)</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="file" 
                    accept={DOCUMENT_ACCEPT}
                    onChange={e => setFile(e.target.files?.[0] || null)} 
                    className="h-10 rounded-control bg-muted/30 border-2 border-dashed border-border cursor-pointer hover:border-primary/40 p-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground"
                  />
                  {!file && (
                    <Input 
                      value={formData.url} 
                      onChange={e => setFormData({...formData, url: e.target.value})} 
                      placeholder="Ou cole o link..." 
                      className="h-10 rounded-control text-sm mt-1" 
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Capa (opcional: arquivo ou link)</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setCoverFile(e.target.files?.[0] || null)} 
                    className="h-10 rounded-control bg-muted/30 border-2 border-dashed border-border cursor-pointer hover:border-primary/40 p-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-control file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground"
                    disabled={isSubmitting || uploading}
                  />
                  {!coverFile && (
                    <Input value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="Ou cole o link da imagem..." className="h-10 rounded-control text-sm mt-1" disabled={isSubmitting || uploading} />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="u-label">Descrição</Label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descrição breve para o aluno..." className="min-h-[50px] w-full rounded-control border border-input bg-background px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button onClick={handleSave} disabled={isSubmitting || uploading} className="w-full h-11 font-bold rounded-control">
                {(isSubmitting || uploading) ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                {uploading ? "Enviando arquivo..." : (editingId ? "Salvar alterações" : "Publicar material")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Pesquisar na biblioteca..." 
          className="pl-11 h-11 rounded-control"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        searchTerm ? (
          <EmptyState
            icon={Search}
            title="Nenhum material encontrado"
            description="Tente outro termo de busca ou limpe o filtro."
            action={{ label: "Limpar busca", onClick: () => setSearchTerm("") }}
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="A biblioteca ainda está vazia"
            description="Cadastre o primeiro material e ele aparece aqui e para os alunos."
            action={{ label: "Novo material", icon: Plus, onClick: () => setIsDialogOpen(true) }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filtered.map((item) => (
            <Card key={item.id} className="overflow-hidden rounded-card flex flex-col">
              <div className="relative aspect-video bg-muted overflow-hidden">
                <ContentCover
                  imageUrl={item.image_url}
                  videoUrl={item.type === 'Video' ? item.url : null}
                  subject={item.category}
                  title={item.title}
                  className="absolute inset-0"
                />
                <div className="absolute top-3 left-3">
                  <Badge className="bg-background/90 text-foreground border border-border px-2.5 py-1 font-bold text-[11px] flex items-center gap-1.5">
                    {item.type === 'Video' ? <Video className="h-3 w-3" /> : item.type === 'Prova' ? <ClipboardCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {tipoLabel(item.type)}
                  </Badge>
                </div>
              </div>
              <CardHeader className="p-5 pb-3">
                {item.category && <span className="u-label">{item.category}</span>}
                <CardTitle className="text-base font-bold truncate mt-1">{item.title || "Material sem título"}</CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description || "Sem descrição."}</p>
              </CardHeader>
              <CardFooter className="p-5 pt-3 border-t border-border mt-auto flex justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label="Editar material" className="h-10 w-10 rounded-control text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} aria-label="Remover material" className="h-10 w-10 rounded-control text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}