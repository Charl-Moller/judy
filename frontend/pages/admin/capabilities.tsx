import { useEffect, useState } from 'react'

export default function CapabilitiesPage() {
  const [items, setItems] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tool_config: {}
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
  
  async function load() { 
    try {
      const res = await fetch(`${apiBase}/capabilities`)
      if (!res.ok) throw new Error('Failed to load capabilities')
      setItems(await res.json())
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load capabilities' })
    }
  }
  
  async function createCapability(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Capability created successfully!' })
        setShowCreateForm(false)
        setFormData({ name: '', description: '', tool_config: {} })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to create capability')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to create capability: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function updateCapability(e: React.FormEvent) {
    e.preventDefault()
    if (!editingItem) return
    
    try {
      const res = await fetch(`${apiBase}/capabilities/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Capability updated successfully!' })
        setShowEditForm(false)
        setEditingItem(null)
        setFormData({ name: '', description: '', tool_config: {} })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to update capability')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to update capability: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function deleteCapability(id: string) {
    if (!confirm('Are you sure you want to delete this capability?')) return
    
    try {
      const res = await fetch(`${apiBase}/capabilities/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Capability deleted successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to delete capability')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete capability: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function duplicateCapability(id: string) {
    const newName = prompt('Enter a name for the duplicate:')
    if (newName === null || newName.trim() === '') return // User cancelled or empty name
    
    try {
      const res = await fetch(`${apiBase}/capabilities/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Capability duplicated successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to duplicate capability')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to duplicate capability: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  function openEditForm(item: any) {
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      description: item.description || '',
      tool_config: item.tool_config || {}
    })
    setShowEditForm(true)
  }

  function resetForm() {
    setFormData({ name: '', description: '', tool_config: {} })
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
        <h1 className="text-xl font-semibold">Capabilities</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            Create New Capability
          </button>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create Capability</h2>
            <form onSubmit={createCapability}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Web Search"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Describe what this capability does"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tool Config (JSON)</label>
                  <textarea
                    value={JSON.stringify(formData.tool_config, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setFormData({...formData, tool_config: parsed})
                      } catch (error) {
                        // Invalid JSON, keep the text as is
                      }
                    }}
                    className="w-full p-2 border rounded"
                    placeholder='{"tool_name": "web_search", "parameters": {"query": "string"}}'
                    rows={4}
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
            <h2 className="text-lg font-semibold mb-4">Edit Capability</h2>
            <form onSubmit={updateCapability}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Web Search"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Describe what this capability does"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tool Config (JSON)</label>
                  <textarea
                    value={JSON.stringify(formData.tool_config, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setFormData({...formData, tool_config: parsed})
                      } catch (error) {
                        // Invalid JSON, keep the text as is
                      }
                    }}
                    className="w-full p-2 border rounded"
                    placeholder='{"tool_name": "web_search", "parameters": {"query": "string"}}'
                    rows={4}
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
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Description</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3">{x.name}</td>
                <td className="p-3">{x.description}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditForm(x)}
                      className="btn btn-sm btn-secondary"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => duplicateCapability(x.id)}
                      className="btn btn-sm btn-info"
                    >
                      Duplicate
                    </button>
                    <button 
                      onClick={() => deleteCapability(x.id)}
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
            No capabilities yet. Click &quot;Create New Capability&quot; to get started.
          </div>
        )}
      </div>
    </div>
  )
}

