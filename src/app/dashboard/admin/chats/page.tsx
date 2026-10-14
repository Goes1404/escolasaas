
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
import { isToday, isWithinInterval, subDays, subMonths } from "date-fns";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { ThreadSummary } from "@/app/api/admin/chat-audit/route";
import { fmtDate, txt, VAZIO } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

type Conversation = ThreadSummary;

const TYPE_LABEL: Record<string, string> = {
  student: "Aluno",
  teacher: "Professor",
  admin: "Coordenação",
  staff: "Secretaria",
  mentor: "Mentor",
  coordenador: "Coordenação",
};

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
        title: "Não foi possível carregar as conversas",
        description: "Tente novamente em alguns instantes.",
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
        title: "Conversa apagada",
        description: "As mensagens foram removidas permanentemente."
      });
      
      // Atualiza a lista removendo o thread
      setThreads(prev => prev.filter(t => !(t.u1_id === u1 && t.u2_id === u2)));
    } catch (err: any) {
      toast({
        title: "Não foi possível apagar a conversa",
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

  const typeLabel = (t?: string | null) => {
    const k = (t || '').toLowerCase();
    if (!k) return VAZIO;
    return TYPE_LABEL[k] ?? txt(t);
  };

  const renderClear = (thread: Conversation) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Apagar conversa" className="h-10 w-10 rounded-control text-red-500 hover:text-red-600 hover:bg-red-50">
          {clearingId === `${thread.u1_id}:${thread.u2_id}` ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-card p-8 max-w-sm">
        <AlertDialogHeader>
          <div className="h-12 w-12 rounded-control bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-foreground">Apagar esta conversa?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Esta ação apagará <strong>todas</strong> as mensagens entre estes participantes. Não é possível desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 mt-6">
          <AlertDialogCancel className="rounded-control font-bold h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleClearChat(thread.u1_id, thread.u2_id)}
            className="rounded-control font-bold bg-red-600 hover:bg-red-700 text-white h-11 px-6"
          >
            Apagar mensagens
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const openHref = (thread: Conversation) => `/dashboard/admin/chats/audit?u1=${thread.u1_id}&u2=${thread.u2_id}`;

  return (
    <div className="space-y-6 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Coordenação · conversas</p>
          <h1 className="u-page-title text-3xl mt-1">Conversas</h1>
          <p className="text-muted-foreground text-sm mt-2">Acompanhe as conversas entre alunos e equipe na plataforma.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou mensagem..."
            className="pl-9 h-11 rounded-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="u-label flex items-center gap-2">
            <Users2 className="h-3 w-3" /> Quem conversa
          </Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-11 rounded-control">
              <SelectValue placeholder="Todas as conversas" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all">Todas as conversas</SelectItem>
              <SelectItem value="student_student">Aluno ↔ aluno</SelectItem>
              <SelectItem value="student_staff">Aluno ↔ equipe</SelectItem>
              <SelectItem value="staff_staff">Só equipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="u-label flex items-center gap-2">
            <Clock className="h-3 w-3" /> Período
          </Label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-11 rounded-control">
              <SelectValue placeholder="Todo o período" />
            </SelectTrigger>
            <SelectContent className="rounded-control">
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card className="rounded-card">
          <CardContent className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="u-label">Carregando conversas…</p>
          </CardContent>
        </Card>
      ) : filteredThreads.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={threads.length === 0 ? "Nenhuma conversa ainda" : "Nenhuma conversa encontrada"}
          description={threads.length === 0
            ? "Quando alunos e equipe trocarem mensagens, as conversas aparecem aqui."
            : "Tente outro nome, outra categoria ou um período maior."}
          action={threads.length > 0 ? {
            label: "Limpar filtros",
            onClick: () => { setSearchTerm(""); setRoleFilter("all"); setDateFilter("all"); },
          } : undefined}
        />
      ) : (
        <>
          {/* Celular: cartões empilhados no lugar da tabela de 4 colunas */}
          <div className="sm:hidden space-y-3">
            {filteredThreads.map((thread, i) => (
              <Card key={i} className="rounded-card">
                <CardContent className="p-4 space-y-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground break-words">
                      {txt(thread.u1_name, "Usuário")} e {txt(thread.u2_name, "Usuário")}
                    </p>
                    <p className="u-label mt-0.5">{typeLabel(thread.u1_type)} / {typeLabel(thread.u2_type)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 break-words">"{txt(thread.last_message, "")}"</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="u-label flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(thread.last_date, "dd/MM HH:mm")}</span>
                    <div className="flex items-center gap-2">
                      {renderClear(thread)}
                      <Button variant="outline" className="font-bold h-10 px-4 rounded-control" asChild>
                        <Link href={openHref(thread)}>
                          <History className="h-4 w-4 mr-2" /> Abrir
                        </Link>
                      </Button>
                    </div>
                  </div>
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
                      <TableHead className="px-6 u-label">Participantes</TableHead>
                      <TableHead className="u-label">Última mensagem</TableHead>
                      <TableHead className="u-label">Status</TableHead>
                      <TableHead className="text-right px-6 u-label">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredThreads.map((thread, i) => (
                      <TableRow key={i} className="hover:bg-muted/20">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="flex -space-x-3 shrink-0">
                              <div className="h-10 w-10 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center font-bold text-primary text-xs" title={txt(thread.u1_name, "")}>{txt(thread.u1_name, "?").charAt(0)}</div>
                              <div className="h-10 w-10 rounded-full bg-muted border-2 border-background flex items-center justify-center font-bold text-foreground text-xs" title={txt(thread.u2_name, "")}>{txt(thread.u2_name, "?").charAt(0)}</div>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground text-sm">
                                {txt(thread.u1_name, "Usuário")} e {txt(thread.u2_name, "Usuário")}
                              </span>
                              <span className="u-label !text-[10px]">
                                {typeLabel(thread.u1_type)} / {typeLabel(thread.u2_type)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground line-clamp-1 max-w-[240px]">"{txt(thread.last_message, "")}"</span>
                            <span className="u-label !text-[10px] flex items-center gap-1 mt-1">
                              <Calendar className="h-2.5 w-2.5" /> {fmtDate(thread.last_date, "dd/MM HH:mm")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold text-[10px] uppercase gap-1.5 px-3">
                            <ShieldCheck className="h-2.5 w-2.5" /> Arquivada
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex items-center justify-end gap-2">
                            {renderClear(thread)}
                            <Button variant="outline" className="font-bold h-10 px-4 rounded-control" asChild>
                              <Link href={openHref(thread)}>
                                <History className="h-4 w-4 mr-2" /> Abrir conversa
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
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
