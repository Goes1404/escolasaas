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
import { ContentCover } from "@/components/ContentCover";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
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

// Rótulo em português para o tipo gravado no banco (o valor do filtro continua o mesmo).
const TYPE_LABEL: Record<string, string> = { Video: "Vídeo", "E-book": "E-book", PDF: "PDF", Artigo: "Artigo", Todos: "Todos" };
const typeLabel = (t?: string | null) => (t ? TYPE_LABEL[t] ?? t : "Material");

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
      <div className="space-y-8 pb-20" aria-busy="true" aria-label="Carregando biblioteca">
        <Skeleton className="h-56 md:h-64 w-full rounded-card" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card bg-white overflow-hidden shadow-xl">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="p-8 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* ── HERO BANNER ── */}
      <section className="aurora-dark relative overflow-hidden rounded-card p-8 md:p-12 text-white shadow-2xl border border-white/5 group">
        <div className="absolute inset-0 dot-grid opacity-15 pointer-events-none rounded-card" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 w-full">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 px-3.5 py-1 rounded-full animate-float">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Biblioteca Digital</span>
            </div>
            {/* Mesmo respiro do título de trilhas: a fonte de display encosta
                palavras e linhas. */}
            <h1 className="u-page-title text-3xl md:text-5xl leading-[1.5] md:leading-[1.5] [word-spacing:0.15em]">
              Acervo de <br /><span className="text-accent">alta performance</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-300 font-medium italic leading-relaxed">
              Apostilas, videoaulas e materiais de apoio escolhidos pelos professores para os seus estudos.
            </p>
          </div>
          
          <div className="relative w-full md:w-80 group/search shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/65 transition-colors group-focus-within/search:text-accent" />
            <Input
              placeholder="Buscar material…"
              className="pl-12 h-14 bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 text-white placeholder:text-white/65 rounded-[1.25rem] text-sm font-medium italic focus-visible:ring-accent focus-visible:ring-1 focus-visible:border-accent transition-all duration-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full space-y-6">
        {/* Barra de filtros no lugar dela — não acompanha a rolagem.
            O TabsList do shadcn vem com justify-center: quando as abas não
            cabem, o excesso transborda para os dois lados e o início ("Todos")
            fica fora do alcance da rolagem — por isso o justify-start. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 min-w-0">
          <TabsList className="bg-white p-1.5 h-14 rounded-2xl border-none shadow-sm flex justify-start items-center gap-1 overflow-x-auto overflow-y-hidden min-w-0 max-w-full hide-scrollbar">
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
                Tipo: <span className="text-primary">{typeLabel(activeType)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-3 py-3">Filtrar por tipo</DropdownMenuLabel>
              {types.map(type => (
                <DropdownMenuItem 
                  key={type} 
                  onClick={() => setActiveType(type)}
                  className={`rounded-xl px-3 py-2.5 font-bold text-sm cursor-pointer mb-1 last:mb-0 ${activeType === type ? 'bg-primary text-white' : ''}`}
                >
                  {typeLabel(type)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Entrada em CSS puro no invólucro: no próprio Card, o fill da
                animação prenderia o transform e anularia o hover:-translate. */}
            {filteredResources.map((item, index) => (
              <div
                key={item.id}
                className="anim-rise"
                style={{ '--i': Math.min(index, 10) } as React.CSSProperties}
              >
              <Card className="gradient-border overflow-hidden border-none shadow-xl hover:shadow-2xl hover:-translate-y-1.5 hover:glow-orange-strong transition-all duration-300 group bg-white rounded-card flex flex-col h-full">
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 shrink-0">
                  <ContentCover
                    imageUrl={item.image_url}
                    videoUrl={item.type === "Video" ? item.url : null}
                    subject={item.category}
                    title={item.title}
                    className="absolute inset-0"
                    imgClassName="transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className="bg-white/95 backdrop-blur-md text-primary border-none shadow-lg flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider">
                      {item.type === "Video" ? <Video className="h-3.5 w-3.5 text-accent" /> : <FileText className="h-3.5 w-3.5 text-blue-500" />}
                      {typeLabel(item.type)}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="p-8 space-y-3 flex-1">
                  <Badge variant="outline" className="w-fit text-[8px] border-accent/20 text-accent font-black uppercase px-2 py-0.5 bg-accent/5 tracking-wider rounded-md">
                    {item.category || "Geral"}
                  </Badge>
                  <CardTitle className="text-xl font-black text-primary italic leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                    {item.title || "Material sem título"}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-3 italic opacity-80">
                    {item.description || "Material de apoio indicado pelos professores."}
                  </p>
                </CardHeader>
                
                <CardFooter className="p-8 pt-0 mt-auto">
                  <div className="flex gap-3 w-full pt-6 border-t border-muted/10">
                    {item.type !== "Video" ? (
                      <Button asChild className="btn-shimmer flex-1 bg-primary text-white h-12 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all border-none">
                        <Link href={`/dashboard/library/book/${item.id}`}>
                          <PenLine className="h-4 w-4 mr-2 text-accent" /> Estudar agora
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild className="btn-shimmer flex-1 bg-slate-900 text-white h-12 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all border-none">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-2 text-accent animate-pulse" /> Ver videoaula
                        </a>
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
              </div>
            ))}
          </div>
        ) : (
          resources.filter(r => !r.category?.startsWith('LIVRO|')).length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="A biblioteca ainda está vazia"
              description="Quando os professores publicarem apostilas e videoaulas, elas aparecem aqui. Enquanto isso, dá para estudar pelas trilhas."
              action={{ label: "Explorar trilhas", href: "/dashboard/trails" }}
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nenhum material com esses filtros"
              description="Tente outra matéria, outro tipo ou uma palavra diferente na busca."
              action={{ label: "Limpar filtros", onClick: () => { setSearchTerm(""); setActiveCategory("Todos"); setActiveType("Todos"); } }}
            />
          )
        )}
      </Tabs>
    </div>
  );
}
