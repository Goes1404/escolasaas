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

  let query = supabase
    .from('profiles')
    .select('*')
    .neq('id', studentId);

  // Exatamente a mesma query do app:
  query = query.or('profile_type.eq.teacher,profile_type.eq.staff');

  const { data: contacts, error: cError } = await query.order('name', { ascending: true });
  
  if (cError) {
    console.error("Query error:", cError);
    return;
  }

  console.log(`Query returned ${contacts.length} total contacts.`);

  const filteredByPolo = contacts?.filter(mentor => {
    if (['admin', 'teacher', 'staff'].includes(userType)) return true;
    
    const mentorInstitution = (mentor.institution || '').toLowerCase();
    
    if (!userInstitution) {
      return !mentorInstitution || mentorInstitution.includes('geral');
    }

    return mentorInstitution.includes(userInstitution) || mentorInstitution.includes('geral') || !mentorInstitution;
  }) || [];

  console.log(`After polo filter: ${filteredByPolo.length} contacts.`);
  
  const sec = filteredByPolo.find(c => c.name.includes("Secretaria"));
  console.log("Is secretary in list?", sec ? "Yes" : "No", sec ? { name: sec.name, profile_type: sec.profile_type, institution: sec.institution } : null);

  console.log("List of all returned contacts after filter:");
  filteredByPolo.forEach(c => console.log(`- ${c.name} (${c.profile_type}) | Institution: ${c.institution}`));
}

testQuery();
