
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Loader2, 
  ShieldCheck, 
  Lock,
  Calendar,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { fmtDate, txt } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

function ChatAuditContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const u1 = searchParams.get('u1');
  const u2 = searchParams.get('u2');
  
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [user1, setUser1] = useState<any>(null);
  const [user2, setUser2] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadLog() {
      if (!u1 || !u2) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/chat-audit?u1=${u1}&u2=${u2}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        setUser1(data.user1);
        setUser2(data.user2);
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Erro ao carregar log de chat:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLog();
  }, [u1, u2]);

  if (!u1 || !u2) return (
    <div className="max-w-xl mx-auto py-10">
      <EmptyState
        icon={MessageSquare}
        title="Nenhuma conversa selecionada"
        description="Escolha uma conversa na lista de conversas para ver as mensagens."
        action={{ label: "Ver conversas", href: "/dashboard/admin/chats" }}
      />
    </div>
  );

  if (loading) return (
    <div className="min-h-[50vh] flex items-center justify-center flex-col gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="u-label">Carregando conversa…</p>
    </div>
  );

  const name1 = txt(user1?.name, "Usuário");
  const name2 = txt(user2?.name, "Usuário");

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden space-y-4">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-4 shrink-0 bg-card border rounded-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-control h-10 w-10 shrink-0" aria-label="Voltar">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div className="flex -space-x-2 shrink-0">
            <Avatar className="h-10 w-10 border-2 border-background">
              <AvatarFallback className="bg-primary text-white text-xs font-bold">{name1.charAt(0)}</AvatarFallback>
            </Avatar>
            <Avatar className="h-10 w-10 border-2 border-background">
              <AvatarFallback className="bg-muted text-foreground text-xs font-bold">{name2.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0">
            <p className="u-label flex items-center gap-1.5"><Lock className="h-3 w-3" /> Coordenação · auditoria de conversa</p>
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate mt-0.5">{name1} e {name2}</h1>
          </div>
        </div>
        <Badge variant="outline" className="hidden sm:flex font-bold text-[10px] uppercase px-3 h-8 items-center gap-2 shrink-0">
          <ShieldCheck className="h-3 w-3" /> Somente leitura
        </Badge>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col border overflow-hidden rounded-card bg-muted/30">
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="flex flex-col gap-5 py-8 px-4 md:px-10">
            {messages.length === 0 ? (
              <EmptyState
                compact
                icon={MessageSquare}
                title="Nenhuma mensagem nesta conversa"
                description="Não há mensagens registradas entre estas duas pessoas, ou não foi possível carregá-las."
                action={{ label: "Voltar às conversas", href: "/dashboard/admin/chats" }}
              />
            ) : (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <p className="u-label">Início da conversa</p>
              </div>
            )}

            {messages.map((msg) => {
              const sender = msg.sender_id === u1 ? user1 : user2;
              const isU1 = msg.sender_id === u1;
              return (
                <div key={msg.id} className={`flex flex-col ${isU1 ? 'items-start' : 'items-end'}`}>
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">{txt(sender?.name, "Usuário")}</span>
                    <span className="u-label !text-[10px]">{fmtDate(msg.created_at, "dd/MM HH:mm")}</span>
                  </div>
                  <div className={`px-4 py-3 rounded-card text-sm max-w-[85%] md:max-w-[70%] border break-words ${
                    isU1 ? 'bg-card text-foreground rounded-tl-none' : 'bg-muted text-foreground rounded-tr-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 bg-card border-t flex items-center justify-center gap-2 shrink-0">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground text-center">
            Visualização restrita à coordenação. As mensagens acima pertencem à instituição.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function AdminChatAuditDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <ChatAuditContent />
    </Suspense>
  );
}
