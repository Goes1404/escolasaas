import { NextResponse } from "next/server";
import { respostaFalhaIA } from "@/lib/ia-status";
import { OpenAI } from "openai";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é uma IA geradora de propostas de redação no modelo ENEM.
Gere um tema de impacto e atualidade no Brasil. Seu JSON deve conter:
{
  "title": "O desafio de reduzir o desperdício de alimentos no Brasil contemporâneo",
  "supporting_texts": [
    { "id": 1, "content": "Texto sobre o problema do desperdício...", "source": "IBGE" },
    { "id": 2, "content": "Texto sobre fomento à doação...", "source": "ONU" }
  ]
}`
        },
        {
          role: "user",
          content: "Gere o tema de redação."
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message?.content || "{}");

    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    return respostaFalhaIA("essay-theme", error);
  }
}
