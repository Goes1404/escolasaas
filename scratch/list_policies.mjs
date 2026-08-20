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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listPolicies() {
  const { data, error } = await supabase.rpc('get_policies', {}, { head: false });
  // If rpc get_policies doesn't exist, we can run a query by using supabase.from() or checking pg_policies via custom rpc or similar.
  // Wait, let's just query pg_policies using an sql function if we have one, or check what policies exist.
  // But wait, we can also check if we can select from profiles table from a student client.
  const studentId = 'cca86ded-1c50-4f7d-909c-f3ba2223068e';
  console.log("Resetting Aluno Teste password to Compromisso2026! using Admin client...");
  const { error: resetError } = await supabase.auth.admin.updateUserById(studentId, {
    password: 'Compromisso2026!',
    email_confirm: true
  });
  if (resetError) {
    console.error("Failed to reset student password:", resetError);
    return;
  }
  console.log("Password reset success!");

  console.log("Checking if student client can query profiles...");
  // Let's create a client using the public anon key.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey);
  
  // Try to sign in as student
  const { data: authData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: 'aluno@compromisso.com',
    password: 'Compromisso2026!' // Or whatever the seed password is
  });

  if (signInError) {
    console.error("Sign in error:", signInError);
    return;
  }

  console.log("Signed in student ID:", authData.user.id);
  
  console.log("Querying direct_messages as student...");
  const { data: messages, error: mError } = await anonClient
    .from('direct_messages')
    .select('id, sender_id, receiver_id, content')
    .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`);

  console.log("Messages queried:", messages);
  console.log("Error querying messages:", mError);

  console.log("Querying profiles as student (exact chat query)...");
  
  // 1. Populate historyIds
  const historyIds = new Set();
  if (messages) {
    messages.forEach((msg) => {
      if (msg.sender_id !== studentId) historyIds.add(msg.sender_id);
      if (msg.receiver_id !== studentId) historyIds.add(msg.receiver_id);
    });
  }

  let query = anonClient
    .from('profiles')
    .select('*')
    .neq('id', studentId);

  if (historyIds.size > 0) {
    const idsList = Array.from(historyIds).map(id => `"${id}"`).join(',');
    query = query.or(`id.in.(${idsList}),profile_type.eq.teacher,profile_type.eq.staff`);
  } else {
    query = query.or('profile_type.eq.teacher,profile_type.eq.staff');
  }

  const { data: contacts, error: pError } = await query.order('name', { ascending: true });

  console.log("Contacts returned count:", contacts?.length);
  console.log("Contacts returned:", contacts?.map(c => ({ id: c.id, name: c.name, profile_type: c.profile_type, institution: c.institution })));
  console.log("Error querying profiles:", pError);

  console.log("Querying direct_messages for specific chat room...");
  const contactId = 'dca32c3e-6f47-417d-ac58-40903772c29e'; // Secretary ID
  const { data: msgs, error: msgsError } = await anonClient
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${studentId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${studentId})`)
    .order('created_at', { ascending: true });

  console.log("Chat room messages:", msgs);
  console.log("Error querying chat room messages:", msgsError);
}

listPolicies();
