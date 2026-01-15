import { NextRequest, NextResponse } from 'next/server';
import { supabase, type LexiconRow } from '@/lib/supabase';
import { staticLexicon } from '@/lib/lexicon-data';
import type { LexiconTerm } from '@/types';

const COLLECTION = 'lexicon';

// Convert Supabase row to LexiconTerm
function rowToTerm(row: LexiconRow): LexiconTerm {
  return {
    id: row.id,
    term: row.term,
    slug: row.slug,
    definition: row.definition,
    level: row.level,
    category: row.category,
    tags: row.tags,
    overview: row.overview || undefined,
    keyConcepts: row.key_concepts || undefined,
    examples: row.examples || undefined,
    useCases: row.use_cases || undefined,
    commonMistakes: row.common_mistakes || undefined,
    relatedTerms: row.related_terms || undefined,
  };
}

/**
 * GET /api/lexicon - List all terms or search
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  const term = searchParams.get('term'); // Get specific term by name

  // If Supabase is not configured, fall back to static data
  if (!supabase) {
    let terms = [...staticLexicon];

    // If searching for specific term by name
    if (term) {
      const found = terms.find(t => t.term.toLowerCase() === term.toLowerCase());
      return NextResponse.json({ term: found || null });
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (category) {
      terms = terms.filter(t => t.category === category);
    }

    return NextResponse.json({ terms, count: terms.length, source: 'static' });
  }

  try {
    // If searching for specific term by name
    if (term) {
      const { data, error } = await supabase
        .from(COLLECTION)
        .select('*')
        .ilike('term', term)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return NextResponse.json({
        term: data ? rowToTerm(data) : null
      });
    }

    // Build query
    let query = supabase.from(COLLECTION).select('*');

    // Full-text search
    if (search) {
      query = query.or(`term.ilike.%${search}%,definition.ilike.%${search}%`);
    }

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Order by term
    query = query.order('term');

    const { data, error } = await query;

    if (error) throw error;

    const terms = (data || []).map(rowToTerm);
    return NextResponse.json({ terms, count: terms.length, source: 'supabase' });
  } catch (error) {
    console.error('Lexicon GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terms' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lexicon - Create a new term
 */
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured. Cannot create terms.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { term, definition, level, category, tags, overview, keyConcepts, examples } = body;

    if (!term || !definition || !level) {
      return NextResponse.json(
        { error: 'Missing required fields: term, definition, level' },
        { status: 400 }
      );
    }

    // Check if term already exists
    const { data: existing } = await supabase
      .from(COLLECTION)
      .select('id')
      .ilike('term', term)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Term "${term}" already exists`, existingId: existing.id },
        { status: 409 }
      );
    }

    // Create the term
    const slug = term.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data, error } = await supabase
      .from(COLLECTION)
      .insert({
        term,
        slug,
        definition,
        level,
        category: category || 'general',
        tags: tags || [],
        overview,
        key_concepts: keyConcepts,
        examples,
        created_by: 'triad-ai',
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: data.id,
      message: `Term "${term}" created successfully`,
    });
  } catch (error) {
    console.error('Lexicon POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create term' },
      { status: 500 }
    );
  }
}
