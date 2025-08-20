import { useState, useEffect } from 'react'
import Link from 'next/link'

interface MCPServer {
  id: string
  name: string
  description: string
  transport: 'sse' | 'stdio' | 'http'
  url: string
  command: string
  status: 'active' | 'inactive' | 'error' | 'connecting'
  tools_count: number
  error_message?: string
  last_connected_at?: string
  tools_discovered_at?: string
  created_at: string
  updated_at: string
}

interface MCPServerCreate {
  name: string
  description: string
  transport: 'sse' | 'stdio' | 'http'
  url: string
  command: string
  auth_token: string
}

interface MCPServerUpdate {
  name: string
  description: string
  transport: 'sse' | 'stdio' | 'http'
  url: string
  command: string
  auth_token: string
}

export default function MCPServersPage() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const [createData, setCreateData] = useState<MCPServerCreate>({
    name: '',
    description: '',
    transport: 'sse',
    url: '',
    command: '',
    auth_token: ''
  })
  const [editData, setEditData] = useState<MCPServerUpdate>({
    name: '',
    description: '',
    transport: 'sse',
    url: '',
    command: '',
    auth_token: ''
  })

  useEffect(() => {
    fetchServers()
  }, [])

  const fetchServers = async () => {
    try {
      const response = await fetch('http://localhost:8000/mcp-servers/')
      if (response.ok) {
        const data = await response.json()
        setServers(data)
      }
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error)
    } finally {
      setLoading(false)
    }
  }

  const createServer = async () => {
    try {
      const response = await fetch('http://localhost:8000/mcp-servers/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData)
      })
      
      if (response.ok) {
        setShowCreateForm(false)
        setCreateData({
          name: '',
          description: '',
          transport: 'sse',
          url: '',
          command: '',
          auth_token: ''
        })
        fetchServers()
      } else {
        const error = await response.json()
        alert(`Failed to create server: ${error.detail}`)
      }
    } catch (error) {
      console.error('Failed to create MCP server:', error)
      alert('Failed to create server')
    }
  }

  const openEditForm = (server: MCPServer) => {
    setEditingServer(server)
    setEditData({
      name: server.name,
      description: server.description,
      transport: server.transport,
      url: server.url || '',
      command: server.command || '',
      auth_token: '' // Don't pre-fill auth token for security
    })
    setShowEditForm(true)
  }

  const updateServer = async () => {
    if (!editingServer) return
    
    try {
      const response = await fetch(`http://localhost:8000/mcp-servers/${editingServer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      
      if (response.ok) {
        setShowEditForm(false)
        setEditingServer(null)
        setEditData({
          name: '',
          description: '',
          transport: 'sse',
          url: '',
          command: '',
          auth_token: ''
        })
        fetchServers()
      } else {
        const error = await response.json()
        alert(`Failed to update server: ${error.detail}`)
      }
    } catch (error) {
      console.error('Failed to update MCP server:', error)
      alert('Failed to update server')
    }
  }

  const connectServer = async (serverId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/mcp-servers/${serverId}/connect`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchServers()
        alert('Successfully connected to server')
      } else {
        const error = await response.json()
        alert(`Failed to connect: ${error.detail}`)
      }
    } catch (error) {
      console.error('Failed to connect to server:', error)
      alert('Failed to connect to server')
    }
  }

  const disconnectServer = async (serverId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/mcp-servers/${serverId}/disconnect`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchServers()
        alert('Successfully disconnected from server')
      } else {
        const error = await response.json()
        alert(`Failed to disconnect: ${error.detail}`)
      }
    } catch (error) {
      console.error('Failed to disconnect from server:', error)
    }
  }

  const refreshTools = async (serverId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/mcp-servers/${serverId}/refresh-tools`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchServers()
        alert('Successfully refreshed tools')
      } else {
        const error = await response.json()
        alert(`Failed to refresh tools: ${error.detail}`)
      }
    } catch (error) {
      console.error('Failed to refresh tools:', error)
    }
  }

  const deleteServer = async (serverId: string, serverName: string) => {
    if (!confirm(`Are you sure you want to delete "${serverName}"?`)) return
    
    try {
      const response = await fetch(`http://localhost:8000/mcp-servers/${serverId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchServers()
      } else {
        const error = await response.json()
        alert(`Failed to delete server: ${error.detail}`)
      }
    } catch (error) {
      console.error('Failed to delete server:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'connecting': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">Loading MCP servers...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">MCP Servers</h1>
          <p className="text-gray-600">Manage Model Context Protocol server connections</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="btn btn-secondary">
            ← Back to Admin
          </Link>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            + Add MCP Server
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Add MCP Server</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="My MCP Server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Description of the MCP server"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Transport</label>
                <select
                  value={createData.transport}
                  onChange={(e) => setCreateData({ ...createData, transport: e.target.value as any })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="sse">SSE (Server-Sent Events)</option>
                  <option value="http">HTTP</option>
                  <option value="stdio">Stdio</option>
                </select>
              </div>

              {(createData.transport === 'sse' || createData.transport === 'http') && (
                <div>
                  <label className="block text-sm font-medium mb-1">URL</label>
                  <input
                    type="url"
                    value={createData.url}
                    onChange={(e) => setCreateData({ ...createData, url: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="http://localhost:3001/mcp"
                  />
                </div>
              )}

              {createData.transport === 'stdio' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Command</label>
                  <input
                    type="text"
                    value={createData.command}
                    onChange={(e) => setCreateData({ ...createData, command: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="node server.js"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Auth Token (Optional)</label>
                <input
                  type="text"
                  value={createData.auth_token}
                  onChange={(e) => setCreateData({ ...createData, auth_token: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Bearer token or API key"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={createServer}
                className="flex-1 btn btn-primary"
                disabled={!createData.name || 
                  (createData.transport !== 'stdio' && !createData.url) ||
                  (createData.transport === 'stdio' && !createData.command)
                }
              >
                Create Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {showEditForm && editingServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Edit MCP Server</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="My MCP Server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Description of the MCP server"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Transport</label>
                <select
                  value={editData.transport}
                  onChange={(e) => setEditData({ ...editData, transport: e.target.value as any })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="sse">SSE (Server-Sent Events)</option>
                  <option value="http">HTTP</option>
                  <option value="stdio">Stdio</option>
                </select>
              </div>

              {(editData.transport === 'sse' || editData.transport === 'http') && (
                <div>
                  <label className="block text-sm font-medium mb-1">URL</label>
                  <input
                    type="url"
                    value={editData.url}
                    onChange={(e) => setEditData({ ...editData, url: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="http://localhost:3001/mcp"
                  />
                </div>
              )}

              {editData.transport === 'stdio' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Command</label>
                  <input
                    type="text"
                    value={editData.command}
                    onChange={(e) => setEditData({ ...editData, command: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="node server.js"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Auth Token (Leave empty to keep current)</label>
                <input
                  type="text"
                  value={editData.auth_token}
                  onChange={(e) => setEditData({ ...editData, auth_token: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Bearer token or API key"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowEditForm(false)
                  setEditingServer(null)
                }}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={updateServer}
                className="flex-1 btn btn-primary"
                disabled={!editData.name || 
                  (editData.transport !== 'stdio' && !editData.url) ||
                  (editData.transport === 'stdio' && !editData.command)
                }
              >
                Update Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Servers List */}
      {servers.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No MCP servers configured</div>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            Add your first MCP server
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <div key={server.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{server.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(server.status)}`}>
                      {server.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{server.description}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    Transport: {server.transport.toUpperCase()} | 
                    Tools: {server.tools_count} |
                    {server.last_connected_at && ` Last connected: ${new Date(server.last_connected_at).toLocaleString()}`}
                  </div>
                </div>

                <div className="flex gap-2">
                  {server.status === 'active' ? (
                    <>
                      <button
                        onClick={() => refreshTools(server.id)}
                        className="btn btn-sm btn-secondary"
                      >
                        Refresh Tools
                      </button>
                      <button
                        onClick={() => disconnectServer(server.id)}
                        className="btn btn-sm btn-secondary"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => connectServer(server.id)}
                      className="btn btn-sm btn-primary"
                    >
                      Connect
                    </button>
                  )}
                  <button
                    onClick={() => openEditForm(server)}
                    className="btn btn-sm btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteServer(server.id, server.name)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {server.error_message && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  <strong>Error:</strong> {server.error_message}
                </div>
              )}

              <div className="text-xs text-gray-500">
                <div>URL/Command: {server.url || server.command}</div>
                <div>Created: {new Date(server.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}