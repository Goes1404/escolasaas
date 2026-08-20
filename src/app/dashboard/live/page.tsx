"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MonitorPlay, Clock, Loader2, ArrowRight, Signal, Calendar, ShieldCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LiveClassesPage() {
  const [lives, setLives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLives() {
      setLoading(true);
      try {
        // Promise.race garante que o loading sempre resolva, mesmo que o fetch
        // fique pendurado (ex.: service worker antigo interceptando a request),
        // o que travava a tela em "Sintonizando Estúdio Master..." para sempre.
        const query = supabase
          .from('lives')
          .select('*')
          .in('status', ['live', 'scheduled'])
          .gte('start_time', new Date(Date.now() - 3600000).toISOString())
          .order('start_time', { ascending: true });

        const { data, error } = await Promise.race([
          query,
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Tempo esgotado ao sintonizar o estúdio.')), 12_000)
          ),
        ]);

        if (error) throw error;
        setLives(data || []);
      } catch (err) {
        console.error("Erro ao buscar lives:", err);
        // Em caso de erro/timeout, mostramos a tela vazia em vez de travar.
        setLives([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLives();

    const channel = supabase
      .channel('live_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lives' }, () => {
        fetchLives();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sintonizando Estúdio Master...</p>
      </div>
    );
  }

  const liveNow = lives.filter(l => l.status === 'live');
  const upcoming = lives.filter(l => l.status === 'scheduled');

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-20 px-2 md:px-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl md:text-5xl font-black text-primary italic leading-none uppercase tracking-tighter">Centro de Transmissões</h1>
          <Badge className="bg-red-50 text-red-600 border-none font-black text-[9px] px-3 py-1 shadow-sm">REDE ATIVA</Badge>
        </div>
        <p className="text-muted-foreground text-sm md:text-xl font-medium italic">Mentoria técnica e sessões de redação em tempo real.</p>
      </div>

      {liveNow.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-3 w-3 rounded-full bg-red-600 animate-ping shadow-[0_0_15px_rgba(220,38,38,0.6)]" />
            <h2 className="text-lg md:text-2xl font-black text-red-600 uppercase tracking-[0.2em] italic">Transmissão em Curso</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {liveNow.map((live) => (
              <Card key={live.id} className="border-none shadow-2xl bg-slate-950 text-white rounded-[3rem] md:rounded-[4rem] overflow-hidden group border-l-[16px] border-red-600 relative transition-all hover:-translate-y-2 duration-500">
                <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-[120px]" />
                <CardContent className="p-8 md:p-16 space-y-10 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-3">
                      <Badge className="bg-red-600 text-white border-none px-6 h-10 font-black flex items-center gap-3 animate-pulse text-[10px] md:text-[13px] rounded-full shadow-2xl">
                        <Signal className="h-5 w-5" /> SINAL AO VIVO
                      </Badge>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2 px-1">
                        <ShieldCheck className="h-4 w-4 text-accent" />
                        AMBIENTE AUDITADO
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mentor Responsável</p>
                      <p className="font-black italic text-accent text-xl md:text-3xl mt-1">{live.teacher_name || "Especialista"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-5">
                    <h3 className="text-2xl md:text-5xl font-black italic leading-[1] group-hover:text-accent transition-colors tracking-tight uppercase">{live.title}</h3>
                    <p className="text-sm md:text-xl text-slate-400 line-clamp-2 italic font-medium leading-relaxed opacity-80">{live.description || "Inicie agora sua participação nesta mentoria técnica obrigatória."}</p>
                  </div>

                  <Button 
                    asChild 
                    className="w-full bg-white text-slate-950 hover:bg-accent hover:text-accent-foreground font-black h-16 md:h-24 rounded-2xl md:rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] transition-all border-none group/btn text-lg md:text-2xl"
                  >
                     <Link href={`/dashboard/live/${live.id}`} className="flex items-center justify-center gap-6">
                        ENTRAR NO ESTÚDIO
                        <ArrowRight className="h-8 w-8 group-hover/btn:translate-x-3 transition-transform duration-500" />
                     </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <Calendar className="h-8 w-8 text-accent" />
          <h2 className="text-lg md:text-3xl font-black text-primary italic uppercase tracking-[0.2em]">Próximas Sessões</h2>
        </div>
        
        {upcoming.length === 0 && liveNow.length === 0 ? (
          <Card className="border-none shadow-xl bg-white rounded-[3.5rem] p-24 text-center opacity-40 border-dashed border-4 flex flex-col items-center gap-8">
            <div className="h-24 w-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center shadow-inner">
              <MonitorPlay className="h-12 w-12 text-primary/20" />
            </div>
            <div className="space-y-3">
              <p className="font-black italic text-3xl text-primary uppercase tracking-tighter">Silêncio no Estúdio</p>
              <p className="text-sm md:text-xl text-muted-foreground font-medium italic">Nenhuma mentoria externa agendada para as próximas horas.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {upcoming.map((live) => (
              <Card key={live.id} className="border-none shadow-xl bg-white rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden hover:shadow-2xl transition-all duration-500 border-l-[12px] border-primary/5 group">
                <CardContent className="p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16">
                  <div className="flex items-center gap-8 md:gap-12 w-full md:w-auto">
                    <div className="h-24 w-24 md:h-32 md:w-32 rounded-[2rem] md:rounded-[2.5rem] bg-slate-50 text-primary flex flex-col items-center justify-center shadow-inner shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-700">
                      <span className="text-[10px] md:text-[14px] font-black uppercase opacity-60 tracking-widest">{format(new Date(live.start_time), 'MMM', { locale: ptBR })}</span>
                      <span className="text-3xl md:text-6xl font-black italic leading-none mt-1">{format(new Date(live.start_time), 'dd')}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="text-[9px] md:text-[12px] border-accent/20 text-accent font-black uppercase px-4 h-7 rounded-xl shadow-sm bg-accent/5">AGENDADA</Badge>
                        <Badge variant="outline" className="text-[9px] md:text-[11px] font-black text-muted-foreground uppercase flex items-center gap-2 border-none shadow-none bg-transparent">
                          <MapPin className="h-4 w-4 text-primary/30" /> Transmissão Remota
                        </Badge>
                      </div>
                      <h3 className="font-black text-primary italic text-2xl md:text-4xl leading-none truncate group-hover:text-accent transition-colors tracking-tight uppercase">{live.title}</h3>
                      <p className="text-[11px] md:text-xl text-muted-foreground font-bold uppercase mt-4 tracking-wider flex items-center gap-3 italic">
                        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                        Com o Mentor {live.teacher_name || "Especialista"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between w-full md:w-auto gap-10 md:gap-20 border-t md:border-t-0 pt-8 md:pt-0 border-muted/10">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-4 text-primary font-black italic text-2xl md:text-5xl">
                        <Clock className="h-6 w-6 md:h-10 md:w-10 text-accent" />
                        {format(new Date(live.start_time), 'HH:mm')}
                      </div>
                      <span className="text-[10px] md:text-[14px] font-black text-muted-foreground uppercase tracking-widest mt-3 opacity-60">Sinal Habilitado</span>
                    </div>
                    <Button asChild variant="outline" className="rounded-2xl md:rounded-3xl border-4 border-primary/10 font-black h-16 md:h-24 px-10 md:px-16 text-xs md:text-xl uppercase shadow-lg hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-95 shrink-0">
                      <Link href={`/dashboard/live/${live.id}`}>GARANTIR ACESSO</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}