'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Wallet,
  Clock,
  Copy,
  Crown,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Coins,
} from 'lucide-react'
import type { AcquisitionModel } from '@/lib/credits/types'

interface Agent {
  id: string
  name: string
  trust_score: number
  owner_id?: string
}

interface AcquireModalProps {
  agent: Agent
  isOpen: boolean
  onClose: () => void
  onSuccess?: (model: AcquisitionModel, agentId: string) => void
}

interface Pricing {
  commission: { enabled: boolean; price: number }
  clone: { enabled: boolean; price: number }
  enterprise: { enabled: boolean; price: number }
}

const DEFAULT_PRICING: Pricing = {
  commission: { enabled: true, price: 5 },
  clone: { enabled: true, price: 150 },
  enterprise: { enabled: false, price: 2000 },
}

export function AcquireModal({ agent, isOpen, onClose, onSuccess }: AcquireModalProps) {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [acquiring, setAcquiring] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AcquisitionModel>('commission')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pricing] = useState<Pricing>(DEFAULT_PRICING)

  // Fetch wallet balance
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
      setSuccess(false)
      fetch('/api/wallet')
        .then(res => res.json())
        .then(data => {
          setBalance(data.wallet?.balance ?? 0)
        })
        .catch(() => setBalance(0))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  const getSelectedPrice = () => {
    return pricing[selectedModel].price
  }

  const canAfford = balance !== null && balance >= getSelectedPrice()

  const handleAcquire = async () => {
    if (!canAfford) return

    setAcquiring(true)
    setError(null)

    try {
      const res = await fetch('/api/marketplace/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          model: selectedModel,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Acquisition failed')
      }

      setSuccess(true)

      // Update balance after purchase
      setBalance(prev => (prev !== null ? prev - getSelectedPrice() : prev))

      // Notify parent
      setTimeout(() => {
        onSuccess?.(selectedModel, data.agentId || agent.id)
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAcquiring(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-800"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Acquire Agent</h2>
                <p className="text-white/70 text-sm">{agent.name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Balance display */}
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
              <Wallet className="h-4 w-4 text-yellow-400" />
              <span className="text-white text-sm">
                Your Balance:{' '}
                <strong className="text-yellow-400">
                  {loading ? '...' : `${balance?.toLocaleString()} AC`}
                </strong>
              </span>
            </div>
          </div>

          {/* Success State */}
          {success ? (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
              >
                <CheckCircle className="w-8 h-8 text-green-400" />
              </motion.div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Acquisition Complete!
              </h3>
              <p className="text-neutral-400">
                {selectedModel === 'commission'
                  ? 'You can now use this agent. Check My Agents.'
                  : selectedModel === 'clone'
                  ? 'Your clone is ready in My Agents.'
                  : 'Full ownership transferred to you.'}
              </p>
            </div>
          ) : (
            <>
              {/* Acquisition Options */}
              <div className="p-4 space-y-3">
                {/* Commission (Rent) */}
                <button
                  onClick={() => setSelectedModel('commission')}
                  disabled={!pricing.commission.enabled}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedModel === 'commission'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  } ${!pricing.commission.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Clock className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Rent (Commission)</h3>
                        <p className="text-sm text-neutral-400">Pay per task, cancel anytime</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-400 font-bold">
                        <Coins className="h-4 w-4" />
                        {pricing.commission.price} AC
                      </div>
                      <p className="text-xs text-neutral-500">per task</p>
                    </div>
                  </div>
                </button>

                {/* Clone */}
                <button
                  onClick={() => setSelectedModel('clone')}
                  disabled={!pricing.clone.enabled}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedModel === 'clone'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  } ${!pricing.clone.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Copy className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Clone (Copy)</h3>
                        <p className="text-sm text-neutral-400">Your own copy to customize</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-400 font-bold">
                        <Coins className="h-4 w-4" />
                        {pricing.clone.price} AC
                      </div>
                      <p className="text-xs text-neutral-500">one-time</p>
                    </div>
                  </div>
                </button>

                {/* Enterprise */}
                <button
                  onClick={() => setSelectedModel('enterprise')}
                  disabled={!pricing.enterprise.enabled}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedModel === 'enterprise'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  } ${!pricing.enterprise.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20">
                        <Crown className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Enterprise (Transfer)</h3>
                        <p className="text-sm text-neutral-400">
                          {pricing.enterprise.enabled
                            ? 'Full ownership including trust history'
                            : 'Not available for this agent'}
                        </p>
                      </div>
                    </div>
                    {pricing.enterprise.enabled && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-yellow-400 font-bold">
                          <Coins className="h-4 w-4" />
                          {pricing.enterprise.price} AC
                        </div>
                        <p className="text-xs text-neutral-500">one-time</p>
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Insufficient funds warning */}
              {!canAfford && balance !== null && (
                <div className="mx-4 mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">
                    Insufficient credits. You need {getSelectedPrice() - balance} more AC.
                  </span>
                </div>
              )}

              {/* Footer */}
              <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
                <div className="text-sm text-neutral-400">
                  Total:{' '}
                  <span className="text-yellow-400 font-bold">
                    {getSelectedPrice()} AC
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAcquire}
                    disabled={!canAfford || acquiring}
                    className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      canAfford && !acquiring
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    {acquiring ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Acquire'
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default AcquireModal
