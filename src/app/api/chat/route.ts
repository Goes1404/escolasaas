import { openai } from '@ai-sdk/openai';
import { classificarFalhaIA, mensagemParaAluno, registrarIncidenteIA } from '@/lib/ia-status';
import { buildAuroraSystemPrompt } from '@/lib/aurora-prompt';
import { getTenantForHost } from '@/lib/get-tenant';
import { generateText } from 'ai';

// 300s no Pro / 60s no Hobby — a Vercel usa o máximo permitido pelo plano
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const tenant = await getTenantForHost(req.headers.get('host'));

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      // Reduzimos a temperatura para 0.2. Isso tira a "criatividade" excessiva e
      // foca na precisão e lógica, evitando que ela invente dados (alucinação).
      temperature: 0.2,
      system: buildAuroraSystemPrompt(tenant.branding.appName),
      messages,
      maxOutputTokens: 16000,
    });

    // Retorna a resposta empacotada em JSON fechado para o frontend antigo
    return Response.json({ success: true, result: { response: text } });

  } catch (error) {
    // Mesmo tratamento das demais rotas de IA: sem crédito e limite de uso são
    // 503 com mensagem honesta, e o incidente fica registrado para o painel.
    const tipo = classificarFalhaIA(error);
    const temporario = tipo !== 'outro';
    if (temporario) await registrarIncidenteIA('chat', tipo, error);
    console.error(`[IA:chat] ${tipo}`, error);

    return new Response(
      JSON.stringify({ indisponivel: temporario, tipo, error: mensagemParaAluno(tipo) }),
      { status: temporario ? 503 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}