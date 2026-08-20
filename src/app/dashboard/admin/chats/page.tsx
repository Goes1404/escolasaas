
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Loader2, 
  MessageSquare, 
  ShieldCheck, 
  History,
  Calendar,
  Filter,
  Users2,
  Clock,
  Trash2,
  AlertTriangle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, isToday, isWithinInterval, subDays, subMonths } from "date-fns";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { ThreadSummary } from "@/app/api/admin/chat-audit/route";

type Conversation = ThreadSummary;

export default function AdminChatAuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/chat-audit');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (err: any) {
      console.error("Erro detalhado ao auditar chats:", err);
      toast({
        title: "Erro de Sincronização",
        description: "Não foi possível carregar os logs de conversa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [toast]);

  const handleClearChat = async (u1: string, u2: string) => {
    setClearingId(`${u1}:${u2}`);
    try {
      const res = await fetch('/api/admin/chat-audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u1, u2 }),
      });
      if (!res.ok) throw new Error(await res.text());

      toast({
        title: "Histórico Limpo",
        description: "As mensagens de teste foram removidas permanentemente."
      });
      
      // Atualiza a lista removendo o thread
      setThreads(prev => prev.filter(t => !(t.u1_id === u1 && t.u2_id === u2)));
    } catch (err: any) {
      toast({
        title: "Falha na Limpeza",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setClearingId(null);
    }
  };

  const filteredThreads = threads.filter(t => {
    const searchMatch = 
      t.u1_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.u2_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.last_message?.toLowerCase().includes(searchTerm.toLowerCase());

    const staffKeywords = ['teacher', 'admin', 'mentor', 'coordenador'];
    const isU1Staff = staffKeywords.some(key => (t.u1_type || '').toLowerCase().includes(key));
    const isU2Staff = staffKeywords.some(key => (t.u2_type || '').toLowerCase().includes(key));

    let roleMatch = true;
    if (roleFilter === 'student_student') roleMatch = !isU1Staff && !isU2Staff;
    if (roleFilter === 'student_staff') roleMatch = (isU1Staff && !isU2Staff) || (!isU1Staff && isU2Staff);
    if (roleFilter === 'staff_staff') roleMatch = isU1Staff && isU2Staff;

    let dateMatch = true;
    const msgDate = new Date(t.last_date);
    const now = new Date();

    if (dateFilter === 'today') dateMatch = isToday(now) && isToday(msgDate);
    if (dateFilter === 'week') dateMatch = isWithinInterval(msgDate, { start: subDays(now, 7), end: now });
    if (dateFilter === 'month') dateMatch = isWithinInterval(msgDate, { start: subMonths(now, 1), end: now });

    return searchMatch && roleMatch && dateMatch;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-primary italic leading-none">Auditoria de Chats</h1>
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <p className="text-muted-foreground font-medium italic">Monitoramento ético e supervisão de interações na rede.</p>
        </div>
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
          <Input 
            placeholder="Buscar por nome ou conteúdo..." 
            className="pl-12 h-14 bg-white border-none shadow-xl rounded-2xl italic font-medium focus-visible:ring-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-primary/40 px-2 tracking-widest flex items-center gap-2">
            <Users2 className="h-3 w-3" /> Categoria de Interação
          </Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold italic">
              <SelectValue placeholder="Todas as Interações" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="all" className="font-bold">Todas as Interações</SelectItem>
              <SelectItem value="student_student" className="font-bold">Aluno ↔ Aluno</SelectItem>
              <SelectItem value="student_staff" className="font-bold">Aluno ↔ Mentoria</SelectItem>
              <SelectItem value="staff_staff" className="font-bold">Equipe Técnica (Staff)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-primary/40 px-2 tracking-widest flex items-center gap-2">
            <Clock className="h-3 w-3" /> Janela de Recência
          </Label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-md font-bold italic">
              <SelectValue placeholder="Todo o Período" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="all" className="font-bold">Todo o Histórico</SelectItem>
              <SelectItem value="today" className="font-bold text-accent">Apenas Hoje</SelectItem>
              <SelectItem value="week" className="font-bold">Última Semana</SelectItem>
              <SelectItem value="month" className="font-bold">Último Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <History className="h-12 w-12 text-accent animate-pulse" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando Logs de Auditoria...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-muted/10">
                  <TableRow className="border-none h-16">
                    <TableHead className="px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Participantes</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Última Interação</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-primary/40">Status</TableHead>
                    <TableHead className="text-right px-8 font-black uppercase text-[10px] tracking-widest text-primary/40">Ações de Gestão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredThreads.map((thread, i) => (
                    <TableRow key={i} className="border-b last:border-0 hover:bg-accent/5 transition-colors group h-24">
                      <TableCell className="px-8">
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 border-2 border-white flex items-center justify-center font-bold text-primary text-xs shadow-sm" title={thread.u1_name}>{thread.u1_name?.charAt(0)}</div>
                            <div className="h-10 w-10 rounded-full bg-accent/10 border-2 border-white flex items-center justify-center font-bold text-accent text-xs shadow-sm" title={thread.u2_name}>{thread.u2_name?.charAt(0)}</div>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-primary text-sm italic group-hover:text-accent transition-colors">
                              {thread.u1_name} + {thread.u2_name}
                            </span>
                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                              {thread.u1_type?.toUpperCase()} / {thread.u2_type?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-primary/70 line-clamp-1 max-w-[200px]">"{thread.last_message}"</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mt-1">
                            <Calendar className="h-2.5 w-2.5" /> {format(new Date(thread.last_date), "dd/MM HH:mm")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 border-none font-black text-[8px] uppercase gap-1.5 px-3">
                          <ShieldCheck className="h-2.5 w-2.5" /> Arquivado
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex items-center justify-end gap-3">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50">
                                {clearingId === `${thread.u1_id}:${thread.u2_id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-10 max-w-sm bg-white">
                              <AlertDialogHeader>
                                <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                                  <AlertTriangle className="h-6 w-6" />
                                </div>
                                <AlertDialogTitle className="text-2xl font-black italic text-primary">Limpar Chat?</AlertDialogTitle>
                                <AlertDialogDescription className="font-medium text-sm">
                                  Esta ação apagará <strong>todas</strong> as mensagens entre estes participantes. Esta operação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-3 mt-6">
                                <AlertDialogCancel className="rounded-xl font-bold border-none bg-muted/30 h-12">Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleClearChat(thread.u1_id, thread.u2_id)} 
                                  className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white h-12 px-8"
                                >
                                  Limpar Agora
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <Button className="bg-primary text-white font-black text-[10px] uppercase h-10 px-6 rounded-xl shadow-lg hover:scale-105 transition-all" asChild>
                            <Link href={`/dashboard/admin/chats/audit?u1=${thread.u1_id}&u2=${thread.u2_id}`}>
                              <History className="h-3.5 w-3.5 mr-2" /> Abrir Log
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredThreads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center py-20">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="font-black italic text-xl text-primary/40 uppercase tracking-widest">Nenhuma conversa localizada</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
