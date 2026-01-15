import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using static lexicon data only.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Type for lexicon entries in Supabase
export interface LexiconRow {
  id: string;
  term: string;
  slug: string;
  definition: string;
  level: 'novice' | 'intermediate' | 'expert' | 'theoretical';
  category: string;
  tags: string[];
  overview: string | null;
  key_concepts: Array<{ title: string; description: string }> | null;
  examples: Array<{ language: string; title: string; code: string; explanation: string }> | null;
  use_cases: string[] | null;
  common_mistakes: string[] | null;
  related_terms: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}
