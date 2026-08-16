"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/app/lib/supabase";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import type { DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const studentSteps: DriveStep[] = [
  {
    element: "#sidebar-logo",
    popover: {
      title: "🎓 Bem-vindo à Plataforma!",
      description: "Vamos fazer um tour rápido pela plataforma para você conhecer todos os recursos disponíveis.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-home",
    popover: {
      title: "📊 Meu Painel",
      description: "Aqui você acompanha seu progresso, notas de simulados, redações e avisos importantes.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-trails",
    popover: {
      title: "📚 Assistir Aulas",
      description: "Acesse trilhas de estudo com videoaulas organizadas por matéria e nível de dificuldade.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-simulados",
    popover: {
      title: "🧠 Fazer Simulados",
      description: "Pratique com questões reais do ENEM e ETEC. Seu desempenho é monitorado pela Aurora IA.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-chat",
    popover: {
      title: "💬 Tirar Dúvidas",
      description: "Converse com professores ou com a Aurora IA a qualquer momento — 24 horas por dia!",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#header-profile",
    popover: {
      title: "👤 Seu Perfil",
      description: "Clique aqui para editar suas informações pessoais, foto e preferências.",
      side: "bottom",
      align: "end",
    },
  },
];

const teacherSteps: DriveStep[] = [
  {
    element: "#sidebar-logo",
    popover: {
      title: "🎓 Bem-vindo, Professor!",
      description: "Vamos conhecer as ferramentas de gestão pedagógica disponíveis para você.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-teacher-home",
    popover: {
      title: "📊 Painel de Gestão",
      description: "Visão geral dos seus alunos, turmas e métricas pedagógicas.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-teacher-trails",
    popover: {
      title: "📚 Minhas Trilhas",
      description: "Crie e gerencie trilhas de estudo com videoaulas, PDFs e exercícios.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-teacher-questions",
    popover: {
      title: "🗃️ Banco de Questões",
      description: "Monte questões personalizadas para simulados e atividades avaliativas.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-teacher-essays",
    popover: {
      title: "✍️ Correção de Redações",
      description: "Corrija redações dos alunos com apoio da Aurora IA para feedback mais rápido.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#nav-teacher-help",
    popover: {
      title: "❓ Central de Ajuda",
      description: "Perguntas frequentes com tutoriais guiados passo a passo na interface real.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#header-profile",
    popover: {
      title: "👤 Seu Perfil",
      description: "Edite suas informações e preferências de conta.",
      side: "bottom",
      align: "end",
    },
  },
];

export function OnboardingTour() {
  const { user, userRole } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);
  const hasChecked = useRef(false);

  const markCompleted = async () => {
    if (!user) return;
    try {
      await supabase.auth.updateUser({
        data: { onboarding_completed: true },
      });
    } catch (e) {
      console.error("Failed to save onboarding preference:", e);
    }
  };

  const steps = userRole === "teacher" || userRole === "admin" ? teacherSteps : studentSteps;

  const { start } = useGuidedTour({
    steps,
    onComplete: markCompleted,
    onSkip: markCompleted,
  });

  useEffect(() => {
    if (!user || hasChecked.current) return;
    hasChecked.current = true;

    const completed = user.user_metadata?.onboarding_completed;
    if (!completed) {
      setShouldShow(true);
    }
  }, [user]);

  useEffect(() => {
    if (!shouldShow) return;

    // Delay para garantir que o DOM está pronto
    const timer = setTimeout(() => {
      start();
      setShouldShow(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [shouldShow, start]);

  return null; // Componente não renderiza nada — o driver.js controla o overlay
}
