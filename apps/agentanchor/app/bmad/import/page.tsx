'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Loader2, CheckCircle, Package } from 'lucide-react'
import Link from 'next/link'

interface BMADAgent {
  name: string
  title: string
  description: string
  icon: string
  filePath: string
}

export default function BMADImportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [agents, setAgents] = useState<BMADAgent[]>([])
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/bmad/import-agents')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load BMAD agents')
      }

      setAgents(data.agents)
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const toggleAgent = (name: string) => {
    const newSelected = new Set(selectedAgents)
    if (newSelected.has(name)) {
      newSelected.delete(name)
    } else {
      newSelected.add(name)
    }
    setSelectedAgents(newSelected)
  }

  const toggleAll = () => {
    if (selectedAgents.size === agents.length) {
      setSelectedAgents(new Set())
    } else {
      setSelectedAgents(new Set(agents.map(a => a.name)))
    }
  }

  const importAgents = async () => {
    setImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/bmad/import-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentNames: Array.from(selectedAgents) }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import agents')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/bots')
      }, 2000)
    } catch (err: any) {
      setError(err.message)
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          BMAD Agents Imported Successfully!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''} imported as bots.
        </p>
        <p className="text-sm text-gray-500">Redirecting to bots page...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/bots"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Import BMAD Agents
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Import professional AI agents from BMAD Method framework as ready-to-use bots
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error}
          {error.includes('BMAD not installed') && (
            <div className="mt-2">
              <p className="text-sm font-medium">To install BMAD:</p>
              <code className="block mt-1 p-2 bg-red-900/20 rounded text-xs">
                npx bmad-method@alpha install
              </code>
            </div>
          )}
        </div>
      )}

      {agents.length === 0 && !error && (
        <div className="card text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No BMAD Agents Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Install BMAD to get access to 15+ professional AI agents
          </p>
        </div>
      )}

      {agents.length > 0 && (
        <>
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Available Agents ({agents.length})
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Select agents to import as bots. Selected: {selectedAgents.size}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toggleAll}
                  className="btn-secondary text-sm"
                >
                  {selectedAgents.size === agents.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={importAgents}
                  disabled={selectedAgents.size === 0 || importing}
                  className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import Selected ({selectedAgents.size})
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() => toggleAgent(agent.name)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    selectedAgents.has(agent.name)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {agent.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {agent.description}
                      </p>
                    </div>
                    {selectedAgents.has(agent.name) && (
                      <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              About BMAD Agents
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-400">
              BMAD (Breakthrough Method for Agile AI-Driven Development) provides professional-grade
              AI agents designed for software development, creative work, and business processes. Each
              agent has specialized workflows and can be customized after import.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
