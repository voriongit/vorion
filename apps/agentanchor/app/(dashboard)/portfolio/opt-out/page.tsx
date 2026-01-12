'use client'

import { Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function OptOutPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Link href="/portfolio" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Portfolio
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-blue-500" />
        <div>
          <h1 className="text-3xl font-bold">Client Protection</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage opt-out requests and ownership transfer notices
          </p>
        </div>
      </div>

      <div className="card p-8 text-center">
        <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Active Notices</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          When ownership changes are proposed for agents you&apos;ve acquired,
          you&apos;ll have the opportunity to review and exercise your opt-out rights here.
        </p>
      </div>

      <div className="mt-8 card p-6">
        <h3 className="font-semibold mb-4">Your Rights</h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400">
          <li>• 30-day notice before any ownership transfer</li>
          <li>• Option to continue, transfer, or terminate service</li>
          <li>• Full refund within opt-out window for prepaid services</li>
          <li>• Data portability and export rights</li>
        </ul>
      </div>
    </div>
  )
}
