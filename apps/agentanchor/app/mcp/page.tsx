import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Settings, Plus } from 'lucide-react'

export default async function MCPServersPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data: mcpServers } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MCP Servers
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure Model Context Protocol servers for your bots
          </p>
        </div>
        <Link href="/mcp/new" className="btn-primary">
          <Plus className="h-4 w-4 inline mr-2" />
          Add MCP Server
        </Link>
      </div>

      {mcpServers && mcpServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mcpServers.map((server) => (
            <div key={server.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
                    <Settings className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {server.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {server.type}
                    </p>
                  </div>
                </div>
              </div>

              {server.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {server.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href={`/mcp/${server.id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Configure
                </Link>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Created {new Date(server.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No MCP servers yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add MCP servers to extend your bots with external tools and data
          </p>
          <Link href="/mcp/new" className="btn-primary">
            <Plus className="h-4 w-4 inline mr-2" />
            Add Your First MCP Server
          </Link>
        </div>
      )}

      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          What are MCP Servers?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Model Context Protocol (MCP) servers allow your AI bots to access external tools,
          databases, APIs, and file systems. Common MCP server types include:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <li>• <strong>Filesystem:</strong> Access and manipulate files</li>
          <li>• <strong>GitHub:</strong> Interact with repositories</li>
          <li>• <strong>Database:</strong> Query and update databases</li>
          <li>• <strong>Web Search:</strong> Search the internet</li>
          <li>• <strong>Custom:</strong> Your own custom integrations</li>
        </ul>
      </div>
    </div>
  )
}
