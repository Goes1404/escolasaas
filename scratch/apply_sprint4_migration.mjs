import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sql = fs.readFileSync(
  path.join(__dirname, 'sprint4_migrations.sql'),
  'utf-8'
);

const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 10 && !s.startsWith('--'));

console.log(`\n🚀 Aplicando Sprint 4 migration: ${statements.length} statements\n`);

let ok = 0, fail = 0;

for (const stmt of statements) {
  const preview = stmt.slice(0, 80).replace(/\n/g, ' ');
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
    if (error) {
      console.log(`  ⚠️  ${preview}...`);
      console.log(`     Erro: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅ ${preview}...`);
      ok++;
    }
  } catch (e) {
    console.log(`  ❌ ${preview}...`);
    console.log(`     ${e.message}`);
    fail++;
  }
}

console.log(`\n📊 Resultado: ${ok} ok, ${fail} falhou\n`);
