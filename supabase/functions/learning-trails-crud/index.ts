import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CRUD para learning_trails.
//
// Versão segura (reescrita): a versão anterior decodificava o JWT sem
// verificar assinatura e montava SQL por concatenação de string (injeção),
// rodando com a SERVICE ROLE. Aqui usamos o supabase-js com o JWT do próprio
// chamador (Authorization header): a assinatura é validada pelo GoTrue e toda
// autorização é delegada às policies de RLS de learning_trails
// (leitura: autenticado; escrita: professor dono via teacher_id, ou staff).
// Nenhum SQL cru é montado — tudo passa pelo query builder parametrizado.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  // Valida a sessão (assinatura verificada pelo GoTrue).
  const { data: { user } } = await supabase.auth.getUser();

  // Roteamento: localiza o segmento "learning_trails" e o id opcional logo após.
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const resourceIdx = segments.indexOf('learning_trails');
  if (resourceIdx === -1) return json({ error: 'Not Found' }, 404);
  const id = segments[resourceIdx + 1] ?? null;

  try {
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase
          .from('learning_trails')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return json({ data });
      }
      const url = new URL(req.url);
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const per = Math.min(100, Math.max(1, Number(url.searchParams.get('per') || 20)));
      const from = (page - 1) * per;
      const { data, error } = await supabase
        .from('learning_trails')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + per - 1);
      if (error) throw error;
      return json({ data });
    }

    // Escrita exige sessão. A autorização fina é da RLS.
    if (!user) return json({ error: 'Unauthorized' }, 401);

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { data, error } = await supabase
        .from('learning_trails')
        .insert({
          title: body.title ?? null,
          category: body.category ?? null,
          description: body.description ?? null,
          teacher_id: user.id, // sempre o dono autenticado — nunca confiar no body
          teacher_name: body.teacher_name ?? null,
          image_url: body.image_url ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ data }, 201);
    }

    if (req.method === 'PUT' && id) {
      const body = await req.json().catch(() => ({}));
      const updates: Record<string, unknown> = {};
      for (const field of ['title', 'category', 'description', 'teacher_name', 'image_url']) {
        if (body[field] !== undefined) updates[field] = body[field];
      }
      if (Object.keys(updates).length === 0) return json({ error: 'No updates provided' }, 400);
      const { data, error } = await supabase
        .from('learning_trails')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Forbidden or not found' }, 403);
      return json({ data });
    }

    if (req.method === 'DELETE' && id) {
      const { data, error } = await supabase
        .from('learning_trails')
        .delete()
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Forbidden or not found' }, 403);
      return json({ data });
    }

    return json({ error: 'Not Found' }, 404);
  } catch (err) {
    console.error('learning-trails-crud error:', err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
