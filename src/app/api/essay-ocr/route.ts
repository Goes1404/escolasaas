import { NextResponse } from "next/server";
import { respostaFalhaIA, registrarIncidenteIA } from "@/lib/ia-status";
import { avaliarLegibilidade } from "@/lib/essay-legibilidade";
import { OpenAI } from "openai";

export const dynamic = 'force-dynamic';
// Transcrição de foto pode levar alguns segundos.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // ~8MB

/**
 * Recebe a foto de uma redação manuscrita (data URL base64) e devolve o texto
 * transcrito, usando o GPT-4o (modelo com visão). Não corrige nem avalia —
 * apenas digitaliza, preservando parágrafos.
 */
export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json(
        { success: false, error: "Envie uma imagem válida (JPEG, PNG ou WEBP)." },
        { status: 400 }
      );
    }

    // Estima o tamanho do base64 para barrar uploads grandes demais.
    const base64Part = image.split(",")[1] || "";
    if ((base64Part.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Imagem muito grande. Use uma foto de até 8MB." },
        { status: 413 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Você é um transcritor de redações manuscritas. Transcreva EXATAMENTE o texto da imagem, " +
            "mantendo a divisão em parágrafos. NÃO corrija erros de gramática, ortografia ou pontuação — " +
            "preserve o que o aluno escreveu. NÃO adicione comentários, títulos ou numeração que não estejam " +
            "no original. Se uma palavra for ilegível, use [ilegível]. Responda APENAS com o texto transcrito.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva esta redação manuscrita:" },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 2000,
    });

    const transcription = completion.choices[0].message?.content?.trim() || "";

    if (!transcription) {
      return NextResponse.json(
        { success: false, error: "Não foi possível ler o texto da imagem. Tente uma foto mais nítida." },
        { status: 422 }
      );
    }

    // Transcrição embaralhada não pode seguir para a correção.
    //
    // Em 11/08 um aluno fotografou a redação, a foto saiu ruim, o OCR devolveu
    // texto sem sentido — "sya ves mercados leesoos de reapas" — e o corretor
    // deu ZERO dizendo que o texto dele tinha "desvios gramaticais
    // sistemáticos". O aluno escreveu certo; a máquina é que não leu. Devolver
    // o embaralhado para ele revisar também não resolve: para consertar aquilo
    // ele teria de redigitar a redação inteira.
    const legibilidade = avaliarLegibilidade(transcription);
    if (!legibilidade.legivel) {
      // Vale um incidente no painel: se isso passar a acontecer com frequência,
      // o problema é a orientação de como fotografar, não uma foto isolada.
      await registrarIncidenteIA(
        "essay-ocr",
        "outro",
        `transcricao_ilegivel ${legibilidade.taxaImpossiveis.toFixed(1)}% ${legibilidade.exemplos.join(" ")}`,
      );
      return NextResponse.json(
        { success: false, error: legibilidade.motivo },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, text: transcription });

  } catch (error: any) {
    return respostaFalhaIA("essay-ocr", error);
  }
}
