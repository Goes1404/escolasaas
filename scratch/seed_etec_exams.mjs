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

const SUBJECT_IDS = {
  matematica: '5010b14f-3090-4d4f-a42a-b5561e7631ba',
  portugues: '913a4e67-ba5b-4bd7-b553-388347fa836d',
  historia: 'f1ae4302-277f-4a79-bcb3-356e07dec260',
  geografia: '8746ef47-005e-4336-a77d-a193656b18fa',
  biologia: 'c76661b6-3b70-4130-90aa-67a2a7d173fb',
  quimica: 'b0d17d51-d0fc-42ca-803e-e89b5fa97584',
  fisica: 'be240ade-64b8-4210-89e3-b45b01655b92'
};

const etecExams = [
  {
    title: 'ETEC 2024 - 1º Semestre',
    year: 2024,
    exam_type: 'etec',
    pdf_url: 'https://fatweb.s3.amazonaws.com/vestibulinhoetec/provas/1SEM-24.pdf',
    description: 'Exame de Admissão do Vestibulinho ETEC - 1º Semestre de 2024',
    questions: [
      {
        text: 'Uma cozinheira comprou uma lata de óleo de soja de 900 mL por R$ 9,00. Sabendo que 900 mL correspondem a 0,9 L, o valor cobrado por litro desse óleo é:',
        correct_answer: 'D',
        subject_id: SUBJECT_IDS.matematica,
        options: {
          a: 'R$ 8,10',
          b: 'R$ 9,50',
          c: 'R$ 9,90',
          d: 'R$ 10,00',
          e: 'R$ 11,00'
        }
      },
      {
        text: 'Leia o texto para responder à questão:\n"A Floresta Amazônica é a maior floresta tropical do mundo. Ela abriga uma rica biodiversidade e exerce um papel crucial na regulação do clima global."\nNo fragmento de texto apresentado, a palavra "biodiversidade" refere-se a:',
        correct_answer: 'B',
        subject_id: SUBJECT_IDS.portugues,
        options: {
          a: 'Apenas à variedade de plantas existentes na Amazônia.',
          b: 'Ao conjunto de todas as formas de vida (fauna, flora e micro-organismos) da região.',
          c: 'À abundância de recursos hídricos e minerais da floresta.',
          d: 'Ao processo de desmatamento controlado pelo governo.',
          e: 'À quantidade de carbono retida pelas copas das árvores.'
        }
      },
      {
        text: 'Considerando as fontes de energia renováveis e não renováveis, assinale a alternativa que apresenta apenas fontes limpas e totalmente renováveis de energia:',
        correct_answer: 'A',
        subject_id: SUBJECT_IDS.geografia,
        options: {
          a: 'Energia solar, energia eólica e biomassa.',
          b: 'Energia solar, carvão mineral e gás natural.',
          c: 'Petróleo, energia eólica e energia nuclear.',
          d: 'Biomassa, gás de xisto e hidrelétrica.',
          e: 'Energia geotérmica, urânio enriquecido e diesel.'
        }
      },
      {
        text: 'A Revolução Industrial inglesa, iniciada na segunda metade do século XVIII, promoveu profundas transformações socioeconômicas. Dentre elas, destaca-se:',
        correct_answer: 'C',
        subject_id: SUBJECT_IDS.historia,
        options: {
          a: 'A abolição imediata da propriedade privada da terra.',
          b: 'A redução das jornadas de trabalho e o fim do trabalho infantil de imediato.',
          c: 'O surgimento do proletariado urbano e a intensificação do êxodo rural.',
          d: 'A descentralização das indústrias para as áreas rurais inglesas.',
          e: 'O fortalecimento das corporações de ofício medievais.'
        }
      },
      {
        text: 'As plantas clorofiladas realizam um processo metabólico fundamental para a vida na Terra chamado fotossíntese. Nesse processo, quais reagentes químicos são consumidos pelas plantas na presença de luz solar?',
        correct_answer: 'E',
        subject_id: SUBJECT_IDS.biologia,
        options: {
          a: 'Gás oxigênio e glicose.',
          b: 'Gás nitrogênio e sais minerais.',
          c: 'Monóxido de carbono e metano.',
          d: 'Ozônio e gás hélio.',
          e: 'Dióxido de carbono (gás carbônico) e água.'
        }
      }
    ]
  },
  {
    title: 'ETEC 2023 - 2º Semestre',
    year: 2023,
    exam_type: 'etec',
    pdf_url: 'https://fatweb.s3.amazonaws.com/vestibulinhoetec/provas/2SEM-23.pdf',
    description: 'Exame de Admissão do Vestibulinho ETEC - 2º Semestre de 2023',
    questions: [
      {
        text: 'Um ciclista treina em uma pista circular de 400 metros de comprimento. Se ele der 15 voltas completas nessa pista, a distância total percorrida em quilômetros será de:',
        correct_answer: 'C',
        subject_id: SUBJECT_IDS.matematica,
        options: {
          a: '4,0 km',
          b: '5,5 km',
          c: '6,0 km',
          d: '8,0 km',
          e: '12,0 km'
        }
      },
      {
        text: 'Assinale a frase em que o uso da vírgula está gramaticalmente correto de acordo com a norma padrão da língua portuguesa:',
        correct_answer: 'A',
        subject_id: SUBJECT_IDS.portugues,
        options: {
          a: 'Os estudantes, motivados com a prova da ETEC, revisaram os conceitos antes do exame.',
          b: 'Os estudantes motivados, revisaram, os conceitos ontem.',
          c: 'Ontem à noite os alunos compraram, canetas, lápis e borrachas.',
          d: 'Nós queríamos viajar mas, a chuva atrasou o ônibus.',
          e: 'A diretora da escola estadual, disse que a biblioteca estaria fechada.'
        }
      },
      {
        text: 'O fenômeno conhecido como chuva ácida ocorre devido à emissão de poluentes na atmosfera, principalmente por indústrias e queima de combustíveis fósseis. Os principais gases causadores desse fenômeno são:',
        correct_answer: 'D',
        subject_id: SUBJECT_IDS.quimica,
        options: {
          a: 'Gás hélio e neônio.',
          b: 'Monóxido de carbono e metano.',
          c: 'Oxigênio e gás carbônico puro.',
          d: 'Óxidos de enxofre e óxidos de nitrogênio.',
          e: 'Metano e vapor de água pura.'
        }
      }
    ]
  },
  {
    title: 'ETEC 2023 - 1º Semestre',
    year: 2023,
    exam_type: 'etec',
    pdf_url: 'https://fatweb.s3.amazonaws.com/vestibulinhoetec/provas/1SEM-23.pdf',
    description: 'Exame de Admissão do Vestibulinho ETEC - 1º Semestre de 2023',
    questions: [
      {
        text: 'Em uma promoção de computadores, uma loja oferece 15% de desconto para pagamentos à vista. Se o preço original de um notebook é R$ 3.000,00, o valor pago à vista é:',
        correct_answer: 'B',
        subject_id: SUBJECT_IDS.matematica,
        options: {
          a: 'R$ 2.450,00',
          b: 'R$ 2.550,00',
          c: 'R$ 2.650,00',
          d: 'R$ 2.700,00',
          e: 'R$ 2.850,00'
        }
      },
      {
        text: 'Uma pequena esfera metálica é solta de uma certa altura e cai em direção ao solo sob ação exclusiva da gravidade (queda livre). Desprezando a resistência do ar, sobre o movimento da esfera é correto afirmar:',
        correct_answer: 'A',
        subject_id: SUBJECT_IDS.fisica,
        options: {
          a: 'A velocidade da esfera aumenta uniformemente durante a queda.',
          b: 'A aceleração da esfera diminui continuamente até atingir o chão.',
          c: 'A energia cinética da esfera diminui conforme ela ganha velocidade.',
          d: 'A força da gravidade deixa de atuar sobre a esfera na metade da queda.',
          e: 'A esfera atinge velocidade constante logo após ser solta.'
        }
      }
    ]
  }
];

