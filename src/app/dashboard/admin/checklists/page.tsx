
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  FileCheck, 
  AlertCircle, 
  CheckCircle2, 
  Send,
  Users,
  Filter,
  ArrowUpRight,
  ClipboardList,
  MessagesSquare,
  Megaphone,
  Sparkles,
  Activity
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fmtNumber, pct, VAZIO } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

const STATUS_NAME: Record<'low' | 'medium' | 'high', string> = {
  low: "Crítico",
  medium: "Em andamento",
  high: "Documentado",
};

interface StudentProgress {
  id: string;
  name: string;
  profile_type: string;
  count: number;
  total: number;
  status: 'low' | 'medium' | 'high';
}

export default function AdminChecklistAuditPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [bulkContent, setBulkContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const TOTAL_REQUIRED_DOCS = 12;

  useEffect(() => {
    async function fetchChecklists() {
      setLoading(true);
      try {
        const { data: allProfiles, error: pError } = await supabase
          .from('profiles')
          .select('id, name, profile_type')
          .eq('role', 'student')
          .order('name');

        if (pError) throw pError;

        const studentProfiles = allProfiles || [];

        const { data: checklistData, error: cError } = await supabase
          .from('student_checklists')
          .select('user_id');

        // Conta por aluno em uma passada (Map) — antes era um .filter() por
        // aluno dentro do .map(), ou seja O(alunos × itens de checklist) rodando
        // no navegador; com ~700 alunos × múltiplos itens isso trava a thread
        // principal no celular.
        const countByStudent = new Map<string, number>();
        for (const c of checklistData || []) {
          countByStudent.set(c.user_id, (countByStudent.get(c.user_id) ?? 0) + 1);
        }

        const progressMap = studentProfiles.map(p => {
          const count = countByStudent.get(p.id) ?? 0;
          const percent = (count / TOTAL_REQUIRED_DOCS) * 100;
          
          return {
            id: p.id,
            name: p.name || 'Estudante',
            profile_type: p.profile_type || 'Novo Aluno',
            count,
            total: TOTAL_REQUIRED_DOCS,
            status: percent < 30 ? 'low' : percent < 80 ? 'medium' : 'high'
          } as StudentProgress;
        });

        setStudents(progressMap);
      } catch (err) {
        console.error("Erro auditoria documentos:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchChecklists();
  }, []);

  const filtered = students.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesType = typeFilter === 'all' || s.profile_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleBulkMessage = async () => {
    if (!bulkContent.trim() || !user || filtered.length === 0) return;
    setIsProcessing(true);
    
    try {
      const messages = filtered.map(student => ({
        sender_id: user.id,
        receiver_id: student.id,
        content: bulkContent
      }));

      const { error } = await supabase.from('direct_messages').insert(messages);
      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: profile?.name || 'Admin',
        action: `Enviou mensagem em massa para ${filtered.length} alunos (${statusFilter})`,
        entity_type: 'bulk_action'
      });

      toast({ title: "Mensagens enviadas", description: `${filtered.length} alunos receberam a mensagem.` });
      setIsMessageOpen(false);
      setBulkContent("");
    } catch (e: any) {
      toast({ title: "Não foi possível enviar as mensagens", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAnnouncement = async () => {
    if (!bulkContent.trim() || !user || filtered.length === 0) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase.from('announcements').insert({
        title: `Documentação: ${statusFilter === 'all' ? 'todos os alunos' : (STATUS_NAME[statusFilter as 'low' | 'medium' | 'high'] ?? statusFilter)}`,
        message: bulkContent,
        priority: 'high',
        author_id: user.id
      });

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: profile?.name || 'Admin',
        action: `Publicou aviso segmentado para o grupo: ${statusFilter}`,
        entity_type: 'announcement'
      });

      toast({ title: "Aviso publicado", description: "O aviso já está no mural de todos os alunos." });
      setIsAnnouncementOpen(false);
      setBulkContent("");
    } catch (e: any) {
      toast({ title: "Não foi possível publicar o aviso", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const statusTone = (st: StudentProgress['status']) =>
    st === 'low'
      ? { text: 'text-red-600', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700' }
      : st === 'medium'
        ? { text: 'text-amber-600', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' }
        : { text: 'text-emerald-600', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' };

  const progressOf = (student: StudentProgress) => {
    const percent = pct(student.count, student.total);
    const tone = statusTone(student.status);
    return (
      <div className="flex flex-col gap-1.5 w-full sm:w-36">
        <div className="flex justify-between items-center text-[11px] font-semibold">
          <span className="text-muted-foreground tabular-nums">{student.count}/{student.total} itens</span>
          <span className={`tabular-nums ${tone.text}`}>{percent}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${tone.bar}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  };

  const statusBadge = (student: StudentProgress) => (
    <Badge className={`border-none font-bold text-[10px] uppercase px-3 h-6 ${statusTone(student.status).badge}`}>
      {STATUS_NAME[student.status]}
    </Badge>
  );

  const rowActions = (student: StudentProgress) => (
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" size="icon" className="rounded-control h-10 w-10" asChild title="Ver perfil" aria-label="Ver perfil">
        <Link href={`/dashboard/admin/users?search=${student.name}`}><ArrowUpRight className="h-4 w-4" /></Link>
      </Button>
      <Button variant="outline" className="font-bold h-10 px-4 rounded-control" asChild>
        <Link href={`/dashboard/chat/${student.id}`}>
          <Send className="h-3.5 w-3.5 mr-2" /> Enviar mensagem
        </Link>
      </Button>
    </div>
  );

  const groupName = statusFilter === 'all' ? 'todos os alunos' : STATUS_NAME[statusFilter as StudentProgress['status']]?.toLowerCase() ?? statusFilter;

  return (
    <div className="space-y-6 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><FileCheck className="h-3.5 w-3.5" /> Coordenação · documentos</p>
          <h1 className="u-page-title text-3xl mt-1">Documentos dos alunos</h1>
          <p className="text-muted-foreground text-sm mt-2">Acompanhe quantos documentos cada aluno já entregou para os vestibulares.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            className="pl-9 h-11 rounded-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Críticos", sub: "menos de 30%", count: students.filter(s => s.status === 'low').length, icon: AlertCircle, color: "text-red-600" },
          { label: "Em andamento", sub: "de 30% a 80%", count: students.filter(s => s.status === 'medium').length, icon: Activity, color: "text-amber-600" },
          { label: "Prontos", sub: "80% ou mais", count: students.filter(s => s.status === 'high').length, icon: CheckCircle2, color: "text-emerald-600" },
        ].map((stat, i) => (
          <Card key={i} className="rounded-card p-4 sm:p-6">
            <div className={`u-label flex items-center gap-2 ${stat.color.replace('text-', '!text-')}`}>
              <stat.icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{stat.label}</span>
            </div>
            <p className={`u-num text-2xl tabular-nums mt-2 ${stat.color}`}>{loading ? VAZIO : fmtNumber(stat.count, 0, "0")}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="u-label flex items-center gap-2">
              <Filter className="h-3 w-3" /> Situação
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 rounded-control">
                <SelectValue placeholder="Todas as situações" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="low">Só críticos</SelectItem>
                <SelectItem value="medium">Em andamento</SelectItem>
                <SelectItem value="high">Prontos para matrícula</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="u-label flex items-center gap-2">
              <Users className="h-3 w-3" /> Perfil
            </Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-11 rounded-control">
                <SelectValue placeholder="Todos os perfis" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="all">Todos os perfis</SelectItem>
                <SelectItem value="etec">Alunos ETEC</SelectItem>
                <SelectItem value="enem">Alunos ENEM</SelectItem>
                <SelectItem value="cpop_santana">CPOP Santana</SelectItem>
                <SelectItem value="cpop_osasco">CPOP Osasco</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:items-end gap-3 [&_button]:w-full sm:[&_button]:w-auto">
          <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
            <DialogTrigger asChild>
              <Button variant="arcade" disabled={filtered.length === 0} className="h-11 font-bold px-5 rounded-control gap-2">
                <MessagesSquare className="h-4 w-4" />
                Mensagem para todos (<span className="tabular-nums">{filtered.length}</span>)
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-card p-6 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Mensagem para os alunos filtrados</DialogTitle>
                <DialogDescription className="text-sm">A mensagem será enviada no chat de cada um dos {filtered.length} alunos filtrados.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                <Label className="u-label">Mensagem</Label>
                <Textarea
                  placeholder="Olá! Notamos que sua documentação está pendente. Precisa de ajuda com algum item?"
                  className="min-h-[100px] rounded-control p-3 text-sm"
                  value={bulkContent}
                  onChange={(e) => setBulkContent(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkMessage} disabled={isProcessing || !bulkContent.trim()} className="w-full h-11 font-bold rounded-control text-sm">
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar no chat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
            <DialogTrigger asChild>
              <Button disabled={filtered.length === 0} variant="outline" className="h-11 font-bold px-5 rounded-control gap-2">
                <Megaphone className="h-4 w-4" />
                Publicar aviso no mural
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-card p-6 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Aviso no mural</DialogTitle>
                <DialogDescription className="text-sm">Cria um aviso no mural de todos os alunos, voltado ao grupo: {groupName}.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                <Label className="u-label">Texto do aviso</Label>
                <Textarea
                  placeholder="Atenção, alunos com documentação crítica: o prazo de envio dos documentos do SiSU termina em 48h!"
                  className="min-h-[100px] rounded-control p-3 text-sm"
                  value={bulkContent}
                  onChange={(e) => setBulkContent(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAnnouncement} disabled={isProcessing || !bulkContent.trim()} className="w-full h-11 font-bold rounded-control text-sm">
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
                  Publicar no mural
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <Card className="rounded-card">
          <CardContent className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="u-label">Carregando documentos…</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={students.length === 0 ? "Nenhum aluno cadastrado" : "Nenhum aluno encontrado"}
          description={students.length === 0
            ? "Cadastre alunos para acompanhar a documentação deles aqui."
            : "Tente ajustar a busca, a situação ou o perfil."}
          action={students.length === 0
            ? { label: "Cadastrar aluno", href: "/dashboard/admin/users/new" }
            : { label: "Limpar filtros", onClick: () => { setSearchTerm(""); setStatusFilter("all"); setTypeFilter("all"); } }}
        />
      ) : (
        <>
          <div className="sm:hidden space-y-3">
            {filtered.map((student) => (
              <Card key={student.id} className="rounded-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground break-words">{student.name}</p>
                      <p className="u-label mt-0.5">{student.profile_type}</p>
                    </div>
                    {statusBadge(student)}
                  </div>
                  {progressOf(student)}
                  {rowActions(student)}
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
                      <TableHead className="px-6 u-label">Aluno / perfil</TableHead>
                      <TableHead className="u-label">Documentos</TableHead>
                      <TableHead className="u-label">Situação</TableHead>
                      <TableHead className="text-right px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((student) => (
                      <TableRow key={student.id} className="hover:bg-muted/20">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">{student.name.charAt(0)}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground text-sm">{student.name}</span>
                              <span className="u-label !text-[10px]">{student.profile_type}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{progressOf(student)}</TableCell>
                        <TableCell>{statusBadge(student)}</TableCell>
                        <TableCell className="text-right px-6">{rowActions(student)}</TableCell>
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
