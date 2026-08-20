
"use client";

import { useState } from "react";
import { HandMetal, Send, Eraser, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Virtuoso } from 'react-virtuoso';
import { usePathname } from "next/navigation";
import { AuroraAvatar } from "@/components/AuroraAvatar";

interface Message {
  role: "assistant" | "user";
  content: string;
  isError?: boolean;
}

export function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou a Aurora IA. Como posso ajudar na sua gestão ou aprendizado hoje?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const pathname = usePathname();

  const isInputHeavyPage = 
    pathname.includes('/chat/') || 
    pathname.includes('/support') || 
    pathname.includes('/live/') || 
    pathname.includes('/forum/');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);

    // Liberado acesso universal à IA (Sem restrição de login)
    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput("");

    try {
      const history = messages.map(m => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.result.response) {
        setMessages(prev => [...prev, { role: "assistant", content: data.result.response }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.error || "Houve um erro inesperado ao conectar com a Aurora.",
          isError: true 
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `⚠️ [ERRO REDE]: ${err.message || "Tente novamente mais tarde."}`,
        isError: true 
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  const renderMessage = (index: number, msg: Message) => (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 px-6 pb-4`}>
      <div className={`max-w-[85%] p-4 rounded-2xl text-xs md:text-sm font-medium leading-relaxed shadow-sm ${
        msg.role === 'user' 
          ? 'bg-primary text-white rounded-tr-none' 
          : msg.isError
            ? 'bg-red-50 text-red-700 border border-red-100 rounded-tl-none italic font-black'
            : 'bg-white text-primary rounded-tl-none border border-primary/5'
      }`}>
        {msg.content}
      </div>
    </div>
  );
  
  return (
    <div 
      className={`fixed ${isInputHeavyPage ? 'bottom-28 lg:bottom-10' : 'bottom-24 lg:bottom-6'} right-6 z-40 flex flex-col gap-3 items-end transition-all duration-500`}
    >
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
           <button 
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl transition-all hover:scale-110 active:scale-95 border-4 border-white group relative animate-in zoom-in duration-700 ${
              isOpen ? 'rotate-[360deg] shadow-primary/40' : ''
            }`}
            title="Abrir Aurora IA"
          >
            {/* O rosto do próprio bichinho do aluno, quando ele tem um — este
                botão fica visível em quase toda página do dashboard, então é
                aqui que o detalhe mais aparece. Sem bicho adotado, o robô
                (mesmo ícone dos outros três lugares onde a Aurora mora). */}
            <div className="relative flex items-center justify-center h-9 w-9 overflow-hidden rounded-full">
              <AuroraAvatar className="h-full w-full transition-all group-hover:scale-95" />
            </div>
            {!isOpen && <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-50 rounded-full border-2 border-white animate-bounce shadow-sm" />}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[90vw] sm:max-w-[400px] p-0 border-none rounded-l-[2rem] overflow-hidden bg-white flex flex-col shadow-2xl z-50">
          <SheetHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground shadow-lg overflow-hidden p-1">
                  <AuroraAvatar className="h-full w-full" />
                </div>
                <div className="text-left">
                  <SheetTitle className="text-white font-black italic leading-none">Aurora IA</SheetTitle>
                  <p className="text-[8px] font-black uppercase tracking-widest text-accent mt-1">Gabinete de Apoio 360</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMessages([{role: "assistant", content: "Sintonizando dados..."}])} className="text-white/65 hover:text-white rounded-full"><Eraser className="h-4 w-4" /></Button>
            </div>
          </SheetHeader>

          <Virtuoso
            className="flex-1 bg-slate-50/50 pt-6"
            style={{ height: '100%' }}
            data={messages}
            itemContent={renderMessage}
            followOutput="auto"
          />

          <div className="p-4 bg-white border-t shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-2 bg-slate-100 p-1.5 pl-4 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-accent/30 transition-all">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre gestão ou conteúdo..."
                disabled={loading}
                className="border-none shadow-none focus-visible:ring-0 text-xs font-bold italic h-10 bg-transparent"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || loading} className="rounded-full bg-primary hover:bg-primary/95 shadow-xl h-10 w-10 shrink-0 transition-all">
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
