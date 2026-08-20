"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AuroraAvatar } from "@/components/AuroraAvatar";

interface ClassroomChatIAProps {
  contextTitle?: string;
}

export function ClassroomChatIA({ contextTitle }: ClassroomChatIAProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([
    { 
      role: 'assistant', 
      content: `Olá! Sou a Aurora. Tenho o contexto desta unidade (${contextTitle || "Aula"}). Deixe-me te ajudar a entender melhor este conteúdo, pode perguntar qualquer coisa!` 
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages, isThinking]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking) return;

    const userText = input;
    setInput("");
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setIsThinking(true);

    try {
      const history = newMessages.map(m => ({
        role: m.role,
        content: m.role === 'user' && m.id === undefined ? `[DÚVIDA SOBRE: ${contextTitle || 'AULA'}]\n${m.content}` : m.content
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      const data = await response.json();
      
      if (data.success && data.result?.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.result.response }]);
      } else {
        throw new Error("Falha no sinal.");
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Desculpe, tive um erro de processamento. Pode tentar novamente?", isError: true }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-3xl shadow-xl border border-muted/20 overflow-hidden animate-in zoom-in-95 duration-500">
      <div className="p-4 bg-primary text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center overflow-hidden p-1">
            <AuroraAvatar className="h-full w-full" />
          </div>
          <div>
            <h4 className="text-xs font-black italic uppercase tracking-tighter leading-none">Mentoria IA Aurora</h4>
            <p className="text-[8px] font-black uppercase text-accent tracking-widest mt-1 opacity-80">Sintonizada nesta Aula</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-accent animate-pulse" />
      </div>

      <ScrollArea className="flex-1 p-4 bg-slate-50/50" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[11px] leading-relaxed font-medium shadow-sm border ${
                msg.role === 'user' 
                  ? 'bg-primary text-white border-transparent' 
                  : 'bg-white text-primary border-slate-100'
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <span className="text-[8px] font-black uppercase text-primary/40 italic">Pensando...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="p-3 bg-white border-t flex items-center gap-2">
        <Input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Dúvida sobre esta aula..."
          className="flex-1 h-10 bg-muted/30 border-none rounded-xl text-xs font-bold italic focus-visible:ring-1 focus-visible:ring-accent"
        />
        <Button size="icon" type="submit" disabled={!input.trim() || isThinking} className="h-10 w-10 bg-primary hover:bg-primary/95 text-white rounded-xl shadow-lg shrink-0 border-none">
          <Send className="h-4 w-4 text-accent" />
        </Button>
      </form>
    </div>
  );
}
