'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Key, Cloud, CloudOff, Database, RefreshCw, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebaseStatus, seedLexiconToFirestore } from '@/lib/firebase-hooks';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { AIModel } from '@/types';

type ProviderStatus = Record<AIModel, { available: boolean; simulated: boolean }>;

export function CortexSettings() {
  const firebaseStatus = useFirebaseStatus();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: number; errors: number } | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch provider status from server
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        setProviderStatus(data.providers);
      } catch (err) {
        console.error('Failed to fetch config:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  // Count native vs simulated providers
  const nativeProviders = providerStatus
    ? Object.entries(providerStatus).filter(([, s]) => s.available && !s.simulated)
    : [];
  const allNative = nativeProviders.length === 3;

  // Debug: check raw env vars on client
  const debugEnvVars = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) + '...',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    isConfigured: isFirebaseConfigured(),
  };

  const handleSeedLexicon = async () => {
    if (!firebaseStatus.connected) return;

    setSeeding(true);
    setSeedResult(null);

    try {
      const result = await seedLexiconToFirestore();
      setSeedResult(result);
    } catch (err) {
      console.error('Seed failed:', err);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Firebase Status */}
        <div className={`glass p-6 rounded-xl border-l-4 ${
          firebaseStatus.connected ? 'border-emerald-500' : 'border-amber-500'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5" />
              Cloud Sync Status
            </h2>
            {firebaseStatus.connected ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-mono">
                <Cloud className="w-3 h-3" />
                CONNECTED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-500 font-mono">
                <CloudOff className="w-3 h-3" />
                {firebaseStatus.configured ? 'OFFLINE' : 'NOT CONFIGURED'}
              </span>
            )}
          </div>

          {firebaseStatus.connected ? (
            <>
              <p className="text-sm text-gray-400 mb-4">
                Firebase Firestore is connected. Your lexicon syncs in real-time across all devices.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSeedLexicon}
                  disabled={seeding}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  {seeding ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                      Seeding...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3 mr-2" />
                      Seed Static Data to Cloud
                    </>
                  )}
                </Button>
                {seedResult && (
                  <span className="text-xs text-gray-500">
                    Added {seedResult.success} terms
                    {seedResult.errors > 0 && `, ${seedResult.errors} errors`}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-4">
                {firebaseStatus.configured
                  ? `Connection failed: ${firebaseStatus.error}`
                  : 'Add Firebase environment variables to enable cloud sync.'}
              </p>
              {!firebaseStatus.configured && (
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 font-mono mb-2">Required variables:</p>
                  <ul className="text-xs text-gray-600 space-y-1 font-mono">
                    <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
                    <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
                    <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
                    <li>NEXT_PUBLIC_FIREBASE_APP_ID</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Active Mode */}
        <div className={`glass p-6 rounded-xl border-l-4 ${allNative ? 'border-cyan-500' : 'border-green-500'}`}>
          <h2 className="text-lg font-bold text-white mb-2">
            {allNative ? 'Native Triad Mode (Active)' : 'Hybrid Mode (Active)'}
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            {allNative ? (
              <>
                All three AI providers are connected natively. The Nexus Triad synthesizes{' '}
                <span className="text-cyan-400">Gemini</span>,{' '}
                <span className="text-purple-400">Claude</span>, and{' '}
                <span className="text-orange-400">Grok</span> perspectives into unified responses.
              </>
            ) : (
              <>
                {nativeProviders.length > 0 ? (
                  <>
                    {nativeProviders.map(([name]) => name).join(', ')} connected natively.
                    Remaining providers are simulated via Gemini.
                  </>
                ) : (
                  <>
                    Nexus uses Google Gemini to simulate all perspectives for synthesis.
                    Add API keys to enable native providers.
                  </>
                )}
              </>
            )}
          </p>
          <div className={`flex items-center space-x-2 text-xs font-mono ${allNative ? 'text-cyan-400' : 'text-green-400'}`}>
            <CheckCircle className="w-4 h-4" />
            <span>{allNative ? 'TRIAD ENGINE ONLINE' : 'CORE ENGINE ONLINE'}</span>
          </div>
        </div>

        {/* Provider Status */}
        <div className="glass p-6 rounded-xl">
          <h2 className="text-lg font-bold text-white mb-4">Provider Status</h2>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-purple-500 animate-spin mr-2" />
              <span className="text-sm text-gray-400">Loading provider status...</span>
            </div>
          ) : providerStatus ? (
            <div className="space-y-3">
              {Object.entries(providerStatus).map(([model, status]) => (
                <div
                  key={model}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        status.available && !status.simulated
                          ? 'bg-green-500'
                          : status.simulated
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <span className="font-mono text-sm text-white uppercase">
                      {model}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {status.available && !status.simulated
                      ? 'Native'
                      : status.simulated
                      ? 'Simulated'
                      : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-400">Failed to load provider status</p>
          )}
        </div>

        {/* API Keys Configuration */}
        {providerStatus && (
          <div className="glass p-6 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key Configuration
              </h2>
              <span className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                allNative ? 'bg-cyan-900 text-cyan-300' : 'bg-amber-900 text-amber-300'
              }`}>
                {allNative ? 'ALL CONFIGURED' : 'PARTIAL'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              API keys are configured via environment variables on the server. Contact your administrator to update credentials.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className="text-sm text-gray-300">GOOGLE_GENERATIVE_AI_API_KEY</span>
                <span className={`text-xs ${providerStatus.gemini.available ? 'text-green-400' : 'text-red-400'}`}>
                  {providerStatus.gemini.available ? 'Configured' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className="text-sm text-gray-300">ANTHROPIC_API_KEY</span>
                <span className={`text-xs ${providerStatus.claude.available ? 'text-green-400' : 'text-red-400'}`}>
                  {providerStatus.claude.available ? 'Configured' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className="text-sm text-gray-300">XAI_API_KEY</span>
                <span className={`text-xs ${providerStatus.grok.available ? 'text-green-400' : 'text-red-400'}`}>
                  {providerStatus.grok.available ? 'Configured' : 'Missing'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="glass p-4 rounded-xl border border-blue-500/30">
          <h3 className="text-sm font-bold text-blue-400 mb-2">Debug Info (Client)</h3>
          <pre className="text-xs text-gray-500 font-mono">
            {JSON.stringify(debugEnvVars, null, 2)}
          </pre>
        </div>

        {/* Environment Notice */}
        {!allNative && (
          <div className="glass p-4 rounded-xl border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-yellow-400 mb-1">
                  Missing API Keys
                </h3>
                <p className="text-xs text-gray-400">
                  Add the missing API keys to your environment variables to enable
                  native multi-model synthesis. Missing providers will be simulated via Gemini.
                </p>
              </div>
            </div>
          </div>
        )}
        {allNative && (
          <div className="glass p-4 rounded-xl border border-cyan-500/30">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-cyan-400 mb-1">
                  Full Triad Active
                </h3>
                <p className="text-xs text-gray-400">
                  All three AI providers are configured. Nexus Chat will synthesize authentic
                  perspectives from Gemini, Claude, and Grok for comprehensive responses.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
