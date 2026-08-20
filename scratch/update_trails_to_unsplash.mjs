import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CATEGORY_IMAGES = {
  'Matemática': 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800&auto=format&fit=crop',
  'Física': 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
  'Química': 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?q=80&w=800&auto=format&fit=crop',
  'Biologia': 'https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?q=80&w=800&auto=format&fit=crop',
  'História': 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop',
  'Geografia': 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop',
  'Atualidades': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop',
  'Literatura': 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?q=80&w=800&auto=format&fit=crop',
  'Português': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=800&auto=format&fit=crop',
  'Linguagens': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=800&auto=format&fit=crop',
  'Filosofia': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop',
  'Sociologia': 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=800&auto=format&fit=crop',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop'; // general learning/digital education image

async function updateTrails() {
  const { data: trails, error: fetchError } = await supabase
    .from('trails')
    .select('id, title, category, image_url');

  if (fetchError) {
    console.error('Error fetching trails:', fetchError);
    return;
  }

  console.log(`Found ${trails.length} trails. Updating images to stable Unsplash ones...`);

  for (const trail of trails) {
    const category = trail.category || '';
    const newImage = CATEGORY_IMAGES[category] || DEFAULT_IMAGE;
    
    console.log(`Updating "${trail.title}" (${category}) -> ${newImage.substring(0, 60)}...`);
    
    const { error: updateError } = await supabase
      .from('trails')
      .update({ image_url: newImage })
      .eq('id', trail.id);

    if (updateError) {
      console.error(`Error updating trail ${trail.id}:`, updateError);
    }
  }

  console.log('Finished updating trails images.');
}

updateTrails();
