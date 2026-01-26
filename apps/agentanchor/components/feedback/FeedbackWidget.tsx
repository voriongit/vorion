'use client';

import { useState, useCallback } from 'react';

/**
 * Feedback types for categorization
 */
type FeedbackType = 'bug' | 'feature' | 'improvement' | 'general';

/**
 * Feedback submission data
 */
interface FeedbackData {
  type: FeedbackType;
  message: string;
  email?: string;
  page: string;
  timestamp: string;
}

/**
 * Props for FeedbackWidget
 */
interface FeedbackWidgetProps {
  /** Position of the widget */
  position?: 'bottom-right' | 'bottom-left';
  /** Custom submission handler (defaults to console.log in dev) */
  onSubmit?: (data: FeedbackData) => Promise<void>;
}

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: '🐛' },
  { value: 'feature', label: 'Feature Request', icon: '✨' },
  { value: 'improvement', label: 'Improvement', icon: '📈' },
  { value: 'general', label: 'General Feedback', icon: '💬' },
];

/**
 * FeedbackWidget - Floating feedback collection component
 *
 * Allows users to submit feedback from anywhere in the application.
 * Supports bug reports, feature requests, improvements, and general feedback.
 *
 * @example
 * ```tsx
 * <FeedbackWidget
 *   position="bottom-right"
 *   onSubmit={async (data) => {
 *     await fetch('/api/feedback', {
 *       method: 'POST',
 *       body: JSON.stringify(data),
 *     });
 *   }}
 * />
 * ```
 */
export function FeedbackWidget({
  position = 'bottom-right',
  onSubmit,
}: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positionClasses =
    position === 'bottom-right' ? 'right-4 bottom-4' : 'left-4 bottom-4';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!message.trim()) {
        setError('Please enter your feedback');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const feedbackData: FeedbackData = {
        type,
        message: message.trim(),
        email: email.trim() || undefined,
        page: typeof window !== 'undefined' ? window.location.pathname : '',
        timestamp: new Date().toISOString(),
      };

      try {
        if (onSubmit) {
          await onSubmit(feedbackData);
        } else {
          // Default: log to console in development
          console.log('[Feedback]', feedbackData);

          // In production, you could POST to an API endpoint:
          // await fetch('/api/feedback', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify(feedbackData),
          // });
        }

        setIsSuccess(true);
        setMessage('');
        setEmail('');

        // Auto-close after success
        setTimeout(() => {
          setIsOpen(false);
          setIsSuccess(false);
        }, 2000);
      } catch (err) {
        setError('Failed to submit feedback. Please try again.');
        console.error('[Feedback Error]', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [type, message, email, onSubmit]
  );

  return (
    <div
      className={`fixed ${positionClasses} z-50`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      {/* Feedback Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Open feedback form"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}

      {/* Feedback Form */}
      {isOpen && (
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80 sm:w-96"
          role="dialog"
          aria-labelledby="feedback-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2
              id="feedback-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Send Feedback
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close feedback form"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="p-6 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-gray-900 dark:text-white font-medium">
                Thank you for your feedback!
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                We appreciate you taking the time to help us improve.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Feedback Type */}
              <div>
                <label className="label">Type of Feedback</label>
                <div className="grid grid-cols-2 gap-2">
                  {FEEDBACK_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setType(ft.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        type === ft.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <span aria-hidden="true">{ft.icon}</span>
                      <span>{ft.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="feedback-message" className="label">
                  Your Feedback
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={4}
                  className="input resize-none"
                  required
                  aria-describedby={error ? 'feedback-error' : undefined}
                />
              </div>

              {/* Email (optional) */}
              <div>
                <label htmlFor="feedback-email" className="label">
                  Email (optional)
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Include your email if you'd like us to follow up.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <p
                  id="feedback-error"
                  className="text-sm text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Feedback'
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
