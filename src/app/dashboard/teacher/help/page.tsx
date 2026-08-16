"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  ClipboardList,
  FilePenLine,
  Database,
  Bell,
  MonitorPlay,
  BarChart3,
  Play,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

interface FAQItem {
  id: string;
  question: string;
  icon: any;
  category: string;
  answer: string;
  tourTarget?: string;
  tourSteps?: DriveStep[];
}

const faqItems: FAQItem[] = [
  {
    id: "create-trail",
    question: "Como criar uma trilha de estudo?",
    icon: ClipboardList,
    category: "Trilhas",
    answer:
      "Para criar uma trilha, acesse a página 'Minhas Trilhas', clique no botão 'Criar Nova Trilha', preencha o título, descrição, categoria e adicione os módulos com videoaulas e materiais.",
    tourTarget: "/dashboard/teacher/trails",
    tourSteps: [
      { element: "#nav-teacher-trails", popover: { title: "Passo 1", description: "Clique em 'Minhas Trilhas' no menu lateral.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Na página de Trilhas, clique no botão de criar nova trilha no topo.", side: "bottom" as const, align: "center" as const } },
      { popover: { title: "Passo 3", description: "Preencha título, descrição e imagem. Depois adicione módulos com vídeos.", side: "bottom" as const, align: "center" as const } },
    ],
  },
  {
    id: "correct-essay",
    question: "Como corrigir uma redação?",
    icon: FilePenLine,
    category: "Redações",
    answer:
      "Na seção 'Correção de Redações', você verá todas as redações pendentes. Clique em uma para abrir o editor com suporte da Aurora IA para gerar feedback automático baseado nas competências do ENEM.",
    tourTarget: "/dashboard/teacher/essays",
    tourSteps: [
      { element: "#nav-teacher-essays", popover: { title: "Passo 1", description: "Clique em 'Correção de Redações'.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Lista de redações pendentes — clique em uma para abrir.", side: "bottom" as const, align: "center" as const } },
      { popover: { title: "Passo 3", description: "Use 'Correção IA' para feedback automático ou corrija manualmente.", side: "bottom" as const, align: "center" as const } },
    ],
  },
  {
    id: "create-questions",
    question: "Como criar questões para o banco?",
    icon: Database,
    category: "Questões",
    answer:
      "No 'Banco de Questões', clique em 'Nova Questão'. Preencha enunciado, alternativas, resposta correta, dificuldade e tags. As questões ficam disponíveis para simulados automáticos.",
    tourTarget: "/dashboard/teacher/questions",
    tourSteps: [
      { element: "#nav-teacher-questions", popover: { title: "Passo 1", description: "Acesse o 'Banco de Questões'.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Clique em 'Nova Questão' para abrir o formulário.", side: "bottom" as const, align: "center" as const } },
      { popover: { title: "Passo 3", description: "Preencha enunciado, A-E, marque a correta, defina dificuldade e tags.", side: "bottom" as const, align: "center" as const } },
    ],
  },
  {
    id: "send-announcement",
    question: "Como enviar um comunicado aos alunos?",
    icon: Bell,
    category: "Comunicação",
    answer:
      "No 'Mural de Avisos', clique em 'Novo Comunicado'. Defina título, mensagem e prioridade. O aviso aparece no painel dos alunos imediatamente.",
    tourTarget: "/dashboard/teacher/communication",
    tourSteps: [
      { element: "#nav-teacher-communication", popover: { title: "Passo 1", description: "Clique em 'Mural de Avisos'.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Botão de criar novo comunicado.", side: "bottom" as const, align: "center" as const } },
      { popover: { title: "Passo 3", description: "Preencha título, mensagem e prioridade. Publicado em tempo real.", side: "bottom" as const, align: "center" as const } },
    ],
  },
  {
    id: "manage-lives",
    question: "Como agendar e gerenciar aulas ao vivo?",
    icon: MonitorPlay,
    category: "Lives",
    answer:
      "Em 'Gerenciar Lives', crie uma nova sessão com título, data/hora e link do YouTube ou Google Meet. Os alunos são notificados automaticamente.",
    tourTarget: "/dashboard/teacher/live",
    tourSteps: [
      { element: "#nav-teacher-live", popover: { title: "Passo 1", description: "Acesse 'Gerenciar Lives'.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Preencha título, data, hora e link da transmissão.", side: "bottom" as const, align: "center" as const } },
    ],
  },
  {
    id: "use-analytics",
    question: "Como usar o BI & Analytics?",
    icon: BarChart3,
    category: "Analytics",
    answer:
      "O painel mostra taxa de conclusão, notas médias, evolução individual e ranking. Use os filtros do topo para segmentar por período, matéria ou turma.",
  },
  {
    id: "manage-library",
    question: "Como adicionar apostilas à biblioteca?",
    icon: BookOpen,
    category: "Biblioteca",
    answer:
      "Na 'Gestão de Apostilas', clique em 'Adicionar Recurso'. Faça upload do PDF ou cole um link, preencha título e categoria.",
    tourTarget: "/dashboard/teacher/library",
    tourSteps: [
      { element: "#nav-teacher-library", popover: { title: "Passo 1", description: "Acesse 'Gestão de Apostilas'.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Adicione Recurso e faça upload ou cole o link.", side: "bottom" as const, align: "center" as const } },
    ],
  },
];

