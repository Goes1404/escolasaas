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
import { EmptyState } from "@/components/EmptyState";

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
    category: "Aulas ao vivo",
    answer:
      "Em 'Aulas ao Vivo', crie uma nova sessão com título, data/hora e link do YouTube ou Google Meet. Os alunos são notificados automaticamente.",
    tourTarget: "/dashboard/teacher/live",
    tourSteps: [
      { element: "#nav-teacher-live", popover: { title: "Passo 1", description: "Acesse 'Aulas ao Vivo'.", side: "right" as const, align: "start" as const } },
      { popover: { title: "Passo 2", description: "Preencha título, data, hora e link da transmissão.", side: "bottom" as const, align: "center" as const } },
    ],
  },
  {
    id: "use-analytics",
    question: "Como usar o painel de desempenho?",
    icon: BarChart3,
    category: "Desempenho",
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

  const chip = (active: boolean) =>
    `shrink-0 h-8 px-3 rounded-control text-xs font-semibold border transition-colors touch-manipulation ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  return (
    <div className="pb-24 space-y-6">

      {/* ── Cabeçalho (nível médio) ── */}
      <div>
        <p className="u-label flex items-center gap-2"><HelpCircle className="h-3.5 w-3.5" /> Professor · ajuda</p>
        <h1 className="u-page-title text-3xl mt-1">Central de ajuda</h1>
        <p className="text-muted-foreground text-sm mt-2">Respostas rápidas e tutoriais passo a passo.</p>
      </div>

      {/* ── Busca ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por pergunta ou categoria…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 bg-background border border-border rounded-control pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* ── Categorias ── */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSearchQuery("")} className={chip(searchQuery === "")}>
          Todas
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setSearchQuery(cat)} className={chip(searchQuery === cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Aviso dos tutoriais ── */}
      <div className="u-surface p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Tutoriais interativos</p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
            Toque em <strong className="text-foreground">Iniciar tutorial</strong> numa pergunta para ver, na tela, onde clicar em cada passo.
          </p>
        </div>
      </div>

      {/* ── Perguntas ── */}
      {filteredFaqs.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="Nenhuma pergunta encontrada"
          description="Tente outras palavras ou veja todas as perguntas."
          secondary={{ label: "Ver todas", onClick: () => setSearchQuery("") }}
        />
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {filteredFaqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="u-surface overflow-hidden data-[state=open]:border-primary/40"
            >
              <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                  <div className="h-9 w-9 rounded-control border border-border flex items-center justify-center shrink-0">
                    <faq.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-snug">{faq.question}</p>
                    <span className="u-label block mt-1">{faq.category}</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="sm:pl-12 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                  {faq.tourSteps && (
                    <Button
                      onClick={() => handleStartTour(faq)}
                      disabled={activeTourId === faq.id}
                      className="h-10 px-4 rounded-control text-xs font-semibold gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Iniciar tutorial
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
