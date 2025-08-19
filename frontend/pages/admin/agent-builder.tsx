import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import AgentCanvas from '../../components/canvas/AgentCanvas'
import { FlowProvider } from '../../context/FlowContext'

// Example agents defined outside component to avoid recreation
const EXAMPLE_AGENTS = [
  {
    metadata: {
      name: "Simple AI Chat Agent",
      description: "Basic AI agent with LLM for chat interactions",
      version: "1.0.0",
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      tags: ["chat", "general"]
    },
    nodes: [
      {
        id: "trigger_1",
        type: "trigger",
        position: { x: 100, y: 100 },
        data: {
          type: "webhook",
          method: "POST",
          path: "/chat",
          authentication: false
        }
      },
      {
        id: "agent_1",
        type: "agent",
        position: { x: 300, y: 100 },
        data: {
          name: "Chat Assistant",
          description: "Friendly AI chat assistant",
          systemPrompt: "You are a helpful AI assistant. Be friendly and concise.",
          capabilities: ["chat", "general_knowledge"],
          memory: true,
          contextWindow: 4000
        }
      },
      {
        id: "llm_1",
        type: "llm",
        position: { x: 500, y: 100 },
        data: {
          provider: "OpenAI",
          model: "gpt-4",
          temperature: 0.7,
          maxTokens: 1000,
          apiKey: "sk-..."
        }
      },
      {
        id: "output_1",
        type: "output",
        position: { x: 700, y: 100 },
        data: {
          format: "json",
          destination: "api",
          template: "{{response}}"
        }
      }
    ],
    connections: [
      {
        id: "conn_1",
        source: "trigger_1",
        target: "agent_1",
        sourceHandle: "trigger_1_output_bottom",
        targetHandle: "agent_1_input_top",
        type: "data",
        dataType: "any"
      },
      {
        id: "conn_2",
        source: "agent_1",
        target: "llm_1",
        sourceHandle: "agent_1_output_bottom",
        targetHandle: "llm_1_input_top",
        type: "data",
        dataType: "any"
      },
      {
        id: "conn_3",
        source: "llm_1",
        target: "output_1",
        sourceHandle: "llm_1_output_bottom",
        targetHandle: "output_1_input_top",
        type: "data",
        dataType: "any"
      }
    ]
  },
  {
    metadata: {
      name: "Image Analysis Agent",
      description: "Multi-component agent for image analysis and description",
      version: "1.0.0",
      createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      tags: ["image", "analysis", "vision"]
    },
    nodes: [
      {
        id: "trigger_2",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          type: "webhook",
          method: "POST",
          path: "/analyze-image",
          authentication: true
        }
      },
      {
        id: "agent_2",
        type: "agent",
        position: { x: 300, y: 200 },
        data: {
          name: "Image Analyzer",
          description: "Specialized agent for image analysis",
          systemPrompt: "You are an expert at analyzing images. Provide detailed descriptions.",
          capabilities: ["image_analysis", "visual_recognition"],
          memory: false,
          contextWindow: 8000
        }
      },
      {
        id: "tool_1",
        type: "tool",
        position: { x: 500, y: 200 },
        data: {
          name: "Vision API",
          type: "image_analysis",
          description: "Advanced image recognition and analysis",
          parameters: { confidence: 0.9, max_labels: 10 },
          enabled: true
        }
      },
      {
        id: "memory_1",
        type: "memory",
        position: { x: 500, y: 400 },
        data: {
          type: "vector",
          maxSize: 10000,
          similarity: 0.85,
          retention: "30d"
        }
      },
      {
        id: "output_2",
        type: "output",
        position: { x: 700, y: 200 },
        data: {
          format: "markdown",
          destination: "api",
          template: "# Image Analysis Results\n\n{{analysis}}"
        }
      }
    ],
    connections: [
      {
        id: "conn_4",
        source: "trigger_2",
        target: "agent_2",
        sourceHandle: "trigger_2_output_bottom",
        targetHandle: "agent_2_input_top",
        type: "data",
        dataType: "any"
      },
      {
        id: "conn_5",
        source: "agent_2",
        target: "tool_1",
        sourceHandle: "agent_2_output_bottom",
        targetHandle: "tool_1_input_top",
        type: "data",
        dataType: "any"
      },
      {
        id: "conn_6",
        source: "tool_1",
        target: "memory_1",
        sourceHandle: "tool_1_output_right",
        targetHandle: "memory_1_input_left",
        type: "memory",
        dataType: "any"
      },
      {
        id: "conn_7",
        source: "tool_1",
        target: "output_2",
        sourceHandle: "tool_1_output_bottom",
        targetHandle: "output_2_input_top",
        type: "data",
        dataType: "any"
      }
    ]
  }
]

