'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Key, Cloud, CloudOff, Database, Loader2 } from 'lucide-react';
import { useSupabaseStatus } from '@/lib/supabase-hooks';
import { isSupabaseConfigured } from '@/lib/supabase-client';
import type { AIModel } from '@/types';

type ProviderStatus = Record<AIModel, { available: boolean; simulated: boolean }>;

export function CortexSettings() {
  const dbStatus = useSupabaseStatus();
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
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
    isConfigured: isSupabaseConfigured(),
  };

  return (
    <div className="fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Database Status */}
        <div className={`glass p-6 rounded-xl border-l-4 ${
          dbStatus.connected ? 'border-emerald-500' : 'border-amber-500'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5" />
              Cloud Sync Status
            </h2>
            {dbStatus.connected ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-mono">
                <Cloud className="w-3 h-3" />
                CONNECTED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-500 font-mono">
                <CloudOff className="w-3 h-3" />
                {dbStatus.configured ? 'OFFLINE' : 'NOT CONFIGURED'}
              </span>
            )}
          </div>

          {dbStatus.connected ? (
            <p className="text-sm text-gray-400">
              Supabase is connected. Your lexicon syncs in real-time across all devices.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-4">
                {dbStatus.configured
                  ? `Connection failed: ${dbStatus.error}`
                  : 'Add Supabase environment variables to enable cloud sync.'}
              </p>
              {!dbStatus.configured && (
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 font-mono mb-2">Required variables:</p>
                  <ul className="text-xs text-gray-600 space-y-1 font-mono">
                    <li>NEXT_PUBLIC_SUPABASE_URL</li>
                    <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
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
