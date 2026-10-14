import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getTenantForHost } from '@/lib/get-tenant';
import { CONTACT_EMAIL } from '@/lib/site-contact';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como a plataforma coleta, usa e protege os dados de alunos, responsáveis e equipe (LGPD).',
};

/**
 * Política de privacidade (LGPD — Lei 13.709/2018).
 *
 * Papéis: a escola/cursinho é a CONTROLADORA (decide para que os dados servem);
 * a plataforma é a OPERADORA (trata os dados em nome da escola). O texto
 * descreve o que o sistema de fato faz hoje — se um recurso novo passar a
 * coletar outro dado, atualize esta página e a data no topo.
 *
 * ⚠️ Texto-base redigido a partir do funcionamento do sistema; antes de
 * divulgar como documento oficial, peça a revisão de um advogado.
 */
const ATUALIZADA_EM = '14 de outubro de 2026';

export default async function PrivacidadePage() {
  const tenant = await getTenantForHost((await headers()).get('host'));
  // Sem escola identificada pelo endereço (domínio do produto), o texto fala
  // da instituição em geral — o produto nunca é a controladora dos dados.
  const nome = tenant.branding.appName;
  const escola = nome && nome !== 'Dalí' ? nome : 'sua instituição de ensino';

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <p className="u-label">Documentos · LGPD</p>
        <h1 className="u-page-title text-3xl sm:text-4xl mt-2">Política de privacidade</h1>
        <p className="mt-3 text-sm text-muted-foreground">Atualizada em {ATUALIZADA_EM}.</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          <section>
            <h2>Quem cuida dos seus dados</h2>
            <p>
              A <strong>{escola}</strong> é a controladora dos dados: é ela quem decide como a plataforma é usada
              nas aulas e na secretaria. A plataforma atua como operadora, guardando e processando os dados em nome
              da escola, seguindo a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2>Quais dados usamos</h2>
            <ul>
              <li><strong>Cadastro:</strong> nome, login de acesso, turma, sala, turno, curso e objetivo (ENEM, ETEC, vestibulares).</li>
              <li><strong>Contato:</strong> telefone celular, usado só para recuperação de senha por SMS e avisos da escola.</li>
              <li><strong>Vida acadêmica:</strong> respostas de simulados e questões, redações enviadas e suas correções, boletim, frequência, metas, caderno de notas e progresso nas trilhas.</li>
              <li><strong>Secretaria:</strong> documentos enviados para matrícula, mensalidades e rematrícula (quando a escola usa esses módulos).</li>
              <li><strong>Uso da plataforma:</strong> quais telas são abertas e falhas técnicas, de forma agregada e sem conteúdo escrito pelo aluno, para melhorar o sistema.</li>
            </ul>
            <p className="mt-3">Não pedimos nem guardamos CPF para login ou recuperação de acesso.</p>
          </section>

          <section>
            <h2>Para que usamos</h2>
            <ul>
              <li>Permitir o acesso às aulas, simulados, redações e demais ferramentas de estudo.</li>
              <li>Acompanhar o desempenho do aluno e mostrar esse acompanhamento ao próprio aluno, aos professores, à coordenação e aos responsáveis autorizados.</li>
              <li>Corrigir redações com apoio de inteligência artificial (Aurora IA). O texto é enviado ao provedor de IA apenas para gerar a correção.</li>
              <li>Operar a secretaria: matrícula, documentos, mensalidades e comunicados.</li>
              <li>Manter a segurança da conta e recuperar o acesso quando a senha é esquecida.</li>
            </ul>
          </section>

          <section>
            <h2>Com quem compartilhamos</h2>
            <p>
              Não vendemos dados. Eles são acessados apenas pela equipe autorizada da escola e por fornecedores que
              tornam a plataforma possível: hospedagem e banco de dados, envio de SMS e o serviço de IA usado na
              correção de redações. Esses fornecedores só podem usar os dados para prestar o serviço.
            </p>
          </section>

          <section>
            <h2>Alunos menores de idade</h2>
            <p>
              Grande parte dos alunos é menor de 18 anos. Os dados de crianças e adolescentes são tratados no seu
              melhor interesse, com o consentimento ou ciência dos responsáveis colhidos pela escola na matrícula.
              Responsáveis podem acompanhar o desempenho pelo portal do responsável, por link enviado pela escola.
            </p>
          </section>

          <section>
            <h2>Como protegemos</h2>
            <ul>
              <li>Cada pessoa só enxerga o que o seu papel permite (aluno, professor, secretaria, coordenação), com regras aplicadas no próprio banco de dados.</li>
              <li>Conexão criptografada (HTTPS) em todo o acesso.</li>
              <li>Senhas nunca ficam visíveis para ninguém, nem para a equipe da escola.</li>
            </ul>
          </section>

          <section>
            <h2>Por quanto tempo guardamos</h2>
            <p>
              Enquanto o aluno estiver vinculado à escola e pelo tempo que a escola precisar para cumprir obrigações
              legais e acadêmicas (como histórico escolar). Depois disso, os dados são excluídos ou anonimizados.
            </p>
          </section>

          <section>
            <h2>Seus direitos</h2>
            <p>
              Você (ou o responsável, no caso de menores) pode pedir a qualquer momento: confirmação de que tratamos
              seus dados, acesso a eles, correção, exclusão quando a lei permitir, e informações sobre com quem foram
              compartilhados. Peça diretamente à secretaria da {escola} ou escreva para{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t pt-6 text-sm">
          <Link href="/login" className="font-semibold text-primary">← Voltar para o acesso</Link>
        </div>
      </div>
    </main>
  );
}
