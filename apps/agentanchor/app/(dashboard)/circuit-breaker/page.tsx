'use client';

/**
 * Circuit Breaker Page
 *
 * Epic 16: Circuit Breaker & Kill Switch
 *
 * Admin dashboard for:
 * - Global Kill Switch control
 * - Viewing/managing paused agents
 * - Circuit breaker event history
 */

import { ShieldAlert } from 'lucide-react';
import { CircuitBreakerDashboard } from '@/components/governance';

export default function CircuitBreakerPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="h-8 w-8 text-red-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Circuit Breaker
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Emergency controls for agent operations. Activate the global kill switch to halt
            all agents, or manage individual agent pause states.
          </p>
        </div>

        {/* Dashboard Component */}
        <CircuitBreakerDashboard />
      </div>
    </div>
  );
}
