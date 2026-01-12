import { LucideIcon, Clock } from 'lucide-react'

interface ComingSoonPageProps {
  title: string
  description: string
  icon: LucideIcon
  features?: string[]
}

export default function ComingSoonPage({
  title,
  description,
  icon: Icon,
  features,
}: ComingSoonPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>

        <p className="mb-6 text-gray-600 dark:text-gray-400">
          {description}
        </p>

        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Clock className="h-4 w-4" />
          Coming Soon
        </div>

        {features && features.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-left dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
              What to expect:
            </h2>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
