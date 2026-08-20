/**
 * Prepara contas que nunca foram usadas para a entrega de acesso pela secretaria.
 *
 * O problema que resolve: dos 580 alunos que nunca entraram, 273 estão com
 * `must_change_password: true` — para eles basta a secretaria entregar o e-mail
 * de login, porque a senha é a padrão e o sistema agora força a troca no
 * primeiro acesso. Os outros 307 não têm essa marca: ninguém sabe qual é a
 * senha deles, e por isso não há o que entregar.
 *
 * Este script iguala os dois grupos: define uma senha inicial conhecida e liga
 * a troca obrigatória. A conta só é tocada se NUNCA foi usada — quem já entrou
 * alguma vez fica de fora, porque teria a própria senha invalidada.
 *
 * Uso:
 *   npx tsx scripts/preparar-primeiro-acesso.ts --senha "SenhaInicial#2026"
 *   npx tsx scripts/preparar-primeiro-acesso.ts --senha "..." --aplicar
 *
 * A senha é obrigatória e não tem valor padrão de propósito: o `compromisso2026`
 * está documentado como pendência de rotação, e embutir qualquer senha no
 * código repetiria o mesmo erro.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const senha = args[args.indexOf('--senha') + 1];

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function validarSenha(s: string | undefined): string {
  if (!s || s.startsWith('--')) {
    throw new Error('Informe a senha inicial: --senha "SuaSenha#2026"');
  }
  // Os mesmos requisitos que a tela de primeiro acesso cobra do aluno. Sem
  // isto, a secretaria poderia definir uma senha que o próprio sistema recusa.
  const ok = s.length >= 8 && /[0-9]/.test(s) && /[!@#$%^&*(),.?":{}|<>]/.test(s);
  if (!ok) {
    throw new Error('A senha precisa ter 8+ caracteres, um número e um símbolo — os mesmos requisitos da tela do aluno.');
  }
  if (s.toLowerCase().includes('compromisso2026')) {
    throw new Error('Essa é a senha padrão antiga, documentada como pendência de rotação. Escolha outra.');
  }
  return s;
}

async function main() {
  const nova = validarSenha(senha);
  const supabase = db();

  // A lista vem de uma função no banco, e não de `auth.admin.listUsers()`:
  // essa API falha com "Database error finding users" ao paginar os 1.061
  // usuários deste projeto, e `last_sign_in_at` não existe em `profiles`.
  const { data: alvos, error } = await supabase.rpc('alunos_sem_primeiro_acesso');
  if (error) throw error;

  const lista = (alvos ?? []) as { id: string; full_name: string; email: string }[];

  console.log(`\nContas que nunca foram usadas e estão sem troca obrigatória: ${lista.length}`);
  console.log(lista.slice(0, 5).map(a => `  ${a.email}  ${a.full_name}`).join('\n'));
  if (lista.length > 5) console.log(`  … e mais ${lista.length - 5}`);

  if (!aplicar) {
    console.log('\n(simulação — nada foi alterado. Use --aplicar para executar.)');
    return;
  }

  let ok = 0;
  let erros = 0;
  for (const a of lista) {
    // Metadado lido individualmente: a Admin API SUBSTITUI o objeto inteiro,
    // então passar só `must_change_password` apagaria o resto.
    const { data: atual } = await supabase.auth.admin.getUserById(a.id);
    const meta = atual?.user?.user_metadata ?? {};

    const { error: e } = await supabase.auth.admin.updateUserById(a.id, {
      password: nova,
      user_metadata: { ...meta, must_change_password: true },
    });
    if (e) { erros++; console.error(`  ✗ ${a.email}: ${e.message}`); }
    else ok++;
  }

  console.log(`\n✓ ${ok} contas preparadas. ${erros ? `${erros} falharam.` : ''}`);
  console.log('A secretaria agora só precisa entregar o e-mail de login e esta senha.');
  console.log('No primeiro acesso, o aluno é obrigado a trocá-la.');
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
