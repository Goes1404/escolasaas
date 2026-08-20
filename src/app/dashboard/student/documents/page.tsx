"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileCheck,
  ExternalLink,
  Cloud,
  CheckCircle2,
  ShieldCheck,
  Info,
  Smartphone,
  MousePointer2,
  FolderPlus,
  Loader2,
  FileSearch,
  Clock,
  LayoutList
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/app/lib/supabase";

const DOCUMENT_GROUPS = [
  {
    title: "Documentos Pessoais",
    items: [
      { id: "rg", label: "RG (Frente e Verso)" },
      { id: "cpf", label: "CPF ou CNH" },
      { id: "birth_cert", label: "Certidão de Nascimento ou Casamento" },
      { id: "voter_id", label: "Título de Eleitor" },
      { id: "military", label: "Reservista (Para homens)" },
      { id: "address", label: "Comprovante de Residência atualizado" }
    ]
  },
  {
    title: "Escolares (FATEC/ETEC/SiSU)",
    items: [
      { id: "hs_transcript", label: "Histórico Escolar do Ensino Médio" },
      { id: "hs_diploma", label: "Certificado de Conclusão do Ensino Médio" },
      { id: "photo_3x4", label: "Foto 3x4 digitalizada" }
    ]
  },
  {
    title: "Socioeconômicos (ProUni/Cotas)",
    items: [
      { id: "income_all", label: "Comprovantes de Renda de todos os moradores" },
      { id: "cadunico", label: "Comprovante de Inscrição no CadÚnico (Se houver)" },
      { id: "tax_return", label: "Declaração de IR (Se houver)" }
    ]
  }
];

export default function StudentAdmissionCentral() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [savingDoc, setSavingDoc] = useState(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('student_checklists')
          .select('item_id')
          .eq('user_id', user.id);
        if (!error && data) setCheckedItems(data.map(d => d.item_id));
      } catch (e) {
        console.error("Erro ao carregar central:", e);
      } finally {
        setLoadingDocs(false);
      }
    }
    loadData();
  }, [user]);

  const toggleItem = async (itemId: string) => {
    // trava clique até o fetch inicial chegar — clicar antes disso seria
    // sobrescrito pelo setCheckedItems(data) quando a query resolvesse
    if (!user || savingDoc || loadingDocs) return;
    const isChecked = checkedItems.includes(itemId);
    const newItems = isChecked ? checkedItems.filter(i => i !== itemId) : [...checkedItems, itemId];
    setCheckedItems(newItems);
    setSavingDoc(true);
    try {
      if (isChecked) {
        await supabase.from('student_checklists').delete().match({ user_id: user.id, item_id: itemId });
      } else {
        await supabase.from('student_checklists').insert({ user_id: user.id, item_id: itemId });
      }
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSavingDoc(false);
    }
  };

  const totalDocs = DOCUMENT_GROUPS.reduce((acc, group) => acc + group.items.length, 0);
  const progressPercent = Math.round((checkedItems.length / totalDocs) * 100);

  // Hero + as 5 dicas fixas abaixo não dependem de dado nenhum — só os
  // checkboxes do checklist esperam a query. Gate cheio aqui prendia
  // conteúdo 100% estático atrás de uma query de 1 linha.
  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 px-1">
      <section className="bg-primary p-8 md:p-12 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <Badge className="bg-accent text-accent-foreground border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest mb-2">Padrão SiSU/ProUni</Badge>
              <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none">Checklist de <span className="text-white">Matrícula</span></h1>
              <p className="text-sm md:text-lg text-white/90 font-medium italic">Gerencie seus dados e organize sua documentação oficial.</p>
            </div>
            <div className="flex flex-col items-end gap-3 bg-white/10 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
              <div className="flex justify-between w-40 text-[9px] font-black uppercase text-white tracking-widest">
                <span>Prontidão Documental</span>
                <span className="text-white">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-40 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-accent transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {DOCUMENT_GROUPS.map((group, idx) => (
            <Card key={idx} className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-muted/10 p-8">
                <CardTitle className="text-lg font-black text-primary italic uppercase flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg text-xs font-black">
                    {idx + 1}
                  </div>
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${loadingDocs ? 'opacity-50 cursor-default' : 'cursor-pointer'} ${
                      checkedItems.includes(item.id)
                        ? 'bg-green-50/50 border-green-200'
                        : 'bg-white border-transparent hover:border-muted/20'
                    }`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <Checkbox checked={checkedItems.includes(item.id)} disabled={loadingDocs} onCheckedChange={() => toggleItem(item.id)} className="h-6 w-6 rounded-lg border-2" />
                    <span className={`text-sm font-bold italic transition-colors ${checkedItems.includes(item.id) ? 'text-green-700' : 'text-primary'}`}>{item.label}</span>
                    {checkedItems.includes(item.id) && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-2xl bg-primary text-white rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-accent/20 rounded-full blur-2xl" />
            <CardHeader className="p-8 relative z-10">
              <div className="h-14 w-14 rounded-3xl bg-white/10 flex items-center justify-center mb-6 shadow-xl"><Cloud className="h-8 w-8 text-white" /></div>
              <CardTitle className="text-2xl font-black italic">Nuvem de Documentos</CardTitle>
              <CardDescription className="text-white/90 font-medium font-bold italic">Use o Google Drive para não perder nada.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6 relative z-10">
              <div className="space-y-4">
                {[
                  { icon: MousePointer2, text: "Acesse drive.google.com" },
                  { icon: FolderPlus, text: 'Crie a pasta "Ingresso 2024"' },
                  { icon: Smartphone, text: 'Escaneie com a câmera do celular' }
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <step.icon className="h-4 w-4 text-white shrink-0" />
                    <span className="text-xs font-bold italic opacity-90">{step.text}</span>
                  </div>
                ))}
              </div>
              <Button asChild className="w-full h-14 bg-accent text-accent-foreground font-black text-xs uppercase rounded-2xl shadow-xl hover:scale-105 transition-all">
                <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer">ABRIR MEU DRIVE <ExternalLink className="ml-2 h-4 w-4" /></a>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8 space-y-4">
            <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex items-center gap-2">
              <FileSearch className="h-3.5 w-3.5 text-accent" /> Qualidade da Imagem
            </h3>
            <p className="text-xs font-medium italic text-primary/70 leading-relaxed">
              "Evite fotos com sombras ou reflexos de luz. Se o text não estiver legível, sua inscrição poderá ser indeferida pela universidade."
            </p>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8 space-y-4">
            <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-accent" /> Validade dos Papéis
            </h3>
            <p className="text-xs font-medium italic text-primary/70 leading-relaxed">
              "Comprovantes de residência devem ter no máximo 90 dias. Certidões não podem ter rasuras ou remendos."
            </p>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8 space-y-4">
            <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex items-center gap-2">
              <LayoutList className="h-3.5 w-3.5 text-accent" /> Organização Maestro
            </h3>
            <p className="text-xs font-medium italic text-primary/70 leading-relaxed">
              "Renomeie seus arquivos como 'RG_FRENTE.pdf' ou 'HISTORICO_MEDIO.pdf'. Isso agiliza a conferência do tutor e evita erros de envio."
            </p>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8 space-y-4">
            <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-accent" /> Dica de Segurança
            </h3>
            <p className="text-xs font-medium italic text-primary/70 leading-relaxed">
              "Nunca envie documentos originais por chats informais. Mantenha seu rastro digital seguro em pastas oficiais."
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}