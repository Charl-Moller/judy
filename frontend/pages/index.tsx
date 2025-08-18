import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import MermaidDiagram from '../components/MermaidDiagram'

type Attachment = { type: string; url?: string; content?: string }

// Function to render message content with Mermaid diagrams
function renderMessageContent(content: string) {
  console.log('renderMessageContent called with:', content.substring(0, 100) + '...')
  
  // Check if content contains Mermaid code blocks
  const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = mermaidRegex.exec(content)) !== null) {
    console.log('Found Mermaid block:', match[1].substring(0, 50) + '...')
    
    // Add text before the Mermaid block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      })
    }

    // Add the Mermaid diagram
    parts.push({
      type: 'mermaid',
      content: match[1].trim()
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after the last Mermaid block
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    })
  }

  console.log('Parts to render:', parts.map(p => ({ type: p.type, contentLength: p.content.length })))

  // If no Mermaid blocks found, return the original content
  if (parts.length === 0) {
    console.log('No Mermaid blocks found, returning text only')
    return <div className="whitespace-pre-wrap">{content}</div>
  }

  // Render parts
  return (
    <div>
      {parts.map((part, index) => (
        <div key={index}>
          {part.type === 'text' ? (
            <div className="whitespace-pre-wrap">{part.content}</div>
          ) : (
            <MermaidDiagram chart={part.content} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [chat, setChat] = useState<{ role: 'user'|'assistant', content: string, attachments?: Attachment[] }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '' // e.g. '' or '/api'

  // No need to fetch agents for user selection - orchestrator handles routing
  // Agents are still available in admin panel for configuration

  async function uploadSelectedFiles(): Promise<string[]> {
    console.log('Uploading files:', files)
    const ids: string[] = []
    for (const f of files) {
      console.log('Uploading file:', f.name, f.type, f.size)
      const form = new FormData()
      form.append('file', f)
      const res = await fetch(`${apiBase}/files`, { method: 'POST', body: form })
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Upload failed for file:', f.name, 'Error:', errorText)
        throw new Error(`Upload failed for ${f.name}: ${errorText}`)
      }
      const json = await res.json()
      console.log('Upload successful for file:', f.name, 'File ID:', json.file_id, 'URL:', json.url)
      ids.push(json.file_id)
    }
    console.log('All files uploaded. File IDs:', ids)
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
      
      // Add user message to chat
      setChat(prev => [...prev, { role: 'user', content: message, attachments: files.length > 0 ? files.map(f => ({ type: f.type, url: URL.createObjectURL(f), content: f.name })) : [] }])
      
      // Add empty assistant message that we'll fill with streaming content
      setChat(prev => [...prev, { role: 'assistant', content: '', attachments: [] }])
      
      // Clear the message input immediately when sending
      setMessage('')
      
      // Start streaming
      setIsStreaming(true)
      console.log('Streaming started - isStreaming: true, isLoading: true')
      
      // Safety timeout to ensure typing indicator is turned off
      let safetyTimeout: NodeJS.Timeout
      safetyTimeout = setTimeout(() => {
        console.warn('Safety timeout: turning off typing indicator')
        setIsStreaming(false)
        setIsLoading(false)
      }, 30000) // 30 seconds timeout
      
      // Use streaming endpoint
      const res = await fetch(`${apiBase}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId, 
          message: message + (files.length > 0 ? ` [Attached ${files.length} file(s): ${files.map(f => f.name).join(', ')}]` : ''), 
          files: fileIds, 
          agent_id: 'orchestrator' // Always use orchestrator for a cleaner user experience
        })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Request failed')
      }
      
      // Handle streaming response
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')
      
      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = '' // Track the complete response
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.error) {
                throw new Error(data.error)
              }
              
              if (data.content !== undefined) {
                console.log('=== STREAMING DEBUG ===')
                console.log('Received chunk:', `"${data.content}"`)
                console.log('Chunk length:', data.content.length)
                console.log('Full response so far:', `"${fullResponse}"`)
                
                fullResponse += data.content
                
                // Update the assistant message content in real-time
                setChat(prev => {
                  const newChat = [...prev]
                  const lastAssistantIndex = newChat.length - 1
                  if (newChat[lastAssistantIndex] && newChat[lastAssistantIndex].role === 'assistant') {
                    console.log('Setting content to:', `"${fullResponse}"`)
                    newChat[lastAssistantIndex].content = fullResponse
                  }
                  return newChat
                })
              }
              
              if (data.done) {
                console.log('=== STREAMING COMPLETE ===')
                console.log('Final response:', `"${fullResponse}"`)
                clearTimeout(safetyTimeout) // Clear the safety timeout
                setIsStreaming(false) // Turn off typing indicator
                setIsLoading(false) // Turn off loading state immediately
                console.log('Streaming completed - isStreaming: false, isLoading: false')
                break
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }
      
      // Get session ID from regular chat endpoint if we don't have one
      if (!sessionId) {
        try {
          const sessionRes = await fetch(`${apiBase}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, files: fileIds })
          })
          if (sessionRes.ok) {
            const sessionJson = await sessionRes.json()
            setSessionId(sessionJson.session_id)
          }
        } catch (sessionErr) {
          console.error('Failed to get session ID:', sessionErr)
        }
      }
      
      
    } catch (err: any) {
      alert(err.message || 'Something went wrong')
      // Remove the failed assistant message
      setChat(prev => prev.slice(0, -1))
    } finally {
      // Always reset states
      setIsLoading(false)
      setIsStreaming(false)
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
                  <div className="text-xs text-gray-500 mb-1">
                    {c.role === 'user' ? 'You' : `Assistant (Orchestrator)`}
                  </div>
                  <div className={`whitespace-pre-wrap ${c.role==='user' ? 'bg-blue-50' : 'bg-gray-50'} p-3 rounded-lg`}>{renderMessageContent(c.content)}</div>
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {c.attachments.map((a, i) => (
                        <AttachmentCard key={i} att={a} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Typing indicator */}
              {isStreaming && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-sm">AI is typing...</span>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-3">
              
              {/* Message Input */}
              <div className="flex items-center gap-2">
              <input
                value={message}
                onChange={e=>setMessage(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }}}
                placeholder="Ask anything..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <input ref={fileInputRef} type="file" multiple onChange={(e)=> setFiles(e.target.files ? Array.from(e.target.files) : [])} className="hidden" id="file-input" />
              <label htmlFor="file-input" className="btn btn-secondary">Attach</label>
              <button onClick={sendMessage} disabled={isLoading || isStreaming} className="btn btn-primary">
                {isLoading ? 'Sending...' : isStreaming ? 'Streaming...' : 'Send'}
              </button>
            </div>
            </div>
          </section>

          <aside className="card p-4 space-y-3">
            <h2 className="font-semibold">Tips</h2>
            <ul className="text-sm list-disc pl-5 text-gray-600 space-y-1">
              <li>Upload spreadsheets to analyze and generate charts</li>
              <li>Ask questions that leverage your knowledge base</li>
              <li>Try: &ldquo;Summarize latest results and create a chart&rdquo;</li>
            </ul>
            
            {/* Current Agent Info */}
            <div className="pt-3 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current Agent</h3>
              <div className="text-sm text-gray-600">
                <div className="font-medium">Orchestrator</div>
                <div className="text-xs text-gray-500">Handles routing and coordination of agents.</div>
              </div>
            </div>
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

