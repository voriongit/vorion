"use client";

import { useState } from 'react';
import { Shield, CheckCircle, Ban, Loader2 } from 'lucide-react';

export default function GovernancePlayground() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runGovernance() {
    if (!prompt) return;
    setLoading(true);
    setResult(null);

    try {
      // 1. REASONING (Intent)
      const intentRes = await fetch('https://cognigate.dev/v1/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: 'web_demo',
          goal: prompt,
          context: {}
        }),
      });
      const intentData = await intentRes.json();

      // 2. GOVERNANCE (Enforce)
      const enforceRes = await fetch('https://cognigate.dev/v1/enforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: 'web_demo',
          plan: intentData.plan,
          trust_level: intentData.trust_level,
          trust_score: intentData.trust_score
        }),
      });
      const verdict = await enforceRes.json();

      setResult({ intent: intentData, verdict });
    } catch (e) {
      console.error(e);
      setResult({ error: "Failed to connect to Cognigate Engine." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      {/* Input Section */}
      <div className="p-6 border-b border-white/5">
        <label className="text-xs font-mono text-indigo-400 uppercase mb-2 block">
          Enter Autonomous Command
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g., "Find cheap flights" or "sudo delete all logs"'
            className="flex-1 bg-black/50 border border-white/10 rounded px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm"
            onKeyDown={(e) => e.key === 'Enter' && runGovernance()}
          />
          <button
            onClick={runGovernance}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded font-medium text-sm disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin w-4 h-4"/> : "Execute"}
          </button>
        </div>
      </div>

      {/* Output Section */}
      {result && !result.error && (
        <div className="p-6 bg-black/30">

          {/* Step 1: Intent Analysis */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                INTENT ANALYSIS
              </h3>
              <span className={`text-xs font-mono px-2 py-1 rounded ${result.intent.plan.risk_score > 0.5 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                RISK: {result.intent.plan.risk_score.toFixed(2)}
              </span>
            </div>
            <div className="text-xs font-mono text-neutral-500 bg-black p-3 rounded border border-white/5 space-y-1">
              <p><span className="text-neutral-400">GOAL:</span> {result.intent.plan.goal}</p>
              <p><span className="text-neutral-400">TOOLS:</span> {result.intent.plan.tools_required.join(', ')}</p>
              {Object.keys(result.intent.plan.risk_indicators).length > 0 && (
                <p><span className="text-neutral-400">RISK INDICATORS:</span> {Object.keys(result.intent.plan.risk_indicators).join(', ')}</p>
              )}
            </div>
          </div>

          {/* Step 2: Enforcement Verdict */}
          <div>
            <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              ENFORCEMENT VERDICT
            </h3>

            <div className={`p-4 rounded border ${result.verdict.allowed ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-red-950/30 border-red-500/30'}`}>
              <div className="flex items-start gap-3">
                {result.verdict.allowed ? <CheckCircle className="text-emerald-500 w-6 h-6 flex-shrink-0" /> : <Ban className="text-red-500 w-6 h-6 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className={`text-lg font-bold uppercase ${result.verdict.allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.verdict.action}
                  </div>
                  {result.verdict.violations.length > 0 && (
                    <ul className="mt-2 text-xs text-red-300 space-y-1">
                      {result.verdict.violations.map((v: any, i: number) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-red-500">•</span>
                          <span>{v.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/5 text-[10px] font-mono text-neutral-600 flex justify-between">
                    <span>TRUST IMPACT: {result.verdict.trust_impact}</span>
                    <span>VERDICT: {result.verdict.verdict_id}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {result?.error && (
        <div className="p-6 bg-red-950/20 text-red-400 text-sm">
          {result.error}
        </div>
      )}
    </div>
  );
}
