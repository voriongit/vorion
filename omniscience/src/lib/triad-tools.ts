/**
 * Triad AI Tools - Lexicon Management Capabilities
 *
 * These tools allow the Nexus Triad to read, write, edit, and manage
 * the lexicon knowledge base as its domain.
 */

import { tool } from 'ai';
import { z } from 'zod';

// Use production URL or fallback to localhost for dev
const getBaseUrl = () => {
  // Production domain
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://learn.vorion.org';
  }
  // Preview deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Custom override
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // Local development
  return 'http://localhost:3001';
};

const BASE_URL = getBaseUrl();

/**
 * Search the lexicon for terms
 */
export const searchLexiconTool = tool({
  description: 'Search the AI lexicon knowledge base for terms matching a query. Use this to find existing definitions before creating new ones.',
  inputSchema: z.object({
    query: z.string().describe('Search query to find matching terms'),
    category: z.string().optional().describe('Filter by category (e.g., "core", "safety", "orchestration")'),
  }),
  execute: async ({ query, category }) => {
    try {
      const params = new URLSearchParams({ search: query });
      if (category) params.append('category', category);

      const res = await fetch(`${BASE_URL}/api/lexicon?${params}`);
      const data = await res.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        count: data.count,
        terms: data.terms?.slice(0, 10).map((t: Record<string, unknown>) => ({
          id: t.id,
          term: t.term,
          definition: t.definition,
          level: t.level,
          category: t.category,
        })),
      };
    } catch (error) {
      return { success: false, error: 'Failed to search lexicon' };
    }
  },
});

/**
 * Get a specific term by name
 */
export const getTermTool = tool({
  description: 'Get the full details of a specific lexicon term by its exact name. Use this to read complete definitions and metadata.',
  inputSchema: z.object({
    termName: z.string().describe('Exact name of the term to retrieve'),
  }),
  execute: async ({ termName }) => {
    try {
      const res = await fetch(`${BASE_URL}/api/lexicon?term=${encodeURIComponent(termName)}`);
      const data = await res.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      if (!data.term) {
        return { success: false, error: `Term "${termName}" not found` };
      }

      return { success: true, term: data.term };
    } catch (error) {
      return { success: false, error: 'Failed to get term' };
    }
  },
});

/**
 * Create a new lexicon term
 */
export const createTermTool = tool({
  description: 'Create a new term in the AI lexicon. Use this to add new AI concepts, technologies, or terminology that should be part of the knowledge base.',
  inputSchema: z.object({
    term: z.string().describe('The term/concept name'),
    definition: z.string().describe('Clear, concise definition of the term'),
    level: z.enum(['novice', 'intermediate', 'expert', 'theoretical'])
      .describe('Knowledge level: novice (basic), intermediate (practical), expert (advanced), theoretical (research-level)'),
    category: z.string().optional()
      .describe('Category for grouping (e.g., "core", "architecture", "safety", "orchestration", "protocols", "techniques")'),
    tags: z.array(z.string()).optional()
      .describe('Tags for searchability'),
    overview: z.string().optional()
      .describe('Extended explanation beyond the definition'),
  }),
  execute: async ({ term, definition, level, category, tags, overview }) => {
    try {
      const res = await fetch(`${BASE_URL}/api/lexicon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, definition, level, category, tags, overview }),
      });

      const data = await res.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        id: data.id,
        message: data.message,
      };
    } catch (error) {
      return { success: false, error: 'Failed to create term' };
    }
  },
});

/**
 * Update an existing term
 */
export const updateTermTool = tool({
  description: 'Update an existing lexicon term. Use this to improve definitions, add context, fix errors, or enhance term metadata.',
  inputSchema: z.object({
    termId: z.string().describe('The ID of the term to update'),
    updates: z.object({
      definition: z.string().optional().describe('Updated definition'),
      level: z.enum(['novice', 'intermediate', 'expert', 'theoretical']).optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      overview: z.string().optional(),
      relatedTerms: z.array(z.string()).optional().describe('Names of related terms'),
    }).describe('Fields to update'),
  }),
  execute: async ({ termId, updates }) => {
    try {
      const res = await fetch(`${BASE_URL}/api/lexicon/${termId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: 'Failed to update term' };
    }
  },
});

/**
 * Delete a term (use with caution)
 */
export const deleteTermTool = tool({
  description: 'Delete a term from the lexicon. Use this sparingly - only for removing duplicate, incorrect, or obsolete entries.',
  inputSchema: z.object({
    termId: z.string().describe('The ID of the term to delete'),
    reason: z.string().describe('Reason for deletion (for audit purposes)'),
  }),
  execute: async ({ termId, reason }) => {
    try {
      console.log(`Triad deleting term ${termId}. Reason: ${reason}`);

      const res = await fetch(`${BASE_URL}/api/lexicon/${termId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: 'Failed to delete term' };
    }
  },
});

/**
 * All Triad lexicon management tools
 */
export const triadLexiconTools = {
  search_lexicon: searchLexiconTool,
  get_term: getTermTool,
  create_term: createTermTool,
  update_term: updateTermTool,
  delete_term: deleteTermTool,
};
