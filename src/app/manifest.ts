import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getTenantForHost } from '@/lib/get-tenant'

/**
 * Manifesto do PWA — servido em `/manifest.webmanifest`.
 *
 * Reescrito em 12/08/2026, ao preparar o pedido para os alunos instalarem o
 * app na tela de início (o único caminho para notificação no iPhone).
 *
 * O que estava errado e travaria a instalação:
 *
 *  · Os dois ícones apontavam para `/images/logocompromisso.png`, declarado
 *    como `image/png` de 192x192 e 512x512. O arquivo é um **JPEG de 428x299**.
 *    O Chrome exige um ícone quadrado de 192px+ que bata com o declarado para
 *    oferecer a instalação — ou seja, o convite podia simplesmente não
 *    aparecer, justamente na campanha em que mil alunos seriam orientados.
 *  · Não havia `apple-touch-icon`; sem ele o iPhone usa uma miniatura da
 *    página como ícone.
 *  · `background_color` preto contra um logo de fundo branco fazia a tela de
 *    abertura piscar preto e depois branco.
 *
 * Havia ainda um `public/manifest.json` sobrando, com outro nome e outras
 * cores. Nada o referenciava (o `<link rel="manifest">` vem daqui, via
 * metadata do Next), então foi removido para não haver duas verdades.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headersList = await headers()
  const tenant = await getTenantForHost(headersList.get('host'))

  return {
    name: `${tenant.branding.appName} — Sistema de Ensino`,
    short_name: tenant.branding.appName,
    description: 'Simulados, provas, redação com correção por IA e trilhas de aprendizado.',
    // O aluno que instala já é aluno: cai direto no painel. Sem sessão, o
    // middleware manda para o login e volta depois.
    start_url: '/dashboard/home',
    display: 'standalone',
    // Tinta do sistema: é o fundo do próprio ícone, então a tela de
    // abertura não pisca de uma cor para outra ao abrir o app instalado.
    background_color: '#09090f',
    theme_color: tenant.branding.primaryColor,
    orientation: 'portrait-primary',
    lang: 'pt-BR',
    categories: ['education'],
    // Ícones ainda fixos (não por tenant): precisam de asset quadrado
    // pré-dimensionado por escola — ver comentário no topo do arquivo sobre
    // a instalação quebrar quando o tamanho declarado não bate com o real.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separado do `any` de propósito: o Android recorta o maskable, e um
      // ícone que serve aos dois papéis acaba com o logo cortado nas bordas.
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
