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

async function inspect() {
  console.log("Fetching Aluno Teste profile...");
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, name, email, profile_type')
    .ilike('name', '%Aluno Teste%');

  if (pError || !profiles || profiles.length === 0) {
    console.error("No student found with name 'Aluno Teste'. Profiles list:", profiles, pError);
    return;
  }

  const student = profiles[0];
  console.log("Found student:", student);

  console.log("Fetching unread messages for student ID:", student.id);
  const { data: messages, error: mError } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('receiver_id', student.id)
    .eq('is_read', false);

  if (mError) {
    console.error("Error fetching messages:", mError);
    return;
  }

  console.log(`Found ${messages.length} unread messages:`);
  for (const msg of messages) {
    const { data: sender } = await supabase
      .from('profiles')
      .select('name, profile_type')
      .eq('id', msg.sender_id)
      .single();
    
    console.log(`- From: ${sender?.name} (${sender?.profile_type}) | Content: "${msg.content}"`);
  }
}

inspect();
