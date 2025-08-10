import { useEffect, useState } from 'react'

export default function CapabilitiesPage() {
  const [items, setItems] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tool_config: {}
  })
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
  
  async function load() { const res = await fetch(`${apiBase}/capabilities`); setItems(await res.json()) }
  
  async function createCapability(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowCreateForm(false)
        setFormData({ name: '', description: '', tool_config: {} })
        load()
      }
    } catch (error) {
      console.error('Failed to create capability:', error)
    }
  }

  useEffect(() => {
    (async () => { const res = await fetch(`${apiBase}/capabilities`); setItems(await res.json()) })()
  }, [apiBase])
  
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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
              <th className="text-left p-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3">{x.name}</td>
                <td className="p-3">{x.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

