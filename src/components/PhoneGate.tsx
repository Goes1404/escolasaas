"use client";

import { useState } from "react";
import { Phone, ShieldCheck, Loader2, ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";

/**
 * Gate obrigatório de telefone (Fase 1 do plano de recuperação por SMS).
 *
 * Sem telefone cadastrado, o aluno não acessa o dashboard — mesma ideia do
 * `must_change_password`. Objetivo: levar a cobertura de telefone para perto de
 * 100% sem custo de SMS, destravando no futuro a troca do método de recuperação.
 *
 * Aplica-se SÓ a alunos. Professores/admin/secretaria não são bloqueados.
 */
export function PhoneGate() {
  const { user, profile, userRole, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const [phoneValue, setPhoneValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasPhone = !!(profile?.phone && String(profile.phone).trim());

  // Só bloqueia aluno com perfil carregado e sem telefone.
  if (userRole !== "student" || !profile || hasPhone) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 0) {
      if (digits.length <= 6) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      else if (digits.length <= 10) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      else formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setPhoneValue(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const digits = phoneValue.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({ title: "Telefone inválido ⚠️", description: "Insira um número com DDD válido.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // .select() confirma a persistência: se a RLS bloquear (0 linhas), tratamos
      // como erro real em vez de "sucesso" falso que prenderia o aluno na tela.
      const { data, error } = await supabase
        .from("profiles")
        .update({ phone: phoneValue })
        .eq("id", user.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Não foi possível salvar seu telefone. Fale com a secretaria.");
      }
      toast({ title: "Telefone salvo! 🎉", description: "Agora você já pode acessar a plataforma." });
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      toast({ title: "Erro ao salvar ❌", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#040406] overflow-y-auto">
      {/* ── Background glow ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-30%] right-[-15%] w-[130%] aspect-square rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(79,70,229,0.20) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-25%] left-[-10%] w-[110%] aspect-square rounded-full blur-[100px]"
          style={{ background: "radial-gradient(ellipse, rgba(234,88,12,0.12) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {/* Marca */}
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/10">
              <ShieldCheck className="h-4 w-4 text-white/70" />
            </div>
            <span className="u-label !text-white/50">Dalí</span>
          </div>

          <div className="bg-white rounded-card shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-7 py-5 flex items-center gap-3">
              <div className="h-10 w-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70">Passo obrigatório</p>
                <p className="text-base font-black text-white italic leading-tight">Cadastre seu telefone</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-7 space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black text-gray-900 italic tracking-tighter leading-tight">
                  Falta só um passo para continuar
                </h1>
                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                  Precisamos de um número de telefone (seu ou de um responsável) para
                  garantir a recuperação da sua conta e comunicados importantes.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                  Telefone com DDD
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                  <input
                    autoFocus
                    type="tel"
                    inputMode="numeric"
                    value={phoneValue}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                    className="w-full h-14 pl-11 pr-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-base text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-300 ml-1 font-medium">
                  Usado apenas pela escola. Não será compartilhado.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || phoneValue.replace(/\D/g, "").length < 10}
                className="w-full h-14 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Salvar e continuar <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Escape: quem não puder cadastrar agora pode sair (não fica preso). */}
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-5 w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
