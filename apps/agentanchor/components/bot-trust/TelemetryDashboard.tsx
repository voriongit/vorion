'use client';

/**
 * Telemetry Dashboard Component
 * Displays real-time performance metrics and telemetry data
 */

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TelemetryDashboardProps {
  botId: string;
}

interface PerformanceSnapshot {
  avg_response_time_ms: number;
  error_rate: number;
  requests_last_hour: number;
  cache_hit_rate: number;
  tokens_last_hour: number;
}

export default function TelemetryDashboard({ botId }: TelemetryDashboardProps) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [responseTimeData, setResponseTimeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshot();
    fetchResponseTimeData();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchSnapshot();
      fetchResponseTimeData();
    }, 30000);

    return () => clearInterval(interval);
  }, [botId]);

  const fetchSnapshot = async () => {
    try {
      const res = await fetch(`/api/bot-trust/telemetry?bot_id=${botId}&snapshot=true`);
      const data = await res.json();

      if (res.ok) {
        setSnapshot(data.snapshot);
      } else {
        setError(data.error || 'Failed to load telemetry snapshot');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchResponseTimeData = async () => {
    try {
      const res = await fetch(
        `/api/bot-trust/telemetry?bot_id=${botId}&metric=response_time_ms&timeseries=true&days=1&interval=60`
      );
      const data = await res.json();

      if (res.ok && data.timeseries) {
        const formattedData = data.timeseries.map((item: any) => ({
          time: new Date(item.timestamp).toLocaleTimeString(),
          response_time: Math.round(item.value),
        }));
        setResponseTimeData(formattedData);
      }
    } catch (err) {
      console.error('Failed to fetch response time data', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-sm">No telemetry data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Response Time"
          value={`${Math.round(snapshot.avg_response_time_ms)}ms`}
          color={snapshot.avg_response_time_ms < 2000 ? 'green' : snapshot.avg_response_time_ms < 5000 ? 'yellow' : 'red'}
        />
        <MetricCard
          title="Error Rate"
          value={`${(snapshot.error_rate * 100).toFixed(2)}%`}
          color={snapshot.error_rate < 0.01 ? 'green' : snapshot.error_rate < 0.05 ? 'yellow' : 'red'}
        />
        <MetricCard
          title="Requests (1h)"
          value={snapshot.requests_last_hour.toString()}
          color="blue"
        />
        <MetricCard
          title="Cache Hit Rate"
          value={`${(snapshot.cache_hit_rate * 100).toFixed(1)}%`}
          color={snapshot.cache_hit_rate > 0.8 ? 'green' : snapshot.cache_hit_rate > 0.5 ? 'yellow' : 'red'}
        />
      </div>

      {/* Token Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-2">Token Usage (Last Hour)</h3>
        <p className="text-3xl font-bold text-blue-600">{snapshot.tokens_last_hour.toLocaleString()}</p>
        <p className="text-sm text-gray-500 mt-1">tokens consumed</p>
      </div>

      {/* Response Time Chart */}
      {responseTimeData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Response Time Trend (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="response_time"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="Response Time"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const colorClasses: Record<string, string> = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}
