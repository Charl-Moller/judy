import { useEffect, useState } from 'react'

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadData, setUploadData] = useState({
    file: null as File | null,
    description: '',
    tags: ''
  })
  const [uploading, setUploading] = useState(false)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  async function load() {
    const res = await fetch(`${apiBase}/files`)
    setFiles(await res.json())
  }

  async function uploadFile(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadData.file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadData.file)
      formData.append('description', uploadData.description)
      formData.append('tags', uploadData.tags)

      const res = await fetch(`${apiBase}/files/upload`, {
        method: 'POST',
        body: formData
      })
      
      if (res.ok) {
        setShowUploadForm(false)
        setUploadData({ file: null, description: '', tags: '' })
        load()
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Files</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowUploadForm(true)}>
            Upload File
          </button>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Upload File</h2>
            <form onSubmit={uploadFile}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">File</label>
                  <input
                    type="file"
                    onChange={(e) => setUploadData({...uploadData, file: e.target.files?.[0] || null})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Describe the file content"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tags</label>
                  <input
                    type="text"
                    value={uploadData.tags}
                    onChange={(e) => setUploadData({...uploadData, tags: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="comma-separated tags"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary flex-1"
                  onClick={() => setShowUploadForm(false)}
                  disabled={uploading}
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
              <th className="text-left p-3">Filename</th>
              <th className="text-left p-3">Size</th>
              <th className="text-left p-3">Description</th>
              <th className="text-left p-3">Tags</th>
              <th className="text-left p-3">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => (
              <tr key={file.id} className="border-b last:border-0">
                <td className="p-3">{file.filename}</td>
                <td className="p-3">{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                <td className="p-3">{file.description || '-'}</td>
                <td className="p-3">{file.tags || '-'}</td>
                <td className="p-3">{file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {files.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No files uploaded yet. Click "Upload File" to get started.
          </div>
        )}
      </div>
    </div>
  )
} 