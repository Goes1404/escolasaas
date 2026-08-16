import Image from 'next/image';

/**
 * Cartaz imprimível para o mural e para projetar na aula.
 *
 * Existe porque digitar endereço no celular é onde metade da turma desiste. O
 * QR é estático (`public/images/qr-instalar.svg`, gerado uma vez com
 * `npx qrcode`) — a URL nunca muda, então não faz sentido carregar uma
 * biblioteca de QR em produção para desenhar sempre a mesma imagem.
 *
 * O CSS de impressão é o ponto: sem ele o navegador imprime o fundo cinza da
 * página, os cabeçalhos do site e a barra de endereço no rodapé.
 */
export const metadata = {
  title: 'Cartaz de instalação | Plataforma',
  // Cartaz de uso interno: não deve aparecer em busca.
  robots: { index: false, follow: false },
};

export default function CartazPage() {
  return (
    <main className="min-h-screen bg-slate-100 print:bg-white p-6 print:p-0">
      {/* Instruções para quem vai imprimir — somem no papel. */}
      <div className="mx-auto max-w-[210mm] mb-6 print:hidden">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-800">Cartaz pronto para o mural</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Imprima em A4 (retrato). Também serve para projetar na aula.
            </p>
          </div>
          <a
            href="/instalar"
            className="text-xs font-black uppercase tracking-widest text-orange-600 hover:text-orange-700"
          >
            Ver a página →
          </a>
        </div>
      </div>

      {/* A4 retrato: 210x297mm. */}
      {/* `min-h` também na impressão: sem ela o bloco encolhe para a altura do
          conteúdo e o rodapé sobe, deixando um terço da folha em branco. */}
      <section className="mx-auto bg-white w-[210mm] min-h-[297mm] print:w-full shadow-xl print:shadow-none flex flex-col items-center text-center px-16 py-14">
        {/* Largura e altura explícitas em vez de `fill`: com `fill` o logo
            depende do layout do pai e não aparecia no PDF. */}
        <Image
          src="/icons/icon-512.png"
          alt=""
          width={96}
          height={96}
          className="mb-8"
          priority
        />

        <h1 className="text-[46px] leading-[1.05] font-black italic tracking-tighter text-slate-900 text-balance">
          Instale o app<br />no seu celular
        </h1>

        <p className="mt-5 text-lg font-medium text-slate-500 leading-relaxed">
          Aponte a câmera do celular para o código
        </p>

        <div className="mt-8 rounded-3xl border-[6px] border-slate-900 p-5">
          <Image
            src="/images/qr-instalar.svg"
            alt="QR code para compromissose.com/instalar"
            width={300}
            height={300}
            // SVG estático, sem otimização — o Next não processa SVG por padrão
            // e a imagem já está no tamanho certo.
            unoptimized
          />
        </div>

        <p className="mt-6 text-2xl font-black tracking-tight text-slate-900">
          compromissose.com/<span className="text-orange-600">instalar</span>
        </p>
        <p className="mt-1 text-sm font-medium text-slate-400">
          ou digite este endereço no navegador
        </p>

        <div className="mt-auto pt-10 w-full">
          <div className="rounded-3xl bg-slate-900 text-white px-8 py-6 text-left">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">
              Por que instalar
            </p>
            <ul className="space-y-2 text-base font-medium text-white/90 leading-snug">
              <li>· Vira ícone na sua tela e abre igual aplicativo.</li>
              <li>· Avisa você às 18h — <b>só se ainda não tiver estudado</b>.</li>
              <li>· Não ocupa espaço e não precisa de loja.</li>
            </ul>
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-slate-300">
            Sua Instituição de Ensino
          </p>
        </div>
      </section>
    </main>
  );
}
