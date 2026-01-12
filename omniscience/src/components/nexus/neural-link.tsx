'use client';

import { useState } from 'react';
import { PenLine, Upload, Cloud, CloudOff, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubmissions, useFirebaseStatus, useLexiconMutations } from '@/lib/firebase-hooks';
import type { KnowledgeLevel } from '@/types';

interface NeuralLinkProps {
  onSubmit?: (data: { term: string; definition: string; level: KnowledgeLevel }) => void;
}

type SubmitMode = 'submission' | 'direct';

export function NeuralLink({ onSubmit }: NeuralLinkProps) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [level, setLevel] = useState<KnowledgeLevel>('novice');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [submitMode, setSubmitMode] = useState<SubmitMode>('submission');
  const [success, setSuccess] = useState(false);

  const firebaseStatus = useFirebaseStatus();
  const { submitTerm } = useSubmissions();
  const { addTerm, isSubmitting, submitError, clearError } = useLexiconMutations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !definition.trim()) return;

    clearError();
    setSuccess(false);

    const termData = {
      term: term.trim(),
      definition: definition.trim(),
      level,
      category: category.trim() || undefined,
      tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    };

    let result: string | null = null;

    if (submitMode === 'submission') {
      // Submit for review (pending queue)
      result = await submitTerm(termData);
    } else {
      // Direct add to lexicon
      result = await addTerm(termData);
    }

    if (result) {
      setSuccess(true);
      onSubmit?.({ term, definition, level });

      // Reset form after brief delay
      setTimeout(() => {
        setTerm('');
        setDefinition('');
        setLevel('novice');
        setCategory('');
        setTags('');
        setSuccess(false);
      }, 2000);
    }
  };

  const categories = ['core', 'architecture', 'protocols', 'orchestration', 'safety', 'techniques', 'evolution'];

  return (
    <div className="fade-in">
      <div className="max-w-2xl mx-auto glass p-8 rounded-xl border border-purple-500/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <PenLine className="w-5 h-5 mr-3 text-purple-400" />
            Neural Link Ingestion
          </h2>

          {/* Connection Status */}
          {firebaseStatus.connected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-500 font-mono">
              <Cloud className="w-3 h-3" />
              CONNECTED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500 font-mono">
              <CloudOff className="w-3 h-3" />
              {firebaseStatus.configured ? 'OFFLINE' : 'LOCAL MODE'}
            </span>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">
              {submitMode === 'submission'
                ? 'Term submitted for review!'
                : 'Term added to lexicon!'}
            </span>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{submitError}</span>
          </div>
        )}

        {/* Mode Selector */}
        {firebaseStatus.connected && (
          <div className="mb-6 flex gap-2">
            <Button
              type="button"
              variant={submitMode === 'submission' ? 'neon' : 'ghost'}
              size="sm"
              onClick={() => setSubmitMode('submission')}
            >
              Submit for Review
            </Button>
            <Button
              type="button"
              variant={submitMode === 'direct' ? 'neon' : 'ghost'}
              size="sm"
              onClick={() => setSubmitMode('direct')}
            >
              Add Directly
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={term}
              onChange={e => setTerm(e.target.value)}
              placeholder="Term Name"
              required
              className="focus:border-purple-500"
            />
            <select
              value={level}
              onChange={e => setLevel(e.target.value as KnowledgeLevel)}
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
            >
              <option value="novice">Novice</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
              <option value="theoretical">Theoretical</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">Select Category (optional)</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="focus:border-purple-500"
            />
          </div>

          <textarea
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            rows={4}
            placeholder="Definition..."
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          />

          <Button
            type="submit"
            disabled={isSubmitting || !term.trim() || !definition.trim()}
            className="w-full bg-purple-600 hover:bg-purple-500 font-bold tracking-wide"
          >
            {isSubmitting ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-pulse" />
                {submitMode === 'submission' ? 'SUBMITTING...' : 'UPLOADING...'}
              </>
            ) : (
              submitMode === 'submission' ? 'SUBMIT FOR REVIEW' : 'COMMIT TO MEMORY'
            )}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          {firebaseStatus.connected
            ? submitMode === 'submission'
              ? 'Terms will be reviewed before appearing in the lexicon.'
              : 'Terms will be added directly to the cloud lexicon.'
            : 'Enable Firebase to sync terms to the cloud.'}
        </p>
      </div>
    </div>
  );
}
