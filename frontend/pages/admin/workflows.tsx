import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import WorkflowEditor from '../../components/WorkflowEditor'

// Example workflows defined outside component to avoid recreation
const EXAMPLE_WORKFLOWS = [
  {
    metadata: {
      name: "Simple AI Chat",
      description: "Basic AI agent with LLM for chat interactions",
      version: "1.0.0",
      createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
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
      name: "Image Analysis Pipeline",
      description: "Multi-agent workflow for image analysis and description",
      version: "1.0.0",
      createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
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

export default function WorkflowsPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([])
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null)
  const [editingWorkflowName, setEditingWorkflowName] = useState('')

  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true)
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      
      // Add cache-busting to prevent browser caching
      const timestamp = Date.now()
      const response = await fetch(`${apiBase}/workflows?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Loaded workflows from backend:', data.workflows?.length || 0)
        console.log('🔍 Workflow IDs:', data.workflows?.map((w: any) => ({ id: w.id, name: w.name, created: w.created_at })) || [])
        setSavedWorkflows(data.workflows || [])
      } else {
        console.error('Failed to load workflows:', response.statusText)
        // Fallback to example workflows if API fails
        setSavedWorkflows(EXAMPLE_WORKFLOWS)
      }
    } catch (error) {
      console.error('Error loading workflows:', error)
      // Fallback to example workflows if API fails
      setSavedWorkflows(EXAMPLE_WORKFLOWS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  const handleSaveWorkflow = async (workflow: any) => {
    try {
      console.log('🔍 handleSaveWorkflow called with:')
      console.log('  - workflow:', workflow)
      console.log('  - workflow.id:', workflow.id)
      console.log('  - workflow.name:', workflow.name)
      
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      
      // Check if workflow already exists (has an ID)
      if (workflow.id) {
        console.log('🔄 Updating existing workflow with ID:', workflow.id)
        // Update existing workflow
        const response = await fetch(`${apiBase}/workflows/${workflow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflow)
        })
        
        if (!response.ok) {
          throw new Error(`Failed to update workflow: ${response.statusText}`)
        }
        
        // Update current workflow with the updated data
        const updatedWorkflow = await response.json()
        console.log('✅ Workflow updated:', updatedWorkflow)
        setCurrentWorkflow(updatedWorkflow)
        
      } else {
        console.log('🆕 Creating new workflow (no ID)')
        // Create new workflow
        const response = await fetch(`${apiBase}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflow)
        })
        
        if (!response.ok) {
          throw new Error(`Failed to create workflow: ${response.statusText}`)
        }
        
        const savedWorkflow = await response.json()
        console.log('✅ New workflow created:', savedWorkflow)
        
        // Update current workflow with the saved data (including the new ID)
        setCurrentWorkflow(savedWorkflow)
      }
      
      // Reload workflows from backend
      await loadWorkflows()
      
      // Show success message
      alert('Workflow saved successfully!')
      
    } catch (error) {
      console.error('Error saving workflow:', error)
      alert(`Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleExecuteWorkflow = (workflow: any) => {
    // Execute workflow (currently just logs to console)
    console.log('Executing workflow:', workflow)
    alert('Workflow execution started! Check console for details.')
  }

  const handleUpdateWorkflow = async (workflow: any, updates: any) => {
    try {
      const updatedWorkflow = { ...workflow, ...updates }
      await handleSaveWorkflow(updatedWorkflow)
    } catch (error) {
      console.error('Error updating workflow:', error)
      alert('Failed to update workflow')
    }
  }

  const deleteWorkflow = async (workflowId: string) => {
    if (confirm(`Are you sure you want to permanently delete this workflow?\n\nThis action cannot be undone.`)) {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
        const response = await fetch(`${apiBase}/workflows/${workflowId}?hard_delete=true`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (!response.ok) {
          throw new Error(`Failed to delete workflow: ${response.statusText}`)
        }
        
        // Reload workflows from backend to ensure consistency
        await loadWorkflows()
        
        alert('Workflow permanently deleted!')
        
      } catch (error) {
        console.error('Error deleting workflow:', error)
        alert(`Failed to delete workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const openWorkflow = (workflow: any) => {
    console.log('🔍 openWorkflow called with:')
    console.log('  - workflow:', workflow)
    console.log('  - workflow.id:', workflow.id)
    console.log('  - workflow.name:', workflow.name)
    setCurrentWorkflow(workflow)
    setShowEditor(true)
  }

  if (showEditor) {
    return (
      <div className="h-screen">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowEditor(false)}
              className="btn btn-secondary"
            >
              ← Back to Workflows
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {currentWorkflow ? `Editing: ${currentWorkflow.name}` : 'New Workflow'}
            </h1>
          </div>
        </div>
        
        <WorkflowEditor
          onSave={handleSaveWorkflow}
          onExecute={handleExecuteWorkflow}
          initialWorkflow={currentWorkflow}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Workflows</h1>
          <p className="mt-2 text-gray-600">
            Design and orchestrate AI agent workflows with a visual editor
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/admin" className="btn btn-secondary">
            Back to Admin
          </Link>
          <button
            onClick={() => {
              setCurrentWorkflow(null)
              setShowEditor(true)
            }}
            className="btn btn-primary"
          >
            Create New Workflow
          </button>
          <button
            onClick={() => loadWorkflows()}
            className="btn btn-secondary"
            title="Force refresh workflows from backend"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Workflow Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">
            {isLoading ? '...' : savedWorkflows.length}
          </div>
          <div className="text-sm text-gray-600">Saved Workflows</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-3xl font-bold text-green-600">
            {isLoading ? '...' : savedWorkflows.filter(w => w.nodes.length > 0).length}
          </div>
          <div className="text-sm text-gray-600">Active Workflows</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-3xl font-bold text-purple-600">
            {isLoading ? '...' : savedWorkflows.reduce((total, w) => total + w.nodes.length, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Components</div>
        </div>
      </div>

      {/* Saved Workflows */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Saved Workflows</h2>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">⏳</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading workflows...</h3>
            <p className="text-gray-600">Please wait while we load your workflows</p>
          </div>
        ) : savedWorkflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first AI workflow to start orchestrating agents, tools, and memory systems
            </p>
            <button
              onClick={() => {
                setCurrentWorkflow(null)
                setShowEditor(true)
              }}
              className="btn btn-primary"
            >
              Create Your First Workflow
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedWorkflows.map((workflow, index) => (
              <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                {/* Status Badge */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      workflow.status === 'active' ? 'bg-green-100 text-green-800' :
                      workflow.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      workflow.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {workflow.status || 'draft'}
                    </span>
                    {workflow.is_template && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        Template
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openWorkflow(workflow)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="Edit Workflow"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteWorkflow(workflow.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="Delete Workflow"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {editingWorkflowId === workflow.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editingWorkflowName}
                          onChange={(e) => setEditingWorkflowName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium text-gray-900"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              // Save the name change
                              handleUpdateWorkflow(workflow, { name: editingWorkflowName })
                              setEditingWorkflowId(null)
                            } else if (e.key === 'Escape') {
                              setEditingWorkflowId(null)
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            handleUpdateWorkflow(workflow, { name: editingWorkflowName })
                            setEditingWorkflowId(null)
                          }}
                          className="text-green-600 hover:text-green-800 text-xs"
                          title="Save"
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => setEditingWorkflowId(null)}
                          className="text-gray-600 hover:text-gray-800 text-xs"
                          title="Cancel"
                        >
                          ❌
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <h3 
                          className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                          onClick={() => {
                            setEditingWorkflowId(workflow.id)
                            setEditingWorkflowName(workflow.name || 'Untitled Workflow')
                          }}
                          title="Click to edit workflow name"
                        >
                          {workflow.name || 'Untitled Workflow'}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingWorkflowId(workflow.id)
                            setEditingWorkflowName(workflow.name || 'Untitled Workflow')
                          }}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          title="Edit workflow name"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-gray-600">{workflow.description}</p>
                  </div>

                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Components:</span>
                    <span className="font-medium">{workflow.nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connections:</span>
                    <span className="font-medium">{workflow.connections.length}</span>
                  </div>
                  
                  {/* Show Agent/Orchestrator details */}
                  {workflow.nodes && workflow.nodes.length > 0 && (
                    <>
                      {workflow.nodes.find((n: any) => n.type === 'agent') && (
                        <div className="flex justify-between">
                          <span>Agent:</span>
                          <span className="font-medium text-blue-600">
                            {workflow.nodes.find((n: any) => n.type === 'agent')?.data?.name || 'AI Agent'}
                          </span>
                        </div>
                      )}
                      {workflow.nodes.find((n: any) => n.type === 'orchestrator') && (
                        <div className="flex justify-between">
                          <span>Orchestrator:</span>
                          <span className="font-medium text-purple-600">
                            {workflow.nodes.find((n: any) => n.type === 'orchestrator')?.data?.name || 'Orchestrator'}
                          </span>
                        </div>
                      )}
                      {workflow.nodes.find((n: any) => n.type === 'llm') && (
                        <div className="flex justify-between">
                          <span>LLM:</span>
                          <span className="font-medium text-green-600">
                            {workflow.nodes.find((n: any) => n.type === 'llm')?.data?.model || 'Language Model'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium">
                      {workflow.created_at ? new Date(workflow.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => openWorkflow(workflow)}
                    className="w-full btn btn-secondary btn-sm"
                  >
                    Open Workflow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Features Overview */}
      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">🎨 Visual Workflow Design</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Drag-and-drop interface for building workflows</li>
            <li>• Visual connections between components</li>
            <li>• Real-time configuration panels</li>
            <li>• Zoom and pan controls for complex workflows</li>
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">🤖 AI Component Library</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• AI Agents with customizable prompts</li>
            <li>• LLM models with parameter tuning</li>
            <li>• Tool integrations and capabilities</li>
            <li>• Memory and context management</li>
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">⚡ Workflow Execution</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Save and load workflow configurations</li>
            <li>• Execute workflows with real-time monitoring</li>
            <li>• Error handling and validation</li>
            <li>• Export and import capabilities</li>
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">🔧 Advanced Features</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Conditional routing and logic</li>
            <li>• Parallel execution paths</li>
            <li>• Memory persistence and retrieval</li>
            <li>• API integration and webhooks</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
