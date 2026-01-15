'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, isSupabaseConfigured, TABLES } from './supabase-client';
import { staticLexicon } from './lexicon-data';
import type { LexiconTerm, KnowledgeLevel } from '@/types';

/**
 * Connection status for Supabase
 */
export interface SupabaseStatus {
  configured: boolean;
  connected: boolean;
  error: string | null;
}

/**
 * Hook to get Supabase connection status
 */
export function useSupabaseStatus(): SupabaseStatus {
  const [status, setStatus] = useState<SupabaseStatus>({
    configured: false,
    connected: false,
    error: null,
  });

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setStatus(prev => ({ ...prev, configured }));

    if (!configured) {
      setStatus({
        configured: false,
        connected: false,
        error: 'Supabase not configured. Add environment variables to enable cloud sync.',
      });
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setStatus({
        configured: true,
        connected: false,
        error: 'Failed to initialize Supabase client.',
      });
      return;
    }

    // Test connection with a simple query
    const testConnection = async () => {
      try {
        const { error } = await client
          .from(TABLES.LEXICON)
          .select('id')
          .limit(1);

        if (error) throw error;

        setStatus({
          configured: true,
          connected: true,
          error: null,
        });
      } catch (err) {
        setStatus({
          configured: true,
          connected: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        });
      }
    };

    testConnection();
  }, []);

  return status;
}

// Re-export for backwards compatibility
export const useFirebaseStatus = useSupabaseStatus;

/**
 * Convert Supabase row to LexiconTerm
 */
function rowToTerm(row: Record<string, unknown>): LexiconTerm {
  return {
    id: row.id as string,
    term: row.term as string,
    slug: row.slug as string,
    definition: row.definition as string,
    level: row.level as KnowledgeLevel,
    category: row.category as string | undefined,
    tags: row.tags as string[] | undefined,
    overview: row.overview as string | undefined,
    keyConcepts: row.key_concepts as LexiconTerm['keyConcepts'],
    examples: row.examples as LexiconTerm['examples'],
    useCases: row.use_cases as string[] | undefined,
    commonMistakes: row.common_mistakes as string[] | undefined,
    relatedTerms: row.related_terms as string[] | undefined,
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

/**
 * Hook for lexicon data with Supabase
 * Falls back to static data when Supabase is not configured
 */
export function useLexicon() {
  const [terms, setTerms] = useState<LexiconTerm[]>(staticLexicon);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setTerms(staticLexicon);
      setLoading(false);
      setIsCloudSynced(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setTerms(staticLexicon);
      setLoading(false);
      setError('Failed to initialize Supabase');
      return;
    }

    // Fetch initial data
    const fetchData = async () => {
      try {
        const { data, error: fetchError } = await client
          .from(TABLES.LEXICON)
          .select('*')
          .order('term');

        if (fetchError) throw fetchError;

        if (!data || data.length === 0) {
          setTerms(staticLexicon);
        } else {
          const cloudTerms = data.map(rowToTerm);
          const merged = mergeTerms(staticLexicon, cloudTerms);
          setTerms(merged);
        }

        setLoading(false);
        setIsCloudSynced(true);
        setError(null);
      } catch (err) {
        console.error('Supabase fetch error:', err);
        setTerms(staticLexicon);
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Fetch failed');
        setIsCloudSynced(false);
      }
    };

    fetchData();

    // Set up real-time subscription
    const channel = client
      .channel('lexicon-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.LEXICON },
        () => {
          // Refetch on any change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return { terms, loading, error, isCloudSynced };
}

/**
 * Merge static and cloud terms (cloud takes precedence for matching terms)
 */
function mergeTerms(staticTerms: LexiconTerm[], cloudTerms: LexiconTerm[]): LexiconTerm[] {
  const cloudMap = new Map(cloudTerms.map(t => [t.term.toLowerCase(), t]));
  const merged: LexiconTerm[] = [];

  merged.push(...cloudTerms);

  for (const staticTerm of staticTerms) {
    if (!cloudMap.has(staticTerm.term.toLowerCase())) {
      merged.push(staticTerm);
    }
  }

  return merged.sort((a, b) => a.term.localeCompare(b.term));
}

/**
 * Hook for adding/updating terms
 */
export function useLexiconMutations() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addTerm = useCallback(async (
    term: Omit<LexiconTerm, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> => {
    if (!isSupabaseConfigured()) {
      setSubmitError('Supabase not configured. Cannot save to cloud.');
      return null;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSubmitError('Supabase not initialized.');
      return null;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const slug = term.term.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const { data, error } = await client
        .from(TABLES.LEXICON)
        .insert({
          term: term.term,
          slug,
          definition: term.definition,
          level: term.level,
          category: term.category || 'general',
          tags: term.tags || [],
          overview: term.overview,
          key_concepts: term.keyConcepts,
          examples: term.examples,
          use_cases: term.useCases,
          common_mistakes: term.commonMistakes,
          related_terms: term.relatedTerms,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add term';
      setSubmitError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const updateTerm = useCallback(async (
    id: string,
    updates: Partial<LexiconTerm>
  ): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      setSubmitError('Supabase not configured.');
      return false;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSubmitError('Supabase not initialized.');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.definition !== undefined) dbUpdates.definition = updates.definition;
      if (updates.level !== undefined) dbUpdates.level = updates.level;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.overview !== undefined) dbUpdates.overview = updates.overview;
      if (updates.keyConcepts !== undefined) dbUpdates.key_concepts = updates.keyConcepts;
      if (updates.examples !== undefined) dbUpdates.examples = updates.examples;

      const { error } = await client
        .from(TABLES.LEXICON)
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update term';
      setSubmitError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const deleteTerm = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      setSubmitError('Supabase not configured.');
      return false;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSubmitError('Supabase not initialized.');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await client
        .from(TABLES.LEXICON)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete term';
      setSubmitError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    addTerm,
    updateTerm,
    deleteTerm,
    isSubmitting,
    submitError,
    clearError: () => setSubmitError(null),
  };
}

/**
 * Submission data for pending review
 */
export interface TermSubmission {
  id?: string;
  term: string;
  definition: string;
  level: KnowledgeLevel;
  category?: string;
  tags?: string[];
  submittedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: Date;
  reviewedAt?: Date;
}

/**
 * Hook for term submissions (pending review queue)
 */
export function useSubmissions() {
  const [submissions, setSubmissions] = useState<TermSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    const fetchSubmissions = async () => {
      try {
        const { data, error } = await client
          .from(TABLES.SUBMISSIONS)
          .select('*')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false });

        if (error) throw error;

        const subs = (data || []).map(row => ({
          id: row.id,
          term: row.term,
          definition: row.definition,
          level: row.level,
          category: row.category,
          tags: row.tags,
          submittedBy: row.submitted_by,
          status: row.status,
          submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
          reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
        })) as TermSubmission[];

        setSubmissions(subs);
        setLoading(false);
      } catch (err) {
        console.error('Submissions fetch error:', err);
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

  const submitTerm = useCallback(async (
    term: Omit<TermSubmission, 'id' | 'status' | 'submittedAt'>
  ): Promise<string | null> => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured. Submission not saved.');
      return null;
    }

    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from(TABLES.SUBMISSIONS)
        .insert({
          term: term.term,
          definition: term.definition,
          level: term.level,
          category: term.category,
          tags: term.tags,
          submitted_by: term.submittedBy,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('Failed to submit term:', err);
      return null;
    }
  }, []);

  return { submissions, loading, submitTerm };
}
