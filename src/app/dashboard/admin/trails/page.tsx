
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
import { txt } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

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
      toast({ title: "Trilha aprovada", description: "O conteúdo já está visível para os alunos." });
    } else {
      toast({ title: "Não foi possível aprovar a trilha", description: "Verifique sua conexão e tente de novo.", variant: "destructive" });
    }
    setApprovingId(null);
  };

  const filteredTrails = trails.filter(t => (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()));

  // Cabeçalho + busca não dependem de dado nenhum — só a tabela espera a
  // query. Gate cheio aqui prendia UI estática atrás do fetch de trilhas.
  const statusBadge = (trail: any) =>
    trail.status === 'review' || trail.status === 'draft' ? (
      <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px] uppercase gap-1.5 px-3 h-6">
        <Clock className="h-2.5 w-2.5" /> Aguardando revisão
      </Badge>
    ) : (
      <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] uppercase gap-1.5 px-3 h-6">
        <CheckCircle2 className="h-2.5 w-2.5" /> Publicada
      </Badge>
    );

  const actions = (trail: any) => (
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" size="icon" aria-label="Ver trilha" className="rounded-control h-10 w-10" asChild>
        <Link href={`/dashboard/classroom/${trail.id}`}><Eye className="h-4 w-4" /></Link>
      </Button>
      <Button variant="ghost" size="icon" aria-label="Comentar" className="rounded-control h-10 w-10"><MessageSquare className="h-4 w-4" /></Button>
      {trail.status !== 'published' && (
        <Button
          onClick={() => handleApprove(trail.id)}
          disabled={approvingId === trail.id}
          className="font-bold h-10 px-5 rounded-control min-w-[100px]"
        >
          {approvingId === trail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
        </Button>
      )}
    </div>
  );

  // Cabeçalho + busca não dependem de dado nenhum — só a tabela espera a
  // query. Gate cheio aqui prendia UI estática atrás do fetch de trilhas.
  return (
    <div className="space-y-6 pb-20 px-1">
      <div>
        <p className="u-label flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Coordenação · trilhas</p>
        <h1 className="u-page-title text-3xl mt-1">Aprovação de trilhas</h1>
        <p className="text-muted-foreground text-sm mt-2">Revise e publique as trilhas criadas pelos professores.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            className="pl-9 h-11 rounded-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-11 px-5 rounded-control font-bold gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-card bg-muted/50 animate-pulse" />)}
        </div>
      ) : filteredTrails.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={trails.length === 0 ? "Nenhuma trilha criada ainda" : "Nenhuma trilha encontrada"}
          description={trails.length === 0
            ? "Quando um professor criar uma trilha, ela aparece aqui para revisão."
            : "Nenhuma trilha tem esse título. Tente outra busca."}
          action={trails.length > 0 && searchTerm ? { label: "Limpar busca", onClick: () => setSearchTerm("") } : undefined}
        />
      ) : (
        <>
          <div className="sm:hidden space-y-3">
            {filteredTrails.map((trail) => (
              <Card key={trail.id} className="rounded-card">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground break-words">{txt(trail.title, "Sem título")}</p>
                    <p className="u-label mt-0.5">{txt(trail.category)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2 min-w-0"><User className="h-4 w-4 shrink-0" /> <span className="truncate">{txt(trail.teacher_name, "Professor")}</span></span>
                    {statusBadge(trail)}
                  </div>
                  {actions(trail)}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden sm:block rounded-card overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-6 u-label">Trilha</TableHead>
                      <TableHead className="u-label">Professor</TableHead>
                      <TableHead className="u-label">Status</TableHead>
                      <TableHead className="text-right px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrails.map((trail) => (
                      <TableRow key={trail.id} className="hover:bg-muted/20">
                        <TableCell className="px-6 py-4">
                          <p className="font-semibold text-foreground text-sm">{txt(trail.title, "Sem título")}</p>
                          <p className="u-label !text-[10px] mt-1">{txt(trail.category)}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
                            <span className="text-sm text-foreground">{txt(trail.teacher_name, "Professor")}</span>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(trail)}</TableCell>
                        <TableCell className="text-right px-6">{actions(trail)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
