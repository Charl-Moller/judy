import { useEffect, useState } from 'react'

export default function LLMConfigsPage() {
  const [items, setItems] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState({
    provider: '',
    model_name: '',
    temperature: 0.7,
    max_tokens: 4000,
    api_base: '',
    api_key_secret_ref: ''
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  async function load() {
    try {
      const res = await fetch(`${apiBase}/llm-configs`)
      if (!res.ok) throw new Error('Failed to load configs')
      setItems(await res.json())
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load LLM configs' })
    }
  }

  async function createConfig(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/llm-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'LLM config created successfully!' })
        setShowCreateForm(false)
        setFormData({ provider: '', model_name: '', temperature: 0.7, max_tokens: 4000, api_base: '', api_key_secret_ref: '' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to create config')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to create config: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function updateConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!editingItem) return
    
    try {
      const res = await fetch(`${apiBase}/llm-configs/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'LLM config updated successfully!' })
        setShowEditForm(false)
        setEditingItem(null)
        setFormData({ provider: '', model_name: '', temperature: 0.7, max_tokens: 4000, api_base: '', api_key_secret_ref: '' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to update config')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to update config: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function deleteConfig(id: string) {
    if (!confirm('Are you sure you want to delete this LLM config?')) return
    
    try {
      const res = await fetch(`${apiBase}/llm-configs/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'LLM config deleted successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to delete config')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete config: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function duplicateConfig(id: string) {
    const newName = prompt('Enter a name for the duplicate (optional):')
    if (newName === null) return // User cancelled
    
    try {
      const res = await fetch(`${apiBase}/llm-configs/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'LLM config duplicated successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to duplicate config')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to duplicate config: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  function openEditForm(item: any) {
    setEditingItem(item)
    setFormData({
      provider: item.provider || '',
      model_name: item.model_name || '',
      temperature: parseFloat(item.temperature) || 0.7,
      max_tokens: parseInt(item.max_tokens) || 4000,
      api_base: item.api_base || '',
      api_key_secret_ref: item.api_key_secret_ref || ''
    })
    setShowEditForm(true)
  }

  function resetForm() {
    setFormData({ provider: '', model_name: '', temperature: 0.7, max_tokens: 4000, api_base: '', api_key_secret_ref: '' })
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
        <h1 className="text-xl font-semibold">LLM Configs</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            Create New Config
          </button>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create LLM Config</h2>
            <form onSubmit={createConfig}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Azure OpenAI, OpenAI"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Model Name</label>
                  <input
                    type="text"
                    value={formData.model_name}
                    onChange={(e) => setFormData({...formData, model_name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., gpt-4, gpt-5-chat"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Base URL</label>
                  <input
                    type="url"
                    value={formData.api_base}
                    onChange={(e) => setFormData({...formData, api_base: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="https://your-resource.openai.azure.com/"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({...formData, max_tokens: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Key Secret Ref</label>
                  <input
                    type="text"
                    value={formData.api_key_secret_ref}
                    onChange={(e) => setFormData({...formData, api_key_secret_ref: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="secret://azure/keyvault/openai-api-key"
                  />
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit LLM Config</h2>
            <form onSubmit={updateConfig}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Azure OpenAI, OpenAI"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Model Name</label>
                  <input
                    type="text"
                    value={formData.model_name}
                    onChange={(e) => setFormData({...formData, model_name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., gpt-4, gpt-5-chat"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Base URL</label>
                  <input
                    type="url"
                    value={formData.api_base}
                    onChange={(e) => setFormData({...formData, api_base: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="https://your-resource.openai.azure.com/"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({...formData, max_tokens: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Key Secret Ref</label>
                  <input
                    type="text"
                    value={formData.api_key_secret_ref}
                    onChange={(e) => setFormData({...formData, api_key_secret_ref: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="secret://azure/keyvault/openai-api-key"
                  />
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
              <th className="text-left p-3">Provider</th>
              <th className="text-left p-3">Model</th>
              <th className="text-left p-3">API Base</th>
              <th className="text-left p-3">Temp</th>
              <th className="text-left p-3">Max Tokens</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3">{x.provider}</td>
                <td className="p-3">{x.model_name}</td>
                <td className="p-3">{x.api_base || 'Not set'}</td>
                <td className="p-3">{x.temperature}</td>
                <td className="p-3">{x.max_tokens}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditForm(x)}
                      className="btn btn-sm btn-secondary"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => duplicateConfig(x.id)}
                      className="btn btn-sm btn-info"
                    >
                      Duplicate
                    </button>
                    <button 
                      onClick={() => deleteConfig(x.id)}
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
        {items.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No LLM configs yet. Click &quot;Create New Config&quot; to get started.
          </div>
        )}
      </div>
    </div>
  )
}

