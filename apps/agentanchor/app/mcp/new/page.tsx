'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Server, Database, Github, FolderOpen, Globe } from 'lucide-react'
import Link from 'next/link'

const MCP_TYPES = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    icon: FolderOpen,
    description: 'Access and manipulate files and directories',
    defaultConfig: {
      basePath: '/workspace',
      permissions: ['read', 'write'],
      excludePatterns: ['node_modules', '.git'],
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    description: 'Interact with GitHub repositories',
    defaultConfig: {
      repositories: [],
      permissions: ['read', 'write', 'pr'],
      autoSync: true,
    },
  },
  {
    id: 'database',
    name: 'Database',
    icon: Database,
    description: 'Query and manage databases',
    defaultConfig: {
      type: 'postgresql',
      host: '',
      port: 5432,
      database: '',
      readOnly: false,
    },
  },
  {
    id: 'websearch',
    name: 'Web Search',
    icon: Globe,
    description: 'Search the internet for information',
    defaultConfig: {
      engine: 'google',
      maxResults: 10,
      safeSearch: true,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: Server,
    description: 'Create a custom MCP integration',
    defaultConfig: {
      endpoint: '',
      apiKey: '',
      customSettings: {},
    },
  },
]

export default function NewMCPServerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string>('filesystem')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    config: MCP_TYPES[0].defaultConfig,
  })

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId)
    const type = MCP_TYPES.find((t) => t.id === typeId)
    if (type) {
      setFormData((prev) => ({
        ...prev,
        config: type.defaultConfig,
      }))
    }
  }

  const handleConfigChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const { data, error } = await supabase
        .from('mcp_servers')
        .insert([
          {
            user_id: session.user.id,
            name: formData.name,
            description: formData.description,
            type: selectedType,
            config: formData.config,
          },
        ])
        .select()
        .single()

      if (error) throw error

      router.push(`/mcp/${data.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create MCP server')
      setLoading(false)
    }
  }

  const selectedTypeData = MCP_TYPES.find((t) => t.id === selectedType)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/mcp"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Add MCP Server
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure a Model Context Protocol server
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Selection */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Server Type
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MCP_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeChange(type.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedType === type.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon
                    className={`h-8 w-8 mb-2 ${
                      selectedType === type.id
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  />
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {type.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {type.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Basic Info */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Server Information
          </h3>

          <div>
            <label htmlFor="name" className="label">
              Server Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="input"
              placeholder={`My ${selectedTypeData?.name} Server`}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input"
              rows={3}
              placeholder="Describe what this MCP server will be used for..."
            />
          </div>
        </div>

        {/* Configuration */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configuration
          </h3>

          {/* Filesystem Config */}
          {selectedType === 'filesystem' && (
            <>
              <div>
                <label className="label">Base Path</label>
                <input
                  type="text"
                  value={formData.config.basePath}
                  onChange={(e) =>
                    handleConfigChange('basePath', e.target.value)
                  }
                  className="input"
                  placeholder="/workspace"
                />
              </div>
              <div>
                <label className="label">Permissions</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.config.permissions?.includes('read')}
                      onChange={(e) => {
                        const perms = formData.config.permissions || []
                        handleConfigChange(
                          'permissions',
                          e.target.checked
                            ? [...perms, 'read']
                            : perms.filter((p: string) => p !== 'read')
                        )
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Read</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.config.permissions?.includes('write')}
                      onChange={(e) => {
                        const perms = formData.config.permissions || []
                        handleConfigChange(
                          'permissions',
                          e.target.checked
                            ? [...perms, 'write']
                            : perms.filter((p: string) => p !== 'write')
                        )
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">Write</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* GitHub Config */}
          {selectedType === 'github' && (
            <>
              <div>
                <label className="label">Repositories (comma-separated)</label>
                <input
                  type="text"
                  placeholder="owner/repo1, owner/repo2"
                  className="input"
                  onChange={(e) =>
                    handleConfigChange(
                      'repositories',
                      e.target.value.split(',').map((r) => r.trim())
                    )
                  }
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.config.autoSync}
                    onChange={(e) =>
                      handleConfigChange('autoSync', e.target.checked)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Auto-sync with GitHub</span>
                </label>
              </div>
            </>
          )}

          {/* Database Config */}
          {selectedType === 'database' && (
            <>
              <div>
                <label className="label">Database Type</label>
                <select
                  value={formData.config.type}
                  onChange={(e) => handleConfigChange('type', e.target.value)}
                  className="input"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="redis">Redis</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Host</label>
                  <input
                    type="text"
                    value={formData.config.host}
                    onChange={(e) => handleConfigChange('host', e.target.value)}
                    className="input"
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input
                    type="number"
                    value={formData.config.port}
                    onChange={(e) =>
                      handleConfigChange('port', parseInt(e.target.value))
                    }
                    className="input"
                    placeholder="5432"
                  />
                </div>
              </div>
              <div>
                <label className="label">Database Name</label>
                <input
                  type="text"
                  value={formData.config.database}
                  onChange={(e) =>
                    handleConfigChange('database', e.target.value)
                  }
                  className="input"
                  placeholder="mydb"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.config.readOnly}
                    onChange={(e) =>
                      handleConfigChange('readOnly', e.target.checked)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Read-only mode</span>
                </label>
              </div>
            </>
          )}

          {/* Web Search Config */}
          {selectedType === 'websearch' && (
            <>
              <div>
                <label className="label">Search Engine</label>
                <select
                  value={formData.config.engine}
                  onChange={(e) => handleConfigChange('engine', e.target.value)}
                  className="input"
                >
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                </select>
              </div>
              <div>
                <label className="label">Max Results</label>
                <input
                  type="number"
                  value={formData.config.maxResults}
                  onChange={(e) =>
                    handleConfigChange('maxResults', parseInt(e.target.value))
                  }
                  className="input"
                  min="1"
                  max="50"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.config.safeSearch}
                    onChange={(e) =>
                      handleConfigChange('safeSearch', e.target.checked)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Enable safe search</span>
                </label>
              </div>
            </>
          )}

          {/* Custom Config */}
          {selectedType === 'custom' && (
            <>
              <div>
                <label className="label">API Endpoint</label>
                <input
                  type="url"
                  value={formData.config.endpoint}
                  onChange={(e) =>
                    handleConfigChange('endpoint', e.target.value)
                  }
                  className="input"
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <label className="label">API Key</label>
                <input
                  type="password"
                  value={formData.config.apiKey}
                  onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                  className="input"
                  placeholder="Enter API key"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Creating...' : 'Create MCP Server'}
          </button>
          <Link href="/mcp" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
