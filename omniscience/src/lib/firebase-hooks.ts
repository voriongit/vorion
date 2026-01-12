'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured, COLLECTIONS } from './firebase';
import { staticLexicon } from './lexicon-data';
import type { LexiconTerm, KnowledgeLevel } from '@/types';

/**
 * Connection status for Firebase
 */
export interface FirebaseStatus {
  configured: boolean;
  connected: boolean;
  error: string | null;
}

/**
 * Hook to get Firebase connection status
 */
export function useFirebaseStatus(): FirebaseStatus {
  const [status, setStatus] = useState<FirebaseStatus>({
    configured: false,
    connected: false,
    error: null,
  });

  useEffect(() => {
    const configured = isFirebaseConfigured();
    setStatus(prev => ({ ...prev, configured }));

    if (!configured) {
      setStatus({
        configured: false,
        connected: false,
        error: 'Firebase not configured. Add environment variables to enable cloud sync.',
      });
      return;
    }

    const db = getDb();
    if (!db) {
      setStatus({
        configured: true,
        connected: false,
        error: 'Failed to initialize Firestore.',
      });
      return;
    }

    // Test connection with a simple query
    const testConnection = async () => {
      try {
        const testQuery = query(
          collection(db, COLLECTIONS.LEXICON),
          orderBy('term'),
        );
        await getDocs(testQuery);
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

/**
 * Convert Firestore document to LexiconTerm
 */
function docToTerm(id: string, data: Record<string, unknown>): LexiconTerm {
  return {
    id,
    term: data.term as string,
    definition: data.definition as string,
    level: data.level as KnowledgeLevel,
    category: data.category as string | undefined,
    tags: data.tags as string[] | undefined,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : undefined,
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : undefined,
  };
}

/**
 * Hook for real-time lexicon sync with Firestore
 * Falls back to static data when Firebase is not configured
 */
export function useLexicon() {
  const [terms, setTerms] = useState<LexiconTerm[]>(staticLexicon);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Use static data when Firebase is not configured
      setTerms(staticLexicon);
      setLoading(false);
      setIsCloudSynced(false);
      return;
    }

    const db = getDb();
    if (!db) {
      setTerms(staticLexicon);
      setLoading(false);
      setError('Failed to initialize Firestore');
      return;
    }

    // Subscribe to real-time updates
    const q = query(
      collection(db, COLLECTIONS.LEXICON),
      orderBy('term', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          // No cloud data yet, use static lexicon
          setTerms(staticLexicon);
        } else {
          const cloudTerms = snapshot.docs.map(doc =>
            docToTerm(doc.id, doc.data())
          );
          // Merge with static lexicon (cloud takes precedence)
          const merged = mergeTerms(staticLexicon, cloudTerms);
          setTerms(merged);
        }
        setLoading(false);
        setIsCloudSynced(true);
        setError(null);
      },
      (err) => {
        console.error('Firestore subscription error:', err);
        setTerms(staticLexicon);
        setLoading(false);
        setError(err.message);
        setIsCloudSynced(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { terms, loading, error, isCloudSynced };
}

/**
 * Merge static and cloud terms (cloud takes precedence for matching terms)
 */
function mergeTerms(staticTerms: LexiconTerm[], cloudTerms: LexiconTerm[]): LexiconTerm[] {
  const cloudMap = new Map(cloudTerms.map(t => [t.term.toLowerCase(), t]));
  const merged: LexiconTerm[] = [];

  // Add all cloud terms
  merged.push(...cloudTerms);

  // Add static terms that don't exist in cloud
  for (const staticTerm of staticTerms) {
    if (!cloudMap.has(staticTerm.term.toLowerCase())) {
      merged.push(staticTerm);
    }
  }

  return merged.sort((a, b) => a.term.localeCompare(b.term));
}

/**
 * Hook for adding/updating terms in Firestore
 */
export function useLexiconMutations() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addTerm = useCallback(async (term: Omit<LexiconTerm, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    if (!isFirebaseConfigured()) {
      setSubmitError('Firebase not configured. Cannot save to cloud.');
      return null;
    }

    const db = getDb();
    if (!db) {
      setSubmitError('Firestore not initialized.');
      return null;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.LEXICON), {
        ...term,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add term';
      setSubmitError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const updateTerm = useCallback(async (id: string, updates: Partial<LexiconTerm>): Promise<boolean> => {
    if (!isFirebaseConfigured()) {
      setSubmitError('Firebase not configured.');
      return false;
    }

    const db = getDb();
    if (!db) {
      setSubmitError('Firestore not initialized.');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const docRef = doc(db, COLLECTIONS.LEXICON, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
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
    if (!isFirebaseConfigured()) {
      setSubmitError('Firebase not configured.');
      return false;
    }

    const db = getDb();
    if (!db) {
      setSubmitError('Firestore not initialized.');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await deleteDoc(doc(db, COLLECTIONS.LEXICON, id));
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
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const db = getDb();
    if (!db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.SUBMISSIONS),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate(),
          reviewedAt: doc.data().reviewedAt?.toDate(),
        })) as TermSubmission[];
        setSubmissions(subs);
        setLoading(false);
      },
      (err) => {
        console.error('Submissions subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const submitTerm = useCallback(async (
    term: Omit<TermSubmission, 'id' | 'status' | 'submittedAt'>
  ): Promise<string | null> => {
    if (!isFirebaseConfigured()) {
      console.warn('Firebase not configured. Submission not saved.');
      return null;
    }

    const db = getDb();
    if (!db) return null;

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.SUBMISSIONS), {
        ...term,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Failed to submit term:', err);
      return null;
    }
  }, []);

  return { submissions, loading, submitTerm };
}

/**
 * Seed Firestore with static lexicon data (admin function)
 */
export async function seedLexiconToFirestore(): Promise<{ success: number; errors: number }> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  let success = 0;
  let errors = 0;

  for (const term of staticLexicon) {
    try {
      // Check if term already exists
      const q = query(
        collection(db, COLLECTIONS.LEXICON),
        where('term', '==', term.term)
      );
      const existing = await getDocs(q);

      if (existing.empty) {
        await addDoc(collection(db, COLLECTIONS.LEXICON), {
          ...term,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
      }
    } catch (err) {
      console.error(`Failed to seed term "${term.term}":`, err);
      errors++;
    }
  }

  return { success, errors };
}
