'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Scale, Shield, BookOpen, Heart, Loader2, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock, TrendingUp, BarChart3, Activity } from 'lucide-react'

interface ValidatorDetails {
  id: string
  name: string
  domain: string
  description: string
  fullDescription: string
  responsibilities: string[]
  considerations: string[]
  metrics: {
    totalVotes: number
    approvalRate: number
    avgResponseTime: string
    recentDecisions: number
  }
}

const VALIDATOR_DATA: Record<string, ValidatorDetails> = {
  guardian: {
    id: 'guardian',
    name: 'The Guardian',
    domain: 'Safety & Security',
    description: 'Assesses threats, potential harm, and data exposure risk',
    fullDescription: 'The Guardian is the first line of defense in the Council, responsible for evaluating all potential security threats and safety concerns before any agent action is approved. This validator focuses on protecting both users and systems from harm.',
    responsibilities: [
      'Evaluate potential security vulnerabilities in proposed actions',
      'Assess data exposure and privacy risks',
      'Identify potential for physical or digital harm',
      'Review access control and authentication requirements',
      'Monitor for adversarial manipulation attempts',
      'Flag actions that could compromise system integrity',
    ],
    considerations: [
      'Could this action expose sensitive user data?',
      'Is there potential for injection attacks or code execution?',
      'Could this be used to harm the user or others?',
      'Does this action require elevated permissions?',
      'Are there rate-limiting or abuse potential concerns?',
    ],
    metrics: {
      totalVotes: 15420,
      approvalRate: 78.3,
      avgResponseTime: '124ms',
      recentDecisions: 342,
    },
  },
  arbiter: {
    id: 'arbiter',
    name: 'The Arbiter',
    domain: 'Ethics & Fairness',
    description: 'Evaluates ethical implications, fairness, and bias',
    fullDescription: 'The Arbiter ensures that all agent actions align with ethical principles and treat all users fairly. This validator scrutinizes decisions for potential bias and ensures actions respect human dignity and autonomy.',
    responsibilities: [
      'Evaluate actions for ethical implications',
      'Identify potential bias in decision-making',
      'Ensure fair treatment across user demographics',
      'Review for discrimination or prejudice',
      'Assess impact on vulnerable populations',
      'Verify consent and autonomy are respected',
    ],
    considerations: [
      'Does this action treat all users fairly?',
      'Could this disproportionately affect certain groups?',
      'Is the user\'s autonomy being respected?',
      'Are there hidden biases in this decision?',
      'Does this align with established ethical guidelines?',
    ],
    metrics: {
      totalVotes: 12890,
      approvalRate: 82.1,
      avgResponseTime: '156ms',
      recentDecisions: 287,
    },
  },
  scholar: {
    id: 'scholar',
    name: 'The Scholar',
    domain: 'Knowledge & Standards',
    description: 'Verifies compliance, accuracy, and knowledge boundaries',
    fullDescription: 'The Scholar validates that agent actions comply with established standards, regulations, and knowledge boundaries. This validator ensures accuracy and prevents the spread of misinformation while respecting intellectual property.',
    responsibilities: [
      'Verify compliance with industry regulations',
      'Assess accuracy of information being provided',
      'Ensure knowledge boundaries are respected',
      'Review for intellectual property concerns',
      'Validate against established standards (GDPR, HIPAA, etc.)',
      'Flag potential misinformation or hallucinations',
    ],
    considerations: [
      'Is the information being provided accurate?',
      'Does this comply with relevant regulations?',
      'Are we operating within our knowledge boundaries?',
      'Could this constitute intellectual property infringement?',
      'Is this claim verifiable and well-sourced?',
    ],
    metrics: {
      totalVotes: 18650,
      approvalRate: 74.8,
      avgResponseTime: '198ms',
      recentDecisions: 456,
    },
  },
  advocate: {
    id: 'advocate',
    name: 'The Advocate',
    domain: 'User Impact',
    description: 'Assesses user benefit, potential harm, and accessibility',
    fullDescription: 'The Advocate champions the user\'s interests, ensuring that agent actions genuinely benefit users and don\'t cause unintended harm. This validator focuses on accessibility, usability, and overall positive user impact.',
    responsibilities: [
      'Evaluate genuine benefit to the user',
      'Assess potential for user harm or frustration',
      'Ensure accessibility for users with disabilities',
      'Review for usability and clarity',
      'Protect user interests in commercial contexts',
      'Consider long-term user impact',
    ],
    considerations: [
      'Does this genuinely help the user?',
      'Could this cause frustration or confusion?',
      'Is this accessible to all users?',
      'Are we prioritizing user interests over other concerns?',
      'What is the long-term impact on user trust?',
    ],
    metrics: {
      totalVotes: 14230,
      approvalRate: 85.6,
      avgResponseTime: '112ms',
      recentDecisions: 398,
    },
  },
}

const VALIDATOR_ICONS: Record<string, any> = {
  guardian: Shield,
  arbiter: Scale,
  scholar: BookOpen,
  advocate: Heart,
}

const VALIDATOR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  guardian: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  arbiter: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  scholar: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  advocate: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
}

export default function ValidatorDetailPage() {
  const params = useParams()
  const validatorId = params.validatorId as string
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading for now
    setTimeout(() => setLoading(false), 300)
  }, [])

  const validator = VALIDATOR_DATA[validatorId]
  const IconComponent = VALIDATOR_ICONS[validatorId] || Scale
  const colors = VALIDATOR_COLORS[validatorId] || VALIDATOR_COLORS.arbiter

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!validator) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Validator Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The validator "{validatorId}" does not exist.
          </p>
          <Link
            href="/council"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Council
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/council"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Council
        </Link>

        {/* Header */}
        <div className={`card ${colors.border} border-2 mb-8`}>
          <div className="flex items-start gap-6">
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${colors.bg}`}>
              <IconComponent className={`h-10 w-10 ${colors.text}`} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {validator.name}
              </h1>
              <p className={`text-lg font-medium ${colors.text} mb-3`}>
                {validator.domain}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {validator.fullDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <BarChart3 className="h-6 w-6 mx-auto text-gray-400 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {validator.metrics.totalVotes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Votes</div>
          </div>
          <div className="card text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {validator.metrics.approvalRate}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Approval Rate</div>
          </div>
          <div className="card text-center">
            <Clock className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {validator.metrics.avgResponseTime}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Response</div>
          </div>
          <div className="card text-center">
            <Activity className="h-6 w-6 mx-auto text-purple-500 mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {validator.metrics.recentDecisions}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Last 24h</div>
          </div>
        </div>

        {/* Responsibilities */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Core Responsibilities
          </h2>
          <ul className="space-y-3">
            {validator.responsibilities.map((resp, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle className={`h-5 w-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                <span className="text-gray-700 dark:text-gray-300">{resp}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Considerations */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Key Considerations
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            When evaluating an action, {validator.name} asks:
          </p>
          <ul className="space-y-3">
            {validator.considerations.map((consideration, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${colors.bg} flex-shrink-0`}>
                  <span className={`text-xs font-bold ${colors.text}`}>{index + 1}</span>
                </div>
                <span className="text-gray-700 dark:text-gray-300 italic">"{consideration}"</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Activity Placeholder */}
        <div className="card bg-gray-100 dark:bg-gray-800">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <TrendingUp className="h-5 w-5" />
            <span className="font-medium">Recent voting activity and decision history coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}
