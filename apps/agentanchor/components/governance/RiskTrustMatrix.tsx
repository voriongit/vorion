'use client';

/**
 * Risk×Trust Matrix Visualization Component
 *
 * Council Priority #1 (80 points)
 *
 * Displays the routing matrix showing which path (GREEN/YELLOW/RED)
 * an action will take based on trust score and risk level.
 */

import { useEffect, useState } from 'react';

// Simple classname utility
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface MatrixCell {
  trustScore: number;
  riskLevel: string;
  path: 'green' | 'yellow' | 'red';
  pathName: string;
  autoApprove: boolean;
}

interface MatrixData {
  trustLevels: string[];
  riskLevels: string[];
  cells: MatrixCell[][];
  legend: {
    green: { name: string; description: string; color: string };
    yellow: { name: string; description: string; color: string };
    red: { name: string; description: string; color: string };
  };
}

interface RiskTrustMatrixProps {
  highlightTrustScore?: number;
  highlightRiskLevel?: string;
  onCellClick?: (cell: MatrixCell) => void;
  compact?: boolean;
}

export function RiskTrustMatrix({
  highlightTrustScore,
  highlightRiskLevel,
  onCellClick,
  compact = false,
}: RiskTrustMatrixProps) {
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatrix() {
      try {
        const response = await fetch('/api/v1/governance/route');
        if (!response.ok) throw new Error('Failed to fetch matrix');
        const data = await response.json();
        setMatrix(data.matrix);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchMatrix();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg p-4">
        <div className="h-64 bg-muted-foreground/20 rounded" />
      </div>
    );
  }

  if (error || !matrix) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-lg p-4">
        Error loading matrix: {error}
      </div>
    );
  }

  const getPathColor = (path: string) => {
    switch (path) {
      case 'green':
        return 'bg-green-500/80 hover:bg-green-500';
      case 'yellow':
        return 'bg-yellow-500/80 hover:bg-yellow-500';
      case 'red':
        return 'bg-red-500/80 hover:bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  const isHighlighted = (trustScore: number, riskLevel: string) => {
    if (!highlightTrustScore && !highlightRiskLevel) return false;
    const trustMatch = highlightTrustScore
      ? trustScore <= highlightTrustScore && highlightTrustScore < trustScore + 200
      : true;
    const riskMatch = highlightRiskLevel
      ? riskLevel.toLowerCase() === highlightRiskLevel.toLowerCase()
      : true;
    return trustMatch && riskMatch;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Risk × Trust Matrix</h3>
          <div className="flex items-center gap-4 text-sm">
            {Object.entries(matrix.legend).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-4 h-4 rounded',
                    getPathColor(key)
                  )}
                />
                <span className="text-muted-foreground">{value.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-sm font-medium text-muted-foreground">
                Trust / Risk
              </th>
              {matrix.riskLevels.map((risk) => (
                <th
                  key={risk}
                  className="p-2 text-center text-sm font-medium text-muted-foreground"
                >
                  {risk}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="p-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {matrix.trustLevels[rowIndex]}
                </td>
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(
                      'p-1',
                      onCellClick && 'cursor-pointer'
                    )}
                    onClick={() => onCellClick?.(cell)}
                  >
                    <div
                      className={cn(
                        'rounded-md p-2 text-center text-white text-xs font-medium transition-all',
                        getPathColor(cell.path),
                        isHighlighted(cell.trustScore, cell.riskLevel) &&
                          'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105',
                        compact ? 'p-1' : 'p-2'
                      )}
                    >
                      {compact ? (
                        cell.path.charAt(0).toUpperCase()
                      ) : (
                        <>
                          <div>{cell.pathName}</div>
                          {cell.autoApprove && (
                            <div className="text-[10px] opacity-80">Auto</div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          {Object.entries(matrix.legend).map(([key, value]) => (
            <div
              key={key}
              className={cn(
                'p-3 rounded-lg border',
                key === 'green' && 'border-green-500/30 bg-green-500/10',
                key === 'yellow' && 'border-yellow-500/30 bg-yellow-500/10',
                key === 'red' && 'border-red-500/30 bg-red-500/10'
              )}
            >
              <div className="font-medium">{value.name}</div>
              <div className="text-muted-foreground text-xs">
                {value.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RiskTrustMatrix;