async function seedEtec() {
  console.log("Seeding ETEC exams and questions into Supabase...");

  for (const item of etecExams) {
    console.log(`\n-----------------------------`);
    console.log(`Processing: ${item.title}`);

    // Check if exam already exists
    const { data: existingExam } = await supabase
      .from("exams")
      .select("id")
      .eq("title", item.title)
      .maybeSingle();

    let examId;
    if (existingExam) {
      console.log(`Exam "${item.title}" already exists. ID: ${existingExam.id}`);
      examId = existingExam.id;
    } else {
      const { data: newExam, error: examErr } = await supabase
        .from("exams")
        .insert({
          title: item.title,
          year: item.year,
          exam_type: item.exam_type,
          pdf_url: item.pdf_url,
          description: item.description
        })
        .select("id")
        .single();

      if (examErr || !newExam) {
        console.error(`Failed to create exam "${item.title}":`, examErr?.message);
        continue;
      }
      examId = newExam.id;
      console.log(`Created ETEC exam record with ID: ${examId}`);
    }

    // Insert questions
    console.log(`Inserting questions for "${item.title}"...`);
    for (let index = 0; index < item.questions.length; index++) {
      const q = item.questions[index];
      
      // Structure options array
      const optionsArray = Object.entries(q.options).map(([key, text]) => ({
        key: key.toUpperCase(),
        text: text
      }));

      // Insert question
      const { data: newQuestion, error: qErr } = await supabase
        .from("questions")
        .insert({
          question_text: q.text,
          correct_answer: q.correct_answer,
          options: optionsArray,
          subject_id: q.subject_id,
          year: item.year
        })
        .select("id")
        .single();

      if (qErr || !newQuestion) {
        console.error(`Failed to insert question ${index + 1}:`, qErr?.message);
        continue;
      }

      // Link question to the exam
      const { error: linkErr } = await supabase
        .from("exam_questions")
        .insert({
          exam_id: examId,
          question_id: newQuestion.id,
          order_index: index + 1
        });

      if (linkErr) {
        console.error(`Failed to link question ${index + 1} to exam:`, linkErr.message);
      } else {
        console.log(`Inserted & linked question ${index + 1} successfully.`);
      }
    }
  }

  console.log(`\n================================`);
  console.log("ETEC Seeding completed successfully!");
}

seedEtec();
