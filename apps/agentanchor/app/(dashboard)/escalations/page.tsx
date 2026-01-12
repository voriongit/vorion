'use client'

import { AlertTriangle } from 'lucide-react'

export default function EscalationsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="h-8 w-8 text-orange-500" />
        <div>
          <h1 className="text-3xl font-bold">Human Escalations</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and resolve escalated agent decisions
          </p>
        </div>
      </div>

      <div className="card p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Pending Escalations</h2>
        <p className="text-gray-600 dark:text-gray-400">
          When agents encounter decisions requiring human oversight, they will appear here.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600">0</div>
          <div className="text-sm text-gray-600">Approved Today</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-orange-600">0</div>
          <div className="text-sm text-gray-600">Pending Review</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-600">0</div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
      </div>
    </div>
  )
}
