'use client';

/**
 * Approval Rate Chart Component
 * Displays historical approval rate trends over time
 */

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ApprovalRateChartProps {
  botId: string;
}

interface DataPoint {
  timestamp: string;
  rate: number;
}

export default function ApprovalRateChart({ botId }: ApprovalRateChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [botId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/bot-trust/approval-rate?bot_id=${botId}&history=true&limit=30`);
      const responseData = await res.json();

      if (res.ok) {
        const formattedData = responseData.history.map((item: any) => ({
          timestamp: new Date(item.timestamp).toLocaleDateString(),
          rate: (item.rate * 100).toFixed(1),
        }));
        setData(formattedData);
      } else {
        setError(responseData.error || 'Failed to load approval rate history');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Approval Rate Trend</h3>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Approval Rate Trend</h3>
        <p className="text-gray-500 text-sm">No historical data available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Approval Rate Trend</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            label={{ value: 'Approval Rate (%)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(value: any) => `${value}%`}
            labelStyle={{ color: '#000' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Approval Rate"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-500">7 Days</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.length >= 7 ? data.slice(-7)[0].rate : '--'}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">30 Days</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.length > 0 ? data[0].rate : '--'}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current</p>
          <p className="text-lg font-semibold text-blue-600">
            {data.length > 0 ? data[data.length - 1].rate : '--'}%
          </p>
        </div>
      </div>
    </div>
  );
}
