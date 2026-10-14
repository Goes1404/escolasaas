"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Send,
  Loader2,
  Info,
  AlertOctagon,
  Trash2,
  Users,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

type Priority = "low" | "medium" | "high";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  target_group?: string;
  audience?: string;
  created_at: string;
}

const priorityMeta: Record<Priority, { label: string; chip: string; dot: string }> = {
  // Informativo é ausência de urgência: neutro. Só importante/urgente ganham cor.
  low:    { label: "Informativo", chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/50" },
  medium: { label: "Importante",  chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  high:   { label: "Urgente",     chip: "bg-red-50 text-red-600 border-red-200",       dot: "bg-red-500" },
};

const targetLabel = (t?: string) => {
  if (!t || t === "all") return "Toda a rede";
  if (t === "etec") return "ETEC";
  if (t === "enem") return "ENEM";
  if (t === "teacher") return "Equipe";
  if (/^\d{1,2}$/.test(t)) return `Sala ${t.padStart(2, "0")}`;
  return t;
};

export default function SecretaryCommunication() {
  const { userRole, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("low");
  const [target, setTarget] = useState("all");
  const [audience, setAudience] = useState("students");
  const [sending, setSending] = useState(false);

  const [list, setList] = useState<Announcement[]>([]);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (!isUserLoading && userRole !== "staff" && userRole !== "admin") {
      router.replace("/dashboard/home");
    }
  }, [userRole, isUserLoading, router]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("announcements")
      .select("id, title, message, priority, target_group, audience, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    const anns = (data as Announcement[]) || [];
    setList(anns);

    // Confirmações de leitura dos responsáveis (staff tem SELECT via RLS).
    if (anns.length > 0) {
      const { data: reads } = await supabase
        .from("guardian_announcement_reads")
        .select("announcement_id")
        .in("announcement_id", anns.map((a) => a.id));
      const counts: Record<string, number> = {};
      ((reads as { announcement_id: string }[]) || []).forEach((r) => {
        counts[r.announcement_id] = (counts[r.announcement_id] || 0) + 1;
      });
      setReadCounts(counts);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (userRole === "staff" || userRole === "admin") fetchList();
  }, [userRole, fetchList]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Dados incompletos", description: "Preencha título e mensagem.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, priority, target_group: target, audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao publicar");

      // Dispara push (best-effort, não bloqueia).
      if (data.announcement?.id) {
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "communication", announcementId: data.announcement.id }),
        }).catch(() => {});
      }

      toast({ title: "Comunicado publicado", description: "Os destinatários foram notificados." });
      setTitle("");
      setMessage("");
      setPriority("low");
      setTarget("all");
      if (data.announcement) setList((prev) => [data.announcement, ...prev]);
      else fetchList();
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setList((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Comunicado removido" });
  };

  if (isUserLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="u-label">Carregando…</p>
      </div>
    );
  }

  const fieldCls = "h-11 bg-muted/30 border-none rounded-control text-sm";

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div>
        <p className="u-label flex items-center gap-2"><Megaphone className="h-3.5 w-3.5" /> Secretaria · comunicação</p>
        <h1 className="u-page-title text-3xl mt-1">Comunicados</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Envie avisos para toda a escola ou para turmas específicas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Novo comunicado */}
        <div className="lg:col-span-2 u-surface p-5 md:p-6 space-y-4 h-fit">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Novo comunicado
          </h2>

          <div className="space-y-1.5">
            <Label className="u-label ml-1">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Ex.: Simulado neste sábado"
              className={`${fieldCls} font-semibold`}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="u-label ml-1">Mensagem *</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Escreva o aviso que os alunos vão ver…"
              className="w-full bg-muted/30 border-none rounded-control text-sm p-3.5 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <p className="u-label text-right"><span className="u-num">{message.length}</span>/2000</p>
          </div>

          <div className="space-y-1.5">
            <Label className="u-label ml-1">Destinatários</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className={fieldCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="students" className="text-sm">Alunos (mural da plataforma)</SelectItem>
                <SelectItem value="guardians" className="text-sm">Responsáveis (portal)</SelectItem>
                <SelectItem value="all" className="text-sm">Alunos e responsáveis</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="u-label ml-1">Prioridade</Label>
              <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-control">
                  <SelectItem value="low" className="text-sm">Informativo</SelectItem>
                  <SelectItem value="medium" className="text-sm text-amber-700">Importante</SelectItem>
                  <SelectItem value="high" className="text-sm text-red-600">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="u-label ml-1">Público</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className={fieldCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-control max-h-60">
                  <SelectGroup>
                    <SelectLabel className="u-label">Geral</SelectLabel>
                    <SelectItem value="all" className="text-sm">Toda a rede</SelectItem>
                    <SelectItem value="etec" className="text-sm">ETEC</SelectItem>
                    <SelectItem value="enem" className="text-sm">ENEM</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="u-label border-t border-border mt-1 pt-2">Turmas</SelectLabel>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((n) => (
                      <SelectItem key={n} value={n} className="text-sm">Sala {n}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prévia */}
          {title.trim() && (
            <div className={`p-3.5 rounded-control border flex items-start gap-3 ${priorityMeta[priority].chip}`}>
              {priority === "high" ? <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="u-label !text-current opacity-70 mb-0.5">Prévia</p>
                <p className="font-bold text-sm truncate">{title}</p>
                <p className="text-xs opacity-80 line-clamp-2 mt-0.5">{message || "…"}</p>
              </div>
            </div>
          )}

          <Button
            variant="arcade"
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full h-11 rounded-control font-bold"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Publicar comunicado
          </Button>
        </div>

        {/* Últimos comunicados */}
        <div className="lg:col-span-3 u-surface p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Últimos comunicados
            </h2>
            <span className="u-label shrink-0"><span className="u-num">{list.length}</span> no total</span>
          </div>

          {loadingList ? (
            <div className="space-y-2.5">
              {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-control" />)}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              compact
              icon={Megaphone}
              title="Nenhum comunicado publicado ainda"
              description="Escreva o primeiro aviso no formulário ao lado. Ele aparece aqui assim que for publicado."
            />
          ) : (
            <div className="space-y-2.5">
              {list.map((a) => {
                const meta = priorityMeta[a.priority] || priorityMeta.low;
                const created = toDate(a.created_at);
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3.5 rounded-control border border-border hover:bg-muted/30 transition-colors group">
                    <div className={`h-2.5 w-2.5 rounded-full ${meta.dot} shrink-0 mt-1.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.chip}`}>{meta.label}</span>
                        <span className="u-label inline-flex items-center gap-1 !tracking-wider">
                          <Users className="h-2.5 w-2.5" /> {targetLabel(a.target_group)}
                        </span>
                        {(a.audience === "guardians" || a.audience === "all") && (
                          <span className="u-label !tracking-wider">
                            Responsáveis · <span className="u-num">{readCounts[a.id] || 0}</span> {(readCounts[a.id] || 0) === 1 ? "leitura" : "leituras"}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">{a.message}</p>
                      {created && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatDistanceToNow(created, { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="h-8 w-8 rounded-control border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 flex items-center justify-center shrink-0 transition-colors" aria-label="Remover comunicado">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-card w-[95vw] sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-bold">Remover comunicado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{a.title}” deixará de aparecer para os destinatários. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-control font-bold text-sm">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)} className="rounded-control font-bold text-sm bg-red-600 hover:bg-red-700">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
