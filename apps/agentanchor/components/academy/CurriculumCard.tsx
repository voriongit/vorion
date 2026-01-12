'use client'

import { useState } from 'react'
import { BookOpen, Clock, Star, Trophy, Users, ChevronDown, ChevronUp } from 'lucide-react'

interface Module {
  id: string
  name: string
  description: string
}

interface Curriculum {
  id: string
  name: string
  description: string
  specialization: string
  difficulty_level: number
  modules: Module[]
  certification_points: number
  trust_points: number
  estimated_duration_hours: number
}

interface CurriculumCardProps {
  curriculum: Curriculum
  onEnroll?: (curriculumId: string) => void
  isEnrolling?: boolean
  isEnrolled?: boolean
  enrolledStatus?: string
}

const SPECIALIZATION_COLORS: Record<string, string> = {
  core: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  customer_service: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  technical: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  creative: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  data: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const SPECIALIZATION_LABELS: Record<string, string> = {
  core: 'Core',
  customer_service: 'Customer Service',
  technical: 'Technical',
  creative: 'Creative',
  data: 'Data',
}

export default function CurriculumCard({
  curriculum,
  onEnroll,
  isEnrolling = false,
  isEnrolled = false,
  enrolledStatus,
}: CurriculumCardProps) {
  const [showModules, setShowModules] = useState(false)

  const renderStars = (level: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < level
            ? 'text-yellow-500 fill-yellow-500'
            : 'text-gray-300 dark:text-gray-600'
        }`}
      />
    ))
  }

  const specializationColor = SPECIALIZATION_COLORS[curriculum.specialization] || SPECIALIZATION_COLORS.core
  const specializationLabel = SPECIALIZATION_LABELS[curriculum.specialization] || curriculum.specialization

  return (
    <div className="card hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${specializationColor}`}>
            {specializationLabel}
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">
            {curriculum.name}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {renderStars(curriculum.difficulty_level)}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {curriculum.description}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <BookOpen className="h-4 w-4" />
          <span>{curriculum.modules?.length || 0} modules</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="h-4 w-4" />
          <span>{curriculum.estimated_duration_hours}h</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Trophy className="h-4 w-4" />
          <span>+{curriculum.trust_points} trust</span>
        </div>
      </div>

      {/* Modules Accordion */}
      <button
        onClick={() => setShowModules(!showModules)}
        className="w-full flex items-center justify-between py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <span>View Modules</span>
        {showModules ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {showModules && curriculum.modules && (
        <div className="mt-2 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
          {curriculum.modules.map((module, index) => (
            <div
              key={module.id}
              className="flex items-start gap-3 text-sm"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {module.name}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  {module.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Button */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        {isEnrolled ? (
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${
              enrolledStatus === 'completed'
                ? 'text-green-600 dark:text-green-400'
                : enrolledStatus === 'in_progress'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {enrolledStatus === 'completed' && 'Completed'}
              {enrolledStatus === 'in_progress' && 'In Progress'}
              {enrolledStatus === 'enrolled' && 'Enrolled'}
            </span>
            {enrolledStatus !== 'completed' && (
              <button className="btn-secondary text-sm py-1.5 px-3">
                Continue
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onEnroll?.(curriculum.id)}
            disabled={isEnrolling}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnrolling ? 'Enrolling...' : 'Enroll Now'}
          </button>
        )}
      </div>
    </div>
  )
}
