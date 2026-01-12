'use client'

import { BookOpen, CheckCircle, Clock, PlayCircle } from 'lucide-react'

interface Enrollment {
  id: string
  enrolled_at: string
  started_at: string | null
  completed_at: string | null
  status: string
  progress_stats: {
    modules_completed: number
    total_modules: number
    percentage: number
  }
  curriculum: {
    id: string
    name: string
    specialization: string
    difficulty_level: number
    certification_points: number
    trust_points: number
  }
}

interface EnrollmentStatusProps {
  enrollment: Enrollment
  onContinue?: (enrollmentId: string) => void
}

const STATUS_CONFIG = {
  enrolled: {
    label: 'Enrolled',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: BookOpen,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: PlayCircle,
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: Clock,
  },
}

export default function EnrollmentStatus({ enrollment, onContinue }: EnrollmentStatusProps) {
  const config = STATUS_CONFIG[enrollment.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.enrolled
  const Icon = config.icon
  const { progress_stats } = enrollment

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>

        {/* Info */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">
            {enrollment.curriculum.name}
          </h4>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {progress_stats.modules_completed}/{progress_stats.total_modules} modules
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-4">
        <div className="w-32">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Progress</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {progress_stats.percentage}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                enrollment.status === 'completed'
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progress_stats.percentage}%` }}
            />
          </div>
        </div>

        {/* Continue Button */}
        {enrollment.status !== 'completed' && (
          <button
            onClick={() => onContinue?.(enrollment.id)}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            {enrollment.status === 'enrolled' ? 'Start' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}
