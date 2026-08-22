'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Share, Plus, MoreVertical, Check, Bell, Smartphone,
  ArrowRight, Download, CheckCircle2,
} from 'lucide-react';

type Plataforma = 'ios' | 'android' | 'outro';

/** O evento que o Chrome dispara quando o site pode ser instalado. */
interface PromptInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectar(): Plataforma {
  if (typeof navigator === 'undefined') return 'outro';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ se apresenta como Mac; o que o denuncia é a tela sensível ao toque.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'outro';
}

function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const PASSOS: Record<'ios' | 'android', { icone: React.ReactNode; texto: React.ReactNode }[]> = {
  ios: [
    {
      icone: <Share className="h-5 w-5" />,
      texto: <>Com o site aberto no <b>Safari</b>, toque em <b>Compartilhar</b> — o quadradinho com a seta para cima, na barra de baixo.</>,
    },
    {
      icone: <Plus className="h-5 w-5" />,
      texto: <>Role a lista e escolha <b>Adicionar à Tela de Início</b>.</>,
    },
    {
      icone: <Check className="h-5 w-5" />,
      texto: <>Toque em <b>Adicionar</b>, no canto superior direito.</>,
    },
    {
      icone: <Smartphone className="h-5 w-5" />,
      texto: <>Feche o Safari e abra o app <b>pelo ícone novo</b> na sua tela.</>,
    },
    {
      icone: <Bell className="h-5 w-5" />,
      texto: <>Toque em <b>Ativar</b> quando aparecer o aviso de notificações.</>,
    },
  ],
  android: [
    {
      icone: <MoreVertical className="h-5 w-5" />,
      texto: <>Toque no menu <b>⋮</b> (três pontinhos), no canto superior direito do Chrome.</>,
    },
    {
      icone: <Download className="h-5 w-5" />,
      texto: <>Escolha <b>Instalar aplicativo</b> — em alguns aparelhos aparece como <b>Adicionar à tela inicial</b>.</>,
    },
    {
      icone: <Check className="h-5 w-5" />,
      texto: <>Confirme em <b>Instalar</b>.</>,
    },
    {
      icone: <Smartphone className="h-5 w-5" />,
      texto: <>Abra o app <b>pelo ícone novo</b> na sua tela.</>,
    },
    {
      icone: <Bell className="h-5 w-5" />,
      texto: <>Toque em <b>Ativar</b> quando aparecer o aviso de notificações.</>,
    },
  ],
};

/**
 * Guia de instalação do app na tela de início.
 *
 * Existe porque a barreira é do sistema, não do código: no iPhone o Web Push
 * só funciona com o site instalado — e das 68 inscrições de push da base,
 * exatamente uma era de iOS. As instruções já existem dentro do painel, mas
 * quem ainda não entrou não as vê; esta página é o endereço que o professor
 * projeta na aula ou manda no grupo.
 *
 * Por isso a plataforma é detectada mas nunca imposta: quem abre isto num
 * projetor está num computador, e precisa poder mostrar os dois caminhos.
 */
