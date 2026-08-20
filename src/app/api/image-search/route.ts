import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

const CATEGORY_KEYWORDS: Record<string, string> = {
  'Matemática': 'mathematics education',
  'Física': 'physics science',
  'Química': 'chemistry laboratory',
  'Biologia': 'biology nature science',
  'História': 'history education ancient',
  'Geografia': 'geography world map',
  'Português': 'language books reading',
  'Linguagens': 'language arts literature',
  'Literatura': 'literature books',
  'Filosofia': 'philosophy thinking',
  'Sociologia': 'sociology society people',
  'Atualidades': 'current events news',
};

function buildQuery(title: string, category: string): string {
  const categoryBase = CATEGORY_KEYWORDS[category] ?? category;

  const cleanTitle = title
    .replace(/^aula\s+\d+\s*[-–:]\s*/i, '')
    .replace(/^exercícios?\s+da\s+aula\s+\d+\s*/i, 'exercises ')
    .replace(/^introdução\s+a[o]?\s+/i, '')
    .replace(/pt\.\s*\d+/i, '')
    .trim()
    .slice(0, 40);

  return `${categoryBase} ${cleanTitle}`.trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? '';
  const category = searchParams.get('category') ?? '';

  if (!PIXABAY_KEY) {
    return NextResponse.json({ error: 'PIXABAY_API_KEY não configurada' }, { status: 500 });
  }

  const query = buildQuery(title, category);
  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=5&safesearch=true&min_width=800`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);

    const data = await res.json();
    const hits: any[] = data.hits ?? [];

    if (hits.length === 0) {
      log.debug('image_search.no_results', { query, title, category });
      return NextResponse.json({ url: null });
    }

    const pick = hits[Math.floor(Math.random() * hits.length)];
    return NextResponse.json({ url: pick.largeImageURL as string, query });
  } catch (err: any) {
    log.error('image_search.fetch_failed', err, { query, title, category });
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
