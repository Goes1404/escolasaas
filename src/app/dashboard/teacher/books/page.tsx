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
      toast({ title: "Erro de Rede", description: "Falha ao carregar acervo de livros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResources();
  }, []);

  const handleSave = async () => {
    if (!formData.title || (!formData.url && !file)) {
      toast({ title: "Campos obrigatórios", description: "Título e Arquivo (ou Link) são necessários.", variant: "destructive" });
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
      
      toast({ title: editingId ? "Livro Atualizado!" : "Livro Cadastrado!" });
      
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary italic leading-none">Gestão de Livros</h1>
          <p className="text-muted-foreground font-medium italic">Administração do acervo bibliográfico digital.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if(!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl h-14 bg-accent text-accent-foreground font-black px-8 shadow-xl hover:scale-105 transition-all">
              <Plus className="h-6 w-6 mr-2" /> Novo Livro
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-6 bg-white w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black italic text-primary">Configurar Livro</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-40">Título da Obra</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Dom Casmurro - Ed. Especial" className="h-10 rounded-xl bg-muted/30 border-none font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-40">Segmento</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>{BOOK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase opacity-40">Formato</Label>
                  <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-40">Restrição de Acesso</Label>
                <Select value={formData.target_audience} onValueChange={v => setFormData({...formData, target_audience: v})}>
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold">
                    <SelectValue placeholder="Todos os Alunos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="all">Acesso Global</SelectItem>
                    <SelectItem value="etec">Apenas Alunos ETEC</SelectItem>
                    <SelectItem value="enem">Apenas Alunos ENEM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-40">Upload da Obra (PDF/EPUB)</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="file" 
                    onChange={e => setFile(e.target.files?.[0] || null)} 
                    className="h-10 rounded-xl bg-muted/30 border-2 border-dashed border-primary/20 cursor-pointer hover:border-accent p-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary file:text-white"
                  />
                  {!file && (
                    <Input 
                      value={formData.url} 
                      onChange={e => setFormData({...formData, url: e.target.value})} 
                      placeholder="Ou URL do livro..." 
                      className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs mt-1" 
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-40">Capa do Livro (Arquivo ou URL)</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setCoverFile(e.target.files?.[0] || null)} 
                    className="h-10 rounded-xl bg-muted/30 border-2 border-dashed border-primary/20 cursor-pointer hover:border-accent p-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary file:text-white"
                  />
                  {!coverFile && (
                    <Input value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="Ou cole a URL..." className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs mt-1" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase opacity-40">Sinopse</Label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Resumo breve da obra..." className="min-h-[60px] w-full rounded-xl bg-muted/30 border-none px-3 py-2 text-sm font-medium resize-none" />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button onClick={handleSave} disabled={isSubmitting || uploading} className="w-full h-12 bg-primary text-white font-black text-base rounded-2xl shadow-xl">
                {(isSubmitting || uploading) ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                {uploading ? "Salvando nos servidores..." : (editingId ? "Atualizar Livro" : "Cadastrar na Biblioteca")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xl group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
        <Input 
          placeholder="Pesquisar no acervo de livros..." 
          className="pl-12 h-14 bg-white border-none shadow-xl rounded-[1.25rem] italic focus-visible:ring-accent"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border-4 border-dashed border-muted/20 rounded-[3rem] bg-muted/5">
          <BookOpen className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="font-black text-primary italic text-xl">Nenhuma obra cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((item) => (
            <Card key={item.id} className="border-none shadow-xl overflow-hidden group bg-white rounded-[2.5rem] flex flex-col hover:shadow-2xl transition-all duration-500">
              <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                <img src={item.image_url || `https://picsum.photos/seed/${item.id}/600/800`} alt={item.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-white/80 backdrop-blur-md text-primary border-none px-3 py-1 font-black text-[10px] uppercase shadow-lg flex items-center gap-2">
                    <BookOpen className="h-3 w-3" />
                    {item.type}
                  </Badge>
                </div>
              </div>
              <CardHeader className="p-8 pb-4">
                <span className="text-[10px] font-black text-accent uppercase tracking-widest">{item.category?.replace('LIVRO|', '')}</span>
                <CardTitle className="text-xl font-black italic truncate mt-2">{item.title}</CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 italic">{item.description || "Sem sinopse disponível."}</p>
              </CardHeader>
              <CardFooter className="p-8 pt-4 border-t border-muted/10 mt-auto flex justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(item)} className="h-10 w-10 rounded-full text-accent hover:bg-accent/10">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-10 w-10 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" asChild className="rounded-xl border-primary/20 text-[10px] font-black uppercase">
                  <a href={item.url} target="_blank">Ver Arquivo</a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
