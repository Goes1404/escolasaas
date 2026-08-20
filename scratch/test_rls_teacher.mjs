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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client to reset password
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

// Public client to simulate browser session
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAsTeacher() {
  const email = 'paulobaraujo@compromisso.com';
  const password = 'Compromisso2026!';
  const userId = 'bcfcbfe9-0d0c-4b16-9724-6f106c12be03'; // ID from profiles table

  console.log(`Forcing password reset for ${email} to ${password}...`);
  const { data: uData, error: uError } = await adminSupabase.auth.admin.updateUserById(
    userId,
    { password: password }
  );

  if (uError) {
    console.error("Failed to reset password via admin client:", uError.message);
    return;
  }
  console.log("Password reset successfully.");

  console.log("\nSigning in as paulobaraujo@compromisso.com...");
  const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Sign in failed:", authError.message);
    return;
  }

  console.log("Sign in successful. User ID:", authData.user.id);

  // Run the 3 queries exactly as the component does
  console.log("\n--- Querying profiles ---");
  const { data: pData, error: pError } = await anonSupabase
    .from("profiles")
    .select("id, name, email, role, profile_type, course, institution, exam_target, last_access, is_financial_aid_eligible, xp_points, phone")
    .eq("role", "student");
    
  if (pError) {
    console.error("Profiles Query Error:", pError);
  } else {
    console.log(`Profiles query successful, returned ${pData?.length || 0} records.`);
    if (pData && pData.length > 0) {
      console.log("Sample profile:", pData[0]);
    }
  }

  console.log("\n--- Querying student_question_answers ---");
  const { data: aData, error: aError } = await anonSupabase
    .from("student_question_answers")
    .select(`
      id,
      is_correct,
      answered_at,
      student_id,
      selected_option,
      questions (
        id,
        subjects (
          id,
          name
        )
      )
    `);

  if (aError) {
    console.error("Answers Query Error:", aError);
  } else {
    console.log(`Answers query successful, returned ${aData?.length || 0} records.`);
    if (aData && aData.length > 0) {
      console.log("Sample answer:", aData[0]);
    }
  }

  console.log("\n--- Querying user_progress ---");
  const { data: prData, error: prError } = await anonSupabase
    .from("user_progress")
    .select("user_id, percentage");

  if (prError) {
    console.error("Progress Query Error:", prError);
  } else {
    console.log(`Progress query successful, returned ${prData?.length || 0} records.`);
    if (prData && prData.length > 0) {
      console.log("Sample progress:", prData[0]);
    }
  }
}

testAsTeacher();
