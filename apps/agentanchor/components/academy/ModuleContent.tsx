'use client'

import { useState } from 'react'
import { BookOpen, CheckCircle, ChevronRight, Loader2 } from 'lucide-react'

interface ModuleSection {
  type: 'text' | 'list' | 'highlight'
  title?: string
  body?: string
  items?: string[]
}

interface Module {
  id: string
  name: string
  description: string
  content?: {
    sections?: ModuleSection[]
  }
  state: 'completed' | 'current' | 'available' | 'locked'
}

interface ModuleContentProps {
  module: Module
  onComplete: () => void
  isCompleting?: boolean
}

export default function ModuleContent({
  module,
  onComplete,
  isCompleting = false,
}: ModuleContentProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  // Default content if none provided
  const sections = module.content?.sections || [
    {
      type: 'text' as const,
      title: 'Module Overview',
      body: module.description,
    },
    {
      type: 'highlight' as const,
      title: 'Learning Objectives',
      body: `In this module, you will learn the fundamentals of ${module.name.toLowerCase()}. This training is designed to help AI agents understand and apply best practices in real-world scenarios.`,
    },
    {
      type: 'list' as const,
      title: 'Key Concepts',
      items: [
        'Understanding core principles and guidelines',
        'Applying knowledge to practical situations',
        'Recognizing edge cases and handling them appropriately',
        'Maintaining consistency and reliability',
      ],
    },
    {
      type: 'text' as const,
      title: 'Summary',
      body: 'Complete this module to demonstrate understanding and progress to the next stage of your training.',
    },
  ]

  const renderSection = (section: ModuleSection, index: number) => {
    switch (section.type) {
      case 'text':
        return (
          <div key={index} className="mb-6">
            {section.title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {section.title}
              </h3>
            )}
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {section.body}
            </p>
          </div>
        )

      case 'list':
        return (
          <div key={index} className="mb-6">
            {section.title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {section.title}
              </h3>
            )}
            <ul className="space-y-2">
              {section.items?.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-400">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )

      case 'highlight':
        return (
          <div
            key={index}
            className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg"
          >
            {section.title && (
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {section.title}
              </h3>
            )}
            <p className="text-blue-800 dark:text-blue-200">
              {section.body}
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {module.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {module.description}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-2">
        {sections.map((section, index) => renderSection(section, index))}
      </div>

      {/* Completion Section */}
      {module.state !== 'completed' && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Acknowledgment Checkbox */}
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              I have read and understood the content of this module and am ready to proceed.
            </span>
          </label>

          {/* Complete Button */}
          <button
            onClick={onComplete}
            disabled={!acknowledged || isCompleting}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCompleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Mark as Complete
              </>
            )}
          </button>
        </div>
      )}

      {/* Already Completed */}
      {module.state === 'completed' && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Module Completed</span>
          </div>
        </div>
      )}
    </div>
  )
}
