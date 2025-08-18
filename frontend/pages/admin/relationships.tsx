import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LLMConfig {
  id: string
  provider: string
  model_name: string
  api_base: string
  max_tokens: string
  temperature: string
}

interface Capability {
  id: string
  name: string
  description: string
}

interface Agent {
  id: string
  name: string
  description: string
  status: string
  llm_config_id: string | null
  capabilities: Capability[]
  llm_config?: LLMConfig
}

interface OrchestratorConfig {
  id: string
  name: string
  description: string
  routing_rules: any[]
  tool_coordination: any
  response_templates: any
  max_agent_calls: number
  enable_tool_chaining: boolean
  default_agent_id: string | null
}

export default function RelationshipsDashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [orchestratorConfigs, setOrchestratorConfigs] = useState<OrchestratorConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [editingLLM, setEditingLLM] = useState<string | null>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

  useEffect(() => {
    console.log('API Base:', apiBase)
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      console.log('Fetching data from:', apiBase)
      
      // Fetch data individually to avoid Promise.all issues
      try {
        const agentsRes = await fetch(`${apiBase}/agents`)
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json()
          console.log('Agents data:', agentsData)
          setAgents(agentsData)
        } else {
          console.error('Agents response not ok:', agentsRes.status, agentsRes.statusText)
        }
      } catch (error) {
        console.error('Error fetching agents:', error)
      }

      try {
        const llmRes = await fetch(`${apiBase}/llm-configs`)
        if (llmRes.ok) {
          const llmData = await llmRes.json()
          console.log('LLM data:', llmData)
          setLlmConfigs(llmData)
        } else {
          console.error('LLM response not ok:', llmRes.status, llmRes.statusText)
        }
      } catch (error) {
        console.error('Error fetching LLM configs:', error)
      }

      try {
        const capabilitiesRes = await fetch(`${apiBase}/capabilities`)
        if (capabilitiesRes.ok) {
          const capabilitiesData = await capabilitiesRes.json()
          console.log('Capabilities data:', capabilitiesData)
          setCapabilities(capabilitiesData)
        } else {
          console.error('Capabilities response not ok:', capabilitiesRes.status, capabilitiesRes.statusText)
        }
      } catch (error) {
        console.error('Error fetching capabilities:', error)
      }

      try {
        const orchestratorRes = await fetch(`${apiBase}/orchestrator`)
        if (orchestratorRes.ok) {
          const orchestratorData = await orchestratorRes.json()
          console.log('Orchestrator data:', orchestratorData)
          setOrchestratorConfigs(orchestratorData)
        } else {
          console.error('Orchestrator response not ok:', orchestratorRes.status, orchestratorRes.statusText)
        }
      } catch (error) {
        console.error('Error fetching orchestrator:', error)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateAgentLLM(agentId: string, llmConfigId: string | null) {
    try {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) return

      const response = await fetch(`${apiBase}/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...agent,
          llm_config_id: llmConfigId
        })
      })

      if (response.ok) {
        await fetchData() // Refresh data
        setEditingLLM(null)
      }
    } catch (error) {
      console.error('Error updating agent LLM:', error)
    }
  }

  async function updateAgentCapabilities(agentId: string, capabilityIds: string[]) {
    try {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) return

      const response = await fetch(`${apiBase}/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...agent,
          capability_ids: capabilityIds
        })
      })

      if (response.ok) {
        await fetchData() // Refresh data
      }
    } catch (error) {
      console.error('Error updating agent capabilities:', error)
    }
  }

  function getLLMConfigName(llmConfigId: string | null): string {
    if (!llmConfigId) return 'Not configured'
    const config = llmConfigs.find(c => c.id === llmConfigId)
    return config ? `${config.provider} (${config.model_name})` : 'Unknown'
  }

  function getAgentCapabilities(agent: Agent): string[] {
    return agent.capabilities?.map(c => c.name) || []
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">Loading relationships...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Relationship Dashboard</h1>
        <Link href="/admin" className="btn btn-secondary">Back to Admin</Link>
      </div>

      {/* System Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{agents.length}</div>
          <div className="text-sm text-gray-600">Active Agents</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{llmConfigs.length}</div>
          <div className="text-sm text-gray-600">LLM Configurations</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{capabilities.length}</div>
          <div className="text-sm text-gray-600">Capabilities</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{orchestratorConfigs.length}</div>
          <div className="text-sm text-gray-600">Orchestrator Configs</div>
        </div>
      </div>

      {/* Agent-LLM-Capability Matrix */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Agent Configuration Matrix</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LLM Configuration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capabilities</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                    <div className="text-sm text-gray-500">{agent.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingLLM === agent.id ? (
                      <select
                        value={agent.llm_config_id || ''}
                        onChange={(e) => updateAgentLLM(agent.id, e.target.value || null)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="">No LLM</option>
                        {llmConfigs.map(config => (
                          <option key={config.id} value={config.id}>
                            {config.provider} ({config.model_name})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">
                          {getLLMConfigName(agent.llm_config_id)}
                        </span>
                        <button
                          onClick={() => setEditingLLM(agent.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {getAgentCapabilities(agent).map((cap, index) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/admin/agents`} className="text-blue-600 hover:text-blue-900">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LLM Configuration Details */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">LLM Configuration Details</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {llmConfigs.map((config) => (
            <div key={config.id} className="border rounded-lg p-4">
              <div className="font-medium text-lg">{config.provider}</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div><strong>Model:</strong> {config.model_name}</div>
                <div><strong>Base URL:</strong> {config.api_base}</div>
                <div><strong>Max Tokens:</strong> {config.max_tokens}</div>
                <div><strong>Temperature:</strong> {config.temperature}</div>
              </div>
              <div className="mt-3">
                <Link href={`/admin/llm-configs`} className="text-blue-600 hover:text-blue-800 text-sm">
                  Edit Configuration
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Orchestrator Configuration */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Orchestrator Configuration</h2>
        {orchestratorConfigs.map((config) => (
          <div key={config.id} className="border rounded-lg p-4 mb-4">
            <div className="font-medium text-lg">{config.name}</div>
            <div className="text-sm text-gray-600 mb-3">{config.description}</div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Routing Rules</h4>
                <div className="text-sm text-gray-600">
                  {config.routing_rules?.length > 0 ? (
                    <ul className="list-disc pl-4">
                      {config.routing_rules.map((rule, index) => (
                        <li key={index}>{rule.name || `Rule ${index + 1}`}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-400">No routing rules configured</span>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Settings</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Max Agent Calls:</strong> {config.max_agent_calls}</div>
                  <div><strong>Tool Chaining:</strong> {config.enable_tool_chaining ? 'Enabled' : 'Disabled'}</div>
                  <div><strong>Default Agent:</strong> {config.default_agent_id || 'None'}</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <Link href={`/admin/orchestrator`} className="text-blue-600 hover:text-blue-800 text-sm">
                Edit Orchestrator
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Capability-Tool Mapping */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Capability & Tool Mapping</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((capability) => (
            <div key={capability.id} className="border rounded-lg p-4">
              <div className="font-medium text-lg">{capability.name}</div>
              <div className="text-sm text-gray-600 mb-3">{capability.description}</div>
              
              <div className="text-sm">
                <strong>Available to:</strong>
                <div className="mt-1">
                  {agents
                    .filter(agent => getAgentCapabilities(agent).includes(capability.name))
                    .map(agent => (
                      <span key={agent.id} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                        {agent.name}
                      </span>
                    ))}
                </div>
              </div>
              
              <div className="mt-3">
                <Link href={`/admin/capabilities`} className="text-blue-600 hover:text-blue-800 text-sm">
                  Manage Capability
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
