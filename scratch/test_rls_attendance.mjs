import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envLocalPath = join(__dirname, '../.env.local');

if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

const TEACHER_EMAIL = 'priscilaprof@compromisso.com';
const TEACHER_ID = 'a9a19f90-649c-4277-ae61-b7ad66c84fd2';

const SECRETARY_EMAIL = 'secretaria@compromisso.com';
const SECRETARY_ID = 'dca32c3e-6f47-417d-ac58-40903772c29e';

const OTHER_TEACHER_ID = '85aa9608-8bac-4963-8774-9b3a8e99af9b'; // Lucas

async function run() {
  console.log("--- Resetting passwords for testing ---");
  await adminClient.auth.admin.updateUserById(TEACHER_ID, { password: 'Compromisso2026!', email_confirm: true });
  await adminClient.auth.admin.updateUserById(SECRETARY_ID, { password: 'Compromisso2026!', email_confirm: true });
  console.log("Passwords reset to Compromisso2026!");

  // ==========================================
  // TEST 1: Sign in as Teacher
  // ==========================================
  console.log(`\n=== TEST 1: Logging in as Teacher (${TEACHER_EMAIL}) ===`);
  const { data: teacherAuth, error: teacherLoginErr } = await anonClient.auth.signInWithPassword({
    email: TEACHER_EMAIL,
    password: 'Compromisso2026!'
  });
  if (teacherLoginErr) {
    console.error("Teacher login failed:", teacherLoginErr);
    return;
  }
  console.log("Teacher logged in successfully.");

  // Test 1a: Teacher creating a session for HERSELF
  console.log("Test 1a: Teacher creating a class session for HERSELF...");
  const { data: sess1, error: err1 } = await anonClient
    .from('class_sessions')
    .insert({
      title: 'Aula de Teste da Priscila (Própria)',
      subject: 'Matemática',
      class_label: '01',
      session_date: '2026-05-24',
      session_type: 'presencial',
      teacher_id: TEACHER_ID,
      teacher_name: 'Priscila Prof',
      checkin_code: 'PRIS',
      checkin_code_expires_at: new Date(Date.now() + 3600000).toISOString()
    })
    .select('id')
    .maybeSingle();

  if (err1) {
    console.error("❌ Failed to create own session:", err1.message);
  } else {
    console.log("✅ Success! Created session ID:", sess1.id);
    // Cleanup
    await adminClient.from('class_sessions').delete().eq('id', sess1.id);
  }

  // Test 1b: Teacher creating a session for ANOTHER teacher
  console.log("Test 1b: Teacher creating a class session for ANOTHER teacher...");
  const { error: err2 } = await anonClient
    .from('class_sessions')
    .insert({
      title: 'Aula de Teste (Outro Professor)',
      subject: 'Física',
      class_label: '01',
      session_date: '2026-05-24',
      session_type: 'presencial',
      teacher_id: OTHER_TEACHER_ID,
      teacher_name: 'Lucas',
      checkin_code: 'LUCA',
      checkin_code_expires_at: new Date(Date.now() + 3600000).toISOString()
    });

  if (err2) {
    console.log("✅ Blocked! (Expected). Error message:", err2.message);
  } else {
    console.log("❌ RLS Failure! Teacher was allowed to create a session for another teacher.");
  }

  // Sign out teacher
  await anonClient.auth.signOut();

  // ==========================================
  // TEST 2: Sign in as Secretary (Staff)
  // ==========================================
  console.log(`\n=== TEST 2: Logging in as Secretary (${SECRETARY_EMAIL}) ===`);
  const { data: secAuth, error: secLoginErr } = await anonClient.auth.signInWithPassword({
    email: SECRETARY_EMAIL,
    password: 'Compromisso2026!'
  });
  if (secLoginErr) {
    console.error("Secretary login failed:", secLoginErr);
    return;
  }
  console.log("Secretary logged in successfully.");

  // Test 2a: Secretary creating a session for another teacher
  console.log("Test 2a: Secretary creating a class session for teacher Lucas...");
  const { data: sess2, error: err3 } = await anonClient
    .from('class_sessions')
    .insert({
      title: 'Aula Agendada pela Secretaria',
      subject: 'Física',
      class_label: '01',
      session_date: '2026-05-24',
      session_type: 'presencial',
      teacher_id: OTHER_TEACHER_ID,
      teacher_name: 'Lucas',
      checkin_code: 'LUC2',
      checkin_code_expires_at: new Date(Date.now() + 3600000).toISOString()
    })
    .select('id')
    .maybeSingle();

  if (err3) {
    console.error("❌ Failed to create session:", err3.message);
  } else {
    console.log("✅ Success! Created session ID:", sess2.id);
    // Cleanup
    await adminClient.from('class_sessions').delete().eq('id', sess2.id);
  }

  // Sign out secretary
  await anonClient.auth.signOut();
}

run();
