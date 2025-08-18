import { useEffect, useState } from 'react'

export default function RAGIndexesPage() {
  const [items, setItems] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    embedding_model: '',
    search_service_url: '',
    api_key_secret_ref: ''
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  async function load() {
    try {
      const res = await fetch(`${apiBase}/rag-indexes`)
      if (!res.ok) throw new Error('Failed to load RAG indexes')
      setItems(await res.json())
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load RAG indexes' })
    }
  }

  async function createRAGIndex(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/rag-indexes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'RAG index created successfully!' })
        setShowCreateForm(false)
        setFormData({ name: '', description: '', embedding_model: '', search_service_url: '', api_key_secret_ref: '' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to create RAG index')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to create RAG index: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function updateRAGIndex(e: React.FormEvent) {
    e.preventDefault()
    if (!editingItem) return
    
    try {
      const res = await fetch(`${apiBase}/rag-indexes/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'RAG index updated successfully!' })
        setShowEditForm(false)
        setEditingItem(null)
        setFormData({ name: '', description: '', embedding_model: '', search_service_url: '', api_key_secret_ref: '' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to update RAG index')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to update RAG index: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function deleteRAGIndex(id: string) {
    if (!confirm('Are you sure you want to delete this RAG index?')) return
    
    try {
      const res = await fetch(`${apiBase}/rag-indexes/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'RAG index deleted successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to delete RAG index')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete RAG index: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function duplicateRAGIndex(id: string) {
    const newName = prompt('Enter a name for the duplicate:')
    if (newName === null || newName.trim() === '') return // User cancelled or empty name
    
    try {
      const res = await fetch(`${apiBase}/rag-indexes/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'RAG index duplicated successfully!' })
        load()
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await res.text()
        throw new Error(error || 'Failed to duplicate RAG index')
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to duplicate RAG index: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  function openEditForm(item: any) {
    setEditingItem(item)
    setFormData({
      name: item.name || '',
      description: item.description || '',
      embedding_model: item.embedding_model || '',
      search_service_url: item.search_service_url || '',
      api_key_secret_ref: item.api_key_secret_ref || ''
    })
    setShowEditForm(true)
  }

  function resetForm() {
    setFormData({ name: '', description: '', embedding_model: '', search_service_url: '', api_key_secret_ref: '' })
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
        <h1 className="text-xl font-semibold">RAG Indexes</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            Create New RAG Index
          </button>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create RAG Index</h2>
            <form onSubmit={createRAGIndex}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Company Knowledge Base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Describe what this index contains"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Embedding Model</label>
                  <input
                    type="text"
                    value={formData.embedding_model}
                    onChange={(e) => setFormData({...formData, embedding_model: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., text-embedding-ada-002"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Search Service URL</label>
                  <input
                    type="url"
                    value={formData.search_service_url}
                    onChange={(e) => setFormData({...formData, search_service_url: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="https://your-search-service.search.windows.net"
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
                    placeholder="secret://azure/keyvault/search-api-key"
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
            <h2 className="text-lg font-semibold mb-4">Edit RAG Index</h2>
            <form onSubmit={updateRAGIndex}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., Company Knowledge Base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Describe what this index contains"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Embedding Model</label>
                  <input
                    type="text"
                    value={formData.embedding_model}
                    onChange={(e) => setFormData({...formData, embedding_model: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., text-embedding-ada-002"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Search Service URL</label>
                  <input
                    type="url"
                    value={formData.search_service_url}
                    onChange={(e) => setFormData({...formData, search_service_url: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="https://your-search-service.search.windows.net"
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
                    placeholder="secret://azure/keyvault/search-api-key"
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
              <th className="text-left p-3">Embedding</th>
              <th className="text-left p-3">Service URL</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3">{x.name}</td>
                <td className="p-3">{x.description}</td>
                <td className="p-3">{x.embedding_model}</td>
                <td className="p-3">{x.search_service_url}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditForm(x)}
                      className="btn btn-sm btn-secondary"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => duplicateRAGIndex(x.id)}
                      className="btn btn-sm btn-info"
                    >
                      Duplicate
                    </button>
                    <button 
                      onClick={() => deleteRAGIndex(x.id)}
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
            No RAG indexes yet. Click &quot;Create New RAG Index&quot; to get started.
          </div>
        )}
      </div>
    </div>
  )
}

