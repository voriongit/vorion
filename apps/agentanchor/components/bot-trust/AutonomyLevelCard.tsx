'use client';

/**
 * Autonomy Level Card Component
 * Displays current autonomy level and progression status
 */

import { useEffect, useState } from 'react';

interface AutonomyEvaluation {
  current_level: number;
  can_progress: boolean;
  next_level?: number;
  requirements_met: {
    min_decisions: boolean;
    min_approval_rate: boolean;
  };
  progress: {
    decisions: number;
    required_decisions: number;
    approval_rate: number;
    required_approval_rate: number;
  };
  recommendation: string;
}

interface AutonomyLevelCardProps {
  botId: string;
}

const LEVEL_NAMES = {
  1: 'Ask & Learn',
  2: 'Suggest',
  3: 'Execute & Review',
  4: 'Autonomous w/ Exceptions',
  5: 'Fully Autonomous',
};

const LEVEL_DESCRIPTIONS = {
  1: 'Bot asks before every action',
  2: 'Bot suggests actions with confidence',
  3: 'Bot executes low-risk actions',
  4: 'Bot handles most decisions autonomously',
  5: 'Bot fully autonomous, can train others',
};

export default function AutonomyLevelCard({ botId }: AutonomyLevelCardProps) {
  const [evaluation, setEvaluation] = useState<AutonomyEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressing, setProgressing] = useState(false);

  useEffect(() => {
    fetchEvaluation();
  }, [botId]);

  const fetchEvaluation = async () => {
    try {
      const res = await fetch(`/api/bot-trust/autonomy?bot_id=${botId}&evaluate=true`);
      const data = await res.json();

      if (res.ok) {
        setEvaluation(data.evaluation);
      } else {
        setError(data.error || 'Failed to load autonomy level');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleProgressLevel = async () => {
    setProgressing(true);
    try {
      const res = await fetch('/api/bot-trust/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId, action: 'progress' }),
      });

      if (res.ok) {
        await fetchEvaluation();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to progress level');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setProgressing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-20 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Autonomy Level</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Autonomy Level</h3>
        <p className="text-gray-500 text-sm">No evaluation available</p>
      </div>
    );
  }

  const currentLevel = evaluation.current_level;
  const levelName = LEVEL_NAMES[currentLevel as keyof typeof LEVEL_NAMES];
  const levelDescription = LEVEL_DESCRIPTIONS[currentLevel as keyof typeof LEVEL_DESCRIPTIONS];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Autonomy Level</h3>

      {/* Current Level */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-bold text-blue-600">
            Level {currentLevel}
          </span>
          <span className="text-sm text-gray-500">/ 5</span>
        </div>
        <p className="text-sm font-medium text-gray-700">{levelName}</p>
        <p className="text-xs text-gray-500 mt-1">{levelDescription}</p>
      </div>

      {/* Progress Bar */}
      {currentLevel < 5 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Progress to Level {evaluation.next_level}</span>
          </div>

          {/* Decision Count Progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Decisions</span>
              <span className={evaluation.requirements_met.min_decisions ? 'text-green-600' : 'text-gray-900'}>
                {evaluation.progress.decisions} / {evaluation.progress.required_decisions}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  evaluation.requirements_met.min_decisions ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (evaluation.progress.decisions / evaluation.progress.required_decisions) * 100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Approval Rate Progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Approval Rate</span>
              <span className={evaluation.requirements_met.min_approval_rate ? 'text-green-600' : 'text-gray-900'}>
                {(evaluation.progress.approval_rate * 100).toFixed(1)}% / {(evaluation.progress.required_approval_rate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  evaluation.requirements_met.min_approval_rate ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (evaluation.progress.approval_rate / evaluation.progress.required_approval_rate) * 100
                  )}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      {evaluation.can_progress ? (
        <button
          onClick={handleProgressLevel}
          disabled={progressing}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {progressing ? 'Progressing...' : `Progress to Level ${evaluation.next_level}`}
        </button>
      ) : currentLevel < 5 ? (
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-600">{evaluation.recommendation}</p>
        </div>
      ) : (
        <div className="bg-green-50 rounded-md p-3">
          <p className="text-xs text-green-700 font-medium">✓ Maximum autonomy level reached</p>
        </div>
      )}
    </div>
  );
}
