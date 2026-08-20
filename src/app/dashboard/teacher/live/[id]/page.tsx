
"use client";

export const runtime = 'edge';

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Signal, 
  ChevronLeft, 
  Loader2,
  Power,
  User,
  Users,
  ExternalLink,
  Mic,
  Video,
  MonitorUp,
  Settings
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";

/**
 * Studio Master - Visão do Mentor/Professor (Educori 360)
 * Atualizado para Next.js 15.
 */
export default function TeacherLiveStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: liveId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [live, setLive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!liveId || !user) return;
    
    async function loadStudioData() {
      try {
        const { data, error } = await supabase
          .from('lives')
          .select('*')
          .eq('id', liveId)
          .single();

        if (error) throw error;
        setLive(data);

      } catch (e) {
        toast({ title: "Erro ao acessar estúdio", variant: "destructive" });
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadStudioData();

    const channel = supabase
      .channel(`live_studio_${liveId}`)
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

  const toggleLiveStatus = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const newStatus = live.status === 'live' ? 'scheduled' : 'live';
    
    const { error } = await supabase
      .from('lives')
      .update({ status: newStatus })
      .eq('id', liveId);

    if (!error) {
      toast({ title: `Sinal: ${newStatus.toUpperCase()}` });
    } else {
      toast({ title: "Erro ao mudar status", variant: "destructive" });
    }
    setIsUpdating(false);
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-950 gap-4">
      <Loader2 className="animate-spin h-12 w-12 text-red-600" />
      <p className="text-[10px] font-black text-white/65 uppercase tracking-[0.3em]">Sincronizando Studio Master...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-6 animate-in fade-in duration-700 overflow-hidden pb-4">
      {/* Barra de Comando Industrial */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-slate-950 p-6 rounded-3xl text-white shadow-2xl border-b-4 border-red-600 gap-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 rounded-full h-12 w-12">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none">{live?.title}</h1>
            <p className="text-[10px] font-bold text-slate-500 tracking-[0.3em] mt-1 uppercase">CONSOLE DE TRANSMISSÃO</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {live?.meet_link && (
            <Button asChild variant="outline" className="h-12 rounded-2xl border-white/20 hover:bg-white/10 text-white font-black px-6 gap-2">
              <a href={live.meet_link} target="_blank" rel="noopener noreferrer">
                ABRIR MEU GOOGLE MEET <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          <Button 
            onClick={toggleLiveStatus} 
            disabled={isUpdating}
            className={`${live?.status === 'live' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-black h-12 px-8 rounded-2xl gap-2 transition-all shadow-xl`}
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {live?.status === 'live' ? 'FECHAR SALA' : 'ABRIR PARA ALUNOS'}
          </Button>

          <Badge className={`${live?.status === 'live' ? 'bg-red-600 animate-pulse' : 'bg-slate-700'} text-white font-black border-none px-6 h-12 rounded-2xl flex items-center gap-3`}>
            <Signal className="h-4 w-4" /> {live?.status === 'live' ? 'AO VIVO' : 'OFFLINE'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
        {/* Painel Central */}
        <Card className="flex-1 bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-slate-800 relative flex items-center justify-center">
           <div className="w-full h-full relative flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-slate-900 via-black to-slate-900">
              <div className="absolute top-8 left-8 flex items-center gap-3">
                 <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                 <span className="text-[10px] font-black uppercase text-white/60 tracking-[0.2em]">Sinal Monitorado</span>
              </div>

              <div className="h-48 w-48 rounded-[2.5rem] bg-accent/5 border-2 border-accent/20 flex items-center justify-center relative shadow-inner">
                 <User className="h-24 w-24 text-accent/20" />
              </div>

              <div className="space-y-2 text-center px-6">
                 <h3 className="text-xl font-black text-white/60 italic uppercase tracking-widest">Console de Gerenciamento</h3>
                 <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-md mx-auto">
                   O chat foi desabilitado. Utilize este console para monitorar o status da sua transmissão externa.
                 </p>
              </div>

              <div className="absolute bottom-10 flex items-center gap-4 bg-white/5 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/10">
                 <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl text-white"><Mic className="h-6 w-6" /></Button>
                 <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl text-white"><Video className="h-6 w-6" /></Button>
                 <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-accent text-accent-foreground"><MonitorUp className="h-6 w-6" /></Button>
                 <div className="w-px h-10 bg-white/10 mx-2" />
                 <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl text-white"><Settings className="h-6 w-6" /></Button>
              </div>
           </div>
        </Card>

        <div className="flex justify-center pb-2">
          <Card className="bg-white px-10 py-6 rounded-3xl shadow-xl flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status da Rede</p>
            <p className="text-lg font-black text-slate-900 italic">Sincronizada</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
