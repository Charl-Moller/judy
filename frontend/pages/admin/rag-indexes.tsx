import { useEffect, useState } from 'react'

export default function RAGIndexesPage() {
  const [items, setItems] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    embedding_model: '',
    search_service_url: '',
    api_key_secret_ref: ''
  })
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  async function load() {
    const res = await fetch(`${apiBase}/rag-indexes`)
    setItems(await res.json())
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
        setShowCreateForm(false)
        setFormData({ name: '', description: '', embedding_model: '', search_service_url: '', api_key_secret_ref: '' })
        load()
      }
    } catch (error) {
      console.error('Failed to create RAG index:', error)
    }
  }

  useEffect(() => {
    (async () => { const res = await fetch(`${apiBase}/rag-indexes`); setItems(await res.json()) })()
  }, [apiBase])
  
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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
                    placeholder="Enter API key secret reference"
                    required
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
              <th className="text-left p-3">Embedding</th>
              <th className="text-left p-3">Service URL</th>
            </tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3">{x.name}</td>
                <td className="p-3">{x.embedding_model}</td>
                <td className="p-3">{x.search_service_url}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

