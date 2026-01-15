import { NextRequest, NextResponse } from 'next/server';
import { supabase, type LexiconRow } from '@/lib/supabase';
import type { LexiconTerm } from '@/types';

const COLLECTION = 'lexicon';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
 * GET /api/lexicon/[id] - Get a specific term by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { id } = await context.params;

    const { data, error } = await supabase
      .from(COLLECTION)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Term not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ term: rowToTerm(data) });
  } catch (error) {
    console.error('Lexicon GET [id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch term' }, { status: 500 });
  }
}

/**
 * PUT /api/lexicon/[id] - Update a term
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    // Map camelCase to snake_case for Supabase
    const updates: Record<string, unknown> = {};
    if (body.definition !== undefined) updates.definition = body.definition;
    if (body.level !== undefined) updates.level = body.level;
    if (body.category !== undefined) updates.category = body.category;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.overview !== undefined) updates.overview = body.overview;
    if (body.keyConcepts !== undefined) updates.key_concepts = body.keyConcepts;
    if (body.examples !== undefined) updates.examples = body.examples;
    if (body.useCases !== undefined) updates.use_cases = body.useCases;
    if (body.commonMistakes !== undefined) updates.common_mistakes = body.commonMistakes;
    if (body.relatedTerms !== undefined) updates.related_terms = body.relatedTerms;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(COLLECTION)
      .update(updates)
      .eq('id', id)
      .select('term')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Term not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Term "${data.term}" updated successfully`,
    });
  } catch (error) {
    console.error('Lexicon PUT error:', error);
    return NextResponse.json({ error: 'Failed to update term' }, { status: 500 });
  }
}

/**
 * DELETE /api/lexicon/[id] - Delete a term
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { id } = await context.params;

    // Get term name before deleting
    const { data: existing } = await supabase
      .from(COLLECTION)
      .select('term')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from(COLLECTION)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Term "${existing.term}" deleted successfully`,
    });
  } catch (error) {
    console.error('Lexicon DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete term' }, { status: 500 });
  }
}
