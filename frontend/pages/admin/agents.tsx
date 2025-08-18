import { useEffect, useState } from 'react'

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [llmConfigs, setLlmConfigs] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [ragIndexes, setRagIndexes] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    llm_config_id: '',
    capabilities: [] as string[],
    rag_indexes: [] as string[],
    status: 'active'
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  async function load() {
    setLoading(true)
    try {
      const [agentsRes, configsRes, capsRes, ragRes] = await Promise.all([
        fetch(`${apiBase}/agents`),
        fetch(`${apiBase}/llm-configs`),
        fetch(`${apiBase}/capabilities`),
        fetch(`${apiBase}/rag-indexes`)
      ])
      setAgents(await agentsRes.json())
      setLlmConfigs(await configsRes.json())
      setCapabilities(await capsRes.json())
      setRagIndexes(await ragRes.json())
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load data' })
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
        setMessage({ type: 'success', text: 'Agent created successfully!' })
        setShowCreateForm(false)
        setFormData({ name: '', description: '', system_prompt: '', llm_config_id: '', capabilities: [], rag_indexes: [], status: 'active' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to create agent')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function updateAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!editingItem) return
    
    try {
      const res = await fetch(`${apiBase}/agents/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Agent updated successfully!' })
        setShowEditForm(false)
        setEditingItem(null)
        setFormData({ name: '', description: '', system_prompt: '', llm_config_id: '', capabilities: [], rag_indexes: [], status: 'active' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to update agent')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function deleteAgent(id: string) {
    if (!confirm('Are you sure you want to delete this agent?')) return
    
    try {
      const res = await fetch(`${apiBase}/agents/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Agent deleted successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to delete agent')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function duplicateAgent(id: string) {
    const newName = prompt('Enter a name for the duplicate:')
    if (newName === null || newName.trim() === '') return // User cancelled or empty name
    
    const newDescription = prompt('Enter a description for the duplicate (optional):')
    if (newDescription === null) return // User cancelled
    
    try {
      const res = await fetch(`${apiBase}/agents/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          system_prompt: formData.system_prompt || undefined
        })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Agent duplicated successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to duplicate agent')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to duplicate agent: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  function openEditForm(item: any) {
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      description: item.description || '',
      system_prompt: item.system_prompt || '',
      llm_config_id: item.llm_config_id || '',
      capabilities: (item.capabilities || []).map((c: any) => c.id || c),
      rag_indexes: (item.rag_indexes || []).map((r: any) => r.id || r),
      status: item.status || 'active'
    })
    setShowEditForm(true)
  }

  function resetForm() {
    setFormData({ name: '', description: '', system_prompt: '', llm_config_id: '', capabilities: [], rag_indexes: [], status: 'active' })
    setShowCreateForm(false)
    setShowEditForm(false)
    setEditingItem(null)
  }

  useEffect(() => {
    load()
  }, [apiBase])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

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
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                  <label className="block text-sm font-medium mb-1">System Prompt</label>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="System prompt for the agent"
                    rows={3}
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
                  <label className="block text-sm font-medium mb-1">RAG Indexes</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                    {ragIndexes.map(rag => (
                      <label key={rag.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.rag_indexes.includes(rag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData, 
                                rag_indexes: [...formData.rag_indexes, rag.id]
                              })
                            } else {
                              setFormData({
                                ...formData, 
                                rag_indexes: formData.rag_indexes.filter(id => id !== rag.id)
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        {rag.name}
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
                  onClick={resetForm}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Agent</h2>
            <form onSubmit={updateAgent}>
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
                  <label className="block text-sm font-medium mb-1">System Prompt</label>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="System prompt for the agent"
                    rows={3}
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
                  <label className="block text-sm font-medium mb-1">RAG Indexes</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                    {ragIndexes.map(rag => (
                      <label key={rag.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.rag_indexes.includes(rag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData, 
                                rag_indexes: [...formData.rag_indexes, rag.id]
                              })
                            } else {
                              setFormData({
                                ...formData, 
                                rag_indexes: formData.rag_indexes.filter(id => id !== rag.id)
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        {rag.name}
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
                  Update
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1"
                  onClick={resetForm}
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
              <th className="text-left p-3">System Prompt</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="p-3">{a.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    a.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {a.status}
                  </span>
                </td>
                <td className="p-3">{a.llm_config?.model_name || 'Not configured'}</td>
                <td className="p-3">{(a.capabilities||[]).map((c:any)=>c.name).join(', ') || 'None'}</td>
                <td className="p-3">{a.system_prompt || 'Not configured'}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditForm(a)}
                      className="btn btn-sm btn-secondary"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => duplicateAgent(a.id)}
                      className="btn btn-sm btn-info"
                    >
                      Duplicate
                    </button>
                    <button 
                      onClick={() => deleteAgent(a.id)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-3 text-center text-sm text-gray-500">Loading...</div>}
        {!loading && agents.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No agents yet. Click &quot;Create New Agent&quot; to get started.
          </div>
        )}
      </div>
    </div>
  )
}

