"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Layers,
  Mail,
  MessageSquare,
  Palette,
  ShieldCheck,
  Sliders,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CONTACT_EMAIL, DEMO_WHATSAPP_URL } from "@/lib/site-contact";

const platformPoints = [
  {
    icon: Palette,
    title: "Sua marca, do jeito que você quiser",
    desc: "Logo, cores e nome da sua instituição em toda a plataforma — o aluno nem percebe que é uma plataforma compartilhada.",
  },
  {
    icon: ShieldCheck,
    title: "Dado isolado por instituição",
    desc: "Cada escola enxerga só os próprios alunos, turmas e resultados. Isolamento de dados de ponta a ponta.",
  },
  {
    icon: Sliders,
    title: "Módulos que você escolhe",
    desc: "Simulados, redação com IA, fórum, mentoria Aurora, lives — ativa só o que faz sentido pra sua instituição.",
  },
  {
    icon: Layers,
    title: "Cresce junto com você",
    desc: "De uma unidade a uma rede inteira de escolas, cada uma com o próprio ambiente dentro da mesma plataforma.",
  },
];

export function BottomSections() {
  return (
    <>
      {/* O QUE A PLATAFORMA OFERECE */}
      <section id="resultados" className="py-20 flex flex-col justify-center bg-gray-50 scroll-mt-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 w-full relative">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6 pb-6 border-b border-gray-200">
            <div className="space-y-2">
              <span className="text-primary text-[10px] font-black tracking-[0.4em] uppercase">Feito pra sua escola</span>
              <h2 className="text-4xl font-black tracking-tighter">Uma plataforma, sua identidade</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {platformPoints.map((point) => (
              <div key={point.title} className="group relative rounded-3xl overflow-hidden shadow-xl bg-white ring-1 ring-gray-100 p-7 flex flex-col gap-4 hover:-translate-y-1 transition-transform">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <point.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-gray-900 leading-tight">{point.title}</p>
                  <p className="text-sm text-gray-500 font-medium mt-2 leading-relaxed">{point.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-20 flex flex-col justify-center bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 w-full relative">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px]">
              <Star className="h-4 w-4" /> Quem usa
            </div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Feito pra quem gere uma instituição</h2>
            <p className="text-gray-500 font-medium">O que coordenadores e gestores buscam quando trazem a plataforma pra escola.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Coordenação Pedagógica", course: "Gestão de turmas e conteúdo", desc: "Ter simulados, banco de questões e redação corrigida por IA prontos, sem depender de equipe técnica própria, é o que faz a diferença no dia a dia." },
              { name: "Direção Escolar", course: "Marca própria, sem apps genéricos", desc: "Os alunos usam com o nome e a cor da nossa instituição — não parece um produto emprestado de outra empresa." },
              { name: "Secretaria Acadêmica", course: "Onboarding de alunos e turmas", desc: "Importar a base de alunos e liberar acesso pra todo mundo de uma vez poupou semanas de trabalho manual." },
            ].map((test) => (
              <div key={test.name} className="p-8 rounded-3xl bg-gray-50 border border-gray-100 shadow-sm relative group hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="flex text-amber-400 mb-4">
                  <Star className="h-5 w-5 fill-current" /><Star className="h-5 w-5 fill-current" /><Star className="h-5 w-5 fill-current" /><Star className="h-5 w-5 fill-current" /><Star className="h-5 w-5 fill-current" />
                </div>
                <p className="text-gray-600 font-medium italic mb-6 leading-relaxed">"{test.desc}"</p>
                <div>
                  <p className="font-black text-gray-900">{test.name}</p>
                  <p className="text-[10px] font-bold text-primary uppercase">{test.course}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ - PERGUNTAS FREQUENTES */}
      <section id="faq" className="py-20 flex flex-col justify-center bg-gray-50 relative overflow-hidden scroll-mt-20">
        <div className="max-w-4xl mx-auto px-6 w-full relative">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Perguntas Frequentes</h2>
            <p className="text-gray-500 font-medium">Tire as principais dúvidas antes de falar com a gente.</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Como funciona a cobrança?", a: "O modelo depende do tamanho da sua instituição e dos módulos ativados. A gente monta uma proposta sob medida na conversa inicial — sem plano genérico." },
              { q: "Os dados da minha escola ficam misturados com os de outras?", a: "Não. Cada instituição tem os próprios dados isolados — alunos, turmas, resultados e conteúdo não são compartilhados entre escolas." },
              { q: "Dá pra usar minha própria logo e cores?", a: "Sim — logo, nome e paleta de cores da sua instituição aparecem em toda a plataforma, incluindo o app instalável no celular do aluno." },
              { q: "Como a IA consegue corrigir redações?", a: "A Aurora, nossa mentora de IA, foi treinada pra avaliar critérios oficiais de redação e devolve nota e feedback em minutos — sem depender de correção manual." },
              { q: "Quanto tempo leva pra colocar minha escola no ar?", a: "Depende do volume de alunos e turmas a importar, mas o ambiente com sua marca fica pronto rapidamente. A gente te dá o prazo exato na conversa inicial." },
            ].map((faq, idx) => (
              <div key={idx} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-black text-lg text-gray-900 mb-2 flex gap-3"><MessageSquare className="h-5 w-5 text-primary shrink-0" /> {faq.q}</h3>
                <p className="text-gray-600 font-medium ml-8 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 bg-gray-950 text-white text-center relative overflow-hidden border-t border-white/5 snap-start">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/30 blur-[150px] rounded-full" />
        </div>
        <div className="max-w-3xl mx-auto px-6 space-y-8 relative z-10">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            Sua escola merece uma<br /><span className="text-primary italic underline decoration-primary/30 decoration-8 underline-offset-8">plataforma própria.</span>
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed font-medium">
            Fale com a gente e veja como fica a plataforma com a marca da sua instituição.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
            <Button asChild size="lg" className="h-16 px-12 bg-primary hover:bg-[#0f7a95] text-white font-black text-lg rounded-full shadow-[0_10px_40px_-10px_rgba(76,204,237,0.5)] border-none transition-all active:scale-95">
              <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">Falar com a gente <ArrowRight className="h-5 w-5" /></a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-16 px-12 bg-transparent text-white font-black text-lg rounded-full border-2 border-white/20 hover:bg-white/5 transition-all">
              <a href="#faq" onClick={(e) => { e.preventDefault(); document.querySelector('#faq')?.scrollIntoView({ behavior: 'smooth' }); }}>Dúvidas Frequentes</a>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white py-16 border-t border-gray-100 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-16 border-b border-gray-100 pb-16">
            <div className="space-y-8 max-w-sm">
              <div className="flex items-center">
                <div className="relative h-12 w-44 md:h-14 md:w-52 overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
                  <Image src="/images/default-logo.png" alt="Logo" fill className="object-contain p-2.5" unoptimized />
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 font-medium leading-relaxed italic">"A plataforma que sua instituição pode chamar de sua."</p>
              </div>
              <div className="flex gap-4">
                <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 transition-all cursor-pointer">
                  <MessageSquare className="h-5 w-5" />
                </a>
                <a href={`mailto:${CONTACT_EMAIL}`} className="h-10 w-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 transition-all cursor-pointer">
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 lg:gap-24">
              <div className="space-y-6">
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Plataforma</p>
                <ul className="space-y-4">
                  <li><Link href="/login" className="text-sm font-bold text-gray-500 hover:text-primary transition-colors">Entrar</Link></li>
                  <li><Link href="#funcionalidades" onClick={(e) => { e.preventDefault(); document.querySelector('#funcionalidades')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm font-bold text-gray-500 hover:text-primary transition-colors">Funcionalidades</Link></li>
                  <li><Link href="#metodologia" onClick={(e) => { e.preventDefault(); document.querySelector('#metodologia')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm font-bold text-gray-500 hover:text-primary transition-colors">Como funciona</Link></li>
                </ul>
              </div>
              <div className="space-y-6">
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Contato</p>
                <p className="text-sm font-bold text-gray-500 break-words md:break-normal">{CONTACT_EMAIL}</p>
                <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-500 hover:text-primary transition-colors block">WhatsApp</a>
              </div>
              <div className="space-y-6 hidden sm:block">
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Oficial</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-loose">
                  © 2026 Plataforma EAD
                </p>
              </div>
            </div>
          </div>
          <div className="pt-10 text-center lg:text-left">
            <p className="text-[11px] font-black text-gray-300 uppercase tracking-[0.5em]">Educação Inteligente • Sua Marca</p>
          </div>
        </div>
      </footer>
    </>
  );
}
