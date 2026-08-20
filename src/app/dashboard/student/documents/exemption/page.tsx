"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Wallet2, 
  Users2, 
  ArrowRight, 
  Info, 
  Loader2,
  Scale,
  FileWarning,
  HelpCircle,
  TrendingUp,
  History,
  Trash2,
  UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { Badge } from "@/components/ui/badge";

interface FamilyMember {
  id: string;
  label: string;
  income: string;
}

const formatBrazilianCurrency = (value: string): string => {
  if (!value) return "";
  const clean = value.replace(/\D/g, "");
  if (!clean) return "";
  const floatValue = Number(clean) / 100;
  return floatValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseBrazilianNumber = (value: string): number => {
  if (!value) return 0;
  const cleanValue = value.replace(/\./g, "").replace(",", ".");
  return Number(cleanValue) || 0;
};

const formatInitialValue = (val: any): string => {
  if (val === undefined || val === null || val === "") return "";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function ExemptionSimulationPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [members, setFamilyMembers] = useState<FamilyMember[]>([
    { id: '1', label: 'Você', income: '' }
  ]);
  
  const [result, setResult] = useState<{
    eligible: boolean;
    perCapita: number;
    totalFamilyIncome: number;
    familySize: number;
    threshold: number;
    minWage: number;
  } | null>(null);

  const MIN_WAGE = 1621; // Referência de base para cálculo
  const THRESHOLD_MULTIPLIER = 1.5;
  const THRESHOLD = MIN_WAGE * THRESHOLD_MULTIPLIER;

  useEffect(() => {
    if (profile) {
      if (profile.family_members && Array.isArray(profile.family_members) && profile.family_members.length > 0) {
        const formattedMembers = (profile.family_members as FamilyMember[]).map(m => ({
          ...m,
          income: formatInitialValue(m.income)
        }));
        setFamilyMembers(formattedMembers);
      }
      if (profile.family_income !== undefined && profile.family_income !== null && profile.family_size) {
        setResult({
          eligible: !!profile.is_financial_aid_eligible,
          perCapita: Number(profile.income_per_capita) || 0,
          totalFamilyIncome: Number(profile.family_income) || 0,
          familySize: Number(profile.family_size) || 1,
          threshold: THRESHOLD,
          minWage: MIN_WAGE
        });
      }
    }
  }, [profile]);

  const totalFamilyIncome = useMemo(() => {
    return members.reduce((acc, m) => acc + parseBrazilianNumber(m.income), 0);
  }, [members]);

  const addMember = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setFamilyMembers([...members, { id, label: '', income: '' }]);
  };

  const removeMember = (id: string) => {
    if (members.length === 1) return;
    setFamilyMembers(members.filter(m => m.id !== id));
  };

  const updateMember = (id: string, field: 'label' | 'income', value: string) => {
    setFamilyMembers(members.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      // Simulação de processamento de IA/Cálculo
      await new Promise(r => setTimeout(r, 1200));

      const familySize = members.length;
      // Se a renda estiver vazia, Number() retorna 0, o que é o comportamento desejado
      const perCapita = totalFamilyIncome / familySize;
      const eligible = perCapita <= THRESHOLD;

      setResult({
        eligible,
        perCapita,
        totalFamilyIncome,
        familySize,
        threshold: THRESHOLD,
        minWage: MIN_WAGE
      });

      if (user) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              is_financial_aid_eligible: eligible,
              family_members: members,
              family_income: totalFamilyIncome,
              family_size: familySize,
              income_per_capita: perCapita
            })
            .eq('id', user.id);
            
          if (error) {
            console.error("Erro ao atualizar perfil (exemption):", error);
            throw error;
          }
          
          if (refreshProfile) {
            await refreshProfile();
          }
        } catch (e) {
          console.error("Erro ao salvar elegibilidade:", e);
        }
      }

      toast({
        title: "Cálculo Concluído ✅",
        description: "Seu perfil foi atualizado com o status de elegibilidade social.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-primary italic">
              Simulador de Isenção
            </h1>
            <Badge className="bg-accent text-accent-foreground border-none font-black text-[10px] px-3 py-1 shadow-lg animate-pulse">
              VERSÃO 2024
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm md:text-lg max-w-2xl font-medium italic">
            Não chute o valor. Use nossa calculadora assistida para somar a renda de cada familiar e descobrir sua elegibilidade no SiSU e ProUni.
          </p>
        </div>
        <div className="flex items-center gap-2 text-primary/40 font-black text-[10px] uppercase tracking-widest bg-white/50 px-4 py-2 rounded-full border border-white/20">
          <History className="h-3 w-3" /> Status: {result ? 'Simulado' : 'Pendente'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna 1: Instruções e Regras */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-2xl bg-primary text-white rounded-[2.5rem] overflow-hidden relative group transition-all duration-500 hover:shadow-primary/20">
            <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-accent/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <CardHeader className="p-8">
              <div className="h-12 w-12 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center mb-6 shadow-xl rotate-3 group-hover:rotate-0 transition-transform">
                <Scale className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-black italic">A Regra de 1,5 SM</CardTitle>
              <CardDescription className="text-white/60 font-medium italic">O critério oficial do Governo Federal.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="p-5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" /> Teto Atualizado
                </p>
                <p className="text-sm font-medium leading-relaxed italic">
                  A soma de todas as rendas dividida pelo número de moradores deve ser de até <strong className="text-accent text-lg">R$ {THRESHOLD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  { icon: Wallet2, text: "Use a renda BRUTA (sem descontos)" },
                  { icon: Users2, text: "Inclua quem não tem renda (0,00)" },
                  { icon: Info, text: "Ignore Bolsa Família ou Auxílios" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
                    <item.icon className="h-4 w-4 text-accent" />
                    <span className="text-[11px] font-bold uppercase tracking-tight italic">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8 space-y-4">
            <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex items-center gap-2">
              <HelpCircle className="h-3.5 w-3.5 text-accent" /> Dica da Aurora
            </h3>
            <p className="text-xs font-medium italic text-primary/70 leading-relaxed">
              "Muitos alunos perdem a isenção porque esquecem de incluir moradores sem renda no cálculo. Deixe o campo de renda vazio para esses integrantes!"
            </p>
          </Card>
        </div>

        {/* Coluna 2: Formulário e Resultado */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="shadow-2xl border-none bg-white rounded-[2.5rem] overflow-hidden transition-all duration-500">
            <CardHeader className="bg-muted/10 p-10 border-b border-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-primary italic flex items-center gap-3">
                    Calculadora de Renda
                    <Sparkles className="h-5 w-5 text-accent" />
                  </CardTitle>
                  <CardDescription className="font-medium italic">Adicione cada integrante que mora com você (campos opcionais).</CardDescription>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Soma Atual</p>
                  <p className="text-2xl font-black text-primary italic">R$ {totalFamilyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-4">
                  {members.map((member, index) => (
                    <div key={member.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-muted/20 border border-transparent hover:border-accent/20 transition-all animate-in slide-in-from-left-2">
                      <div className="flex-1 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-primary/40 ml-2">Integrante / Parentesco</Label>
                        <Input 
                          placeholder={index === 0 ? "Você" : "Ex: Mãe, Pai, Irmão..."} 
                          value={member.label} 
                          onChange={(e) => updateMember(member.id, 'label', e.target.value)}
                          className="h-12 bg-white rounded-xl border-none font-bold italic"
                        />
                      </div>
                      <div className="w-full sm:w-48 space-y-2">
                        <Label className="text-[9px] font-black uppercase text-primary/40 ml-2">Renda Bruta (R$)</Label>
                        <Input 
                          type="text" 
                          placeholder="0,00" 
                          value={member.income} 
                          onChange={(e) => updateMember(member.id, 'income', formatBrazilianCurrency(e.target.value))}
                          className="h-12 bg-white rounded-xl border-none font-black text-primary"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeMember(member.id)}
                          disabled={members.length === 1}
                          className="h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addMember}
                    className="flex-1 h-14 border-dashed border-2 border-primary/20 rounded-2xl font-bold text-primary hover:bg-primary/5"
                  >
                    <UserPlus className="h-4 w-4 mr-2" /> Adicionar Integrante
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 bg-primary hover:bg-primary/95 text-white h-14 rounded-2xl font-black text-lg shadow-xl"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <TrendingUp className="h-5 w-5 mr-2" />}
                    {loading ? "Analisando..." : "Verificar Elegibilidade"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {result && !loading && (
            <div className="animate-in zoom-in-95 slide-in-from-top-10 duration-700">
              <Card className={`border-none shadow-2xl rounded-[3rem] overflow-hidden ${result.eligible ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                <div className={`p-10 flex flex-col md:flex-row items-center gap-8 ${result.eligible ? 'bg-green-600 text-white' : 'bg-red-600 text-white'} transition-all duration-1000`}>
                  <div className="h-20 w-20 rounded-[2rem] bg-white/20 backdrop-blur-xl flex items-center justify-center shrink-0 shadow-2xl rotate-3">
                    {result.eligible ? <CheckCircle2 className="h-10 w-10" /> : <FileWarning className="h-10 w-10" />}
                  </div>
                  <div className="text-center md:text-left space-y-1">
                    <h3 className="text-2xl md:text-4xl font-black italic tracking-tighter leading-none">
                      {result.eligible ? "Elegível para Isenção" : "Fora do Critério de Isenção"}
                    </h3>
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] opacity-80">
                      Diagnóstico: {result.familySize} pessoas / R$ {result.totalFamilyIncome.toLocaleString('pt-BR')} total
                    </p>
                  </div>
                </div>
                <CardContent className="p-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white rounded-3xl border-2 border-muted/10 flex flex-col gap-1 shadow-inner group hover:border-accent/30 transition-all">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Sua Renda Per Capita</span>
                      <span className={`text-3xl font-black italic ${result.eligible ? 'text-green-600' : 'text-red-600'}`}>R$ {result.perCapita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <p className="text-[8px] font-bold text-muted-foreground mt-2 uppercase">Valor por cada morador da casa</p>
                    </div>
                    <div className="p-6 bg-white rounded-3xl border-2 border-muted/10 flex flex-col gap-1 shadow-inner">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Limite de 1,5 Salário Mínimo</span>
                      <span className="text-3xl font-black text-primary italic">R$ {result.threshold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <p className="text-[8px] font-bold text-muted-foreground mt-2 uppercase">Referência MEC / Governo Federal</p>
                    </div>
                  </div>
                  
                  <div className="mt-10 flex flex-col md:flex-row gap-4">
                    <Button asChild className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-black h-16 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 text-base">
                      <Link href="/dashboard/chat/aurora-ai">
                        Tirar Dúvidas com Aurora
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Link>
                    </Button>
                    <Button variant="outline" className="flex-1 h-16 rounded-2xl border-2 font-black text-primary hover:bg-muted/50 transition-all" asChild>
                      <Link href="/dashboard/student/documents">
                        Checklist de Documentos
                      </Link>
                    </Button>
                  </div>
                  
                  <p className="mt-8 text-[10px] text-center text-muted-foreground font-bold uppercase italic opacity-60">
                    *Este cálculo considera o Salário Mínimo de R$ {result.minWage.toLocaleString('pt-BR')}. Os editais podem sofrer variações anuais.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
