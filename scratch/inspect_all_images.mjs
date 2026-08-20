import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectAll() {
  // Inspect library_resources
  const { data: libraryData, error: libErr } = await supabase
    .from('library_resources')
    .select('id, title, category, image_url')
    .limit(10);
  
  if (libErr) console.error('Error fetching library_resources:', libErr);
  else console.log('Library resources:', JSON.stringify(libraryData, null, 2));

  // Inspect books if table exists
  try {
    const { data: booksData, error: booksErr } = await supabase
      .from('books')
      .select('id, title, image_url')
      .limit(10);
    if (booksErr) console.log('Error fetching books:', booksErr.message);
    else console.log('Books:', JSON.stringify(booksData, null, 2));
  } catch (e) {
    console.log('Books table query error:', e.message);
  }
}

inspectAll();
