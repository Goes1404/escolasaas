"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  HeartHandshake, Plus, Pencil, Trash2, Star, Loader2, Phone, Mail, X, Check, UserRound,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";

export interface Guardian {
  id: string;
  student_id: string;
  name: string;
  relationship: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
}

const RELATIONSHIPS = [
  "Mãe", "Pai", "Avó / Avô", "Tio / Tia", "Irmão / Irmã",
  "Responsável legal", "Outro",
];

type FormState = {
  name: string; relationship: string; cpf: string;
  phone: string; email: string; is_primary: boolean; notes: string;
};

const EMPTY_FORM: FormState = {
  name: "", relationship: "", cpf: "", phone: "", email: "", is_primary: false, notes: "",
};

export function GuardiansCard({ studentId }: { studentId: string }) {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const canEdit = userRole === "staff" || userRole === "admin";

  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = fechado, "new" = novo
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Guardian | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_guardians")
      .select("id, student_id, name, relationship, cpf, phone, email, is_primary, notes")
      .eq("student_id", studentId)
      .order("is_primary", { ascending: false })
      .order("name");
    if (!error) setGuardians((data as Guardian[]) || []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY_FORM); setEditingId("new"); };
  const openEdit = (g: Guardian) => {
    setForm({
      name: g.name, relationship: g.relationship || "", cpf: g.cpf || "",
      phone: g.phone || "", email: g.email || "", is_primary: g.is_primary, notes: g.notes || "",
    });
    setEditingId(g.id);
  };
  const closeForm = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Nome do responsável é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        student_id: studentId,
        name: form.name.trim(),
        relationship: form.relationship || null,
        cpf: form.cpf.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        is_primary: form.is_primary,
        notes: form.notes.trim() || null,
      };

      // Só pode haver um principal — desmarca os demais antes de salvar este.
      if (form.is_primary) {
        await supabase
          .from("student_guardians")
          .update({ is_primary: false })
          .eq("student_id", studentId)
          .neq("id", editingId === "new" ? "00000000-0000-0000-0000-000000000000" : editingId);
      }

      if (editingId === "new") {
        const { error } = await supabase.from("student_guardians").insert(payload);
        if (error) throw error;
        toast({ title: "Responsável adicionado" });
      } else {
        const { error } = await supabase
          .from("student_guardians")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingId!);
        if (error) throw error;
        toast({ title: "Responsável atualizado" });
      }
      closeForm();
      await load();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("student_guardians").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Responsável removido" });
      await load();
    }
    setDeleteTarget(null);
  };

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-black text-primary italic flex items-center gap-2">
          <HeartHandshake className="h-5 w-5 text-orange-500" />
          Responsáveis
          {guardians.length > 0 && (
            <span className="text-[10px] font-black text-slate-400 not-italic">({guardians.length})</span>
          )}
        </CardTitle>
        {canEdit && editingId === null && (
          <Button
            onClick={openNew}
            size="sm"
            className="h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] uppercase tracking-wide border-none shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-6 pt-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
          </div>
        ) : (
          <>
            {/* Formulário (novo/edição) */}
            {editingId !== null && (
              <div className="space-y-3 p-4 rounded-2xl bg-orange-50/60 border border-orange-100 animate-in fade-in zoom-in-95 duration-300">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-orange-600/60 tracking-widest ml-1">Nome do responsável *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Maria Silva Santos"
                    className="h-11 bg-white border-none rounded-xl font-bold text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-orange-600/60 tracking-widest ml-1">Parentesco</Label>
                    <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                      <SelectTrigger className="h-11 bg-white border-none rounded-xl font-bold text-sm">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r} value={r} className="font-bold text-xs">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-orange-600/60 tracking-widest ml-1">CPF</Label>
                    <Input
                      value={form.cpf}
                      onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="h-11 bg-white border-none rounded-xl font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-orange-600/60 tracking-widest ml-1">Telefone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="h-11 bg-white border-none rounded-xl font-medium text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-orange-600/60 tracking-widest ml-1">E-mail</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="responsavel@email.com"
                      className="h-11 bg-white border-none rounded-xl font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-orange-600/60 tracking-widest ml-1">Observações</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ex: contato preferencial pela manhã"
                    className="h-11 bg-white border-none rounded-xl font-medium text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_primary: !form.is_primary })}
                  className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-orange-600"
                >
                  <span className={`h-5 w-5 rounded-md flex items-center justify-center border transition-colors ${form.is_primary ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-orange-200"}`}>
                    {form.is_primary && <Check className="h-3.5 w-3.5" />}
                  </span>
                  Responsável principal
                </button>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest border-none"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Salvar
                  </Button>
                  <Button
                    onClick={closeForm}
                    variant="ghost"
                    className="h-11 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Lista de responsáveis */}
            {guardians.length === 0 && editingId === null ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <UserRound className="h-8 w-8 text-slate-200" />
                <p className="text-xs font-bold text-slate-400">
                  {canEdit ? "Nenhum responsável cadastrado ainda." : "Nenhum responsável cadastrado."}
                </p>
              </div>
            ) : (
              guardians.map((g) => (
                <div
                  key={g.id}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-orange-500">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-800 truncate">{g.name}</span>
                      {g.is_primary && (
                        <Badge className="bg-orange-100 text-orange-700 border-none text-[9px] font-black uppercase tracking-wide h-4 px-1.5">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> Principal
                        </Badge>
                      )}
                      {g.relationship && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{g.relationship}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {g.phone && (
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <Phone className="h-3 w-3 text-slate-300" /> {g.phone}
                        </span>
                      )}
                      {g.email && (
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono truncate">
                          <Mail className="h-3 w-3 text-slate-300 shrink-0" /> {g.email}
                        </span>
                      )}
                      {g.cpf && (
                        <span className="text-[11px] text-slate-400 font-mono">CPF {g.cpf}</span>
                      )}
                      {g.notes && (
                        <span className="text-[11px] text-slate-400 italic mt-0.5">{g.notes}</span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        aria-label="Editar responsável"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(g)}
                        aria-label="Remover responsável"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black italic">Remover responsável?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} será removido(a) do cadastro deste aluno. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl font-black bg-red-500 hover:bg-red-600 border-none"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
