'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle, Lock, Key, Cloud, CloudOff, Database, RefreshCw, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { providerStatus } from '@/lib/ai-providers';
import { useFirebaseStatus, seedLexiconToFirestore } from '@/lib/firebase-hooks';
import { isFirebaseConfigured } from '@/lib/firebase';

export function CortexSettings() {
  const firebaseStatus = useFirebaseStatus();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: number; errors: number } | null>(null);

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
        <div className="glass p-6 rounded-xl border-l-4 border-green-500">
          <h2 className="text-lg font-bold text-white mb-2">
            Simulation Mode (Active)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Currently, Nexus uses Google Gemini to{' '}
            <strong className="text-white">simulate</strong> the perspectives of
            Claude and Grok for synthesis. This ensures functionality without
            requiring extra API keys.
          </p>
          <div className="flex items-center space-x-2 text-xs font-mono text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>CORE ENGINE ONLINE</span>
          </div>
        </div>

        {/* Provider Status */}
        <div className="glass p-6 rounded-xl">
          <h2 className="text-lg font-bold text-white mb-4">Provider Status</h2>
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
        </div>

        {/* API Keys (Coming Soon) */}
        <div className="glass p-6 rounded-xl opacity-50 pointer-events-none">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4" />
              External API Keys
            </h2>
            <span className="text-[10px] bg-red-900 text-red-300 px-2 py-1 rounded flex items-center gap-1">
              <Lock className="w-3 h-3" />
              COMING SOON
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Direct browser integration for Anthropic/xAI keys requires a backend
            proxy due to CORS restrictions. This feature will be available when
            the backend service is deployed.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Anthropic (Claude)
              </label>
              <Input
                type="password"
                placeholder="sk-ant-..."
                disabled
                className="opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">xAI (Grok)</label>
              <Input
                type="password"
                placeholder="xai-..."
                disabled
                className="opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="glass p-4 rounded-xl border border-blue-500/30">
          <h3 className="text-sm font-bold text-blue-400 mb-2">Debug Info (Client)</h3>
          <pre className="text-xs text-gray-500 font-mono">
            {JSON.stringify(debugEnvVars, null, 2)}
          </pre>
        </div>

        {/* Environment Notice */}
        <div className="glass p-4 rounded-xl border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-yellow-400 mb-1">
                Backend Required for Full Triad
              </h3>
              <p className="text-xs text-gray-400">
                To enable true multi-model synthesis with actual Claude and Grok
                APIs, deploy the backend service with your API keys configured as
                environment variables.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
