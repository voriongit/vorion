'use client'

import { DollarSign, CreditCard, ExternalLink } from 'lucide-react'

export default function PayoutsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <DollarSign className="h-8 w-8 text-green-500" />
        <div>
          <h1 className="text-3xl font-bold">Payout Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your earnings and payout preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <div className="text-sm text-gray-600 mb-1">Available Balance</div>
          <div className="text-2xl font-bold text-green-600">$0.00</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-orange-600">$0.00</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-600 mb-1">Total Earned</div>
          <div className="text-2xl font-bold">$0.00</div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-6 w-6 text-gray-500" />
          <h3 className="font-semibold">Payment Account</h3>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="font-medium mb-2">Connect Stripe Account</h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Connect your Stripe account to receive payouts from agent commissions and sales.
          </p>
          <button className="btn-primary inline-flex items-center gap-2">
            Connect with Stripe
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 card p-6">
        <h3 className="font-semibold mb-4">Commission Structure</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600">Free Tier</span>
            <span className="font-medium">15% platform fee</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600">Pro Tier</span>
            <span className="font-medium">10% platform fee</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Enterprise Tier</span>
            <span className="font-medium">7% platform fee</span>
          </div>
        </div>
      </div>
    </div>
  )
}
