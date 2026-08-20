
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

      toast({ title: "Mensagens Enviadas!", description: `${filtered.length} alunos receberam seu contato.` });
      setIsMessageOpen(false);
      setBulkContent("");
    } catch (e: any) {
      toast({ title: "Falha no disparo", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAnnouncement = async () => {
    if (!bulkContent.trim() || !user || filtered.length === 0) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase.from('announcements').insert({
        title: `⚠️ Alerta de Documentação: ${statusFilter.toUpperCase()}`,
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

      toast({ title: "Aviso Publicado!", description: "O comunicado já está no mural de todos os alunos." });
      setIsAnnouncementOpen(false);
      setBulkContent("");
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-primary italic leading-none">Auditoria de Documentos</h1>
            <FileCheck className="h-6 w-6 text-accent" />
          </div>
          <p className="text-muted-foreground font-medium italic">Supervisão da prontidão documental para vestibulares.</p>
        </div>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-accent" />
          <Input 
            placeholder="Buscar por nome..." 
            className="pl-12 h-14 bg-white border-none shadow-xl rounded-2xl italic font-medium focus-visible:ring-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Critico (<30%)", count: students.filter(s => s.status === 'low').length, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
          { label: "progresso iniciado", count: students.filter(s => s.status === 'medium').length, icon: Activity, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Prontos (>80%)", count: students.filter(s => s.status === 'high').length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-lg rounded-3xl bg-white overflow-hidden p-6 hover:shadow-xl transition-all">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner`}>
                <stat.icon className={`h-6 w-6 ${stat.icon === Activity ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <p className="text-2xl font-black text-primary">{stat.count}</p>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-primary/40 px-2 tracking-widest flex items-center gap-2">
              <Filter className="h-3 w-3" /> Filtrar por Nível de Risco
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold italic">
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all" className="font-bold">Todos os Status</SelectItem>
                <SelectItem value="low" className="font-bold text-red-600">Apenas Críticos</SelectItem>
                <SelectItem value="medium" className="font-bold text-amber-600">progresso iniciado</SelectItem>
                <SelectItem value="high" className="font-bold text-green-600">Prontos para Matrícula</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-primary/40 px-2 tracking-widest flex items-center gap-2">
              <Users className="h-3 w-3" /> Filtrar por Categoria
            </Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold italic">
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all" className="font-bold">Todos os Perfis</SelectItem>
                <SelectItem value="etec" className="font-bold">Alunos ETEC</SelectItem>
                <SelectItem value="enem" className="font-bold">Alunos ENEM</SelectItem>
                <SelectItem value="cpop_santana" className="font-bold">CPOP Santana</SelectItem>
                <SelectItem value="cpop_osasco" className="font-bold">CPOP Osasco</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
            <DialogTrigger asChild>
              <Button disabled={filtered.length === 0} className="h-12 bg-primary text-white font-black text-[10px] uppercase px-6 rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all gap-2">
                <MessagesSquare className="h-4 w-4 text-accent" />
                Mensagem em Massa ({filtered.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-6 bg-white border-none shadow-2xl max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-black italic text-primary">Intervenção Direta</DialogTitle>
                <DialogDescription className="font-medium italic text-sm">Esta mensagem será enviada individualmente para o chat de {filtered.length} alunos filtrados.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Conteúdo da Mensagem</Label>
                <Textarea 
                  placeholder="Olá! Notamos que sua documentação está pendente. Precisa de ajuda com algum item?" 
                  className="min-h-[100px] rounded-2xl bg-muted/30 border-none font-medium italic p-4 text-sm"
                  value={bulkContent}
                  onChange={(e) => setBulkContent(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkMessage} disabled={isProcessing || !bulkContent.trim()} className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-xl text-sm">
                  {isProcessing ? <Sparkles className="h-5 w-5 animate-pulse mr-2 text-accent" /> : <Send className="h-5 w-5 mr-2 text-accent" />}
                  Disparar no Chat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
            <DialogTrigger asChild>
              <Button disabled={filtered.length === 0} variant="outline" className="h-12 border-2 border-primary/20 text-primary font-black text-[10px] uppercase px-6 rounded-xl hover:bg-primary/5 transition-all gap-2">
                <Megaphone className="h-4 w-4 text-accent" />
                Publicar Aviso Segmentado
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-6 bg-white border-none shadow-2xl max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-black italic text-primary">Alerta Geral de Grupo</DialogTitle>
                <DialogDescription className="font-medium italic text-sm">Isso criará um aviso no mural para toda a rede focada no grupo {statusFilter}.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Corpo do Comunicado</Label>
                <Textarea 
                  placeholder="Atenção alunos em situação CRÍTICA: O prazo para envio de documentos do SiSU encerra em 48h!" 
                  className="min-h-[100px] rounded-2xl bg-muted/30 border-none font-medium italic p-4 text-sm"
                  value={bulkContent}
                  onChange={(e) => setBulkContent(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAnnouncement} disabled={isProcessing || !bulkContent.trim()} className="w-full h-12 bg-accent text-accent-foreground font-black rounded-xl shadow-xl text-sm">
                  {isProcessing ? <Sparkles className="h-5 w-5 animate-pulse mr-2" /> : <Megaphone className="h-5 w-5 mr-2" />}
                  Fixar no Mural de Avisos
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-accent animate-pulse" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Auditando Registros de Rede...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-muted/10">
                  <TableRow className="border-none h-16">
                    <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Estudante / Polo</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Status do Checklist</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Diagnóstico</TableHead>
                    <TableHead className="text-right px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((student) => {
                    const percent = Math.round((student.count / student.total) * 100);
                    return (
                      <TableRow key={student.id} className="border-b last:border-0 hover:bg-accent/5 transition-all group h-24">
                        <TableCell className="px-8">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-black italic shadow-md group-hover:scale-110 transition-transform">{student.name.charAt(0)}</div>
                            <div className="flex flex-col">
                              <span className="font-black text-primary text-sm italic">{student.name}</span>
                              <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">{student.profile_type}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center w-32 text-[8px] font-black uppercase">
                              <span className="text-primary/40">Itens: {student.count}/{student.total}</span>
                              <span className={student.status === 'low' ? 'text-red-500' : student.status === 'medium' ? 'text-amber-500' : 'text-green-500'}>{percent}%</span>
                            </div>
                            <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden border">
                              <div className={`h-full transition-all duration-1000 ${
                                student.status === 'low' ? 'bg-red-500' : student.status === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                              }`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-none font-black text-[8px] uppercase px-3 h-6 ${
                            student.status === 'low' ? 'bg-red-100 text-red-700' : student.status === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {student.status === 'low' ? 'Risco Crítico' : student.status === 'medium' ? 'progresso iniciado' : 'Documentado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-8">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-primary" asChild title="Ver Perfil">
                              <Link href={`/dashboard/admin/users?search=${student.name}`}><ArrowUpRight className="h-4 w-4" /></Link>
                            </Button>
                            <Button className="bg-primary text-white font-black text-[10px] uppercase h-10 px-6 rounded-xl shadow-lg hover:scale-105 transition-all" asChild>
                              <Link href={`/dashboard/chat/${student.id}`}>
                                <Send className="h-3.5 w-3.5 mr-2" /> Cobrar Apoio
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-24 text-center">
              <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="font-black italic text-xl text-primary/40 uppercase tracking-widest">Nenhum registro localizado</p>
              <p className="text-xs text-muted-foreground mt-2 italic">Tente ajustar os filtros de risco ou polo.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
