'use client';

import { useEffect, useState } from 'react';
import { arquetipo, type Arquetipo } from '@/lib/mascote';

/**
 * Descobre se existe arte renderizada para um arquétipo.
 *
 * ── Por que sondar em vez de manter uma lista ──────────────────────────────
 *
 * A alternativa era um manifesto declarando quais bichos têm imagem. Só que aí
 * colocar um arquivo na pasta não bastaria — seria preciso lembrar de editar o
 * manifesto junto, e esquecer disso deixa a imagem no disco e o vetor na tela,
 * sem erro nenhum para explicar por quê. Sondando, o contrato é o arquivo
 * existir: joga em `/public/mascotes/lobinho.webp` e o app passa a usar; tira,
 * e o vetor volta sozinho.
 *
 * O custo é um 404 por arquétipo quando a arte ainda não foi feita. O cache
 * abaixo garante que seja um por sessão, não um por render.
 */

/** Uma sondagem por arquétipo por sessão. */
const cache = new Map<Arquetipo, Promise<string | null>>();

export function caminhoDaImagem(id: Arquetipo): string {
  return `/mascotes/${id}.webp`;
}

function sondar(id: Arquetipo): Promise<string | null> {
  const guardado = cache.get(id);
  if (guardado) return guardado;

  const url = caminhoDaImagem(id);
  const p = new Promise<string | null>(resolve => {
    const img = new window.Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(id, p);
  return p;
}

/**
 * A URL da arte renderizada, ou `null` enquanto não houver uma.
 *
 * Devolve `null` também no primeiro render — quem chama desenha o vetor até a
 * imagem chegar. É de propósito: o vetor aparece na hora e a foto entra por
 * cima quando carrega, então a tela nunca fica vazia nem quebrada.
 */
export function useImagemDoMascote(especie: Arquetipo | null): string | null {
  const id = arquetipo(especie).id;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setUrl(null);
    void sondar(id).then(r => { if (vivo) setUrl(r); });
    return () => { vivo = false; };
  }, [id]);

  return url;
}
