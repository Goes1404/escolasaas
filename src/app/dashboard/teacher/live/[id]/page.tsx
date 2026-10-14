
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
  CalendarDays,
  Radio,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";

/**
 * Estúdio da aula ao vivo - visão do professor
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
      toast({ title: newStatus === 'live' ? "Sala aberta para os alunos" : "Sala fechada" });
    } else {
      toast({ title: "Erro ao mudar status", variant: "destructive" });
    }
    setIsUpdating(false);
  };

  if (loading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      <p className="u-label">Carregando…</p>
    </div>
  );

  const isLive = live?.status === 'live';

  return (
    <div className="space-y-5 pb-8">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Voltar" className="rounded-control h-10 w-10 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="u-label flex items-center gap-2"><Radio className="h-3.5 w-3.5" /> Professor · estúdio</p>
            <h1 className="u-page-title text-2xl md:text-3xl mt-1 line-clamp-2">{live?.title || "Aula ao vivo"}</h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5">
          <Badge
            variant="outline"
            className={`h-11 px-4 rounded-control flex items-center justify-center gap-2 font-bold text-xs ${isLive ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/30' : 'text-muted-foreground'}`}
          >
            <Signal className="h-4 w-4" /> {isLive ? 'Ao vivo' : 'Fora do ar'}
          </Badge>

          {live?.meet_link && (
            <Button asChild variant="outline" className="h-11 rounded-control font-bold px-5 gap-2">
              <a href={live.meet_link} target="_blank" rel="noopener noreferrer">
                Abrir o Google Meet <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          {isLive ? (
            <Button
              onClick={toggleLiveStatus}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 rounded-control gap-2"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Fechar sala
            </Button>
          ) : (
            <Button
              variant="arcade"
              onClick={toggleLiveStatus}
              disabled={isUpdating}
              className="font-bold h-11 px-6 rounded-control gap-2"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Abrir para os alunos
            </Button>
          )}
        </div>
      </div>

      {/* Painel */}
      <Card className="rounded-card p-6 md:p-10 flex flex-col items-center justify-center text-center gap-5 min-h-[280px]">
        <div className="h-20 w-20 rounded-card bg-muted flex items-center justify-center">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-lg font-bold text-foreground">Painel da transmissão</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A aula acontece no Meet (ou YouTube). Use esta tela para abrir e fechar a sala para os alunos.
            O chat desta aula está desativado.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="rounded-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="u-label">Horário marcado</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{fmtDate(live?.start_time, "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        </Card>
        <Card className="rounded-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="u-label">Acesso dos alunos</p>
            <p className={`text-sm font-semibold mt-0.5 ${isLive ? 'text-red-600' : 'text-foreground'}`}>{isLive ? 'Sala aberta' : 'Sala fechada'}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
