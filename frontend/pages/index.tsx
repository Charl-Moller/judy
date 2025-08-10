import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Attachment = { type: string; url?: string; content?: string }

export default function Home() {
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [chat, setChat] = useState<{ role: 'user'|'assistant', content: string, attachments?: Attachment[] }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '' // e.g. '' or '/api'

  async function uploadSelectedFiles(): Promise<string[]> {
    const ids: string[] = []
    for (const f of files) {
      const form = new FormData()
      form.append('file', f)
      const res = await fetch(`${apiBase}/files`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      const json = await res.json()
      ids.push(json.file_id)
    }
    return ids
  }

  async function sendMessage() {
    if (!message && files.length === 0) return
    setIsLoading(true)
    try {
      let fileIds: string[] = []
      if (files.length > 0) {
        fileIds = await uploadSelectedFiles()
        setFiles([])
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      setChat(prev => [...prev, { role: 'user', content: message }])
      const res = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message, files: fileIds })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Request failed')
      setSessionId(json.session_id || sessionId)
      setChat(prev => [...prev, { role: 'assistant', content: json.response, attachments: json.attachments }])
      setMessage('')
    } catch (err: any) {
      alert(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand" />
            <span className="font-semibold">Multi‑Agent Assistant</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin</Link>
            <a href="https://" className="text-sm text-gray-400">v1.0.0</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
          <section className="md:col-span-2 card p-4 flex flex-col h-[70vh]">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {chat.map((c, idx) => (
                <div key={idx} className="">
                  <div className="text-xs text-gray-500 mb-1">{c.role === 'user' ? 'You' : 'Assistant'}</div>
                  <div className={`whitespace-pre-wrap ${c.role==='user' ? 'bg-blue-50' : 'bg-gray-50'} p-3 rounded-lg`}>{c.content}</div>
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {c.attachments.map((a, i) => (
                        <AttachmentCard key={i} att={a} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                value={message}
                onChange={e=>setMessage(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }}}
                placeholder="Ask anything..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <input ref={fileInputRef} type="file" multiple onChange={(e)=> setFiles(e.target.files ? Array.from(e.target.files) : [])} className="hidden" id="file-input" />
              <label htmlFor="file-input" className="btn btn-secondary">Attach</label>
              <button onClick={sendMessage} disabled={isLoading} className="btn btn-primary">{isLoading ? 'Sending...' : 'Send'}</button>
            </div>
          </section>

          <aside className="card p-4 space-y-3">
            <h2 className="font-semibold">Tips</h2>
            <ul className="text-sm list-disc pl-5 text-gray-600 space-y-1">
              <li>Upload spreadsheets to analyze and generate charts</li>
              <li>Ask questions that leverage your knowledge base</li>
              <li>Try: &ldquo;Summarize latest results and create a chart&rdquo;</li>
            </ul>
          </aside>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">© {new Date().getFullYear()} Multi‑Agent Assistant</footer>
    </div>
  )
}

function AttachmentCard({ att }: { att: Attachment }) {
  if (att.url && (att.type === 'image')) {
    return (
      <div className="border rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={att.url} alt="attachment" className="w-full h-40 object-cover" />
      </div>
    )
  }
  if (att.url && (att.type === 'document')) {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="block p-3 border rounded-lg hover:bg-gray-50">
        Document ↗
      </a>
    )
  }
  return (
    <div className="p-3 border rounded-lg bg-white text-sm text-gray-700 whitespace-pre-wrap">{att.content || att.url}</div>
  )
}

