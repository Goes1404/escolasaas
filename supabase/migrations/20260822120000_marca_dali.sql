-- Renomeia o tenant padrão para a marca do produto: Dalí.
--
-- O `default` não é uma escola cliente — é o branding que aparece quando o host
-- não resolve para nenhum subdomínio (localhost, *.vercel.app, domínio raiz).
-- Ou seja, é a cara do produto. Escolas reais continuam com o branding delas,
-- em linhas próprias.
--
-- O logo passa a ser SVG (`/logo-dali.svg`): é o mesmo desenho de
-- `src/components/LogoDali.tsx`, e vetor não borra no sidebar em tela retina.
-- `next.config` já tem `dangerouslyAllowSVG`, então o next/image aceita.
UPDATE public.tenants
SET name = 'Dalí',
    branding = branding
      || jsonb_build_object('appName', 'Dalí', 'logoUrl', '/logo-dali.svg')
WHERE slug = 'default';
