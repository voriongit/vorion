'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Key, Book, Code2 } from 'lucide-react'

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Scalar API Reference
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'
    script.async = true
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-neutral-900/95 backdrop-blur border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-neutral-700" />
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-blue-500" />
              <h1 className="text-lg font-semibold text-neutral-100">API Documentation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/api-keys"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <Key className="w-4 h-4" />
              Get API Key
            </Link>
            <a
              href="/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Code2 className="w-4 h-4" />
              OpenAPI Spec
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Quick Start Guide */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                  1
                </div>
                <h3 className="font-medium text-neutral-100">Get Your API Key</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Navigate to{' '}
                <Link href="/settings/api-keys" className="text-blue-400 hover:underline">
                  Settings &gt; API Keys
                </Link>{' '}
                to generate your key.
              </p>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                  2
                </div>
                <h3 className="font-medium text-neutral-100">Authenticate Requests</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Add your key to the Authorization header:{' '}
                <code className="text-xs bg-neutral-700 px-1 py-0.5 rounded">
                  Bearer YOUR_API_KEY
                </code>
              </p>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                  3
                </div>
                <h3 className="font-medium text-neutral-100">Make Your First Call</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Try{' '}
                <code className="text-xs bg-neutral-700 px-1 py-0.5 rounded">GET /api/v1/agents</code>{' '}
                to list your agents.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Example Code */}
      <div className="bg-neutral-900/50 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Quick Example
          </h2>
          <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-xs text-neutral-500">cURL</span>
            </div>
            <pre className="p-4 text-sm text-neutral-300 overflow-x-auto">
              <code>{`curl -X GET "https://app.agentanchorai.com/api/v1/agents" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Scalar API Reference */}
      <div ref={containerRef} className="api-reference-container">
        <script
          id="api-reference"
          data-url="/openapi.json"
          data-configuration={JSON.stringify({
            theme: 'kepler',
            layout: 'modern',
            showSidebar: true,
            hideModels: false,
            hideDownloadButton: false,
            hiddenClients: ['c', 'objc', 'ocaml'],
            defaultHttpClient: {
              targetKey: 'javascript',
              clientKey: 'fetch',
            },
            customCss: `
              .dark-mode {
                --scalar-background-1: #0a0a0a;
                --scalar-background-2: #171717;
                --scalar-background-3: #262626;
                --scalar-color-1: #fafafa;
                --scalar-color-2: #a3a3a3;
                --scalar-color-3: #737373;
                --scalar-color-accent: #3b82f6;
              }
            `,
          })}
        />
      </div>

      {/* Fallback content while Scalar loads */}
      <noscript>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center">
            <p className="text-yellow-400">
              JavaScript is required to view the interactive API documentation.
            </p>
            <p className="text-yellow-500/70 mt-2">
              You can still download the{' '}
              <a href="/openapi.json" className="text-blue-400 hover:underline">
                OpenAPI specification
              </a>{' '}
              directly.
            </p>
          </div>
        </div>
      </noscript>
    </div>
  )
}
