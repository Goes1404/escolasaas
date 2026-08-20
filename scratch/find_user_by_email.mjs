import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function findUser() {
  console.log("Fetching user adm@compromisso.com directly by ID f63ab716-d2a5-4e89-b870-9f58064f8e70...");
  
  const { data: { user }, error } = await supabase.auth.admin.getUserById('f63ab716-d2a5-4e89-b870-9f58064f8e70');

  if (error) {
    console.error("Error fetching user by ID:", error.message);
    return;
  }

  if (user) {
    console.log("SUCCESS! Found user metadata in Auth:");
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log("User not found by ID.");
  }
}

findUser();
