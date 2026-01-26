'use client';

/**
 * Trust Score Card Component
 * Displays trust score (0-1000) with component breakdown
 * Scale: 0-1000 canonical range aligned with @vorionsys/atsf-core RuntimeTier
 */

import { useEffect, useState } from 'react';

interface TrustScore {
  score: number;
  components: {
    decision_accuracy: number;
    ethics_compliance: number;
    training_success: number;
    operational_stability: number;
    peer_reviews: number;
  };
  calculated_at: string;
}

interface TrustScoreCardProps {
  botId: string;
}

export default function TrustScoreCard({ botId }: TrustScoreCardProps) {
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrustScore();
  }, [botId]);

  const fetchTrustScore = async () => {
    try {
      const res = await fetch(`/api/bot-trust/trust-score?bot_id=${botId}`);
      const data = await res.json();

      if (res.ok) {
        setTrustScore(data.trust_score);
      } else if (res.status === 404) {
        // No trust score yet, calculate one
        await calculateTrustScore();
      } else {
        setError(data.error || 'Failed to load trust score');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const calculateTrustScore = async () => {
    try {
      const res = await fetch('/api/bot-trust/trust-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId }),
      });

      const data = await res.json();

      if (res.ok) {
        setTrustScore(data.trust_score);
      } else {
        setError(data.error || 'Failed to calculate trust score');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded w-full mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Trust Score</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!trustScore) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Trust Score</h3>
        <p className="text-gray-500 text-sm">No trust score available</p>
      </div>
    );
  }

  // Colors and labels aligned with RuntimeTier (0-1000)
  const getScoreColor = (score: number) => {
    if (score >= 900) return 'text-purple-600';  // L5 Autonomous
    if (score >= 700) return 'text-green-600';   // L4 Certified
    if (score >= 500) return 'text-blue-600';    // L3 Trusted
    if (score >= 300) return 'text-yellow-600';  // L2 Standard
    if (score >= 100) return 'text-orange-600';  // L1 Provisional
    return 'text-red-600';                        // L0 Sandbox
  };

  const getScoreLabel = (score: number) => {
    if (score >= 900) return 'Autonomous';
    if (score >= 700) return 'Certified';
    if (score >= 500) return 'Trusted';
    if (score >= 300) return 'Standard';
    if (score >= 100) return 'Provisional';
    return 'Sandbox';
  };

  const scoreColor = getScoreColor(trustScore.score);
  const scoreLabel = getScoreLabel(trustScore.score);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Trust Score</h3>

      {/* Main Score */}
      <div className="mb-6">
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {trustScore.score}
          <span className="text-lg text-gray-400 font-normal">/1000</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{scoreLabel}</p>
        <p className="text-xs text-gray-400 mt-2">
          Updated {new Date(trustScore.calculated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-gray-400 uppercase">Components</h4>

        <ComponentBar
          label="Decision Accuracy"
          value={trustScore.components.decision_accuracy}
          weight="35%"
        />
        <ComponentBar
          label="Ethics Compliance"
          value={trustScore.components.ethics_compliance}
          weight="25%"
        />
        <ComponentBar
          label="Training Success"
          value={trustScore.components.training_success}
          weight="20%"
        />
        <ComponentBar
          label="Operational Stability"
          value={trustScore.components.operational_stability}
          weight="15%"
        />
        <ComponentBar
          label="Peer Reviews"
          value={trustScore.components.peer_reviews}
          weight="5%"
        />
      </div>
    </div>
  );
}

function ComponentBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: string;
}) {
  const getColor = (val: number) => {
    if (val >= 85) return 'bg-green-500';
    if (val >= 70) return 'bg-blue-500';
    if (val >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">
          {label}
          <span className="text-gray-400 ml-1">({weight})</span>
        </span>
        <span className="text-gray-900 font-medium">{value.toFixed(0)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getColor(value)}`}
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
}
