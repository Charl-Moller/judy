import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import MermaidDiagram from '../components/MermaidDiagram'
import AgentCanvas from '../components/canvas/AgentCanvas'
import { FlowProvider } from '../context/FlowContext'
import { NodeConfigProvider } from '../context/NodeConfigContext'
import { ExecutionProvider } from '../context/ExecutionContext'

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
  const [showCanvas, setShowCanvas] = useState(false)
  const [currentWorkflow, setCurrentWorkflow] = useState(null)
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [showTestChat, setShowTestChat] = useState(false)
  const [testMessages, setTestMessages] = useState<{role: 'user'|'system'|'assistant', content: string, timestamp: Date}[]>([
    {role: 'system', content: 'Test Lab initialized. Ready to test your workflow!', timestamp: new Date()}
  ])
  
  // Predefined workflow templates
  const workflowTemplates = {
    simple: {
      name: "Simple Chat Agent",
      description: "Basic AI chat agent",
      nodes: [
        {
          id: "trigger_1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            name: "Chat Trigger",
            type: "webhook",
            method: "POST",
            path: "/chat"
          }
        },
        {
          id: "agent_1",
          type: "agent",
          position: { x: 300, y: 100 },
          data: {
            name: "Chat Assistant",
            systemPrompt: "You are a helpful AI assistant. Be friendly and concise."
          }
        },
        {
          id: "llm_1",
          type: "llm",
          position: { x: 500, y: 100 },
          data: {
            name: "GPT-4",
            provider: "OpenAI",
            model: "gpt-4",
            temperature: 0.7
          }
        }
      ],
      connections: [
        {
          id: "conn_1",
          source: "trigger_1",
          target: "agent_1",
          type: "data"
        },
        {
          id: "conn_2",
          source: "agent_1",
          target: "llm_1",
          type: "data"
        }
      ]
    },
    multiAgent: {
      name: "Multi-Agent System",
      description: "Orchestrator with specialized agents",
      nodes: [
        {
          id: "orchestrator_1",
          type: "orchestrator",
          position: { x: 200, y: 50 },
          data: {
            name: "Main Orchestrator",
            description: "Routes requests to appropriate agents"
          }
        },
        {
          id: "persona_router_1",
          type: "persona_router",
          position: { x: 50, y: 200 },
          data: {
            name: "Persona Router",
            description: "Determines best agent for request"
          }
        },
        {
          id: "agent_1",
          type: "agent",
          position: { x: 200, y: 300 },
          data: {
            name: "General Agent",
            systemPrompt: "You are a general-purpose AI assistant."
          }
        },
        {
          id: "agent_2",
          type: "agent",
          position: { x: 400, y: 300 },
          data: {
            name: "Data Analyst",
            systemPrompt: "You are a specialized data analysis agent."
          }
        }
      ],
      connections: [
        {
          id: "conn_1",
          source: "orchestrator_1",
          target: "persona_router_1",
          type: "control"
        },
        {
          id: "conn_2",
          source: "persona_router_1",
          target: "agent_1",
          type: "data"
        },
        {
          id: "conn_3",
          source: "persona_router_1",
          target: "agent_2",
          type: "data"
        }
      ]
    }
  }

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
        <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6 h-[calc(100vh-140px)]">
          {/* Chat Section */}
          <section className={`${
            showTestChat && showCanvas && selectedComponent ? 'w-1/4' : // Four panes: chat + test + canvas + config
            showTestChat && showCanvas ? 'w-1/3' :                      // Three panes: chat + test + canvas  
            showTestChat && selectedComponent ? 'w-1/2' :               // Three panes: chat + test + config
            showCanvas && selectedComponent ? 'w-1/3' :                 // Three panes: chat + canvas + config
            showTestChat ? 'w-1/2' :                                    // Two panes: chat + test
            showCanvas ? 'w-1/2' :                                      // Two panes: chat + canvas
            selectedComponent ? 'w-2/3' :                               // Two panes: chat + config
            'w-3/4'                                                     // Default: chat + sidebar
          } card p-4 flex flex-col overflow-hidden transition-all duration-300`}>
            {/* Layout Status Indicator */}
            <div className="mb-3 pb-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Chat</h2>
                <div className="flex items-center space-x-2 text-xs bg-gray-100 px-2 py-1 rounded">
                  <span className="text-gray-600">Layout:</span>
                  <span className="font-medium text-blue-600">
                    {showTestChat && showCanvas && selectedComponent ? 'Chat + Test + Canvas + Config' :
                     showTestChat && showCanvas ? 'Chat + Test + Canvas' :
                     showTestChat && selectedComponent ? 'Chat + Test + Config' :
                     showCanvas && selectedComponent ? 'Chat + Canvas + Config' :
                     showTestChat ? 'Chat + Test' :
                     showCanvas ? 'Chat + Canvas' :
                     selectedComponent ? 'Chat + Config' :
                     'Chat + Sidebar'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
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
            <div className="flex-shrink-0 mt-4 space-y-3 border-t pt-3">
              
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

          {/* Test Chat Section */}
          {showTestChat && (
            <section className={`${
              showCanvas && selectedComponent ? 'w-1/4' : // Four panes
              showCanvas ? 'w-1/3' :                      // Three panes  
              selectedComponent ? 'w-1/2' :               // Three panes
              'w-1/2'                                     // Two panes
            } card p-4 flex flex-col overflow-hidden transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-green-700">🧪 Test Lab</h2>
                <button
                  onClick={() => setShowTestChat(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 border border-green-200 rounded p-3 bg-green-50">
                <div className="text-center py-4 text-green-600">
                  <div className="text-4xl mb-2">🚀</div>
                  <p className="text-sm">Test your workflow here!</p>
                  <p className="text-xs mt-1">Changes to components update in real-time</p>
                </div>
                
                {/* Test messages */}
                <div className="space-y-2 min-h-32">
                  {testMessages.map((msg, idx) => (
                    <div key={idx} className={`p-2 rounded border text-sm ${
                      msg.role === 'system' ? 'bg-green-50 border-green-200' :
                      msg.role === 'user' ? 'bg-blue-50 border-blue-200 ml-8' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <span className={`font-medium ${
                        msg.role === 'system' ? 'text-green-600' :
                        msg.role === 'user' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {msg.role === 'system' ? 'System:' : 
                         msg.role === 'user' ? 'You:' : 'Assistant:'}
                      </span>
                      <span className="ml-1">{msg.content}</span>
                      <div className="text-xs opacity-60 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  
                  {/* Show active component being edited */}
                  {selectedComponent && (
                    <div className="bg-blue-50 p-2 rounded border border-blue-200 text-sm">
                      <span className="text-blue-600 font-medium">Config:</span> 
                      <span className="ml-1">
                        Editing {selectedComponent.type} "{selectedComponent.data?.name || selectedComponent.id}"
                      </span>
                      <div className="text-xs text-blue-500 mt-1">
                        ⚡ Changes will be applied to next test run
                      </div>
                    </div>
                  )}
                  
                  {/* Show current workflow status */}
                  {currentWorkflow && (
                    <div className="bg-purple-50 p-2 rounded border border-purple-200 text-sm">
                      <span className="text-purple-600 font-medium">Workflow:</span> 
                      <span className="ml-1">
                        {currentWorkflow.name || 'Custom Workflow'} ({currentWorkflow.nodes?.length || 0} components)
                      </span>
                    </div>
                  )}
                  
                  {!currentWorkflow && (
                    <div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-sm">
                      <span className="text-yellow-600 font-medium">Notice:</span> 
                      <span className="ml-1">Load a workflow template to enable testing</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type test message..."
                    className="flex-1 px-3 py-2 border border-green-300 rounded focus:ring-2 focus:ring-green-500 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget.value.trim()
                        if (input) {
                          e.currentTarget.value = ''
                          
                          // Add user message
                          setTestMessages(prev => [...prev, {
                            role: 'user',
                            content: input,
                            timestamp: new Date()
                          }])
                          
                          // Simulate processing and response
                          setTimeout(() => {
                            const response = currentWorkflow ? 
                              `Processed "${input}" through ${currentWorkflow.name || 'workflow'} with ${currentWorkflow.nodes?.length || 0} components.` :
                              'Please load a workflow template first to enable testing.'
                            
                            setTestMessages(prev => [...prev, {
                              role: 'assistant',
                              content: response,
                              timestamp: new Date()
                            }])
                          }, 1000)
                        }
                      }
                    }}
                  />
                  <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                    Test
                  </button>
                </div>
                <div className="mt-2 text-xs text-green-600">
                  Press Enter to send • Component changes apply instantly
                </div>
              </div>
            </section>
          )}

          {/* Canvas Section */}
          {showCanvas && (
            <section className={`${
              showTestChat && selectedComponent ? 'w-1/4' : // Four panes
              showTestChat ? 'w-1/3' :                      // Three panes
              selectedComponent ? 'w-1/3' :                 // Three panes  
              'w-1/2'                                       // Two panes
            } card p-4 flex flex-col transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Workflow Canvas</h2>
                <div className="flex items-center space-x-2">
                  {currentWorkflow && (
                    <button
                      onClick={() => {
                        if (confirm('Clear current workflow?')) {
                          setCurrentWorkflow(null)
                          setSelectedComponent(null)
                        }
                      }}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                      title="Clear workflow"
                    >
                      🗑️
                    </button>
                  )}
                  <button
                    onClick={() => setShowCanvas(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <FlowProvider>
                  <NodeConfigProvider>
                    <ExecutionProvider>
                      <div className="h-full border border-gray-200 rounded">
                        {currentWorkflow ? (
                          <AgentCanvas
                            height="100%"
                            initialAgent={currentWorkflow}
                            onSave={(workflow) => {
                              setCurrentWorkflow(workflow)
                              console.log('Workflow saved:', workflow)
                              alert('Workflow saved to session!')
                              // You could save to backend here
                            }}
                            onExecute={(workflow) => {
                              console.log('Executing workflow:', workflow)
                              alert('Workflow execution would start here!')
                              // Execute the workflow
                            }}
                            onNodeSelect={(node) => {
                              console.log('Node selected:', node)
                              setSelectedComponent(node)
                            }}
                            onOpenTestChat={() => {
                              console.log('Opening test chat from canvas')
                              setShowTestChat(true)
                            }}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center bg-gray-50">
                            <div className="text-center">
                              <div className="text-gray-400 text-6xl mb-4">🎨</div>
                              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Design</h3>
                              <p className="text-gray-600 mb-4">
                                Use the Quick Start templates or drag components to create your workflow
                              </p>
                              <div className="space-y-2">
                                <button
                                  onClick={() => {
                                    setCurrentWorkflow(workflowTemplates.simple)
                                  }}
                                  className="block mx-auto btn btn-secondary btn-sm"
                                >
                                  🤖 Load Simple Agent
                                </button>
                                <button
                                  onClick={() => {
                                    setCurrentWorkflow(workflowTemplates.multiAgent)
                                  }}
                                  className="block mx-auto btn btn-secondary btn-sm"
                                >
                                  🎛️ Load Multi-Agent System
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </ExecutionProvider>
                  </NodeConfigProvider>
                </FlowProvider>
              </div>
            </section>
          )}

          {/* Component Config Panel - Always show when selectedComponent exists */}
          {selectedComponent && (
            <section className={`${
              showTestChat && showCanvas ? 'w-1/4' :  // Four panes
              showTestChat ? 'w-1/2' :                // Three panes
              showCanvas ? 'w-1/3' :                  // Three panes
              'w-1/4'                                 // Two panes
            } card p-4 space-y-3 transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Component Config</h2>
                <button
                  onClick={() => setSelectedComponent(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Component Type
                  </label>
                  <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                    {selectedComponent.type}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={selectedComponent.data?.name || ''}
                    onChange={(e) => {
                      setSelectedComponent({
                        ...selectedComponent,
                        data: { ...selectedComponent.data, name: e.target.value }
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {selectedComponent.type === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      System Prompt
                    </label>
                    <textarea
                      value={selectedComponent.data?.systemPrompt || ''}
                      onChange={(e) => {
                        setSelectedComponent({
                          ...selectedComponent,
                          data: { ...selectedComponent.data, systemPrompt: e.target.value }
                        })
                      }}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter system prompt for this agent..."
                    />
                  </div>
                )}
                {selectedComponent.type === 'llm' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model
                      </label>
                      <select
                        value={selectedComponent.data?.model || 'gpt-4'}
                        onChange={(e) => {
                          setSelectedComponent({
                            ...selectedComponent,
                            data: { ...selectedComponent.data, model: e.target.value }
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Temperature ({selectedComponent.data?.temperature || 0.7})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={selectedComponent.data?.temperature || 0.7}
                        onChange={(e) => {
                          setSelectedComponent({
                            ...selectedComponent,
                            data: { ...selectedComponent.data, temperature: parseFloat(e.target.value) }
                          })
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      // Apply changes and close panel
                      console.log('Applying changes:', selectedComponent)
                      setSelectedComponent(null)
                    }}
                    className="w-full btn btn-primary btn-sm"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Sidebar - Show when neither canvas nor config panel nor test chat is active */}
          {!showCanvas && !selectedComponent && !showTestChat && (
            <aside className="w-1/4 card p-4 space-y-3">
              <h2 className="font-semibold">Controls</h2>
              
              {/* Canvas Toggle */}
              <button
                onClick={() => setShowCanvas(true)}
                className="w-full btn btn-primary mb-2"
              >
                🎨 Open Canvas
              </button>
              
              {/* Test Lab Toggle */}
              <button
                onClick={() => setShowTestChat(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors mb-4"
              >
                🧪 Open Test Lab
              </button>
              
              {/* Quick Templates */}
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-2">Quick Start</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setCurrentWorkflow(workflowTemplates.simple)
                      setShowCanvas(true)
                    }}
                    className="w-full btn btn-secondary btn-sm text-left"
                  >
                    🤖 Simple Chat Agent
                  </button>
                  <button
                    onClick={() => {
                      setCurrentWorkflow(workflowTemplates.multiAgent)
                      setShowCanvas(true)
                    }}
                    className="w-full btn btn-secondary btn-sm text-left"
                  >
                    🎛️ Multi-Agent System
                  </button>
                </div>
              </div>
              
              {/* Test Layout Button */}
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-2">Test Layout</h3>
                <button
                  onClick={() => {
                    // Simulate component selection during chat
                    setSelectedComponent({
                      id: 'demo_agent',
                      type: 'agent',
                      data: {
                        name: 'Demo Agent',
                        systemPrompt: 'You are a demonstration agent for testing the layout.'
                      }
                    })
                  }}
                  className="w-full btn btn-secondary btn-sm"
                >
                  📝 Select Component (Demo)
                </button>
              </div>
              
              <h3 className="font-semibold text-sm">Tips</h3>
              <ul className="text-sm list-disc pl-5 text-gray-600 space-y-1">
                <li>Upload spreadsheets to analyze and generate charts</li>
                <li>Ask questions that leverage your knowledge base</li>
                <li>Try: &ldquo;Summarize latest results and create a chart&rdquo;</li>
                <li>Use the canvas to design custom workflows</li>
                <li>Open Test Lab + Canvas + select a component for full development experience</li>
                <li>Component changes apply to test runs in real-time</li>
                <li>Chat and all panels work together seamlessly</li>
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
          )}
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

