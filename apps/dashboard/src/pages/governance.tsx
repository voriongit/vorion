import Layout from '../components/Layout'
import useSWR from 'swr'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Proposal {
  id: string;
  timestamp: string;
  agent: string;
  intent: string;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  justification?: string;
  decidedAt?: string;
  decidedBy?: string;
}

interface DecisionModalProps {
  proposal: Proposal | null;
  decision: 'approve' | 'reject' | null;
  onClose: () => void;
  onConfirm: (justification: string) => void;
}

function DecisionModal({ proposal, decision, onClose, onConfirm }: DecisionModalProps) {
  const [justification, setJustification] = useState('');
  const isApprove = decision === 'approve';

  if (!proposal || !decision) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className={`px-6 py-4 border-b border-white/10 ${isApprove ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <h2 className={`text-xl font-bold ${isApprove ? 'text-green-400' : 'text-red-400'}`}>
              {isApprove ? 'Approve Proposal' : 'Reject Proposal'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Provide justification for your decision
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Proposal Summary */}
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-slate-500">Agent:</span>
                <span className="font-bold text-slate-200 uppercase">{proposal.agent}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs uppercase text-slate-500 pt-0.5">Intent:</span>
                <span className="text-slate-300 text-sm">{proposal.intent}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-slate-500">Risk:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  proposal.risk === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {proposal.risk}
                </span>
              </div>
            </div>

            {/* Justification Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Justification {isApprove ? '(optional)' : '(required)'}
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={isApprove
                  ? "Why are you approving this action?"
                  : "Why are you rejecting this action?"
                }
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(justification)}
              disabled={!isApprove && !justification.trim()}
              className={`px-6 py-2 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isApprove
                  ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20'
                  : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20'
              }`}
            >
              {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Governance() {
  const { data: proposals, mutate } = useSWR<Proposal[]>('/api/proposals', fetcher, { refreshInterval: 2000 })
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null);
  const toast = useToast();

  const openDecisionModal = (proposal: Proposal, decision: 'approve' | 'reject') => {
    setSelectedProposal(proposal);
    setPendingDecision(decision);
  };

  const closeModal = () => {
    setSelectedProposal(null);
    setPendingDecision(null);
  };

  const handleConfirmDecision = async (justification: string) => {
    if (!selectedProposal || !pendingDecision) return;

    try {
      await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedProposal.id,
          decision: pendingDecision,
          justification
        })
      });

      toast.success(`Proposal ${pendingDecision === 'approve' ? 'approved' : 'rejected'}`);
      mutate();
      closeModal();
    } catch {
      toast.error('Failed to submit decision');
    }
  };

  return (
    <Layout title="Governance">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-600">
          The Council Chamber
        </h1>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>{proposals?.length || 0} pending decisions</span>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-slate-800/50 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-500">Timestamp</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-500">Agent</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-500">Intent</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-500">Risk</th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {proposals?.map((p) => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4 font-mono text-xs text-slate-400">
                  {new Date(p.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 font-bold text-slate-200 uppercase text-xs">{p.agent}</td>
                <td className="px-6 py-4 text-slate-300 max-w-md">
                  <div className="truncate">{p.intent}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    p.risk === 'HIGH'
                      ? 'bg-red-500/20 text-red-400'
                      : p.risk === 'MEDIUM'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {p.risk}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-2 justify-end opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openDecisionModal(p, 'approve')}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-bold shadow-lg shadow-green-900/20 transition-colors"
                    >
                      APPROVE
                    </button>
                    <button
                      onClick={() => openDecisionModal(p, 'reject')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-bold shadow-lg shadow-red-900/20 transition-colors"
                    >
                      REJECT
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!proposals || proposals.length === 0) && (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">⚖️</div>
            <div className="text-slate-500 italic">No pending proposals</div>
            <div className="text-xs text-slate-600 mt-2">The Council is at rest</div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {proposals?.map((p) => (
          <div
            key={p.id}
            className="bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-3"
          >
            {/* Header with Agent and Risk */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 uppercase text-sm">{p.agent}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  p.risk === 'HIGH'
                    ? 'bg-red-500/20 text-red-400'
                    : p.risk === 'MEDIUM'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {p.risk}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-500">
                {new Date(p.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Intent */}
            <p className="text-slate-300 text-sm leading-relaxed">{p.intent}</p>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => openDecisionModal(p, 'approve')}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold shadow-lg shadow-green-900/20 transition-colors"
              >
                APPROVE
              </button>
              <button
                onClick={() => openDecisionModal(p, 'reject')}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 transition-colors"
              >
                REJECT
              </button>
            </div>
          </div>
        ))}

        {(!proposals || proposals.length === 0) && (
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">⚖️</div>
            <div className="text-slate-500 italic">No pending proposals</div>
            <div className="text-xs text-slate-600 mt-2">The Council is at rest</div>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {selectedProposal && pendingDecision && (
        <DecisionModal
          proposal={selectedProposal}
          decision={pendingDecision}
          onClose={closeModal}
          onConfirm={handleConfirmDecision}
        />
      )}
    </Layout>
  )
}
