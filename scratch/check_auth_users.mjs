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

async function checkAuthUsers() {
  // Use the admin API to list users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error("Error listing auth users:", error.message);
    return;
  }

  const admins = users.filter(u => {
    const role = u.user_metadata?.role || '';
    const pt = u.user_metadata?.profile_type || '';
    return role.includes('admin') || role.includes('teacher') || pt.includes('admin') || pt.includes('teacher');
  });
  console.log(`Found ${admins.length} admin/teacher auth users:`);
  admins.forEach(u => {
    console.log(`- Email: ${u.email} | ID: ${u.id} | Metadata:`, JSON.stringify(u.user_metadata));
  });
}

checkAuthUsers();
