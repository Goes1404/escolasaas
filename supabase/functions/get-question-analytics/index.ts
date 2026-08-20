import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// TODO: Add row level security for this function
// It should only be callable by authenticated users with the 'teacher' role.

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get total questions
    const { count: totalQuestions, error: totalError } = await supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // 2. Get question counts by subject
    const { data: questionsBySubject, error: bySubjectError } = await supabaseAdmin
      .from('questions')
      .select(`
        subjects ( id, name )
      `);
      
    if (bySubjectError) throw bySubjectError;

    const subjectCounts = questionsBySubject.reduce((acc, { subjects }) => {
        if (subjects) {
            acc[subjects.name] = (acc[subjects.name] || 0) + 1;
        }
        return acc;
    }, {});

    const questionsBySubjectFormatted = Object.keys(subjectCounts).map(subject => ({
        subject,
        count: subjectCounts[subject],
    })).sort((a, b) => b.count - a.count);


    // 3. Get answered questions ratio
    const { data: answeredQuestions, error: answeredError } = await supabaseAdmin
      .from('student_question_answers')
      .select('question_id', { count: 'exact' });

    if (answeredError) throw answeredError;

    const uniqueAnsweredQuestions = new Set(answeredQuestions.map(q => q.question_id));
    const answeredRatio = totalQuestions > 0 ? Math.round((uniqueAnsweredQuestions.size / totalQuestions) * 100) : 0;

    const payload = {
      totalQuestions,
      questionsBySubject: questionsBySubjectFormatted,
      answeredRatio,
    };

    return new Response(JSON.stringify(payload),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
