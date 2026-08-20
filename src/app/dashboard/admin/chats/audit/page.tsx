
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
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

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

  if (loading) return (
    <div className="h-screen flex items-center justify-center flex-col gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-accent" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Descriptografando Log de Segurança...</p>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 h-full animate-in fade-in duration-500 overflow-hidden space-y-4">
      <div className="flex items-center justify-between px-4 py-4 shrink-0 bg-white shadow-sm border rounded-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 shrink-0">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <Avatar className="h-10 w-10 border-2 border-white shadow-md">
                <AvatarFallback className="bg-primary text-white text-xs font-black">{user1?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <Avatar className="h-10 w-10 border-2 border-white shadow-md">
                <AvatarFallback className="bg-accent text-white text-xs font-black">{user2?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h1 className="text-lg font-black text-primary italic leading-none">{user1?.name} & {user2?.name}</h1>
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-1">
                <Lock className="h-2 w-2" /> LOG DE AUDITORIA • PROTEGIDO
              </p>
            </div>
          </div>
        </div>
        <Badge className="bg-red-50 text-red-600 border-red-100 font-black text-[8px] uppercase px-3 h-8 flex items-center gap-2">
          <ShieldCheck className="h-3 w-3" /> MODO AUDITOR
        </Badge>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col shadow-2xl border-none overflow-hidden rounded-[3rem] bg-slate-50 relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-red-500/20 z-10" />
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="flex flex-col gap-6 py-10 px-6 md:px-12">
            <div className="flex flex-col items-center justify-center py-10 opacity-40">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4"><Calendar className="h-6 w-6" /></div>
              <p className="text-xs font-black uppercase tracking-widest">Início do Log Histórico</p>
            </div>

            {messages.map((msg, i) => {
              const sender = msg.sender_id === u1 ? user1 : user2;
              const isU1 = msg.sender_id === u1;
              return (
                <div key={msg.id} className={`flex flex-col ${isU1 ? 'items-start' : 'items-end'} animate-in slide-in-from-bottom-2 duration-300`}>
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="text-[8px] font-black uppercase text-primary/40">{sender?.name}</span>
                    <span className="text-[7px] font-bold text-muted-foreground italic">{format(new Date(msg.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  <div className={`px-6 py-4 rounded-[2rem] text-sm font-medium shadow-sm max-w-[85%] md:max-w-[70%] border ${
                    isU1 ? 'bg-white text-primary border-primary/5 rounded-tl-none' : 'bg-muted/30 text-primary border-muted/20 rounded-tr-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-6 bg-red-50/50 border-t border-red-100 flex items-center justify-center gap-3 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-red-800 italic">
            Visualização restrita ao Gabinete de Gestão. As interações acima são propriedade da rede.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function AdminChatAuditDetailPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    }>
      <ChatAuditContent />
    </Suspense>
  );
}
