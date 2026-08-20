import { NextResponse } from "next/server";
import { respostaFalhaIA } from "@/lib/ia-status";
import { OpenAI } from "openai";
import { corrigirRedacao, ErroCorrecao } from "@/lib/essay-grader";

export const dynamic = 'force-dynamic';
// Duas correções em paralelo + eventual terceira em série.
export const maxDuration = 60;

/**
 * Casca HTTP sobre `corrigirRedacao`. Toda a regra de correção vive em
 * `src/lib/essay-grader.ts`, para que scripts (recorreção, calibração)
 * exercitem exatamente o mesmo código que atende o aluno.
 */
export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { theme, text, supporting_texts, origin } = await req.json();

    const motivadores: string[] = Array.isArray(supporting_texts)
      ? supporting_texts
          .map((t: any) => (typeof t === "string" ? t : t?.content || ""))
          .filter((l: string) => typeof l === "string" && l.trim().length > 4)
      : [];

    const result = await corrigirRedacao({ theme, text, motivadores, origin }, openai);
    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    if (error instanceof ErroCorrecao) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return respostaFalhaIA("essay-evaluate", error);
  }
}
