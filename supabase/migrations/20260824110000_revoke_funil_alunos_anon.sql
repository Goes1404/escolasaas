-- O security advisor aponta a view funil_alunos exposta a anon (ela junta
-- auth.users). A migration 20260811050000 revogou de authenticated mas
-- esqueceu anon/PUBLIC. O caminho de leitura para staff é a RPC
-- obter_funil_alunos(), que continua funcionando.
REVOKE SELECT ON public.funil_alunos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.funil_alunos TO service_role;
