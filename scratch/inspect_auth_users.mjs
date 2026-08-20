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

async function run() {
  console.log("--- Listing all auth users ---");
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error:", error);
  } else {
    // Find Selma
    const selma = users.find(u => u.email === 'selmasoliveira@compromisso.com');
    console.log("Selma auth user:");
    console.log(selma);
    
    console.log("\nAll non-student auth users metadata:");
    users.forEach(u => {
      if (!u.email?.includes('aluno') && !u.email?.includes('student')) {
        console.log(u.email, "metadata:", u.user_metadata);
      }
    });
  }
}

run();
