import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getMonday(offsetWeeks = 0) {
  const d = new Date();
  // Adjust by offsetWeeks
  d.setDate(d.getDate() + offsetWeeks * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().slice(0, 10);
}

async function seed() {
  console.log("Seeding weekly themes...");

  const mondayPrev = getMonday(-1);
  const mondayCurr = getMonday(0);
  const mondayNext = getMonday(1);

  const themes = [
    {
      title: "Desafios para a valorização de comunidades e povos tradicionais no Brasil",
      description: "A redação deve abordar a preservação da cultura, os conflitos de terra e a importância social e ecológica dos povos tradicionais (indígenas, quilombolas, ribeirinhos).",
      source: "Compromisso Pedagógico ENEM",
      target: "enem",
      week_start: mondayPrev
    },
    {
      title: "Caminhos para combater a intolerância religiosa no Brasil",
      description: "Analise as causas históricas e sociais da intolerância religiosa no país, propondo medidas educativas e punitivas para garantir a liberdade de culto.",
      source: "Compromisso Pedagógico ENEM",
      target: "enem",
      week_start: mondayCurr
    },
    {
      title: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil",
      description: "Discuta a importância do registro civil de nascimento para assegurar direitos fundamentais como saúde, educação e assistência social no Brasil.",
      source: "Compromisso Pedagógico ENEM",
      target: "enem",
      week_start: mondayNext
    },
    {
      title: "A importância da sustentabilidade urbana no dia a dia da comunidade",
      description: "Aborde soluções sustentáveis para as cidades brasileiras, como mobilidade urbana limpa, coleta seletiva e hortas comunitárias.",
      source: "Compromisso Pedagógico ETEC",
      target: "etec",
      week_start: mondayCurr
    }
  ];

  for (const t of themes) {
    // Delete existing theme for the same week and target to avoid duplicates
    await supabase
      .from("essay_weekly_themes")
      .delete()
      .eq("week_start", t.week_start)
      .eq("target", t.target);

    const { data, error } = await supabase
      .from("essay_weekly_themes")
      .insert([t])
      .select();

    if (error) {
      console.error(`Error inserting theme "${t.title}":`, error.message);
    } else {
      console.log(`Inserted theme: "${t.title}" for week starting ${t.week_start} (${t.target})`);
    }
  }

  console.log("Seeding completed successfully!");
}

seed();
