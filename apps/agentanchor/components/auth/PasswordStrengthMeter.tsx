'use client'

import { useMemo } from 'react'

interface PasswordStrengthMeterProps {
  password: string
}

interface PasswordCheck {
  label: string
  met: boolean
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const checks = useMemo<PasswordCheck[]>(() => {
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ]
  }, [password])

  const strength = useMemo(() => {
    const metCount = checks.filter((c) => c.met).length
    if (metCount === 0) return { level: 0, label: '', color: '' }
    if (metCount <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' }
    if (metCount <= 3) return { level: 2, label: 'Fair', color: 'bg-yellow-500' }
    if (metCount <= 4) return { level: 3, label: 'Good', color: 'bg-blue-500' }
    return { level: 4, label: 'Strong', color: 'bg-green-500' }
  }, [checks])

  const isValid = checks.every((c) => c.met)

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              level <= strength.level ? strength.color : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      {strength.label && (
        <p className={`text-sm font-medium ${
          strength.level <= 1 ? 'text-red-600 dark:text-red-400' :
          strength.level === 2 ? 'text-yellow-600 dark:text-yellow-400' :
          strength.level === 3 ? 'text-blue-600 dark:text-blue-400' :
          'text-green-600 dark:text-green-400'
        }`}>
          {strength.label}
        </p>
      )}

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {checks.map((check, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 text-xs ${
              check.met
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {check.met ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Validate password meets all requirements
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return { valid: errors.length === 0, errors }
}
