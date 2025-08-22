import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageSquare, 
  Plus, 
  Search,
  Pin,
  Bot,
  Send,
  Paperclip,
  Sparkles,
  ChevronRight,
  ChevronDown,
  History,
  Settings,
  X,
  Check,
  Loader2,
  PinIcon,
  PinOff,
  Menu
} from 'lucide-react'
import { ExecutionProvider, useExecution } from '../context/ExecutionContext'
import ChatMessageRenderer from '../components/ChatMessageRenderer'

// Types
type Agent = {
  id: string
  name: string
  description?: string
  nodes: any[]
  connections: any[]
  status: string
  suggested_prompts?: string[]
  metadata?: {
    tags?: string[]
    createdAt?: string
  }
}

// Inner component that uses ExecutionContext
function ChatInterface() {
  // State
  const [agents, setAgents] = useState<Agent[]>([])
  const [pinnedAgentIds, setPinnedAgentIds] = useState<string[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [showAgents, setShowAgents] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Use ExecutionContext for message management (like agent-builder)
  const {
    conversationHistory,
    isExecuting,
    startExecution,
    stopExecution,
    addMessage,
    updateMessage,
    clearHistory
  } = useExecution()
  
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  // Load agents and pinned state on mount
  useEffect(() => {
    fetchAgents()
    // Load pinned agents from localStorage
    const saved = localStorage.getItem('pinnedAgents')
    if (saved) {
      setPinnedAgentIds(JSON.parse(saved))
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationHistory])

  // Fetch agents from agent-builder
  async function fetchAgents() {
    try {
      const res = await fetch(`${apiBase}/agent-builder`)
      if (res.ok) {
        const data = await res.json()
        const agentList = data.agents || []
        setAgents(agentList)
        
        // Auto-select first agent
        if (agentList.length > 0 && !selectedAgent) {
          setSelectedAgent(agentList[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }

  // Upload files
  async function uploadFiles(): Promise<string[]> {
    const ids: string[] = []
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${apiBase}/files`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed for ${file.name}`)
      const json = await res.json()
      ids.push(json.file_id)
    }
    return ids
  }

  // Toggle pin agent
  function togglePinAgent(agentId: string) {
    setPinnedAgentIds(prev => {
      const updated = prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
      localStorage.setItem('pinnedAgents', JSON.stringify(updated))
      return updated
    })
  }

  // Get sorted agents (pinned first)
  function getSortedAgents() {
    const filtered = agents.filter(agent => 
      !searchQuery || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    return [
      ...filtered.filter(a => pinnedAgentIds.includes(a.id)),
      ...filtered.filter(a => !pinnedAgentIds.includes(a.id))
    ]
  }

  // Get suggested prompts for agent
  function getAgentSuggestedPrompts(agent: Agent): string[] {
    if (agent.suggested_prompts) return agent.suggested_prompts
    
    const prompts: string[] = []
    if (agent.nodes) {
      const hasAgent = agent.nodes.some(n => n.type === 'agent' || n.data?.nodeType === 'agent')
      const hasLlm = agent.nodes.some(n => n.type === 'llm' || n.data?.nodeType === 'llm')
      
      if (hasAgent) {
        prompts.push('How can you help me?')
        prompts.push('What are your capabilities?')
      }
      
      if (hasLlm) {
        prompts.push('Analyze this information')
        prompts.push('Generate a summary')
      }
    }
    
    if (prompts.length === 0) {
      prompts.push('Start a conversation')
      prompts.push('Help me with a task')
    }
    
    return prompts.slice(0, 4)
  }

  // Send message - EXACTLY like agent-builder
  async function sendMessage() {
    if (!input.trim() || !selectedAgent || isExecuting) return
    
    const messageText = input.trim()
    setInput('')
    
    // Upload files if any
    let fileIds: string[] = []
    if (files.length > 0) {
      try {
        fileIds = await uploadFiles()
        setFiles([])
        if (fileInputRef.current) fileInputRef.current.value = ''
      } catch (err) {
        console.error('File upload failed:', err)
      }
    }
    
    // Add user message using ExecutionContext
    addMessage({
      type: 'user',
      content: messageText + (fileIds.length > 0 ? ` [Attached ${fileIds.length} file(s)]` : '')
    })
    
    // Start execution
    startExecution()
    
    try {
      // Check if agent has streaming enabled - EXACTLY like agent-builder
      const hasStreamingAgent = selectedAgent.nodes?.some((node: any) => 
        (node.type === 'agent' || node.data?.nodeType === 'agent') && 
        node.data?.streamResponse === true
      )
      
      if (hasStreamingAgent) {
        // Use streaming endpoint - EXACTLY like agent-builder
        const response = await fetch(`${apiBase}/chat/workflow/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: selectedAgent.nodes,
            connections: selectedAgent.connections || [],
            input: messageText,
            files: fileIds,
            session_id: `chat_${selectedAgent.id}_${Date.now()}`,
            conversation_history: conversationHistory.map(msg => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content
            }))
          })
        })
        
        if (!response.ok) throw new Error('Streaming request failed')
        
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        
        if (reader) {
          let accumulatedContent = ''
          
          // Add initial empty assistant message for real-time streaming
          const streamingMessage = {
            type: 'assistant' as const,
            content: ''
          }
          const streamingMessageId = addMessage(streamingMessage)
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) break
              
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = line.slice(6)
                    if (data === '[DONE]') continue
                    
                    const parsed = JSON.parse(data)
                    if (parsed.content) {
                      accumulatedContent += parsed.content
                      
                      // Update the streaming message in real-time - EXACTLY like agent-builder
                      updateMessage(streamingMessageId, { content: accumulatedContent })
                      
                      // Small delay to make streaming visible
                      await new Promise(resolve => setTimeout(resolve, 10))
                    }
                  } catch (e) {
                    // Skip invalid JSON lines
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        }
      } else {
        // Handle non-streaming - EXACTLY like agent-builder
        const response = await fetch(`${apiBase}/chat/workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: selectedAgent.nodes,
            connections: selectedAgent.connections || [],
            input: messageText,
            files: fileIds,
            session_id: `chat_${selectedAgent.id}_${Date.now()}`,
            conversation_history: conversationHistory.map(msg => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content
            }))
          })
        })
        
        if (!response.ok) throw new Error('Request failed')
        
        const result = await response.json()
        
        // Add assistant response
        addMessage({
          type: 'assistant',
          content: result.response || result.content || 'No response'
        })
      }
    } catch (error) {
      console.error('Error:', error)
      
      // Add error message
      addMessage({
        type: 'assistant',
        content: 'Sorry, an error occurred. Please try again.'
      })
    } finally {
      stopExecution()
    }
  }

  // Agent Card Component
  function AgentCard({ agent, isSelected, isPinned, onSelect, onTogglePin }: any) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-3 rounded-xl cursor-pointer transition-all ${
          isSelected 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
            : 'bg-white hover:bg-gray-50 border border-gray-200'
        }`}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bot size={16} className={isSelected ? 'text-white' : 'text-gray-600'} />
              <h3 className={`font-medium ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                {agent.name}
              </h3>
            </div>
            {agent.description && (
              <p className={`text-sm mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                {agent.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {agent.nodes?.some((n: any) => 
                (n.type === 'agent' || n.data?.nodeType === 'agent') && n.data?.streamResponse
              ) && (
                <span className={`text-xs px-2 py-0.5 rounded ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                }`}>
                  ⚡ Streaming
                </span>
              )}
              <span className={`text-xs ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                {agent.nodes?.length || 0} components
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin()
            }}
            className={`p-1 rounded hover:bg-white/10 ${
              isSelected ? 'text-white' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar - Agent Selection */}
      <motion.aside 
        initial={{ x: -300 }}
        animate={{ x: showAgents ? 0 : -300 }}
        className="w-80 bg-white/80 backdrop-blur-xl border-r border-gray-200 flex flex-col fixed h-full z-10 lg:relative"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Agents
            </h2>
            <button
              onClick={() => setShowAgents(false)}
              className="lg:hidden p-1 hover:bg-gray-100 rounded"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {getSortedAgents().length === 0 ? (
            <div className="text-center py-8">
              <Bot className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500 text-sm">No agents found</p>
              <Link href="/admin/agent-builder" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
                Create your first agent →
              </Link>
            </div>
          ) : (
            getSortedAgents().map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                isPinned={pinnedAgentIds.includes(agent.id)}
                onSelect={() => {
                  setSelectedAgent(agent)
                  clearHistory()
                }}
                onTogglePin={() => togglePinAgent(agent.id)}
              />
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <Link href="/admin/agent-builder" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2">
            <Settings size={16} />
            <span>Agent Builder</span>
          </Link>
          <Link href="/admin" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <History size={16} />
            <span>Admin Panel</span>
          </Link>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedAgent ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAgents(!showAgents)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Menu size={20} />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <Bot className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedAgent.name}</h2>
                    <p className="text-sm text-gray-500">{selectedAgent.description || 'AI Agent'}</p>
                  </div>
                </div>
                <button
                  onClick={() => togglePinAgent(selectedAgent.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    pinnedAgentIds.includes(selectedAgent.id)
                      ? 'bg-blue-100 text-blue-600'
                      : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  {pinnedAgentIds.includes(selectedAgent.id) ? <Pin size={20} /> : <PinOff size={20} />}
                </button>
              </div>
            </div>

            {/* Messages or Welcome Screen */}
            <div className="flex-1 overflow-y-auto">
              {conversationHistory.length === 0 ? (
                /* Welcome Screen with Suggested Prompts */
                <div className="max-w-4xl mx-auto p-6">
                  <div className="text-center py-12">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center"
                    >
                      <Bot className="text-white" size={48} />
                    </motion.div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      Hello! I'm {selectedAgent.name}
                    </h1>
                    <p className="text-gray-600 mb-8">
                      {selectedAgent.description || 'How can I help you today?'}
                    </p>
                    
                    {/* Suggested Prompts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                      {getAgentSuggestedPrompts(selectedAgent).map((prompt, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => setInput(prompt)}
                          className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
                        >
                          <div className="flex items-start gap-3">
                            <Sparkles className="text-blue-500 mt-1" size={16} />
                            <span className="text-gray-700 group-hover:text-gray-900">{prompt}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto p-6 space-y-4">
                  <AnimatePresence>
                    {conversationHistory.map((msg, idx) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`flex gap-3 ${
                          msg.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.type === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                            <Bot className="text-white" size={16} />
                          </div>
                        )}
                        <div className={`max-w-2xl rounded-2xl px-4 py-3 ${
                          msg.type === 'user' 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                            : 'bg-white border border-gray-200'
                        }`}>
                          <ChatMessageRenderer content={msg.content} isUser={msg.type === 'user'} />
                        </div>
                        {msg.type === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">U</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200 p-4">
              <div className="max-w-4xl mx-auto">
                {/* File Preview */}
                {files.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg text-sm">
                        <Paperclip size={14} />
                        <span>{file.name}</span>
                        <button
                          onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Input Field */}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Paperclip size={20} />
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder={`Message ${selectedAgent.name}...`}
                    disabled={isExecuting}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isExecuting || (!input.trim() && files.length === 0)}
                    className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isExecuting || (!input.trim() && files.length === 0)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transform hover:scale-105'
                    }`}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center"
              >
                <Bot className="text-white" size={64} />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Select an Agent
              </h2>
              <p className="text-gray-500 mb-6">
                Choose an agent from the sidebar to start chatting
              </p>
              <button
                onClick={() => setShowAgents(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all"
              >
                Browse Agents
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Main component wrapped with ExecutionProvider
export default function Home() {
  return (
    <ExecutionProvider>
      <ChatInterface />
    </ExecutionProvider>
  )
}