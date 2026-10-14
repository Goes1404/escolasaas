
"use client";

import { useState, useEffect } from "react";
import {
  PlusCircle,
  Calendar,
  Clock,
  Loader2,
  Trash2,
  Radio,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { fmtDate, fmtNumber, toDate, txt } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  live: "Ao vivo",
  ended: "Encerrada",
  finished: "Encerrada",
  cancelled: "Cancelada",
};

export default function ManageLivePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lives, setLives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    meet_link: "",
  });

  async function fetchLives() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lives")
        .select("*")
        .order("start_time", { ascending: false });

      if (!error && data) setLives(data);
    } catch (err) {
      console.error("Erro ao buscar lives:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLives();
  }, [user]);

  const handleCreateLive = async () => {
    if (!formData.title || !formData.date || !formData.time || !user || isSubmitting) {
      if (!isSubmitting)
        toast({
          title: "Faltam dados",
          description: "Título, data e horário são obrigatórios.",
          variant: "destructive",
        });
      return;
    }

    setIsSubmitting(true);
    try {
      const start_time = new Date(`${formData.date}T${formData.time}`).toISOString();

      const { error } = await supabase.from("lives").insert({
        title: formData.title,
        description: formData.description,
        start_time,
        meet_link: formData.meet_link,
        teacher_id: user.id,
        teacher_name: user.user_metadata?.full_name || "Mentor da Rede",
        status: "scheduled",
      });

      if (error) throw new Error(error.message);

      toast({ title: "Aula agendada", description: "A aula já aparece na agenda dos alunos." });
      setIsCreateOpen(false);
      setFormData({ title: "", description: "", date: "", time: "", meet_link: "" });
      fetchLives();
    } catch (error: any) {
      toast({
        title: "Erro ao agendar",
        description:
          error?.message?.includes("status")
            ? "A coluna 'status' não existe no banco. Execute o script SQL."
            : error?.message || "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    const { error } = await supabase.from("lives").delete().eq("id", id);
    if (!error) {
      setLives((prev) => prev.filter((live) => live.id !== id));
      toast({ title: "Aula removida" });
    }
    setDeletingId(null);
  };

  const upcomingCount = lives.filter((l) => { const d = toDate(l.start_time); return !!d && d >= new Date(); }).length;
  const liveNow = lives.filter((l) => l.status === "live").length;

  const inputCls = "w-full h-11 bg-background border border-input rounded-control px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";

  return (
    <div className="pb-24 space-y-5">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><Radio className="h-3.5 w-3.5" /> Professor · aulas ao vivo</p>
          <h1 className="u-page-title text-3xl mt-1">Aulas ao vivo</h1>
          <p className="text-sm text-muted-foreground mt-1">Agende aulas e mentorias pelo Meet ou YouTube.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="arcade" className="w-full sm:w-auto h-11 px-5 rounded-control font-bold">
              <PlusCircle className="h-4 w-4 mr-2" />
              Agendar aula
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-card p-0 w-[95vw] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto">
            <DialogHeader className="p-5 border-b border-border">
              <DialogTitle className="text-lg font-bold text-foreground">
                Nova aula ao vivo
              </DialogTitle>
            </DialogHeader>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label className="u-label">Título da aula</Label>
                <input
                  placeholder="Ex.: Mentoria de carreira"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={isSubmitting}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="u-label">Data</Label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    disabled={isSubmitting}
                    className={`${inputCls} px-3`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="u-label">Horário</Label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    disabled={isSubmitting}
                    className={`${inputCls} px-3`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="u-label">Link da reunião</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    placeholder="https://meet.google.com/..."
                    value={formData.meet_link}
                    onChange={(e) => setFormData({ ...formData, meet_link: e.target.value })}
                    disabled={isSubmitting}
                    className={`${inputCls} pl-10 pr-3`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="u-label">Pauta (opcional)</Label>
                <textarea
                  placeholder="O que será discutido..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={isSubmitting}
                  className={`${inputCls} h-auto min-h-[70px] py-3 resize-none`}
                />
              </div>
            </div>
            <DialogFooter className="p-5 pt-0">
              <Button
                onClick={handleCreateLive}
                disabled={isSubmitting || !formData.title}
                className="w-full h-11 rounded-control font-bold"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : null}
                Publicar na agenda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Contadores ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Total</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(lives.length)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className="u-label">Próximas</p>
          <p className="u-num text-2xl mt-1">{fmtNumber(upcomingCount)}</p>
        </div>
        <div className="u-surface p-3 sm:p-4">
          <p className={`u-label ${liveNow > 0 ? "!text-red-600" : ""}`}>Ao vivo</p>
          <p className={`u-num text-2xl mt-1 ${liveNow > 0 ? "text-red-600" : ""}`}>{fmtNumber(liveNow)}</p>
        </div>
      </div>

      {/* ── Lista ── */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : lives.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nenhuma aula agendada"
            description="Agende uma aula ao vivo e ela aparece aqui e na agenda dos alunos."
            action={{ label: "Agendar aula", icon: PlusCircle, onClick: () => setIsCreateOpen(true) }}
          />
        ) : (
          lives.map((live) => {
            const isLive = live.status === "live";
            const d = toDate(live.start_time);
            const dayNum = d ? String(d.getDate()).padStart(2, "0") : "—";
            const monthShort = fmtDate(d, "MMM").replace(".", "");

            return (
              <div
                key={live.id}
                className={`u-surface p-3.5 ${isLive ? "!border-red-300 dark:!border-red-500/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Data */}
                  <div
                    className={`flex flex-col items-center justify-center min-w-[48px] py-1.5 px-2 rounded-control shrink-0 border ${
                      isLive ? "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30" : "border-border"
                    }`}
                  >
                    <span className={`u-num text-lg leading-none ${isLive ? "text-red-600" : "text-foreground"}`}>
                      {dayNum}
                    </span>
                    <span className={`u-label !tracking-[0.16em] mt-1 ${isLive ? "!text-red-600" : ""}`}>
                      {monthShort}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtDate(d, "HH:mm")}
                      </span>
                      <Badge
                        variant="outline"
                        className={`font-bold text-[10px] px-1.5 h-5 ${
                          isLive ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/30" : "text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABEL[live.status] ?? txt(live.status, "Agendada")}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug truncate">
                      {txt(live.title, "Aula sem título")}
                    </p>
                    {live.meet_link && (
                      <p className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        {live.meet_link}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => handleDelete(live.id)}
                    disabled={deletingId === live.id}
                    className="h-9 w-9 rounded-control flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40 touch-manipulation"
                    title="Excluir"
                    aria-label="Excluir aula"
                  >
                    {deletingId === live.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <Link
                    href={`/dashboard/teacher/live/${live.id}`}
                    className="h-9 px-4 rounded-control flex items-center gap-1.5 text-xs font-bold text-foreground border border-border hover:bg-muted transition-colors touch-manipulation"
                  >
                    Abrir estúdio
                    <Radio className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
