
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, ClipboardCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";
import { format } from "date-fns";

export default function NewAttendanceSessionPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lives, setLives] = useState<any[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    class_label: "",
    session_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "",
    session_type: "presencial" as "presencial" | "live",
    live_id: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("lives")
      .select("id, title, start_time")
      .eq("teacher_id", user.id)
      .order("start_time", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setLives(data);
      });

    supabase
      .from("profiles")
      .select("course")
      .eq("role", "student")
      .not("course", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const distinct = Array.from(new Set(data.map((p) => (p.course || "").trim()).filter(Boolean))).sort();
        setClassOptions(distinct);
      });
  }, [user]);

  function handleLiveSelect(liveId: string) {
    if (liveId === "none") {
      setFormData((prev) => ({ ...prev, live_id: "" }));
      return;
    }
    const live = lives.find((l) => l.id === liveId);
    if (!live) return;
    const d = new Date(live.start_time);
    setFormData((prev) => ({
      ...prev,
      live_id: liveId,
      title: prev.title || live.title,
      session_date: format(d, "yyyy-MM-dd"),
      start_time: format(d, "HH:mm"),
      session_type: "live",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.session_date || !user) {
      toast({
        title: "Dados incompletos",
        description: "Título e data são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.class_label) {
      toast({
        title: "Selecione uma sala/turma",
        description: "A chamada precisa estar vinculada a uma turma.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("class_sessions")
      .insert({
        title: formData.title,
        description: formData.description || null,
        subject: formData.subject || null,
        class_label: formData.class_label,
        session_date: formData.session_date,
        start_time: formData.start_time || null,
        session_type: formData.session_type,
        teacher_id: user.id,
        teacher_name: profile?.full_name || null,
        live_id: formData.live_id || null,
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Erro ao criar sessão", description: error.message, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    toast({ title: "Sessão criada!", description: "Agora você pode registrar a chamada." });
    router.push(`/dashboard/teacher/attendance/${data.id}`);
  }

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Back link ── */}
      <Link
        href="/dashboard/teacher/attendance"
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-600 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Chamadas
      </Link>

      {/* ── Hero ── */}
      <div className="relative rounded-card overflow-hidden bg-[#0d0d0f] border border-slate-100 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(99,102,241,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-3 w-3 text-orange-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
              Nova Sessão
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-slate-800 leading-none">
            Criar Chamada
          </h1>
          <p className="text-slate-600 text-xs font-semibold mt-1">
            Vincule a uma turma para gerar o token
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-sm border border-slate-200 rounded-card overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-400/85" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              Detalhes da Aula
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Live link */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Vincular a uma Live (opcional)
            </Label>
            <Select onValueChange={handleLiveSelect} defaultValue="none">
              <SelectTrigger className="h-12 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-sm">
                <SelectValue placeholder="Selecionar live..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                <SelectItem value="none" className="font-bold text-slate-600 text-xs">Nenhuma</SelectItem>
                {lives.map((live) => (
                  <SelectItem key={live.id} value={live.id} className="font-bold text-slate-600 text-xs">
                    {live.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Título <span className="text-red-400">*</span>
            </Label>
            <input
              type="text"
              placeholder="Ex: Matemática — Funções"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
              className="w-full h-12 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
            />
          </div>

          {/* Date + Time grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Data <span className="text-red-400">*</span>
              </Label>
              <input
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, session_date: e.target.value }))}
                required
                className="w-full h-12 bg-white shadow-sm border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#4CCCED]/40 transition-all [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Horário
              </Label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                className="w-full h-12 bg-white shadow-sm border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#4CCCED]/40 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Subject + Type */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Matéria
              </Label>
              <input
                type="text"
                placeholder="Matemática"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full h-12 bg-white shadow-sm border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                Tipo
              </Label>
              <Select
                value={formData.session_type}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, session_type: v as "presencial" | "live" }))
                }
              >
                <SelectTrigger className="h-12 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 bg-white">
                  <SelectItem value="presencial" className="font-bold text-slate-600 text-xs">Presencial</SelectItem>
                  <SelectItem value="live" className="font-bold text-slate-600 text-xs">Live (Online)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Class */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Sala / Turma <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.class_label}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, class_label: v }))}
            >
              <SelectTrigger className="h-12 rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 font-bold text-sm">
                <SelectValue placeholder="Selecionar turma..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white">
                {classOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled className="font-bold text-slate-500 text-xs">
                    Nenhuma turma cadastrada
                  </SelectItem>
                ) : (
                  classOptions.map((c) => (
                    <SelectItem key={c} value={c} className="font-bold text-slate-600 text-xs">
                      {c}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-500 font-medium leading-snug px-1">
              Só alunos desta sala poderão usar o token.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Descrição (opcional)
            </Label>
            <Textarea
              placeholder="Observações sobre a aula..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="rounded-xl bg-white shadow-sm border-slate-200 text-slate-800 placeholder:text-slate-500 font-medium text-sm resize-none focus-visible:ring-orange-500/30 focus-visible:border-[#4CCCED]/30"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-13 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-800 font-black rounded-2xl shadow-xl shadow-orange-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar Sessão e Registrar Chamada
          </Button>
        </div>
      </form>
    </div>
  );
}
