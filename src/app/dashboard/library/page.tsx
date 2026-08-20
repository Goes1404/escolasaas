"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  FileText, 
  Video, 
  BookOpen, 
  Filter, 
  Loader2,
  PenLine,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import Link from "next/link";

const CATEGORY_IMAGES: Record<string, string> = {
  'Matemática': 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800&auto=format&fit=crop',
  'Física': 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
  'Química': 'https://images.unsplash.com/photo-1532094349884-543648cdbd8e?q=80&w=800&auto=format&fit=crop',
  'Biologia': 'https://images.unsplash.com/photo-1576319155264-99536e0be1ee?q=80&w=800&auto=format&fit=crop',
  'História': 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop',
  'Geografia': 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop',
  'Linguagens': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=800&auto=format&fit=crop',
  'Saúde': 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=800&auto=format&fit=crop',
  'Atualidades': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop',
  'Literatura': 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?q=80&w=800&auto=format&fit=crop',
  'Filosofia': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop',
  'Sociologia': 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=800&auto=format&fit=crop',
  'Didáticos': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=800&auto=format&fit=crop',
  'Técnicos': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
  'Guias': 'https://images.unsplash.com/photo-1501534159981-3ef501f27838?q=80&w=800&auto=format&fit=crop',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop';

function getSafeLibraryImage(url: string | null | undefined, category: string) {
  if (!url || url.includes('picsum.photos')) {
    const cleanCategory = category.replace('LIVRO|', '');
    return CATEGORY_IMAGES[cleanCategory] || DEFAULT_IMAGE;
  }
  return url;
}

const categories = ["Todos", "Matemática", "Física", "Linguagens", "História", "Saúde", "Atualidades", "Literatura", "Química", "Filosofia", "Sociologia"];
const types = ["Todos", "PDF", "Video", "E-book", "Artigo"];

export default function LibraryPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [activeType, setActiveType] = useState("Todos");
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResources = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);

    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      // Busca todos os recursos (query simples que nunca falha)
      const { data, error } = await supabase.from('library_resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtra por segmentação no front-end (se a coluna existir nos dados)
      const audience = (
        profile?.exam_target || 
        user?.user_metadata?.exam_target || 
        profile?.profile_type || 
        user?.user_metadata?.profile_type || 
        'enem'
      ).toLowerCase().trim();
      const userAudience = audience.includes('etec') ? 'etec' : 'enem';
      const filtered = (data || []).filter(r => {
        if (!r.target_audience) return true; // sem segmentação = mostra para todos
        return r.target_audience === 'all' || r.target_audience === userAudience;
      });

      setResources(filtered);
    } catch (err: any) {
      console.error("Erro ao carregar acervo:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (user && profile) loadResources();
  }, [user, profile, loadResources]);

  const filteredResources = useMemo(() => resources.filter(resource => {
    const title = (resource.title || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = title.includes(search);
    const matchesCategory = activeCategory === "Todos" || resource.category === activeCategory;
    const matchesType = activeType === "Todos" || resource.type === activeType;
    const isBook = resource.category?.startsWith('LIVRO|');
    return matchesSearch && matchesCategory && matchesType && !isBook;
  }), [resources, searchTerm, activeCategory, activeType]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="font-black text-muted-foreground uppercase text-xs tracking-widest animate-pulse">Carregando Acervo Digital...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* ── HERO BANNER ── */}
      <section className="aurora-dark relative overflow-hidden rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl border border-white/5 group">
        <div className="absolute inset-0 dot-grid opacity-15 pointer-events-none rounded-[2.5rem]" />
        <div className="absolute top-[-25%] right-[-10%] w-64 h-64 md:w-96 md:h-96 bg-primary/20 rounded-full blur-[85px] hidden md:block" />
        <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 bg-primary/10 rounded-full blur-[60px] hidden md:block" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 w-full">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 px-3.5 py-1 rounded-full animate-float">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Biblioteca Digital</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none uppercase">
              Acervo de <br /><span className="text-gradient-brand italic">Alta Performance</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-300 font-medium italic leading-relaxed">
              Acesse apostilas, videoaulas e materiais de apoio recomendados pelo corpo docente para acelerar seus estudos.
            </p>
          </div>
          
          <div className="relative w-full md:w-80 group/search shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/65 transition-colors group-focus-within/search:text-accent" />
            <Input
              placeholder="Buscar material..."
              className="pl-12 h-14 bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 text-white placeholder:text-white/65 rounded-[1.25rem] text-sm font-medium italic focus-visible:ring-accent focus-visible:ring-1 focus-visible:border-accent transition-all duration-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      <Tabs defaultValue="Todos" className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between overflow-x-auto pb-2 gap-4">
          <TabsList className="bg-white/80 p-1.5 h-14 rounded-2xl border-none shadow-sm flex items-center gap-1 overflow-x-auto max-w-full scrollbar-hide">
            {categories.map(cat => (
              <TabsTrigger 
                key={cat} 
                value={cat} 
                onClick={() => setActiveCategory(cat)}
                className="rounded-xl px-5 h-11 data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 duration-300"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-14 px-6 rounded-2xl bg-white border-none shadow-sm hover:bg-slate-50 transition-all font-black text-[10px] uppercase gap-2 active:scale-95 shrink-0 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-accent" />
                Tipo: <span className="text-primary">{activeType}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-3 py-3">Filtrar por Tipo</DropdownMenuLabel>
              {types.map(type => (
                <DropdownMenuItem 
                  key={type} 
                  onClick={() => setActiveType(type)}
                  className={`rounded-xl px-3 py-2.5 font-bold text-sm cursor-pointer mb-1 last:mb-0 ${activeType === type ? 'bg-primary text-white' : ''}`}
                >
                  {type}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredResources.map((item, index) => (
              <Card key={item.id} className="gradient-border overflow-hidden border-none shadow-xl hover:shadow-2xl hover:-translate-y-1.5 hover:glow-orange-strong transition-all duration-300 group bg-white rounded-[2.5rem] flex flex-col h-full">
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 shrink-0">
                  <Image
                    src={getSafeLibraryImage(item.image_url, item.category)}
                    alt={item.title || "Material"}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={index === 0}
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className="bg-white/95 backdrop-blur-md text-primary border-none shadow-lg flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider">
                      {item.type === "Video" ? <Video className="h-3.5 w-3.5 text-accent" /> : <FileText className="h-3.5 w-3.5 text-blue-500" />}
                      {item.type}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="p-8 space-y-3 flex-1">
                  <Badge variant="outline" className="w-fit text-[8px] border-accent/20 text-accent font-black uppercase px-2 py-0.5 bg-accent/5 tracking-wider rounded-md">
                    {item.category}
                  </Badge>
                  <CardTitle className="text-xl font-black text-primary italic leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                    {item.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-3 italic opacity-80">
                    {item.description || "Material de apoio técnico pedagógico para aceleração do seu aprendizado."}
                  </p>
                </CardHeader>
                
                <CardFooter className="p-8 pt-0 mt-auto">
                  <div className="flex gap-3 w-full pt-6 border-t border-muted/10">
                    {item.type !== "Video" ? (
                      <Button asChild className="btn-shimmer flex-1 bg-primary text-white h-12 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all border-none">
                        <Link href={`/dashboard/library/book/${item.id}`}>
                          <PenLine className="h-4 w-4 mr-2 text-accent" /> Estudar Agora
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild className="btn-shimmer flex-1 bg-slate-900 text-white h-12 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all border-none">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-2 text-accent animate-pulse" /> Ver Videoaula
                        </a>
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center border-4 border-dashed border-muted/20 rounded-[3rem] bg-white/50 animate-in zoom-in-95 duration-500">
            <FileText className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="font-black italic text-xl text-primary/40">Biblioteca em Sincronização</p>
            <p className="text-sm text-muted-foreground mt-2">Nenhum material encontrado para os filtros atuais.</p>
          </div>
        )}
      </Tabs>
    </div>
  );
}