export function GuiaInstalacao() {
  const [plataforma, setPlataforma] = useState<Plataforma>('outro');
  const [aba, setAba] = useState<'ios' | 'android'>('android');
  const [instalado, setInstalado] = useState(false);
  const [prompt, setPrompt] = useState<PromptInstalacao | null>(null);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    const p = detectar();
    setPlataforma(p);
    if (p === 'ios' || p === 'android') setAba(p);
    setInstalado(estaInstalado());

    // No Chrome dá para instalar com um toque, sem passo a passo nenhum.
    const capturar = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptInstalacao);
    };
    window.addEventListener('beforeinstallprompt', capturar);
    const aoInstalar = () => { setInstalado(true); setPrompt(null); };
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  async function instalarAgora() {
    if (!prompt) return;
    setInstalando(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } finally {
      setInstalando(false);
    }
  }

  const passos = PASSOS[aba];

  return (
    // `pb-32`: o widget de acessibilidade é global e fica fixo no canto
    // inferior direito. Sem folga, ele encosta no último bloco da página.
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-5 pt-10 pb-32">
      <div className="mx-auto w-full max-w-lg space-y-6">

        <header className="text-center space-y-4">
          <div className="mx-auto relative h-20 w-20 rounded-card bg-white shadow-xl border border-slate-100 overflow-hidden p-2">
            <Image src="/icons/icon-192.png" alt="Plataforma" fill className="object-contain" sizes="80px" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black italic tracking-tighter text-slate-900 leading-tight text-balance">
              Instale o app<br />no seu celular
            </h1>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              Fica com ícone na tela, abre igual aplicativo e avisa você quando
              faltar estudar. Não ocupa espaço nem precisa de loja.
            </p>
          </div>
        </header>

        {instalado ? (
          <section className="rounded-card bg-emerald-50 border border-emerald-100 p-7 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-xl font-black italic text-emerald-900">Já está instalado!</p>
              <p className="text-sm font-medium text-emerald-700/80 leading-relaxed">
                Você abriu pelo ícone. Só falta ativar os avisos dentro do painel.
              </p>
            </div>
            <Link
              href="/dashboard/home"
              className="flex items-center justify-center gap-2 w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all"
            >
              Ir para o painel <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : (
          <>
            {/* Caminho curto: o Chrome instala com um toque. */}
            {prompt && (
              <button
                type="button"
                onClick={instalarAgora}
                disabled={instalando}
                className="w-full h-16 rounded-card bg-orange-500 hover:bg-orange-600 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
              >
                <Download className="h-5 w-5" />
                {instalando ? 'Instalando…' : 'Instalar agora'}
              </button>
            )}

            <div className="rounded-card bg-white border border-slate-100 shadow-sm overflow-hidden">
              {/* Abas: a plataforma detectada vem selecionada, mas quem abre no
                  projetor precisa mostrar as duas para a turma inteira. */}
              <div className="grid grid-cols-2 border-b border-slate-100">
                {(['android', 'ios'] as const).map(chave => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setAba(chave)}
                    aria-pressed={aba === chave}
                    className={`py-4 text-xs font-black uppercase tracking-widest transition-colors ${
                      aba === chave
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chave === 'android' ? 'Android' : 'iPhone'}
                    {plataforma === chave && (
                      <span className="block text-[8px] font-bold opacity-60 mt-0.5">o seu</span>
                    )}
                  </button>
                ))}
              </div>

              <ol className="p-6 space-y-5">
                {passos.map((passo, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="h-10 w-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                        {passo.icone}
                      </div>
                      <span className="text-[10px] font-black text-slate-300 tabular-nums">{i + 1}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed pt-2">
                      {passo.texto}
                    </p>
                  </li>
                ))}
              </ol>

              {aba === 'ios' && (
                <div className="mx-6 mb-6 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-xs font-bold text-amber-800 leading-relaxed">
                    No iPhone é preciso usar o <b>Safari</b> — e os avisos só funcionam
                    depois de instalar. É regra da Apple, não dá para pular.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="rounded-card bg-slate-900 text-white p-6 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">O que você recebe</p>
          <ul className="space-y-2 text-sm font-medium text-white/85">
            <li className="flex items-start gap-3">
              <Bell className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" />
              <span>Um aviso por dia, às 18h, <b>só se você ainda não tiver estudado</b>.</span>
            </li>
            <li className="flex items-start gap-3">
              <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" />
              <span>O app abre em tela cheia, sem a barra do navegador.</span>
            </li>
          </ul>
          <p className="text-[11px] font-medium text-white/40 leading-relaxed pt-1">
            Dá para desativar os avisos quando quiser, em Ajustes.
          </p>
        </div>

        <div className="text-center">
          <Link href="/login" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
            Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  );
}
