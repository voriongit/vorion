'use client'

import { CheckCircle, Circle, Lock, PlayCircle } from 'lucide-react'

interface Module {
  id: string
  name: string
  description: string
  state: 'completed' | 'current' | 'available' | 'locked'
  score?: number | null
}

interface ModuleProgressProps {
  modules: Module[]
  onModuleClick?: (moduleId: string) => void
  currentModuleId?: string | null
}

export default function ModuleProgress({
  modules,
  onModuleClick,
  currentModuleId,
}: ModuleProgressProps) {
  const completedCount = modules.filter(m => m.state === 'completed').length
  const percentage = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'current':
        return <PlayCircle className="h-5 w-5 text-blue-500" />
      case 'available':
        return <Circle className="h-5 w-5 text-gray-400" />
      case 'locked':
        return <Lock className="h-4 w-4 text-gray-300" />
      default:
        return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStateStyles = (state: string, isSelected: boolean) => {
    const base = 'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer'

    if (state === 'locked') {
      return `${base} border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed`
    }

    if (isSelected) {
      return `${base} border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500`
    }

    switch (state) {
      case 'completed':
        return `${base} border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700`
      case 'current':
        return `${base} border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700`
      case 'available':
        return `${base} border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`
      default:
        return `${base} border-gray-200 dark:border-gray-700`
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Progress: {completedCount}/{modules.length} modules
        </span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {percentage}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Module List */}
      <div className="space-y-2 mt-4">
        {modules.map((module, index) => {
          const isSelected = currentModuleId === module.id
          const isClickable = module.state !== 'locked'

          return (
            <div
              key={module.id}
              className={getStateStyles(module.state, isSelected)}
              onClick={() => isClickable && onModuleClick?.(module.id)}
            >
              {/* Module Number */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                module.state === 'completed'
                  ? 'bg-green-500 text-white'
                  : module.state === 'current'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {index + 1}
              </div>

              {/* Module Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium truncate ${
                    module.state === 'locked'
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {module.name}
                  </p>
                  {module.score !== null && module.score !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      {module.score}%
                    </span>
                  )}
                </div>
                <p className={`text-sm truncate ${
                  module.state === 'locked'
                    ? 'text-gray-300 dark:text-gray-600'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {module.description}
                </p>
              </div>

              {/* State Icon */}
              <div className="flex-shrink-0">
                {getStateIcon(module.state)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Completion Message */}
      {percentage === 100 && (
        <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-400">
            All modules completed! Ready for Council Examination.
          </p>
        </div>
      )}
    </div>
  )
}