export default function TeacherHelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const router = useRouter();

  const filteredFaqs = faqItems.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(faqItems.map((f) => f.category))];

  const handleStartTour = useCallback((faq: FAQItem) => {
    if (!faq.tourSteps) return;

    setActiveTourId(faq.id);

    import("driver.js").then(({ driver }) => {
      const driverInstance = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(0, 0, 0, 0.85)",
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "app-tour-popover",
        nextBtnText: "Próximo →",
        prevBtnText: "← Anterior",
        doneBtnText: "Entendi ✓",
        progressText: "{{current}} de {{total}}",
        onDestroyStarted: () => {
          driverInstance.destroy();
          setActiveTourId(null);
        },
        steps: faq.tourSteps!,
      });

      if (faq.tourTarget) {
        setTimeout(() => {
          driverInstance.drive();
        }, 500);
      } else {
        driverInstance.drive();
      }
    });
  }, []);

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(76,204,237,0.13) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(59,130,246,0.10) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="h-3 w-3 text-orange-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400/85">
              Suporte · FAQ
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Central de Ajuda
          </h1>
          <p className="text-white/70 text-xs font-semibold mt-1">
            Tutoriais interativos passo a passo
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por pergunta ou categoria..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 bg-white shadow-sm border border-slate-200 rounded-2xl pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[#4CCCED]/40 transition-all"
        />
      </div>

      {/* ── Category chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setSearchQuery("")}
          className={`shrink-0 h-8 px-3.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all touch-manipulation ${
            searchQuery === ""
              ? "bg-[#4CCCED] text-white shadow-lg shadow-orange-500/20"
              : "bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800"
          }`}
        >
          Todas
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSearchQuery(cat)}
            className={`shrink-0 h-8 px-3.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all touch-manipulation ${
              searchQuery === cat
                ? "bg-[#4CCCED] text-white shadow-lg shadow-orange-500/20"
                : "bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Info card ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0d0d0f] border border-[#4CCCED]/15 p-4">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 100% 50%, rgba(76,204,237,0.13) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#4CCCED]/20 border border-[#4CCCED]/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-black text-white italic">Tutoriais Interativos</p>
            <p className="text-[11px] text-white/50 leading-relaxed mt-1">
              Clique em <strong className="text-orange-400">"Iniciar Tutorial"</strong> em qualquer pergunta para um passo a passo visual com setas indicando onde clicar.
            </p>
          </div>
        </div>
      </div>

      {/* ── FAQ Accordion ── */}
      {filteredFaqs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-[1.5rem]">
          <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nenhum resultado</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Tente outros termos</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {filteredFaqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm data-[state=open]:bg-slate-50 data-[state=open]:border-[#4CCCED]/20 transition-all"
            >
              <AccordionTrigger className="px-4 py-3.5 hover:no-underline group">
                <div className="flex items-center gap-3 text-left flex-1">
                  <div className="h-9 w-9 rounded-xl bg-[#4CCCED]/15 border border-[#4CCCED]/25 flex items-center justify-center shrink-0 group-data-[state=open]:bg-[#4CCCED]/30 transition-all">
                    <faq.icon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 italic text-sm leading-snug">{faq.question}</p>
                    <Badge className="mt-1.5 bg-white shadow-sm text-slate-600 border border-slate-200 font-black text-[8px] uppercase px-1.5 h-4">
                      {faq.category}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="pl-12 space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium italic">
                    {faq.answer}
                  </p>
                  {faq.tourSteps && (
                    <Button
                      onClick={() => handleStartTour(faq)}
                      disabled={activeTourId === faq.id}
                      className="h-10 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 border-none text-[10px] uppercase tracking-widest gap-1.5"
                    >
                      <Play className="h-3 w-3" />
                      Iniciar Tutorial
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
