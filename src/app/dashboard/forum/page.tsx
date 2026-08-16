"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  ArrowRight, 
  Loader2, 
  Hash,
  Calculator,
  Atom,
  FlaskConical,
  MessageSquare,
  Filter,
  Building2,
  Lock
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/app/lib/supabase";

const FORUM_CATEGORIES = [
  "Todos", 
  "Dúvidas", 
  "Matemática", 
  "Física", 
  "Química", 
  "Biologia", 
  "Linguagens", 
  "História", 
  "Geografia", 
  "Carreira", 
  "Polos",
  "Off-Topic"
];

export default function ForumPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newForum, setNewForum] = useState({ name: "", description: "", category: "Dúvidas" });
  const [forums, setForums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchForums = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forums')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) setForums(data || []);
    } catch (e) {
      console.error('Erro ao carregar fóruns:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForums();
  }, []);

  const handleCreateForum = async () => {
    if (!newForum.name.trim() || !user) return;

    setIsSubmitting(true);
    const { data, error } = await supabase
      .from('forums')
      .insert([{
        name: newForum.name,
        description: newForum.description,
        category: newForum.category,
        author_id: user.id,
        author_name: profile?.name || user.email?.split('@')[0],
      }])
      .select()
      .single();
    
    if (!error) {
      setForums(prev => [data, ...prev]);
      toast({ title: "Discussão Iniciada!", description: "Sua pergunta agora está visível para toda a rede." });
      setIsCreateOpen(false);
      setNewForum({ name: "", description: "", category: "Dúvidas" });
    } else {
      toast({ title: "Erro ao publicar", description: error.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  // Lógica de Filtro Industrial para Polos (Sincronizada com o Perfil)
  const filteredForums = forums?.filter(f => {
    const title = (f.name || '').toLowerCase();
    const desc = (f.description || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    const isStaff = ['teacher', 'admin', 'staff'].includes(profile?.profile_type?.toLowerCase() || '');
    
    // Filtro de Segurança por Polo: 
    // Alunos só veem fóruns da categoria "Polos" se o nome do fórum contiver a instituição deles
    if (f.category === "Polos" && !isStaff) {
      const userInstitution = (profile?.institution || '').toLowerCase().trim();
      // Se o aluno não tem polo, ele não vê fóruns de polos
      if (!userInstitution) return false;
      // O nome do fórum deve conter o nome do polo do aluno
      if (!title.includes(userInstitution)) return false;
    }

    const matchesSearch = title.includes(search) || desc.includes(search);
    const matchesCategory = activeCategory === "Todos" || f.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Matemática": return <Calculator className="h-5 w-5 md:h-6 md:w-6" />;
      case "Física": return <Atom className="h-5 w-5 md:h-6 md:w-6" />;
      case "Química": return <FlaskConical className="h-5 w-5 md:h-6 md:w-6" />;
      case "Polos": return <Building2 className="h-5 w-5 md:h-6 md:w-6" />;
      default: return <Hash className="h-5 w-5 md:h-6 md:w-6" />;
    }
  };

  const getCategoryStyles = (cat: string) => {
    switch (cat) {
      case "Matemática": return { bg: "bg-blue-100", text: "text-blue-700", hoverBg: "group-hover:bg-blue-600", hoverText: "group-hover:text-white" };
      case "Física": return { bg: "bg-indigo-100", text: "text-indigo-700", hoverBg: "group-hover:bg-indigo-600", hoverText: "group-hover:text-white" };
      case "Química": return { bg: "bg-emerald-100", text: "text-emerald-700", hoverBg: "group-hover:bg-emerald-600", hoverText: "group-hover:text-white" };
      case "Biologia": return { bg: "bg-green-100", text: "text-green-700", hoverBg: "group-hover:bg-green-600", hoverText: "group-hover:text-white" };
      case "Linguagens": return { bg: "bg-rose-100", text: "text-rose-700", hoverBg: "group-hover:bg-rose-600", hoverText: "group-hover:text-white" };
      case "História": return { bg: "bg-amber-100", text: "text-amber-700", hoverBg: "group-hover:bg-amber-600", hoverText: "group-hover:text-white" };
      case "Geografia": return { bg: "bg-orange-100", text: "text-orange-700", hoverBg: "group-hover:bg-orange-600", hoverText: "group-hover:text-white" };
      case "Polos": return { bg: "bg-purple-100", text: "text-purple-700", hoverBg: "group-hover:bg-purple-600", hoverText: "group-hover:text-white" };
      default: return { bg: "bg-accent/10", text: "text-accent", hoverBg: "group-hover:bg-accent", hoverText: "group-hover:text-white" };
    }
  };

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-700 pb-20 max-w-full min-w-0 overflow-x-hidden px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-primary italic tracking-tight leading-none">
            Comunidade <span className="text-accent">Plataforma</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm md:text-lg italic">Onde o conhecimento se torna colaborativo.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
              <button className="rounded-xl md:rounded-2xl h-14 bg-primary text-white font-black px-8 shadow-xl shadow-primary/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 w-full md:w-auto border-none">
                  <Plus className="h-6 w-6 text-accent" />
                  <span>Nova Discussão</span>
              </button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 md:p-12 max-w-[95vw] md:max-w-lg bg-white mx-auto">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic text-primary">Iniciar Tópico</DialogTitle>
                  <DialogDescription className="font-medium text-sm italic">Compartilhe sua dúvida ou insight com a rede.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 px-2">Título do Debate</label>
                    <Input placeholder="Qual sua dúvida principal?" value={newForum.name} onChange={(e) => setNewForum({...newForum, name: e.target.value})} disabled={isSubmitting} className="h-14 rounded-xl bg-muted/30 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 px-2">Matéria</label>
                    <Select value={newForum.category} onValueChange={(v) => setNewForum({...newForum, category: v})} disabled={isSubmitting}>
                        <SelectTrigger className="h-14 rounded-xl bg-muted/30 border-none font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">{FORUM_CATEGORIES.filter(c=>c!=="Todos").map(c=><SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 px-2">Contexto / Detalhes</label>
                    <Input placeholder="Explique um pouco mais..." value={newForum.description} onChange={(e) => setNewForum({...newForum, description: e.target.value})} disabled={isSubmitting} className="h-14 rounded-xl bg-muted/30 border-none font-medium italic" />
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={handleCreateForum} disabled={isSubmitting || !newForum.name.trim()} className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl">
                    {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <MessageSquare className="h-6 w-6 mr-2 text-accent" />}
                    {isSubmitting ? "Publicando..." : "Publicar Agora"}
                  </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
          <Input 
            placeholder="Pesquisar debates..." 
            className="pl-12 h-14 bg-white border-none shadow-xl rounded-2xl text-base font-medium italic focus-visible:ring-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-hide">
          {FORUM_CATEGORIES.slice(0, 6).map(cat => (
            <Button 
              key={cat} 
              variant={activeCategory === cat ? "default" : "outline"}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-6 h-10 text-[9px] font-black uppercase tracking-widest shrink-0 transition-all border-none shadow-md ${activeCategory === cat ? 'bg-primary text-white scale-105 shadow-primary/20' : 'bg-white'}`}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sintonizando Rede...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredForums?.length === 0 ? (
            <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[3rem] opacity-30">
              <MessageSquare className="h-16 w-16 mx-auto mb-4" />
              <p className="font-black italic text-xl">Nenhuma discussão encontrada</p>
            </div>
          ) : (
            filteredForums?.map((forum) => {
                const styles = getCategoryStyles(forum.category);
                return (
                <Card key={forum.id} className="group relative overflow-hidden flex flex-col border border-muted/20 shadow-xl rounded-[2.5rem] bg-white hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                    <CardHeader className="p-8 pb-4">
                        <div className="flex items-center justify-between">
                            <div className={`h-12 w-12 rounded-2xl ${styles.bg} ${styles.text} flex items-center justify-center ${styles.hoverBg} ${styles.hoverText} transition-all shadow-inner`}>{getCategoryIcon(forum.category)}</div>
                            <Badge className={`${styles.bg} ${styles.text} border-none font-black text-[8px] uppercase px-3 py-1`}>{forum.category}</Badge>
                        </div>
                        <CardTitle className="pt-6 text-xl font-black italic text-primary leading-tight group-hover:text-accent transition-colors line-clamp-2 min-h-[3rem]">{forum.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 flex-grow">
                        <p className="text-xs md:text-sm text-muted-foreground font-medium italic line-clamp-2 opacity-80">"{forum.description}"</p>
                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-muted/10">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Autor</span>
                            <span className="text-[10px] font-bold text-primary italic">@{forum.author_name?.split(' ')[0].toLowerCase()}</span>
                          </div>
                          <Button asChild variant="ghost" className="text-accent font-black text-[10px] uppercase hover:bg-accent/10 rounded-xl px-4">
                            <Link href={`/dashboard/forum/${forum.id}`}>Participar <ArrowRight className="ml-2 h-4 w-4" /></Link>
                          </Button>
                        </div>
                    </CardContent>
                </Card>
                )
            })
          )}
        </div>
      )}
    </div>
  );
}