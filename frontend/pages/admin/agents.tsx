import { useEffect, useState } from 'react'

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [llmConfigs, setLlmConfigs] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    llm_config_id: '',
    capabilities: [] as string[],
    rag_indexes: [] as string[],
    status: 'active'
  })
  const [loading, setLoading] = useState(false)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  async function load() {
    setLoading(true)
    try {
      const [agentsRes, configsRes, capsRes] = await Promise.all([
        fetch(`${apiBase}/agents`),
        fetch(`${apiBase}/llm-configs`),
        fetch(`${apiBase}/capabilities`)
      ])
      setAgents(await agentsRes.json())
      setLlmConfigs(await configsRes.json())
      setCapabilities(await capsRes.json())
    } finally {
      setLoading(false)
    }
  }

  async function createAgent(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowCreateForm(false)
        setFormData({ name: '', description: '', llm_config_id: '', capabilities: [], rag_indexes: [], status: 'active' })
        load()
      }
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [agentsRes, configsRes, capsRes] = await Promise.all([
          fetch(`${apiBase}/agents`),
          fetch(`${apiBase}/llm-configs`),
          fetch(`${apiBase}/capabilities`)
        ])
        setAgents(await agentsRes.json())
        setLlmConfigs(await configsRes.json())
        setCapabilities(await capsRes.json())
      } finally {
        setLoading(false)
      }
    })()
  }, [apiBase])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Agents</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            Create New Agent
          </button>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create Agent</h2>
            <form onSubmit={createAgent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Research Assistant"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Describe what this agent does"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">LLM Config</label>
                  <select
                    value={formData.llm_config_id}
                    onChange={(e) => setFormData({...formData, llm_config_id: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Select LLM Config</option>
                    {llmConfigs.map(config => (
                      <option key={config.id} value={config.id}>
                        {config.provider} - {config.model_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Capabilities</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                    {capabilities.map(cap => (
                      <label key={cap.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.capabilities.includes(cap.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData, 
                                capabilities: [...formData.capabilities, cap.id]
                              })
                            } else {
                              setFormData({
                                ...formData, 
                                capabilities: formData.capabilities.filter(id => id !== cap.id)
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        {cap.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button type="submit" className="btn btn-primary flex-1">
                  Create
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Model</th>
              <th className="text-left p-3">Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="p-3">{a.name}</td>
                <td className="p-3">{a.status}</td>
                <td className="p-3">{a.llm_config?.model_name}</td>
                <td className="p-3">{(a.capabilities||[]).map((c:any)=>c.name).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-3 text-center text-sm text-gray-500">Loading...</div>}
      </div>
    </div>
  )
}

