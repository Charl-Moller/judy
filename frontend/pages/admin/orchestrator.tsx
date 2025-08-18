import { useState, useEffect } from 'react'
import Head from 'next/head'

interface RoutingRule {
  name: string
  description: string
  keywords: string[]
  agent_capabilities: string[]
  priority: number
  fallback_agent_id?: string
  response_template?: string
}

interface ToolCoordination {
  enable_chaining: boolean
  max_chain_length: number
  tool_dependencies: Record<string, string[]>
  execution_order: string[]
}

interface ResponseTemplate {
  name: string
  description: string
  template: string
  placeholders: string[]
  format_type: string
}

interface OrchestratorConfig {
  id: string
  name: string
  description?: string
  routing_rules: RoutingRule[]
  default_agent_id?: string
  orchestrator_llm_id?: string  // Add LLM configuration for orchestrator
  tool_coordination: ToolCoordination
  response_templates: ResponseTemplate[]
  max_agent_calls: number
  enable_tool_chaining: boolean
  created_at: string
  updated_at: string
}

interface LLMConfig {
  id: string
  name: string
  model_name: string
  api_base: string
}

interface Agent {
  id: string
  name: string
  description?: string
}

interface Capability {
  id: string
  name: string
  description?: string
}

export default function OrchestratorPage() {
  const [configs, setConfigs] = useState<OrchestratorConfig[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])  // Add LLM configs
  const [selectedConfig, setSelectedConfig] = useState<OrchestratorConfig | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_agent_calls: 3,
    enable_tool_chaining: true,
    orchestrator_llm_id: ''
  })

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  useEffect(() => {
    fetchConfigs()
    fetchAgents()
    fetchCapabilities()
    fetchLLMConfigs()  // Add LLM configs fetch
  }, [])

  async function fetchConfigs() {
    try {
      const res = await fetch(`${apiBase}/orchestrator`)
      if (res.ok) {
        const data = await res.json()
        setConfigs(data)
      }
    } catch (error) {
      console.error('Failed to fetch orchestrator configs:', error)
    }
  }

  async function fetchAgents() {
    try {
      const res = await fetch(`${apiBase}/agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  async function fetchCapabilities() {
    try {
      const res = await fetch(`${apiBase}/capabilities`)
      if (res.ok) {
        const data = await res.json()
        setCapabilities(data)
      }
    } catch (error) {
      console.error('Failed to fetch capabilities:', error)
    }
  }

  async function fetchLLMConfigs() {
    try {
      const res = await fetch(`${apiBase}/llm-configs`)
      if (res.ok) {
        const data = await res.json()
        setLlmConfigs(data)
      }
    } catch (error) {
      console.error('Failed to fetch LLM configs:', error)
    }
  }

  async function createConfig() {
    try {
      const res = await fetch(`${apiBase}/orchestrator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          routing_rules: [],
          tool_coordination: {
            enable_chaining: formData.enable_tool_chaining,
            max_chain_length: 3,
            tool_dependencies: {},
            execution_order: []
          },
          response_templates: []
        })
      })
      if (res.ok) {
        await fetchConfigs()
        setFormData({ name: '', description: '', max_agent_calls: 3, enable_tool_chaining: true, orchestrator_llm_id: '' })
      }
    } catch (error) {
      console.error('Failed to create orchestrator config:', error)
    }
  }

  async function updateConfig() {
    if (!selectedConfig) return
    try {
      const res = await fetch(`${apiBase}/orchestrator/${selectedConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        await fetchConfigs()
        setIsEditing(false)
        setSelectedConfig(null)
      }
    } catch (error) {
      console.error('Failed to update orchestrator config:', error)
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm('Are you sure you want to delete this orchestrator configuration?')) return
    try {
      const res = await fetch(`${apiBase}/orchestrator/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchConfigs()
      }
    } catch (error) {
      console.error('Failed to delete orchestrator config:', error)
    }
  }

  async function duplicateConfig(id: string) {
    const config = configs.find(c => c.id === id)
    if (!config) return
    
    const newName = prompt('Enter name for duplicated configuration:', `${config.name} (Copy)`)
    if (!newName) return
    
    try {
      const res = await fetch(`${apiBase}/orchestrator/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      if (res.ok) {
        await fetchConfigs()
      }
    } catch (error) {
      console.error('Failed to duplicate orchestrator config:', error)
    }
  }

  async function testConfig(id: string) {
    const testMessage = prompt('Enter a test message to test routing:', 'create a flowchart')
    if (!testMessage) return
    
    try {
      const res = await fetch(`${apiBase}/orchestrator/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage })
      })
      if (res.ok) {
        const result = await res.json()
        alert(`Test Results:\n\nMessage: ${result.test_message}\nRule Matched: ${result.routing_result?.rule_matched || 'None'}\nAgent Selected: ${result.selected_agent || 'None'}\nRouting Rules Checked: ${result.routing_rules_checked}`)
      }
    } catch (error) {
      console.error('Failed to test orchestrator config:', error)
    }
  }

  function openEditForm(config: OrchestratorConfig) {
    setSelectedConfig(config)
    setFormData({
      name: config.name,
      description: config.description || '',
      max_agent_calls: config.max_agent_calls,
      enable_tool_chaining: config.enable_tool_chaining,
      orchestrator_llm_id: config.orchestrator_llm_id || '' // Set LLM field
    })
    setIsEditing(true)
  }

  return (
    <>
      <Head>
        <title>Orchestrator Configuration - Admin</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Orchestrator Configuration</h1>
            <p className="mt-2 text-gray-600">
              Manage intelligent routing rules, tool coordination, and response templates for the orchestrator agent.
            </p>
          </div>

          {/* Create/Edit Form */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? 'Edit Configuration' : 'Create New Configuration'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Configuration name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Configuration description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Agent Calls</label>
                <input
                  type="number"
                  value={formData.max_agent_calls}
                  onChange={(e) => setFormData({...formData, max_agent_calls: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded"
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Enable Tool Chaining</label>
                <input
                  type="checkbox"
                  checked={formData.enable_tool_chaining}
                  onChange={(e) => setFormData({...formData, enable_tool_chaining: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600">Allow tools to call other tools</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Orchestrator LLM</label>
                <select
                  value={formData.orchestrator_llm_id}
                  onChange={(e) => setFormData({...formData, orchestrator_llm_id: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select LLM</option>
                  {llmConfigs.map((llm) => (
                    <option key={llm.id} value={llm.id}>
                      {llm.name} ({llm.model_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={updateConfig}
                    className="btn-primary"
                    disabled={!formData.name}
                  >
                    Update Configuration
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setSelectedConfig(null) }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={createConfig}
                  className="btn-primary"
                  disabled={!formData.name}
                >
                  Create Configuration
                </button>
              )}
            </div>
          </div>

          {/* Configurations List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Orchestrator Configurations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3">LLM Configuration</th>
                    <th className="text-left p-3">Routing Rules</th>
                    <th className="text-left p-3">Response Templates</th>
                    <th className="text-left p-3">Max Agent Calls</th>
                    <th className="text-left p-3">Tool Chaining</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {configs.map((config) => (
                    <tr key={config.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium">{config.name}</td>
                      <td className="p-3 text-gray-600">{config.description || 'No description'}</td>
                      <td className="p-3 text-gray-600">
                        {config.orchestrator_llm_id ? (
                          (() => {
                            const llm = llmConfigs.find(l => l.id === config.orchestrator_llm_id)
                            return llm ? `${llm.name} (${llm.model_name})` : 'Unknown LLM'
                          })()
                        ) : (
                          <span className="text-gray-400">Not configured</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600">{config.routing_rules.length} rules</td>
                      <td className="p-3 text-gray-600">{config.response_templates.length} templates</td>
                      <td className="p-3 text-gray-600">{config.max_agent_calls}</td>
                      <td className="p-3 text-gray-600">
                        {config.enable_tool_chaining ? 'Enabled' : 'Disabled'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditForm(config)}
                            className="btn-secondary text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => duplicateConfig(config.id)}
                            className="btn-info text-sm"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => testConfig(config.id)}
                            className="btn-secondary text-sm"
                          >
                            Test
                          </button>
                          <button
                            onClick={() => deleteConfig(config.id)}
                            className="btn-danger text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advanced Configuration Section */}
          {selectedConfig && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Advanced Configuration: {selectedConfig.name}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Routing Rules */}
                <div>
                  <h4 className="font-medium mb-3">Routing Rules</h4>
                  <div className="space-y-3">
                    {selectedConfig.routing_rules.map((rule, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-sm text-gray-600">{rule.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Keywords: {rule.keywords.join(', ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          Capabilities: {rule.agent_capabilities.join(', ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          Priority: {rule.priority}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tool Coordination */}
                <div>
                  <h4 className="font-medium mb-3">Tool Coordination</h4>
                  <div className="space-y-2 text-sm">
                    <div>Chaining: {selectedConfig.tool_coordination.enable_chaining ? 'Enabled' : 'Disabled'}</div>
                    <div>Max Chain Length: {selectedConfig.tool_coordination.max_chain_length}</div>
                    <div>Execution Order: {selectedConfig.tool_coordination.execution_order.join(' → ')}</div>
                  </div>
                </div>

                {/* Response Templates */}
                <div className="lg:col-span-2">
                  <h4 className="font-medium mb-3">Response Templates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedConfig.response_templates.map((template, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-gray-600">{template.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Format: {template.format_type}
                        </div>
                        <div className="text-xs text-gray-500">
                          Placeholders: {template.placeholders.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
