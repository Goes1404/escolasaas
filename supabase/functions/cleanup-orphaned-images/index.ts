// Edge Function: cleanup-orphaned-images
// Remove arquivos do bucket 'question-images' que não têm referência em questions.image_url
// Pode ser chamada manualmente ou agendada via pg_cron / cron externo.
//
// Agendamento sugerido (rodar no SQL Editor do Supabase):
//   select cron.schedule('cleanup-images-nightly', '0 3 * * *',
//     $$select net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-orphaned-images',
//       headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb)$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'question-images';

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Lista todos os arquivos no bucket
  const { data: files, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 });

  if (listErr) {
    return Response.json({ error: listErr.message }, { status: 500 });
  }

  if (!files || files.length === 0) {
    return Response.json({ deleted: 0, message: 'Bucket já está limpo.' });
  }

  // 2. Busca todos os caminhos de imagem referenciados no banco
  const { data: questions, error: dbErr } = await supabase
    .from('questions')
    .select('image_url')
    .not('image_url', 'is', null);

  if (dbErr) {
    return Response.json({ error: dbErr.message }, { status: 500 });
  }

  // Extrai só o nome do arquivo da URL pública
  const referencedPaths = new Set(
    (questions ?? [])
      .map((q: { image_url: string }) => q.image_url?.split(`${BUCKET}/`)[1])
      .filter(Boolean)
  );

  // 3. Identifica órfãos
  const orphans = files
    .filter(f => f.name && !referencedPaths.has(f.name))
    .map(f => f.name);

  if (orphans.length === 0) {
    return Response.json({ deleted: 0, message: 'Nenhum arquivo órfão encontrado.' });
  }

  // 4. Remove órfãos em lote
  const { error: removeErr } = await supabase.storage
    .from(BUCKET)
    .remove(orphans);

  if (removeErr) {
    return Response.json({ error: removeErr.message }, { status: 500 });
  }

  return Response.json({
    deleted: orphans.length,
    files: orphans,
    message: `${orphans.length} arquivo(s) órfão(s) removido(s) com sucesso.`
  });
});
