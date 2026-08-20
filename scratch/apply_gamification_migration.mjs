/**
 * apply_gamification_migration.mjs
 * Applies the gamification migration directly via Supabase REST API
 */
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
  path.join(__dirname, '..', 'supabase', 'migrations', '20260706000000_create_gamification.sql'),
  'utf-8'
);

// Split into individual statements and run each
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 10 && !s.startsWith('--'));

console.log(`\n🚀 Aplicando migration: ${statements.length} statements\n`);

let ok = 0, fail = 0;

for (const stmt of statements) {
  const preview = stmt.slice(0, 80).replace(/\n/g, ' ');
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' }).single();
    if (error) {
      // Try direct query if RPC not available
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
