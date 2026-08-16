"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import { DEMO_WHATSAPP_URL } from "@/lib/site-contact";

const sectionFallback = (
  <div className="min-h-[40vh] py-32 flex justify-center items-center bg-gray-950">
    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
  </div>
);

const DynamicFeatureBentoGrid = dynamic(
  () => import("@/components/home/FeatureBentoGrid").then((mod) => mod.FeatureBentoGrid),
  { ssr: false, loading: () => sectionFallback }
);

const DynamicFlowSection = dynamic(
  () => import("@/components/home/FlowSection").then((mod) => mod.FlowSection),
  { ssr: false, loading: () => sectionFallback }
);

const DynamicFluidAccessSection = dynamic(
  () => import("@/components/home/FluidAccessSection").then((mod) => mod.FluidAccessSection),
  { ssr: false, loading: () => sectionFallback }
);

const DynamicBottomSections = dynamic(
  () => import("@/components/home/BottomSections").then((mod) => mod.BottomSections),
  { ssr: false, loading: () => sectionFallback }
);

interface NavLink {
  label: string;
  anchor: string;
}

const NAV_LINKS: readonly NavLink[] = [
  { label: "Funcionalidades", anchor: "#funcionalidades" },
  { label: "Como funciona", anchor: "#metodologia" },
  { label: "Quem usa", anchor: "#resultados" },
  { label: "Dúvidas", anchor: "#faq" },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Prefetch principais rotas para acelerar navegação
    router.prefetch('/login');

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router]);

  const handleRedirect = (path: string): void => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    router.push(path);
  };

  const handleScrollTo = (anchorId: string): void => {
    setMobileMenuOpen(false);
    document.querySelector(anchorId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-950 selection:bg-primary/20 selection:text-primary scroll-smooth relative">

      {/* Transição de Tela de Carregamento */}
      {isRedirecting && (
        <div className="fixed inset-0 z-[200] bg-gray-950 animate-in fade-in duration-500 flex flex-col items-center justify-center gap-4">
          <div className="relative h-16 w-16 flex items-center justify-center animate-pulse">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
          <h2 className="text-xl font-black text-white italic uppercase tracking-tighter animate-pulse">Acessando o Portal...</h2>
        </div>
      )}

      {/* HEADER PREMIUM */}
      <header
        className={`fixed top-0 w-full z-[60] transition-all duration-500 border-b ${scrolled
          ? 'bg-white/95 md:bg-white/95 backdrop-blur-xl py-2 shadow-lg border-gray-100'
          : 'bg-black/20 backdrop-blur-sm py-4 border-white/5'
          }`}
        style={scrolled && typeof window !== 'undefined' && window.innerWidth < 768 ? { backgroundColor: 'rgba(76, 204, 237, 0.95)', borderBottom: 'none' } : {}}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center">
            <Link href="/" onClick={(e) => { e.preventDefault(); handleScrollTo('#home'); }} className="flex items-center group">
              <div className="relative h-10 w-10 md:h-12 md:w-12 overflow-hidden rounded-xl shadow-lg bg-white p-1.5 transition-transform group-hover:rotate-6 duration-500">
                <Image
                  src="/images/default-logo.png"
                  alt="Logo"
                  fill
                  className="object-contain p-1"
                  sizes="(max-width: 768px) 40px, 48px"
                  priority
                />
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <a
                key={link.anchor}
                href={link.anchor}
                onClick={(e) => { e.preventDefault(); handleScrollTo(link.anchor); }}
                className={`text-sm font-black transition-all flex items-center group cursor-pointer ${scrolled ? 'text-gray-600 hover:text-primary' : 'text-white hover:text-primary'}`}
              >
                <span className="group-hover:translate-x-1 transition-transform">{link.label}</span>
              </a>
            ))}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleRedirect('/login')}
                className={`text-sm font-black transition-colors ${scrolled ? 'text-gray-600 hover:text-primary' : 'text-white hover:text-primary'}`}
              >
                Entrar
              </button>
              <Button asChild className="bg-primary hover:bg-[#0f7a95] text-white font-black h-10 px-6 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all active:scale-95 border-none">
                <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Falar com a gente</a>
              </Button>
            </div>
          </nav>

          <button
            className={`md:hidden flex items-center gap-2 py-2 px-4 rounded-full transition-all active:scale-95 shadow-lg ${
              scrolled ? 'bg-primary text-white shadow-primary/30 border-none' : 'bg-white/10 text-white backdrop-blur-md border border-white/20'
            }`}
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="text-[11px] font-black uppercase tracking-widest pt-0.5">Menu</span>
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[110] bg-white animate-in slide-in-from-right duration-500 md:hidden">
          <div className="p-8 flex justify-between items-center border-b border-gray-100">
            <span className="text-2xl font-black text-primary italic uppercase tracking-tighter">Plataforma</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-2 px-4 bg-gray-50 text-gray-400 rounded-full active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest border border-gray-100"
            >
              <span>Fechar</span>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-10 space-y-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.anchor}
                href={link.anchor}
                className="block text-xl font-black text-gray-800"
                onClick={(e) => { e.preventDefault(); handleScrollTo(link.anchor); }}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-8 space-y-3">
              <Button asChild className="w-full bg-primary h-14 text-white rounded-full border-none text-lg font-black shadow-xl shadow-primary/20">
                <a href={DEMO_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Falar com a gente</a>
              </Button>
              <Button onClick={() => handleRedirect('/login')} disabled={isRedirecting} variant="outline" className="w-full h-14 rounded-full border-gray-200 text-gray-600 text-lg font-black">
                Entrar
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* HERO — vitrine com mockup 3D do dashboard */}
        <HeroShowcase onNavigate={handleRedirect} onScrollTo={handleScrollTo} />

        {/* BENTO GRID — funcionalidades da plataforma */}
        <DynamicFeatureBentoGrid />

        {/* FLUXO DO ALUNO — timeline scroll-driven (#metodologia) */}
        <DynamicFlowSection />

        {/* ACESSO FLUIDO — CTA de login polido */}
        <DynamicFluidAccessSection onNavigate={handleRedirect} />

        {/* RESULTADOS + FAQ + CTA final */}
        <DynamicBottomSections />
      </main>
    </div>
  );
}
