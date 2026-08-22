import type { Metadata } from "next";
import LandingExperience from "@/components/home/LandingExperience";
import "./landing.css";

export const metadata: Metadata = {
  title: "Compromisso — plataforma de estudo e gestão escolar (ENEM · ETEC)",
  description:
    "Simulados no padrão real, redação corrigida em minutos, gamificação com mascote, financeiro de mensalidades, portal do responsável e rematrícula digital — tudo numa plataforma feita para o celular do aluno.",
};

export default function LandingPage() {
  return <LandingExperience />;
}
