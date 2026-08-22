import type { Metadata } from "next";
import LandingExperience from "@/components/home/LandingExperience";
import "./landing.css";

export const metadata: Metadata = {
  title: "Dalí — plataforma de estudo e gestão escolar (ENEM · ETEC)",
  description:
    "Simulados no padrão real, redação corrigida em minutos, gamificação com mascote, financeiro de mensalidades, portal do responsável e rematrícula digital — tudo numa plataforma feita para o celular do aluno.",
};

/**
 * Aplica o tema da landing ANTES do primeiro paint — sem isso a página nasce
 * escura e pisca para o claro na hidratação. Escuro é o padrão; quem nunca
 * escolheu, mas usa o sistema em claro, já entra no claro.
 */
const THEME_BOOTSTRAP = `(function(){try{
var t=localStorage.getItem('landing-theme');
if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}
document.documentElement.setAttribute('data-landing-theme',t)
}catch(e){document.documentElement.setAttribute('data-landing-theme','dark')}})()`;

export default function LandingPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      <LandingExperience />
    </>
  );
}
