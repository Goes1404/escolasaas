"use client";

export const runtime = 'edge';

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, ChevronLeft, Loader2, MessageSquare, ShieldCheck, AlertCircle, Sparkles, Terminal, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { AuroraAvatar } from "@/components/AuroraAvatar";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  isError?: boolean;
  is_read?: boolean;
}

export default function DirectChatPage() {
  const params = useParams();
  const contactId = params.id as string;
  const isAurora = contactId === "aurora-ai";
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBlockedStudentToStudent, setIsBlockedStudentToStudent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isStaffUser = ['teacher', 'staff', 'admin'].includes(profile?.profile_type?.toLowerCase() || '');

  useEffect(() => {
    if (!user || isAurora || !contactId) return;

    const markAsRead = async () => {
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', contactId)
        .eq('is_read', false);
    };

    markAsRead();
  }, [user, contactId, isAurora, messages.length]);

  useEffect(() => {
    async function loadChatData() {
      if (authLoading) return;
      if (!user || !contactId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        if (isAurora) {
          setContact({ name: "Aurora IA", profile_type: "teacher", institution: "Mentoria Geral" });
          setMessages([
            { id: 'initial', sender_id: 'aurora-ai', content: 'Olá! Sou a Aurora. Como posso te ajudar a acelerar seus estudos hoje?', created_at: new Date().toISOString() }
          ]);
        } else {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', contactId)
            .single();
          
          if (!profileError && profileData) {
            setContact(profileData);
            
            // Check student-to-student direct messaging restriction
            const myType = (profile?.profile_type || '').toLowerCase();
            const theirType = (profileData.profile_type || '').toLowerCase();
            if (myType === 'student' && theirType === 'student') {
              setIsBlockedStudentToStudent(true);
            }
          } else {
            setContact({ name: "Mentor da Rede", institution: "Plataforma EAD" });
          }

          // Teto defensivo: sem limite, uma conversa longa reenviaria o
          // histórico inteiro a cada abertura do chat. 300 mais recentes
          // (desc, depois reordenadas) cobre qualquer thread real de hoje
          // sem herdar meses de mensagens pra sempre conforme o uso cresce.
          const { data: msgsDesc, error: msgsError } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(300);

          if (!msgsError) {
            setMessages((msgsDesc || []).slice().reverse());
          } else {
            toast({ title: "Falha ao carregar mensagens", description: "Verifique sua conexão.", variant: "destructive" });
          }
        }
      } catch (err) {
        console.error("Erro fatal ao carregar chat:", err);
      } finally {
        setLoading(false);
      }
    }

    loadChatData();

    if (!isAurora && user) {
      const channel = supabase
        .channel(`chat_realtime_${contactId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages'
        }, (payload) => {
          const isFromCurrentChat = 
            (payload.new.sender_id === user.id && payload.new.receiver_id === contactId) ||
            (payload.new.sender_id === contactId && payload.new.receiver_id === user.id);

          if (isFromCurrentChat) {
            setMessages((prev: ChatMessage[]) => {
              if (!payload.new || typeof payload.new.id !== 'string') return prev;
              const exists = prev.some(m => m.id === payload.new.id);
              return exists ? prev : [...prev, payload.new as ChatMessage];
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, contactId, isAurora, toast, authLoading, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages, isAiThinking]);

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const userText = customText || input;
    if (!userText.trim() || !user || !contactId || isSending || isBlockedStudentToStudent) return;

    if (!customText) setInput("");

    if (isAurora) {
      const newUserMessage = { id: `u-${Date.now()}`, sender_id: user.id, content: userText, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, newUserMessage]);
      setIsAiThinking(true);

      try {
        const history = messages
          .filter(m => !m.isError && m.id !== 'initial')
          .map(m => ({
            role: m.sender_id === 'aurora-ai' ? 'assistant' : 'user',
            content: m.content
          }));
        
        history.push({ role: 'user', content: userText });

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history })
        });

        const data = await response.json();
        
        if (data.success && data.result?.response) {
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            sender_id: "aurora-ai",
            content: data.result.response,
            created_at: new Date().toISOString()
          }]);
        } else {
          throw new Error(data.error || "Erro na resposta da Aurora.");
        }
      } catch (err: any) {
        setMessages(prev => [...prev, {
          id: `ai-err-${Date.now()}`,
          sender_id: "aurora-ai",
          content: "Ops! Tive um problema de sinal agora. Pode tentar reformular sua dúvida?",
          created_at: new Date().toISOString(),
          isError: true
        }]);
      } finally {
        setIsAiThinking(false);
      }
    } else {
      setIsSending(true);
      try {
        const { data, error } = await supabase.from('direct_messages').insert({
          sender_id: user.id,
          receiver_id: contactId,
          content: userText,
          is_read: false
        }).select().single();

        if (error) throw error;

        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data as ChatMessage];
        });

        // Push (fire-and-forget). O texto NÃO vai mais no corpo: a rota lê a
        // mensagem que acabou de ser gravada, para ninguém conseguir disparar
        // notificação com conteúdo forjado em nome de outra pessoa.
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "chat", receiverId: contactId }),
        }).catch(() => {});
      } catch (err: any) {
        toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
      } finally {
        setIsSending(false);
      }
    }
  };
  
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center relative">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 animate-pulse">Sintonizando Canal de Mentoria...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in overflow-hidden relative rounded-3xl border border-muted/20 shadow-xl min-h-[75vh]">
      {/* Background dot grid overlay */}
      <div className="absolute inset-0 dot-grid-dark opacity-10 pointer-events-none" />
      
      {/* ── CABEÇALHO DO CHAT (Glassmorphism + Gradient Border) ── */}
      <div className="flex items-center justify-between p-3 md:p-5 bg-white/80 backdrop-blur-md border-b shrink-0 z-10">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-11 w-11 shrink-0 hover:bg-primary/5">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="relative shrink-0">
              <Avatar className={`h-11 w-11 md:h-14 md:w-14 border-[3px] shadow-lg ${isAurora ? 'bg-accent border-white' : 'border-primary/5'}`}>
                {isAurora ? (
                  <div className="h-full w-full flex items-center justify-center text-accent-foreground p-1.5">
                    <AuroraAvatar className="h-full w-full" />
                  </div>
                ) : (
                  <>
                    <AvatarImage src={`https://picsum.photos/seed/${contactId}/150/150`} />
                    <AvatarFallback className="bg-primary text-white font-black italic text-sm">{contact?.name?.charAt(0) || "?"}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-black text-primary italic leading-none truncate">{contact?.name || "Mentor da Rede"}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest truncate">
                  {isAurora ? 'Engine de Apoio 24/7' : (contact?.institution || 'Plataforma EAD')}
                </span>
                <Badge variant="outline" className="bg-primary/5 border-none text-primary/45 font-black text-[7px] px-2 h-4 uppercase tracking-widest leading-none flex items-center justify-center shrink-0">
                  {contact?.profile_type === 'teacher' ? 'Docente' : (contact?.profile_type === 'staff' ? 'Secretaria' : 'Estudante')}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-3 pr-2">
          <Badge className="bg-primary/5 text-primary border-none font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 h-9 px-4 rounded-xl">
            <ShieldCheck className="h-4 w-4 text-accent" /> SINAL SEGURO
          </Badge>
        </div>
      </div>

      {/* ── CONVERSAÇÃO (BOM INTERFACE DE CHAT STITCH STYLE) ── */}
      <div className="flex-1 min-h-0 flex flex-col relative z-0">
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="flex flex-col gap-5 py-8 px-4 md:px-12 max-w-4xl mx-auto w-full">
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id;
              const isError = msg.isError;
              return (
                <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                  <div className="flex items-center gap-2 mb-1 px-3">
                    {!isMe && <span className="text-[8px] font-black uppercase text-primary/30 tracking-widest">{msg.sender_id === contactId ? contact?.name : 'Aurora'}</span>}
                    <span className="text-[7px] font-bold text-muted-foreground italic opacity-50">{format(new Date(msg.created_at), "HH:mm")}</span>
                  </div>
                  <div className={`px-5 py-3.5 rounded-card text-sm leading-relaxed font-medium shadow-sm max-w-[85%] md:max-w-[70%] transition-all border ${
                      isMe 
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent rounded-tr-none shadow-orange-500/10' 
                        : isError 
                          ? 'bg-red-50 text-red-700 border-red-100 rounded-tl-none font-black italic flex items-start gap-2.5' 
                          : 'bg-white text-primary border-slate-200/50 rounded-tl-none'
                    }`}>
                     {isError && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                     
                     <div className="w-full text-sm leading-relaxed overflow-hidden">
                       <ReactMarkdown
                         remarkPlugins={[remarkGfm]}
                         components={{
                           p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                           ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                           ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                           li: ({node, ...props}) => <li className="" {...props} />,
                           strong: ({node, ...props}) => <strong className="font-extrabold" {...props} />,
                           em: ({node, ...props}) => <em className="italic opacity-90" {...props} />,
                           h1: ({node, ...props}) => <h1 className="text-lg font-black mt-4 mb-2 uppercase" {...props} />,
                           h2: ({node, ...props}) => <h2 className="text-base font-black mt-3 mb-2 uppercase" {...props} />,
                           h3: ({node, ...props}) => <h3 className="text-sm font-black mt-2 mb-1 uppercase" {...props} />,
                           a: ({node, ...props}) => <a className="underline underline-offset-2 break-all opacity-90 hover:opacity-100" target="_blank" rel="noopener noreferrer" {...props} />,
                           code: ({node, inline, ...props}: any) => inline 
                             ? <code className="bg-black/10 px-1 py-0.5 rounded text-xs font-mono" {...props} /> 
                             : <pre className="bg-black/10 p-3 rounded-lg text-xs overflow-x-auto my-3"><code className="font-mono" {...props} /></pre>,
                           blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-current opacity-70 pl-3 my-2 italic" {...props} />
                         }}
                       >
                         {msg.content}
                       </ReactMarkdown>
                     </div>
                  </div>
                </div>
              );
            })}
            
            {isAiThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-card rounded-tl-none border border-slate-100 shadow-sm animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/30 italic">Aurora respondendo...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {isAurora && !isAiThinking && messages.length < 3 && (
          <div className="px-4 md:px-12 max-w-4xl mx-auto w-full mb-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => handleSend(undefined, "O que é a regra de 1,5 salário mínimo?")}
                className="bg-accent/10 hover:bg-accent/20 text-accent font-black text-[9px] uppercase tracking-widest px-4 py-2 rounded-full border border-accent/20 transition-all flex items-center gap-2"
              >
                <Sparkles className="h-3 w-3" /> Testar Resposta Aurora
              </button>
              <button 
                onClick={() => handleSend(undefined, "Quais documentos preciso para o ETEC?")}
                className="bg-primary/5 hover:bg-primary/10 text-primary font-black text-[9px] uppercase tracking-widest px-4 py-2 rounded-full border border-primary/10 transition-all flex items-center gap-2"
              >
                <Terminal className="h-3 w-3" /> Testar Signal Pedagógico
              </button>
            </div>
          </div>
        )}

        {/* Input area styled with Stitch glassmorphism */}
        <div className="p-4 md:p-6 bg-white/90 border-t shrink-0 backdrop-blur-md relative z-10">
          {isAurora && (
            <p className="text-[9px] text-center text-muted-foreground/60 mb-2 px-4 uppercase tracking-widest italic font-bold">
              A Aurora IA é uma inteligência artificial e pode cometer erros. Verifique informações importantes.
            </p>
          )}
          {isBlockedStudentToStudent ? (
            <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center gap-3 text-red-700 shadow-sm">
              <ShieldAlert className="h-5 w-5 shrink-0 animate-pulse" />
              <p className="text-xs font-black uppercase tracking-tight italic">
                Diretrizes de Segurança: Estudantes não podem enviar mensagens para outros estudantes.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => handleSend(e)} className="flex items-center gap-3 max-w-4xl mx-auto bg-slate-100 p-2 pl-6 rounded-card border border-slate-200/80 focus-within:ring-4 focus-within:ring-accent/10 transition-all">
               <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isAiThinking || isSending}
                placeholder={isAurora ? "Tire uma dúvida pedagógica..." : (isStaffUser ? "Digite sua mensagem..." : "Digite sua mensagem para o mentor...")}
                className="flex-1 h-10 md:h-12 bg-transparent border-none text-primary font-bold italic focus-visible:outline-none text-sm px-0"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isAiThinking || isSending} 
                className="h-10 w-10 md:h-12 md:w-12 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full shadow-lg shrink-0 border-none transition-all active:scale-90 flex items-center justify-center hover:scale-105"
              >
                {isAiThinking || isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
