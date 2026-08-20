import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearQuestions() {
  console.log('Iniciando limpeza do banco de questões...');

  try {
    // 1. Deletar respostas dos alunos (analytics)
    console.log('Limpando respostas de alunos...');
    const { error: err1 } = await supabase.from('student_question_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err1) throw err1;

    // 2. Deletar associações em provas
    console.log('Limpando associações de provas...');
    const { error: err2 } = await supabase.from('exam_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err2) throw err2;

    // 3. Deletar questões
    console.log('Limpando banco de questões principal...');
    const { error: err3 } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err3) throw err3;

    console.log('Banco de questões limpo com sucesso!');
  } catch (error) {
    console.error('Erro durante a limpeza:', error.message);
    process.exit(1);
  }
}

clearQuestions();
