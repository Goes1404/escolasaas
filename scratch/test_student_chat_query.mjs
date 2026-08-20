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

async function testQuery() {
  const studentId = 'cca86ded-1c50-4f7d-909c-f3ba2223068e';
  
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .single();

  if (pError || !profile) {
    console.error("Student profile not found:", pError);
    return;
  }

  console.log("Active profile:", { name: profile.name, profile_type: profile.profile_type, institution: profile.institution });

  const userType = (profile.profile_type || 'student').toLowerCase();
  const userInstitution = (profile.institution || '').toLowerCase().trim();

  // Replicar a busca de histórico de direct_messages do aluno
  const { data: chatHistory, error: historyError } = await supabase
    .from('direct_messages')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`);

  if (historyError) {
    console.error("Error fetching chat history:", historyError);
    return;
  }

  const historyIds = new Set();
  chatHistory.forEach((msg) => {
    if (msg.sender_id !== studentId) historyIds.add(msg.sender_id);
    if (msg.receiver_id !== studentId) historyIds.add(msg.receiver_id);
  });

  console.log("History IDs found:", Array.from(historyIds));

  let query = supabase
    .from('profiles')
    .select('*')
    .neq('id', studentId);

  if (historyIds.size > 0) {
    const idsList = Array.from(historyIds).map(id => `"${id}"`).join(',');
    const orString = `id.in.(${idsList}),profile_type.eq.teacher,profile_type.eq.staff`;
    console.log("Running query.or with string:", orString);
    query = query.or(orString);
  } else {
    query = query.or('profile_type.eq.teacher,profile_type.eq.staff');
  }

  const { data: contacts, error: cError } = await query.order('name', { ascending: true });
  
  if (cError) {
    console.error("Query error:", cError);
    return;
  }

  console.log(`Query returned ${contacts.length} total contacts.`);
}

testQuery();