export default function AgentBuilderPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [savedAgents, setSavedAgents] = useState<any[]>([])
  const [currentAgent, setCurrentAgent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [editingAgentName, setEditingAgentName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTag, setFilterTag] = useState<string>('')

  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true)
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      
      // Add cache-busting to prevent browser caching
      const timestamp = Date.now()
      const response = await fetch(`${apiBase}/agent-builder?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('🤖 Loaded agents from backend:', data.agents?.length || 0)
        console.log('🤖 Agent IDs:', data.agents?.map((a: any) => ({ id: a.id, name: a.name, created: a.created_at })) || [])
        setSavedAgents(data.agents || [])
      } else {
        console.error('Failed to load agents:', response.statusText)
        // Fallback to example agents if API fails
        setSavedAgents(EXAMPLE_AGENTS)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
      // Fallback to example agents if API fails
      setSavedAgents(EXAMPLE_AGENTS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load agents on mount and check for migration import
  useEffect(() => {
    loadAgents()
    
    // Check for migrated workflow in sessionStorage
    const importData = sessionStorage.getItem('importAgent')
    if (importData) {
      try {
        const agentData = JSON.parse(importData)
        console.log('🔄 Loading migrated workflow:', agentData)
        
        // Set up for editing the migrated agent
        setCurrentAgent(agentData)
        setShowEditor(true)
        
        // Clear the import data
        sessionStorage.removeItem('importAgent')
        
        // Show migration success message
        setTimeout(() => {
          alert(`✅ Workflow "${agentData.name}" has been migrated to Agent Builder!\n\nYou can now use the enhanced visual editor to modify your agent.`)
        }, 500)
        
      } catch (error) {
        console.error('Error loading migrated workflow:', error)
        sessionStorage.removeItem('importAgent')
      }
    }
  }, [loadAgents])

  const handleSaveAgent = async (agent: any) => {
    try {
      console.log('🤖 handleSaveAgent called with:', agent)
      
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      
      // Check if agent already exists (has an ID)
      if (agent.id) {
        console.log('🔄 Updating existing agent with ID:', agent.id)
        // Update existing agent
        const response = await fetch(`${apiBase}/agent-builder/${agent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agent)
        })
        
        if (!response.ok) {
          throw new Error(`Failed to update agent: ${response.statusText}`)
        }
        
        const updatedAgent = await response.json()
        console.log('✅ Agent updated:', updatedAgent)
        setCurrentAgent(updatedAgent)
        
      } else {
        console.log('🆕 Creating new agent (no ID)')
        // Create new agent
        const response = await fetch(`${apiBase}/agent-builder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agent)
        })
        
        if (!response.ok) {
          throw new Error(`Failed to create agent: ${response.statusText}`)
        }
        
        const savedAgent = await response.json()
        console.log('✅ New agent created:', savedAgent)
        setCurrentAgent(savedAgent)
      }
      
      // Reload agents from backend
      await loadAgents()
      
      // Show success message
      alert('Agent saved successfully!')
      
    } catch (error) {
      console.error('Error saving agent:', error)
      alert(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleExecuteAgent = (agent: any) => {
    console.log('Executing agent:', agent)
    alert('Agent execution started! Check console for details.')
  }

  const handleUpdateAgent = async (agent: any, updates: any) => {
    try {
      const updatedAgent = { ...agent, ...updates }
      await handleSaveAgent(updatedAgent)
    } catch (error) {
      console.error('Error updating agent:', error)
      alert('Failed to update agent')
    }
  }

  const deleteAgent = async (agentId: string) => {
    if (confirm(`Are you sure you want to permanently delete this agent?\n\nThis action cannot be undone.`)) {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
        const response = await fetch(`${apiBase}/agent-builder/${agentId}?hard_delete=true`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (!response.ok) {
          throw new Error(`Failed to delete agent: ${response.statusText}`)
        }
        
        await loadAgents()
        alert('Agent permanently deleted!')
        
      } catch (error) {
        console.error('Error deleting agent:', error)
        alert(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const openAgent = (agent: any) => {
    console.log('🤖 openAgent called with:', agent)
    setCurrentAgent(agent)
    setShowEditor(true)
  }

  const duplicateAgent = async (agent: any) => {
    const duplicatedAgent = {
      ...agent,
      id: undefined, // Remove ID so it creates a new one
      name: `${agent.name} (Copy)`,
      metadata: {
        ...agent.metadata,
        name: `${agent.name} (Copy)`,
        createdAt: new Date().toISOString()
      }
    }
    await handleSaveAgent(duplicatedAgent)
  }

  // Get all unique tags for filtering
  const allTags = Array.from(new Set(
    savedAgents.flatMap(agent => agent.metadata?.tags || [])
  )).filter(Boolean)

  // Filter agents based on search and tag
  const filteredAgents = savedAgents.filter(agent => {
    const matchesSearch = !searchTerm || 
      agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.metadata?.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesTag = !filterTag || agent.metadata?.tags?.includes(filterTag)
    
    return matchesSearch && matchesTag
  })

  if (showEditor) {
    return (
      <div className="h-screen flex flex-col">
        {/* Visual Canvas Editor */}
        <div className="flex-1">
          <FlowProvider>
            <AgentCanvas
              initialAgent={currentAgent}
              onSave={handleSaveAgent}
              onExecute={handleExecuteAgent}
              onBack={() => setShowEditor(false)}
              height="100%"
            />
          </FlowProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🤖 Agent Builder</h1>
          <p className="mt-2 text-gray-600">
            Design and orchestrate AI agents with a visual drag-and-drop editor
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/admin" className="btn btn-secondary">
            Back to Admin
          </Link>
          <button
            onClick={() => {
              setCurrentAgent(null)
              setShowEditor(true)
            }}
            className="btn btn-primary"
          >
            🎨 Create New Agent
          </button>
          <button
            onClick={() => loadAgents()}
            className="btn btn-secondary"
            title="Force refresh agents from backend"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search agents by name, description, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="w-48">
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Agent Overview */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <motion.div 
          className="card p-6 text-center"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-3xl font-bold text-blue-600">
            {isLoading ? '...' : filteredAgents.length}
          </div>
          <div className="text-sm text-gray-600">Active Agents</div>
        </motion.div>
        <motion.div 
          className="card p-6 text-center"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-3xl font-bold text-green-600">
            {isLoading ? '...' : savedAgents.filter(a => a.nodes.length > 0).length}
          </div>
          <div className="text-sm text-gray-600">Configured Agents</div>
        </motion.div>
        <motion.div 
          className="card p-6 text-center"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-3xl font-bold text-purple-600">
            {isLoading ? '...' : savedAgents.reduce((total, a) => total + a.nodes.length, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Components</div>
        </motion.div>
        <motion.div 
          className="card p-6 text-center"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-3xl font-bold text-orange-600">
            {isLoading ? '...' : allTags.length}
          </div>
          <div className="text-sm text-gray-600">Categories</div>
        </motion.div>
      </div>

      {/* Saved Agents */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your AI Agents</h2>
          {searchTerm || filterTag ? (
            <div className="text-sm text-gray-500">
              Showing {filteredAgents.length} of {savedAgents.length} agents
            </div>
          ) : null}
        </div>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">⏳</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading agents...</h3>
            <p className="text-gray-600">Please wait while we load your AI agents</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🤖</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterTag ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterTag 
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first AI agent to start building intelligent workflows'
              }
            </p>
            {!searchTerm && !filterTag && (
              <button
                onClick={() => {
                  setCurrentAgent(null)
                  setShowEditor(true)
                }}
                className="btn btn-primary"
              >
                🎨 Create Your First Agent
              </button>
            )}
          </div>
        ) : (
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            layout
          >
            {filteredAgents.map((agent, index) => (
              <motion.div 
                key={agent.id || index} 
                className="border rounded-lg p-5 hover:shadow-lg transition-all duration-300 bg-white"
                whileHover={{ y: -2 }}
                layout
              >
                {/* Status and Actions Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      agent.status === 'active' ? 'bg-green-100 text-green-800' :
                      agent.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      agent.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {agent.status || 'draft'}
                    </span>
                    {agent.is_template && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        Template
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => duplicateAgent(agent)}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Duplicate Agent"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => openAgent(agent)}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit Agent"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteAgent(agent.id)}
                      className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete Agent"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Agent Name and Description */}
                <div className="mb-4">
                  {editingAgentId === agent.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editingAgentName}
                        onChange={(e) => setEditingAgentName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium text-gray-900"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateAgent(agent, { name: editingAgentName })
                            setEditingAgentId(null)
                          } else if (e.key === 'Escape') {
                            setEditingAgentId(null)
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          handleUpdateAgent(agent, { name: editingAgentName })
                          setEditingAgentId(null)
                        }}
                        className="text-green-600 hover:text-green-800 text-xs p-1"
                        title="Save"
                      >
                        ✅
                      </button>
                    </div>
                  ) : (
                    <h3 
                      className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 text-lg mb-2"
                      onClick={() => {
                        setEditingAgentId(agent.id)
                        setEditingAgentName(agent.name || 'Untitled Agent')
                      }}
                      title="Click to edit agent name"
                    >
                      {agent.name || 'Untitled Agent'}
                    </h3>
                  )}
                  <p className="text-sm text-gray-600 line-clamp-2">{agent.description}</p>
                </div>

                {/* Tags */}
                {agent.metadata?.tags && agent.metadata.tags.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {agent.metadata.tags.slice(0, 3).map((tag: string) => (
                        <span 
                          key={tag}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full cursor-pointer hover:bg-gray-200"
                          onClick={() => setFilterTag(tag)}
                        >
                          #{tag}
                        </span>
                      ))}
                      {agent.metadata.tags.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                          +{agent.metadata.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Agent Stats */}
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex justify-between">
                    <span>Components:</span>
                    <span className="font-medium">{agent.nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connections:</span>
                    <span className="font-medium">{agent.connections.length}</span>
                  </div>
                  
                  {/* Show Agent/LLM details */}
                  {agent.nodes && agent.nodes.length > 0 && (
                    <>
                      {agent.nodes.find((n: any) => n.type === 'agent') && (
                        <div className="flex justify-between">
                          <span>Agent Core:</span>
                          <span className="font-medium text-blue-600">
                            {agent.nodes.find((n: any) => n.type === 'agent')?.data?.name || 'AI Agent'}
                          </span>
                        </div>
                      )}
                      {agent.nodes.find((n: any) => n.type === 'llm') && (
                        <div className="flex justify-between">
                          <span>LLM Model:</span>
                          <span className="font-medium text-green-600">
                            {agent.nodes.find((n: any) => n.type === 'llm')?.data?.model || 'Language Model'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium">
                      {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openAgent(agent)}
                    className="btn btn-primary btn-sm text-xs"
                  >
                    🎨 Edit Agent
                  </button>
                  <button
                    onClick={() => handleExecuteAgent(agent)}
                    className="btn btn-secondary btn-sm text-xs"
                  >
                    ⚡ Run Test
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Enhanced Features Overview */}
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <motion.div 
          className="card p-6"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">🎨 Visual Agent Design</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Drag-and-drop interface for building agents</li>
            <li>• Visual connections between components</li>
            <li>• Real-time configuration panels</li>
            <li>• Zoom and pan controls for complex agents</li>
          </ul>
        </motion.div>
        <motion.div 
          className="card p-6"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">🤖 AI Component Library</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• AI Agents with customizable prompts</li>
            <li>• LLM models with parameter tuning</li>
            <li>• Tool integrations and capabilities</li>
            <li>• Memory and context management</li>
          </ul>
        </motion.div>
        <motion.div 
          className="card p-6"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">⚡ Agent Execution</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Save and load agent configurations</li>
            <li>• Execute agents with real-time monitoring</li>
            <li>• Error handling and validation</li>
            <li>• Export and import capabilities</li>
          </ul>
        </motion.div>
        <motion.div 
          className="card p-6"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">🔧 Advanced Features</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Conditional routing and logic</li>
            <li>• Parallel execution paths</li>
            <li>• Memory persistence and retrieval</li>
            <li>• API integration and webhooks</li>
          </ul>
        </motion.div>
        <motion.div 
          className="card p-6"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">📊 Agent Analytics</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Performance monitoring</li>
            <li>• Usage statistics and insights</li>
            <li>• Error tracking and debugging</li>
            <li>• Conversation history analysis</li>
          </ul>
        </motion.div>
        <motion.div 
          className="card p-6"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold mb-4">🔗 Integration Hub</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• REST API endpoints</li>
            <li>• Webhook integrations</li>
            <li>• Third-party service connections</li>
            <li>• Custom plugin support</li>
          </ul>
        </motion.div>
      </div>
    </div>
  )
}