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

async function checkProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, profile_type")
    .limit(100);

  if (error) {
    console.error("Error fetching profiles:", error.message);
    return;
  }

  console.log(`Found ${data.length} profiles:`);
  data.forEach((p) => {
    console.log(`- Name: ${p.name} | Email: ${p.email} | Role: ${p.role} | ProfileType: ${p.profile_type} | ID: ${p.id}`);
  });
}

checkProfiles();
