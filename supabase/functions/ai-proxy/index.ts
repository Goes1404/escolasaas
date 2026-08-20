
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

// Constantes de configuração e segurança
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY")!;
const EMBEDDING_MODEL = "text-embedding-004"; // Modelo de embedding recomendado pelo Google

// Inicialização dos clientes
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// --- SERVIDOR PRINCIPAL ---
serve(async (req) => {
  const { url, method } = req;
  const { pathname } = new URL(url);

  // Validação de segurança básica: verifica se a chave de serviço está presente
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração de segurança ausente no servidor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- ROTAS ---
  try {
    // Rota para gerar e salvar embeddings
    if (pathname.endsWith("/embed") && method === "POST") {
      const { text, owner_id } = await req.json();
      if (!text || !owner_id) {
        return new Response(JSON.stringify({ error: "O texto (text) e o ID do proprietário (owner_id) são obrigatórios." }), { status: 400 });
      }

      console.log(`[INFO] Recebida solicitação para gerar embedding para o texto: "${text.substring(0, 50)}..."`);
      
      const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;

      const { data, error } = await supabaseAdmin
        .from("embeddings")
        .insert({
          content: text,
          embedding: embedding,
          owner_id: owner_id
        })
        .select();

      if (error) {
        console.error("[ERROR] Erro ao salvar embedding no banco:", error);
        throw new Error(`Falha ao salvar no banco de dados: ${error.message}`);
      }

      console.log("[SUCCESS] Embedding salvo com sucesso no banco de dados.");
      return new Response(JSON.stringify({ success: true, data: data[0] }), { status: 200 });
    }

    // Rota para buscar documentos similares (busca semântica)
    if (pathname.endsWith("/query") && method === "POST") {
      const { query, match_threshold = 0.75, match_count = 5 } = await req.json();
      if (!query) {
        return new Response(JSON.stringify({ error: "A consulta (query) é obrigatória." }), { status: 400 });
      }

      console.log(`[INFO] Recebida consulta para busca semântica: "${query}"`);

      const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await embeddingModel.embedContent(query);
      const queryEmbedding = result.embedding.values;

      const { data: documents, error } = await supabaseAdmin.rpc("match_embeddings", {
        query_embedding: queryEmbedding,
        match_threshold: match_threshold,
        match_count: match_count,
      });

      if (error) {
        console.error("[ERROR] Erro ao executar a busca semântica:", error);
        throw new Error(`Falha ao buscar no banco de dados: ${error.message}`);
      }

      console.log(`[SUCCESS] Busca semântica retornou ${documents.length} documento(s).`);
      return new Response(JSON.stringify({ success: true, data: documents }), { status: 200 });
    }
    
    // Rota padrão para health check
    return new Response(JSON.stringify({ message: "Servidor ai-proxy operacional." }), { status: 200 });

  } catch (err) {
    console.error("[FATAL] Erro inesperado no servidor:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

console.log("🚀 Servidor da Edge Function 'ai-proxy' iniciado com sucesso!");
