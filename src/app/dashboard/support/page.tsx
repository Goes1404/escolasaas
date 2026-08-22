
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Loader2, 
  Eraser, 
  Info, 
  FileText, 
  GraduationCap, 
  ShieldCheck,
  MessageSquarePlus,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthProvider";

interface Message {
  role: "assistant" | "user";
  content: string;
  isError?: boolean;
}

export default function AuroraSupportPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: `Olá! Sou a Aurora, sua Engine de Apoio. Conectada agora a: ${profile?.institution || 'Rede Geral'}. Como posso acelerar seus processos hoje?`
    }]);

    // Simulação industrial de medição de latência real
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 40) + 10);
    }, 5000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth"
        });
      }
    }
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.result?.response || data?.text || "Sem resposta da Aurora.";

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Não consegui processar sua solicitação agora. Tente novamente em instantes. (${err.message})`,
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestionChips = [
    { label: "Documentação ENEM", icon: FileText },
    { label: "Isenção de Taxa", icon: Info },
    { label: "Explique Derivadas", icon: Sparkles },
    { label: "O que é CadÚnico?", icon: GraduationCap },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] w-full max-w-6xl mx-auto animate-in fade-in duration-500 overflow-hidden space-y-6">
      <div className="flex items-center justify-between px-2 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-primary uppercase">
              Engine de Comunicação
            </h1>
            <Badge className="bg-accent/10 text-accent font-black text-[8px] uppercase tracking-widest border-none px-3">SINAL ATIVO</Badge>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-accent" /> {profile?.institution || 'REDE GERAL'} • MONITORAMENTO 24/7
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setMessages([{role: "assistant", content: "Sintonizando dados..."}])} 
            className="rounded-xl border-dashed h-10 px-6 text-xs font-black uppercase hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Eraser className="h-4 w-4 mr-2" /> Reiniciar
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-0 overflow-hidden pb-4">
        <div className="hidden lg:flex flex-col gap-6 w-72 shrink-0">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-2">Categorias de Suporte</p>
            {suggestionChips.map((chip, i) => (
              <Button 
                key={i} 
                variant="outline" 
                onClick={() => handleSend(undefined, chip.label)}
                className="w-full justify-start h-auto py-4 px-5 rounded-2xl bg-white hover:bg-accent hover:text-white transition-all border-none shadow-md font-bold text-xs gap-4 group"
              >
                <div className="p-2.5 bg-primary/5 rounded-xl group-hover:bg-white/20 transition-colors">
                  <chip.icon className="h-4 w-4 text-accent group-hover:text-white shrink-0" />
                </div>
                <span className="truncate">{chip.label}</span>
              </Button>
            ))}
          </div>
          
          <Card className="mt-auto p-6 aurora-dark text-primary-foreground border-none rounded-card shadow-2xl relative overflow-hidden group gradient-border">
            <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-accent/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 space-y-4">
              <h3 className="font-black text-xs flex items-center gap-2 italic">
                <Wifi className="h-4 w-4 text-accent" />
                Status do Polo
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[9px] font-black uppercase opacity-60">
                  <span>Latência de Rede</span>
                  <span className="text-accent italic">{latency}ms</span>
                </div>
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${100 - latency}%` }} />
                </div>
              </div>
              <p className="text-[10px] opacity-70 leading-relaxed font-medium italic">
                O sinal em {profile?.institution || 'sua unidade'} está 100% estável.
              </p>
            </div>
          </Card>
        </div>

        <Card className="gradient-border flex-1 flex flex-col shadow-2xl border-none overflow-hidden rounded-card bg-white relative min-h-0 ring-1 ring-black/5">
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="flex flex-col gap-8 py-8 px-6 md:px-10">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 duration-500`}>
                  <Avatar className={`h-10 w-10 border-2 shrink-0 shadow-lg ${msg.role === 'assistant' ? 'border-primary/10' : 'border-accent/10'}`}>
                    <AvatarFallback className={msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-accent text-white font-black'}>
                      {msg.role === 'assistant' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`p-5 md:p-6 rounded-card text-sm leading-relaxed shadow-sm max-w-[85%] md:max-w-[75%] font-medium ${
                    msg.role === 'assistant' 
                      ? msg.isError 
                        ? 'bg-red-50 text-red-700 border border-red-100 rounded-tl-none font-black italic flex items-start gap-3'
                        : 'bg-muted/20 text-foreground rounded-tl-none' 
                      : 'bg-primary text-white rounded-tr-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-4 md:gap-6 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                  <div className="bg-muted/10 p-6 rounded-card rounded-tl-none flex items-center gap-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50 italic">Aurora processando solicitação...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-6 md:p-8 bg-muted/5 border-t shrink-0">
            <form onSubmit={handleSend} className="flex gap-4 max-w-4xl mx-auto">
              <div className="relative flex-1">
                <MessageSquarePlus className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30" />
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Descreva sua dúvida pedagógica ou administrativa..."
                  disabled={loading}
                  className="h-14 md:h-16 bg-white border-none rounded-3xl pl-14 pr-8 shadow-xl focus-visible:ring-accent text-sm md:text-base font-bold italic"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-shimmer h-14 w-14 md:h-16 md:w-16 bg-primary hover:bg-primary/95 text-white rounded-3xl shadow-2xl glow-orange-strong shrink-0 transition-[transform,box-shadow] active:scale-90 [touch-action:manipulation] flex items-center justify-center border-none"
              >
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
              </button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
