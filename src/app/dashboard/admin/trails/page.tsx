
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  MessageSquare, 
  Loader2, 
  Filter, 
  Search,
  AlertCircle,
  Clock,
  User,
  Layout,
  ShieldCheck,
  ClipboardList
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function TrailApprovalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [trails, setTrails] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrails() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('trails')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setTrails(data || []);
      } catch (e) {
        console.error("Erro ao buscar trilhas:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTrails();
  }, []);

  const handleApprove = async (id: string) => {
    if (approvingId) return;
    setApprovingId(id);
    const { error } = await supabase.from('trails').update({ status: 'published' }).eq('id', id);
    if (!error) {
      setTrails(prev => prev.map(t => t.id === id ? { ...t, status: 'published' } : t));
      toast({ title: "Trilha Aprovada!", description: "O conteúdo já está visível para os alunos." });
    } else {
      toast({ title: "Erro na aprovação", description: "Verifique sua conexão.", variant: "destructive" });
    }
    setApprovingId(null);
  };

  const filteredTrails = trails.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Cabeçalho + busca não dependem de dado nenhum — só a tabela espera a
  // query. Gate cheio aqui prendia UI estática atrás do fetch de trilhas.
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-primary italic leading-none">Controle de Qualidade</h1>
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <p className="text-muted-foreground font-medium italic text-sm md:text-lg">Aprovação e Workflow de Conteúdo Pedagógico</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
          <Input 
            placeholder="Pesquisar por título ou matéria..." 
            className="pl-12 h-14 bg-white border-none shadow-xl rounded-2xl italic font-medium focus-visible:ring-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white shadow-xl border-none font-bold gap-2 hover:bg-muted transition-all">
          <Filter className="h-4 w-4" /> Filtros Avançados
        </Button>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-muted/10">
                <TableRow className="border-none h-16">
                  <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Trilha / Conteúdo</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Professor</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Status</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
                      <div className="space-y-2 p-4">
                        {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-50 animate-pulse" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredTrails.map((trail) => (
                  <TableRow key={trail.id} className="border-b last:border-0 hover:bg-accent/5 transition-colors group h-24">
                    <TableCell className="px-8">
                      <div>
                        <p className="font-black text-primary text-sm italic group-hover:text-accent transition-colors">{trail.title}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter mt-1">{trail.category}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 shadow-sm"><User className="h-4 w-4 text-primary/40" /></div>
                        <span className="text-xs font-bold text-primary/70">{trail.teacher_name || "Mentor"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {trail.status === 'review' || trail.status === 'draft' ? (
                        <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[8px] uppercase gap-1.5 px-3 h-6">
                          <Clock className="h-2.5 w-2.5" /> Aguardando Revisão
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-none font-black text-[8px] uppercase gap-1.5 px-3 h-6">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Publicada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-white hover:shadow-md transition-all" asChild>
                          <Link href={`/dashboard/classroom/${trail.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-white hover:shadow-md transition-all"><MessageSquare className="h-4 w-4" /></Button>
                        {trail.status !== 'published' && (
                          <Button 
                            onClick={() => handleApprove(trail.id)} 
                            disabled={approvingId === trail.id}
                            className="bg-primary text-white font-black text-[10px] uppercase h-10 px-6 rounded-xl shadow-lg shadow-primary/20 min-w-[100px] hover:bg-primary/95 transition-all"
                          >
                            {approvingId === trail.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aprovar"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTrails.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center py-20">
                      <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                      <p className="font-black italic text-xl text-primary/40 uppercase tracking-widest">Nenhuma trilha pendente</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
