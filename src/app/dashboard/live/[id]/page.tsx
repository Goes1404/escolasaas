"use client";

export const runtime = 'edge';

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Loader2,
  Signal,
  Sparkles,
  ExternalLink,
  Users,
  MonitorPlay,
  CalendarClock,
  ShieldCheck,
  Video
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function StudentLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: liveId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [live, setLive] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!liveId || !user) return;

    async function loadLiveData() {
      try {
        const { data, error } = await supabase
          .from('lives')
          .select(`*`)
          .eq('id', liveId)
          .single();

        if (error) throw error;
        setLive(data);

      } catch (error: any) {
        console.error("Erro ao carregar live:", error);
        toast({ title: "Aula não encontrada", variant: "destructive" });
        router.push('/dashboard/live');
      } finally {
        setLoading(false);
      }
    }

    loadLiveData();

    const channel = supabase
      .channel(`live_view_${liveId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'lives',
        filter: `id=eq.${liveId}`
      }, (payload) => {
        setLive(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId, user, router, toast]);

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin h-12 w-12 text-accent" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse text-primary">Sintonizando Satélite...</p>
    </div>
  );

  const isLiveNow = live?.status === 'live';

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-700 overflow-hidden pb-4">
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-5 rounded-[1.5rem] shadow-sm border border-white/20 shrink-0">
        <div className="flex items-center gap-5 overflow-hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="rounded-full h-11 w-11 shrink-0 bg-primary/5 hover:bg-primary/10 transition-all"
          >
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-black text-primary italic leading-none truncate tracking-tight">{live?.title}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <ShieldCheck className="h-3 w-3 text-accent" />
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                Ambiente de Mentoria • {live?.teacher_name || 'Mentor da Rede'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge className={`${isLiveNow ? 'bg-red-600 animate-pulse' : 'bg-slate-500'} text-white border-none px-4 h-9 font-black text-[10px] flex items-center gap-2.5 rounded-xl shadow-lg`}>
            {isLiveNow ? (
              <><Signal className="h-4 w-4" /> TRANSMISSÃO ATIVA</>
            ) : (
              <><CalendarClock className="h-4 w-4" /> SALA AGENDADA</>
            )}
          </Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-6">
        <Card className="flex-1 bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-none relative flex items-center justify-center group ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,1)_0%,rgba(2,6,23,1)_100%)] opacity-100" />
          
          <div className="w-full h-full relative z-10 flex flex-col items-center justify-center p-8 md:p-12 text-center gap-10">
             <div className="absolute top-8 left-8 flex items-center gap-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
                <div className={`h-2.5 w-2.5 rounded-full ${isLiveNow ? 'bg-red-600 animate-ping' : 'bg-slate-600'}`} />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
                  {isLiveNow ? 'Sinal em Curso' : 'Link em Verificação'}
                </span>
             </div>

             <div className={`h-40 w-48 md:h-64 md:w-64 rounded-[3rem] bg-white/5 border-2 ${isLiveNow ? 'border-accent/40 shadow-[0_0_100px_rgba(245,158,11,0.15)]' : 'border-white/5'} flex items-center justify-center relative transition-all duration-1000 rotate-1 group-hover:rotate-0`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[3rem]" />
                <MonitorPlay className={`h-20 w-20 md:h-32 md:w-32 ${isLiveNow ? 'text-accent' : 'text-white/10'} transition-colors duration-700 relative z-10`} />
                {isLiveNow && (
                  <div className="absolute -bottom-4 -right-4 h-14 w-14 bg-green-500 rounded-2xl border-4 border-slate-950 flex items-center justify-center shadow-2xl rotate-12">
                     <Signal className="h-7 w-7 text-white animate-pulse" />
                  </div>
                )}
             </div>
             
             <div className="space-y-8 max-w-xl">
                <div className="space-y-3">
                  <h3 className="text-2xl md:text-5xl font-black text-white italic leading-none uppercase tracking-tighter drop-shadow-2xl">
                    Console de Mentoria
                  </h3>
                  <p className="text-xs md:text-base text-slate-400 font-medium italic leading-relaxed max-w-sm mx-auto">
                    {live?.meet_link 
                      ? "O acesso externo está liberado. Clique no botão abaixo para iniciar sua participação."
                      : "Esta sessão está agendada. O link será habilitado assim que o mentor registrar a sala."}
                  </p>
                </div>
                
                {live?.meet_link ? (
                  <div className="flex flex-col gap-5 animate-in zoom-in-95 duration-700">
                    <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-black h-16 md:h-24 px-10 md:px-16 rounded-[2rem] shadow-[0_30px_60px_rgba(245,158,11,0.25)] transition-all hover:scale-105 active:scale-95 group relative overflow-hidden border-none ring-4 ring-accent/20">
                      <a href={live.meet_link} target="_blank" rel="noopener noreferrer">
                        <span className="relative z-10 flex items-center gap-5 text-base md:text-2xl uppercase tracking-tighter">
                          ACESSAR SALA DO GOOGLE MEET
                          <ExternalLink className="h-7 w-7 group-hover:translate-x-1.5 group-hover:-translate-y-1.5 transition-transform duration-500" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                      </a>
                    </Button>
                    <div className="flex items-center justify-center gap-3 text-[10px] font-black text-white/60 uppercase tracking-[0.4em]">
                      <Users className="h-3 w-3" /> Sessão Restrita à Rede
                    </div>
                  </div>
                ) : (
                  <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-md shadow-inner animate-pulse">
                    <p className="text-sm font-bold text-slate-500 italic">
                      Aguardando processamento do link pelo Mentor...
                    </p>
                  </div>
                )}
             </div>
          </div>
        </Card>
        
        <Card className="bg-white rounded-[2.5rem] shadow-2xl p-10 border-none shrink-0 relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-5%] p-6 opacity-[0.03] transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-12">
            <Sparkles className="h-40 w-40 text-primary" />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl rotate-3">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-[11px] font-black text-primary/40 uppercase tracking-[0.3em] leading-none">Pauta da Mentoria</h2>
              <p className="text-lg font-black text-primary italic mt-1">O que vamos aprender hoje?</p>
            </div>
          </div>
          <div className="bg-muted/10 p-6 rounded-2xl border border-muted/20">
            <p className="text-sm md:text-lg font-medium italic text-primary/80 leading-relaxed max-w-5xl">
              {live?.description || "Esta sessão de apoio pedagógico é focada na resolução de dúvidas críticas e aprofundamento técnico."}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}