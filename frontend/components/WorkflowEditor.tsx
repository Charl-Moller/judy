import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiPlus, FiSettings, FiPlay, FiSave, FiTrash2, FiCopy, 
  FiZap, FiDatabase, FiCpu, FiMessageSquare, FiUser,
  FiArrowRight, FiX, FiEdit3, FiEye, FiLink
} from 'react-icons/fi'
import ConnectionManager from './ConnectionManager'
import WorkflowValidator from './WorkflowValidator'

interface WorkflowNode {
  id: string
  type: 'agent' | 'llm' | 'tool' | 'memory' | 'trigger' | 'output' | 'orchestrator'
  position: { x: number; y: number }
  data: any
  connections: {
    inputs: string[]
    outputs: string[]
  }
}

interface WorkflowConnection {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  type: 'data' | 'control' | 'memory'
  dataType: string
}

interface WorkflowEditorProps {
  onSave?: (workflow: any) => void
  onExecute?: (workflow: any) => void
  initialWorkflow?: any
}

export default function WorkflowEditor({ onSave, onExecute, initialWorkflow }: WorkflowEditorProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [connections, setConnections] = useState<WorkflowConnection[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showPalette, setShowPalette] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Undo/Redo functionality
  const [history, setHistory] = useState<Array<{ nodes: WorkflowNode[]; connections: WorkflowConnection[] }>>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isUndoRedo, setIsUndoRedo] = useState(false)

  // LLM Configs from database
  const [llmConfigs, setLLMConfigs] = useState<any[]>([])
  const [showLLMConfigModal, setShowLLMConfigModal] = useState(false)
  const [llmConfigForm, setLLMConfigForm] = useState({
    provider: '',
    model_name: '',
    temperature: 0.7,
    max_tokens: 4000,
    api_base: '',
    api_key_secret_ref: ''
  })

  // Test execution state
  const [showTestPanel, setShowTestPanel] = useState(false)
  const [testInput, setTestInput] = useState('')
  const [testResults, setTestResults] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionLogs, setExecutionLogs] = useState<string[]>([])
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([])
  
  // Debug logging for conversation history
  useEffect(() => {
    console.log('🔍 Conversation history updated:', conversationHistory)
    console.log('🔍 Conversation history length:', conversationHistory.length)
    console.log('🔍 Conversation history content:', conversationHistory.map(turn => `${turn.role}: ${turn.content.substring(0, 50)}...`))
  }, [conversationHistory])

  // Auto-scroll to bottom when new messages arrive
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [conversationHistory, isExecuting])

  const canvasRef = useRef<HTMLDivElement>(null)
  const draggedNodeRef = useRef<string | null>(null)

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoRedo) return // Don't save during undo/redo operations
    
    const currentState = { nodes, connections }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(currentState)
    
    // Limit history to 50 states to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift()
    }
    
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [nodes, connections, history, historyIndex, isUndoRedo])

  // Undo operation
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setIsUndoRedo(true)
      const newIndex = historyIndex - 1
      const previousState = history[newIndex]
      setNodes(previousState.nodes)
      setConnections(previousState.connections)
      setHistoryIndex(newIndex)
      setIsUndoRedo(false)
    }
  }, [history, historyIndex])

  // Redo operation
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setIsUndoRedo(true)
      const newIndex = historyIndex + 1
      const nextState = history[newIndex]
      setNodes(nextState.nodes)
      setConnections(nextState.connections)
      setHistoryIndex(newIndex)
      setIsUndoRedo(false)
    }
  }, [history, historyIndex])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Load initial workflow when it changes
  useEffect(() => {
    if (initialWorkflow) {
      setNodes(initialWorkflow.nodes || [])
      setConnections(initialWorkflow.connections || [])
      // Center the view on the workflow
      if (initialWorkflow.nodes && initialWorkflow.nodes.length > 0) {
        const avgX = initialWorkflow.nodes.reduce((sum: number, node: any) => sum + node.position.x, 0) / initialWorkflow.nodes.length
        const avgY = initialWorkflow.nodes.reduce((sum: number, node: any) => sum + node.position.y, 0) / initialWorkflow.nodes.length
        setPan({ x: -avgX + 400, y: -avgY + 300 })
      }
      
      // Initialize history with initial state
      const initialState = { nodes: initialWorkflow.nodes || [], connections: initialWorkflow.connections || [] }
      setHistory([initialState])
      setHistoryIndex(0)
    } else {
      // Reset canvas for new workflows
      setNodes([])
      setConnections([])
      setSelectedNode(null)
      setShowConfig(false)
      setPan({ x: 0, y: 0 })
      setZoom(1)
      
      // Initialize empty history
      const emptyState = { nodes: [], connections: [] }
      setHistory([emptyState])
      setHistoryIndex(0)
    }
  }, [initialWorkflow])

  const addNode = (type: WorkflowNode['type'], position: { x: number; y: number }) => {
    const newNode: WorkflowNode = {
      id: `${type}_${Date.now()}`,
      type,
      position,
      data: {
        name: type === 'agent' ? 'AI Agent' :
              type === 'orchestrator' ? 'Orchestrator' :
              type === 'llm' ? 'Language Model' :
              type === 'memory' ? 'Knowledge Memory' :
              type === 'tool' ? 'External Tool' :
              type === 'trigger' ? 'Trigger' :
              type === 'output' ? 'Output' : 'Node',
        description: type === 'agent' ? 'AI agent with LLM, memory, and tools' :
                    type === 'orchestrator' ? 'Coordinates multiple AI agents' :
                    type === 'llm' ? 'Large language model for text generation' :
                    type === 'memory' ? 'RAG, vector search, and knowledge retrieval' :
                    type === 'tool' ? 'External tool or API integration' :
                    type === 'trigger' ? 'Workflow trigger or starting point' :
                    type === 'output' ? 'Workflow output or result' : 'Configure this component',
        // Set default values for memory nodes
        ...(type === 'memory' && {
          type: 'rag',
          maxSize: 1000,
          similarity: 0.8,
          retention: '7d'
        })
      },
      connections: { inputs: [], outputs: [] }
    }
    
    setNodes(prev => [...prev, newNode])
    saveToHistory()
  }

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => {
      const newNodes = prev.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      )
      setTimeout(() => saveToHistory(), 0) // Save after state update
      return newNodes
    })
  }, [saveToHistory])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const newNodes = prev.filter(node => node.id !== nodeId)
      setTimeout(() => saveToHistory(), 0) // Save after state update
      return newNodes
    })
    setConnections(prev => {
      const newConnections = prev.filter(conn => 
        conn.source !== nodeId && conn.target !== nodeId
      )
      setTimeout(() => saveToHistory(), 0) // Save after state update
      return newConnections
    })
    if (selectedNode === nodeId) {
      setSelectedNode(null)
      setShowConfig(false)
    }
  }, [selectedNode, saveToHistory])

  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const newNode: WorkflowNode = {
      ...node,
      id: `${node.type}_${Date.now()}`,
      position: { x: node.position.x + 100, y: node.position.y + 100 }
    }
    setNodes(prev => {
      const newNodes = [...prev, newNode]
      setTimeout(() => saveToHistory(), 0) // Save after state update
      return newNodes
    })
  }, [nodes, saveToHistory])

  const createConnection = useCallback((connection: any) => {
    setConnections(prev => {
      const newConnections = [...prev, connection]
      setTimeout(() => saveToHistory(), 0) // Save after state update
      return newConnections
    })
  }, [saveToHistory])

  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => {
      const newConnections = prev.filter(conn => conn.id !== connectionId)
      setTimeout(() => saveToHistory(), 0) // Save after state update
      return newConnections
    })
  }, [saveToHistory])

  // Canvas dragging
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if we clicked on the canvas background (not on nodes or other elements)
    const target = e.target as HTMLElement
    if (target === canvasRef.current || 
        target.classList.contains('bg-grid-pattern') ||
        target === e.currentTarget) {
      setIsDraggingCanvas(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    }
  }, [pan])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }, [isDraggingCanvas, dragStart])

  const handleCanvasMouseUp = useCallback(() => {
    setIsDraggingCanvas(false)
  }, [])

  // Node dragging
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    setIsDraggingNode(true)
    draggedNodeRef.current = nodeId
    setSelectedNode(nodeId)
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleNodeMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingNode && draggedNodeRef.current) {
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      
      setNodes(prev => prev.map(node => 
        node.id === draggedNodeRef.current 
          ? { ...node, position: { x: node.position.x + deltaX, y: node.position.y + deltaY } }
          : node
      ))
      
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }, [isDraggingNode, dragStart])

  const handleNodeMouseUp = useCallback(() => {
    setIsDraggingNode(false)
    draggedNodeRef.current = null
  }, [])

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingNode) {
        handleNodeMouseMove(e as any)
      } else if (isDraggingCanvas) {
        // Handle canvas dragging globally
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      }
    }

    const handleGlobalMouseUp = () => {
      if (isDraggingNode) {
        handleNodeMouseUp()
      } else if (isDraggingCanvas) {
        setIsDraggingCanvas(false)
      }
    }

    if (isDraggingNode || isDraggingCanvas) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDraggingNode, isDraggingCanvas, handleNodeMouseMove, handleNodeMouseUp, dragStart])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      
      // Get the canvas element and its bounding rect
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      
      // Calculate mouse position relative to canvas
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      // Calculate mouse position relative to current pan and zoom
      const worldMouseX = (mouseX - pan.x) / zoom
      const worldMouseY = (mouseY - pan.y) / zoom
      
      // Calculate zoom delta
      const delta = e.deltaY > 0 ? 0.95 : 1.05
      const newZoom = Math.max(0.1, Math.min(3, zoom * delta))
      
      // Calculate new pan to keep mouse position fixed
      const newPanX = mouseX - worldMouseX * newZoom
      const newPanY = mouseY - worldMouseY * newZoom
      
      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }
  }, [zoom, pan])

  const saveWorkflow = useCallback(() => {
    console.log('🔍 saveWorkflow called with:')
    console.log('  - initialWorkflow:', initialWorkflow)
    console.log('  - initialWorkflow.id:', initialWorkflow?.id)
    console.log('  - nodes count:', nodes.length)
    console.log('  - connections count:', connections.length)
    
    const workflow = {
      id: initialWorkflow?.id || undefined,
      name: initialWorkflow?.name || initialWorkflow?.metadata?.name || 'AI Workflow',
      description: initialWorkflow?.description || initialWorkflow?.metadata?.description || 'AI Agent Orchestration Workflow',
      version: initialWorkflow?.version || initialWorkflow?.metadata?.version || '1.0.0',
      nodes,
      connections,
      workflow_metadata: {
        ...initialWorkflow?.workflow_metadata,
        ...initialWorkflow?.metadata,
        createdAt: new Date().toISOString()
      },
      tags: initialWorkflow?.tags || initialWorkflow?.metadata?.tags || [],
      owner_id: initialWorkflow?.owner_id || null,
      is_public: initialWorkflow?.is_public || false,
      status: initialWorkflow?.status || 'draft',
      is_template: initialWorkflow?.is_template || false
    }
    
    console.log('🔍 Final workflow object:')
    console.log('  - workflow.id:', workflow.id)
    console.log('  - workflow.name:', workflow.name)
    
    onSave?.(workflow)
  }, [nodes, connections, initialWorkflow, onSave])

  const executeWorkflow = useCallback(() => {
    const workflow = { nodes, connections }
    onExecute?.(workflow)
  }, [nodes, connections, onExecute])

  const resetCanvas = useCallback(() => {
    setNodes([])
    setConnections([])
    setSelectedNode(null)
    setShowConfig(false)
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  const showNodeConfig = useCallback((node: WorkflowNode) => {
    setSelectedNode(node.id)
    setShowConfig(true)
  }, [])

  // Load LLM configs from API
  useEffect(() => {
    const loadLLMConfigs = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
        const res = await fetch(`${apiBase}/llm-configs`)
        if (res.ok) {
          const configs = await res.json()
          setLLMConfigs(configs)
        }
      } catch (error) {
        console.error('Failed to load LLM configs:', error)
      }
    }
    
    loadLLMConfigs()
  }, [])

  // Save current LLM configuration as new LLM config
  const saveAsNewLLMConfig = useCallback(async (node: WorkflowNode) => {
    if (node.type !== 'llm') return
    
    const configData = {
      provider: node.data?.provider || '',
      model_name: node.data?.model || '',
      temperature: node.data?.temperature || 0.7,
      max_tokens: node.data?.maxTokens || 4000,
      api_base: node.data?.apiBase || '',
      api_key_secret_ref: node.data?.apiKeySecretRef || ''
    }
    
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      const res = await fetch(`${apiBase}/llm-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })
      
      if (res.ok) {
        const newConfig = await res.json()
        setLLMConfigs(prev => [...prev, newConfig])
        
        // Update the node to reference the new config
        const updatedNode = {
          ...node,
          data: { 
            ...node.data, 
            llmConfigId: newConfig.id 
          }
        }
        setNodes(prev => prev.map(n => n.id === node.id ? updatedNode : n))
        saveToHistory()
        
        alert('LLM configuration saved successfully!')
      } else {
        throw new Error('Failed to save LLM config')
      }
    } catch (error) {
      console.error('Failed to save LLM config:', error)
      alert('Failed to save LLM configuration. Please try again.')
    }
  }, [nodes, setNodes, saveToHistory])

  // Test workflow execution
  const testExecution = useCallback(async () => {
    if (!testInput.trim()) {
      alert('Please enter a test input first!')
      return
    }

    setIsExecuting(true)
    setExecutionLogs([])
    setTestResults('')

    try {
      // Find the agent node (assuming it's the starting point)
      const agentNode = nodes.find(n => n.type === 'agent')
      if (!agentNode) {
        throw new Error('No agent found in the workflow')
      }

      // Find the LLM node connected to the agent
      const agentConnections = connections.filter(c => c.source === agentNode.id)
      const llmConnection = agentConnections.find(c => {
        const targetNode = nodes.find(n => n.id === c.target)
        return targetNode?.type === 'llm'
      })

      if (!llmConnection) {
        throw new Error('No LLM connected to the agent')
      }

      const llmNode = nodes.find(n => n.id === llmConnection.target)
      if (!llmNode) {
        throw new Error('LLM node not found')
      }

      // Validate LLM configuration
      if (!llmNode.data?.provider || !llmNode.data?.model || !llmNode.data?.apiBase) {
        throw new Error('LLM configuration incomplete. Please configure provider, model, and API base URL.')
      }

      // Simulate execution flow
      setExecutionLogs(prev => [...prev, '🚀 Starting workflow execution...'])
      setExecutionLogs(prev => [...prev, `📝 Input received: "${testInput}"`])
      setExecutionLogs(prev => [...prev, `👤 Agent "${agentNode.data?.name || 'AI Agent'}" processing...`])
      
      if (agentNode.data?.systemPrompt) {
        setExecutionLogs(prev => [...prev, `💭 System prompt: "${agentNode.data.systemPrompt}"`])
      }
      
      setExecutionLogs(prev => [...prev, `🧠 LLM "${llmNode.data?.model || 'Unknown Model'}" generating response...`])
      
      // Call the real workflow execution API
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      const requestBody = {
        nodes: nodes,
        connections: connections,
        input: testInput,
        session_id: `workflow_test_${Date.now()}`,
        conversation_history: conversationHistory
      }
      
      console.log('🔍 Sending request with conversation history:', requestBody)
      console.log('🔍 Conversation history length:', conversationHistory.length)
      console.log('🔍 Current conversation history state:', conversationHistory)
      console.log('🔍 Memory node in workflow:', nodes.find(n => n.type === 'memory'))
      console.log('🔍 Memory node data:', nodes.find(n => n.type === 'memory')?.data)
      console.log('🔍 All nodes in workflow:', nodes.map(n => ({ id: n.id, type: n.type, data: n.data })))
      console.log('🔍 All connections in workflow:', connections)
      
      const response = await fetch(`${apiBase}/chat/workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      console.log('🔍 Response received:', result)
      console.log('🔍 Response response field:', result.response)
      console.log('🔍 Response workflow_execution:', result.workflow_execution)
      
      setExecutionLogs(prev => [...prev, '✅ Response generated successfully!'])
      setExecutionLogs(prev => [...prev, `🔗 Model: ${result.workflow_execution?.llm_model || 'Unknown'}`])
      setExecutionLogs(prev => [...prev, `🏢 Provider: ${result.workflow_execution?.provider || 'Unknown'}`])
      
      setTestResults(result.response)
      
      // Update conversation history
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: testInput },
        { role: 'assistant', content: result.response }
      ]
      console.log('🔍 Updating conversation history:', newHistory)
      console.log('🔍 New history length:', newHistory.length)
      console.log('🔍 Setting conversation history to:', newHistory)
      setConversationHistory(newHistory)
      
    } catch (error) {
      setExecutionLogs(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
      setTestResults('Execution failed. Check logs for details.')
    } finally {
      setIsExecuting(false)
    }
  }, [testInput, nodes, connections, conversationHistory])

  // Stream workflow execution for real-time feedback
  const streamExecution = useCallback(async () => {
    if (!testInput.trim()) {
      alert('Please enter a test input first!')
      return
    }

    setIsExecuting(true)
    setExecutionLogs([])
    setTestResults('')

    try {
      // Find the agent node (assuming it's the starting point)
      const agentNode = nodes.find(n => n.type === 'agent')
      if (!agentNode) {
        throw new Error('No agent found in the workflow')
      }

      // Find the LLM node connected to the agent
      const agentConnections = connections.filter(c => c.source === agentNode.id)
      const llmConnection = agentConnections.find(c => {
        const targetNode = nodes.find(n => n.id === c.target)
        return targetNode?.type === 'llm'
      })

      if (!llmConnection) {
        throw new Error('No LLM connected to the agent')
      }

      const llmNode = nodes.find(n => n.id === llmConnection.target)
      if (!llmNode) {
        throw new Error('LLM node not found')
      }

      // Validate LLM configuration
      if (!llmNode.data?.provider || !llmNode.data?.model || !llmNode.data?.apiBase) {
        throw new Error('LLM configuration incomplete. Please configure provider, model, and API base URL.')
      }

      // Simulate execution flow
      setExecutionLogs(prev => [...prev, '🚀 Starting streaming workflow execution...'])
      setExecutionLogs(prev => [...prev, `📝 Input received: "${testInput}"`])
      setExecutionLogs(prev => [...prev, `👤 Agent "${agentNode.data?.name || 'AI Agent'}" processing...`])
      
      if (agentNode.data?.systemPrompt) {
        setExecutionLogs(prev => [...prev, `💭 System prompt: "${agentNode.data.systemPrompt}"`])
      }
      
      setExecutionLogs(prev => [...prev, `🧠 LLM "${llmNode.data?.model || 'Unknown Model'}" generating response...`])
      
      // Call the streaming workflow execution API
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      const requestBody = {
        nodes: nodes,
        connections: connections,
        input: testInput,
        session_id: `workflow_test_${Date.now()}`,
        conversation_history: conversationHistory
      }
      
      console.log('🔍 Sending streaming request with conversation history:', requestBody)
      console.log('🔍 Conversation history length:', conversationHistory.length)
      console.log('🔍 Current conversation history state:', conversationHistory)
      console.log('🔍 Memory node in workflow:', nodes.find(n => n.type === 'memory'))
      console.log('🔍 Memory node data:', nodes.find(n => n.type === 'memory')?.data)
      console.log('🔍 All nodes in workflow:', nodes.map(n => ({ id: n.id, type: n.type, data: n.data })))
      console.log('🔍 All connections in workflow:', connections)
      
      const response = await fetch(`${apiBase}/chat/workflow/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      let fullResponse = ''
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.error) {
                  throw new Error(data.error)
                }
                
                if (data.content) {
                  fullResponse += data.content
                  setTestResults(fullResponse)
                }
                
                if (data.done) {
                  setExecutionLogs(prev => [...prev, '✅ Streaming response completed!'])
                  break
                }
              } catch (parseError) {
                // Skip invalid JSON lines
                continue
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
      
      setExecutionLogs(prev => [...prev, '✅ Streaming response completed!'])
      
      // Update conversation history
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: testInput },
        { role: 'assistant', content: fullResponse }
      ]
      console.log('🔍 Updating streaming conversation history:', newHistory)
      console.log('🔍 New streaming history length:', newHistory.length)
      console.log('🔍 Setting streaming conversation history to:', newHistory)
      setConversationHistory(newHistory)
      
    } catch (error) {
      setExecutionLogs(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
      setTestResults('Execution failed. Check logs for details.')
    } finally {
      setIsExecuting(false)
    }
  }, [testInput, nodes, connections, conversationHistory])



  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {initialWorkflow ? `Editing: ${initialWorkflow.name || initialWorkflow.metadata?.name || 'Untitled Workflow'}` : 'AI Workflow Editor'}
            </h1>
            {initialWorkflow && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                ID: {initialWorkflow.id?.substring(0, 8)}...
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {/* Undo/Redo buttons */}
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
              title="Undo (Ctrl+Z)"
            >
              <FiArrowRight className="w-4 h-4 transform rotate-180" />
              <span>Undo</span>
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <FiArrowRight className="w-4 h-4" />
              <span>Redo</span>
            </button>
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-sm font-medium text-gray-700"
            >
              {showPalette ? 'Hide' : 'Show'} Palette
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-sm font-medium text-gray-700"
            >
              {showConfig ? 'Hide' : 'Show'} Config
            </button>
            <button
              onClick={() => setShowTestPanel(!showTestPanel)}
              className={`px-3 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors ${
                showTestPanel 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💬 {showTestPanel ? 'Hide' : 'Show'} Chat
            </button>
            <button
              onClick={resetCanvas}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-sm font-medium text-gray-700"
            >
              Reset
            </button>
            <div className="text-sm text-gray-500 px-2">
              💡 Click and drag on empty canvas to pan • Ctrl+scroll to zoom to mouse
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={saveWorkflow}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center space-x-2 text-sm font-medium"
          >
            <FiSave className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button
            onClick={executeWorkflow}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center space-x-2 text-sm font-medium"
          >
            <FiPlay className="w-4 h-4" />
            <span>Execute</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Component Palette */}
        <AnimatePresence>
          {showPalette && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 280 }}
              exit={{ width: 0 }}
              className="bg-white border-r border-gray-200 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Components</h3>
                    <button
                      onClick={() => setShowPalette(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  <button
                    onClick={() => addNode('agent', { x: 100, y: 100 })}
                    className="w-full p-3 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-blue-900">AI Agent</div>
                    <div className="text-sm text-blue-700">AI agent with LLM, memory, and tools</div>
                  </button>
                  
                  <button
                    onClick={() => addNode('orchestrator', { x: 100, y: 100 })}
                    className="w-full p-3 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-purple-900">Orchestrator</div>
                    <div className="text-sm text-purple-700">Coordinates multiple AI agents</div>
                  </button>
                  
                  <button
                    onClick={() => addNode('llm', { x: 100, y: 100 })}
                    className="w-full p-3 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-blue-900">Language Model</div>
                    <div className="text-sm text-blue-700">Large language model for text generation</div>
                  </button>
                  
                  <button
                    onClick={() => addNode('memory', { x: 100, y: 100 })}
                    className="w-full p-3 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-purple-900">Knowledge Memory</div>
                    <div className="text-sm text-purple-700">RAG, vector search, and knowledge retrieval</div>
                  </button>
                  
                  <button
                    onClick={() => addNode('tool', { x: 100, y: 100 })}
                    className="w-full p-3 bg-green-100 hover:bg-green-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-green-900">External Tool</div>
                    <div className="text-sm text-green-700">External tool or API integration</div>
                  </button>
                  
                  <button
                    onClick={() => addNode('trigger', { x: 100, y: 100 })}
                    className="w-full p-3 bg-red-100 hover:bg-red-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-red-900">Trigger</div>
                    <div className="text-sm text-red-700">Workflow trigger or starting point</div>
                  </button>
                  
                  <button
                    onClick={() => addNode('output', { x: 100, y: 100 })}
                    className="w-full p-3 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium text-orange-900">Output</div>
                    <div className="text-sm text-orange-700">Workflow output or result</div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Toolbar */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm font-medium text-gray-700"
            >
              {showPalette ? 'Hide' : 'Show'} Components
            </button>
            
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm font-medium text-gray-700"
            >
              {showConfig ? 'Hide' : 'Show'} Config
            </button>
            
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1">
              <button
                onClick={() => setZoom(prev => Math.max(0.1, prev * 0.95))}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Zoom Out (Ctrl+scroll)"
              >
                -
              </button>
              <span className="px-2 text-sm text-gray-600 min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.min(5, prev * 1.05))}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Zoom In (Ctrl+scroll)"
              >
                +
              </button>
            </div>
            
            <button
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm font-medium text-gray-700"
              title="Reset View (Ctrl+scroll to zoom to mouse)"
            >
              Reset View
            </button>
            
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                ↶
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y)"
              >
                ↷
              </button>
            </div>
          </div>

          {/* Canvas Content */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0'
            }}
          >
            {/* Grid Background */}
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
            
            {/* Canvas Background for Dragging */}
            <div 
              className={`absolute inset-0 ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
            
            {/* Workflow Nodes */}
            {nodes.map(node => (
              <div
                key={node.id}
                className={`absolute p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none ${
                  node.type === 'agent' || node.type === 'orchestrator' ? 'w-48 h-32' : 
                  node.type === 'llm' || node.type === 'tool' || node.type === 'memory' ? 'w-48 h-20' : 'w-48 h-24'
                } ${
                  node.type === 'llm' ? 'bg-blue-50 border-blue-300' :
                  node.type === 'memory' ? 'bg-purple-50 border-purple-300' :
                  node.type === 'tool' ? 'bg-green-50 border-green-300' : ''
                }`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none'
                }}
                onClick={() => showNodeConfig(node)}
                onMouseDown={(e) => {
                  if (e.button === 0) { // Left click only
                    handleNodeMouseDown(e, node.id)
                  }
                }}
                onMouseMove={handleNodeMouseMove}
                onMouseUp={handleNodeMouseUp}
                onDoubleClick={() => setSelectedNode(node.id)}
              >
                {/* Node Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-semibold">
                    {node.type === 'llm' && '🧠'}
                    {node.type === 'trigger' && '▶'}
                    {node.type === 'agent' && '👤'}
                    {node.type === 'orchestrator' && '🎯'}
                    {node.type === 'tool' && '⚡'}
                    {node.type === 'memory' && '💾'}
                    {node.type === 'output' && '💬'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {node.data?.name || 
                       (node.type === 'trigger' ? 'Trigger' :
                        node.type === 'agent' ? 'AI Agent' :
                        node.type === 'orchestrator' ? 'Orchestrator' :
                        node.type === 'llm' ? 'Language Model' :
                        node.type === 'tool' ? 'Tool' :
                        node.type === 'memory' ? 'Memory' :
                        node.type === 'output' ? 'Output' : 'Node')}
                    </h3>
                  </div>
                  
                  {/* Node Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        duplicateNode(node.id)
                      }}
                      className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-200"
                      title="Duplicate Node"
                    >
                      <FiCopy className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNode(node.id)
                      }}
                      className="w-6 h-6 rounded bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors duration-200"
                      title="Delete Node"
                    >
                      <FiTrash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Connection Manager */}
          <ConnectionManager
            nodes={nodes}
            connections={connections}
            onConnectionsChange={setConnections}
            onConnectionCreate={createConnection}
            onConnectionDelete={deleteConnection}
            onNodeCreate={(node) => setNodes(prev => [...prev, node])}
            pan={pan}
            zoom={zoom}
          />
        </div>

        {/* Configuration Panel */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 400 }}
              exit={{ width: 0 }}
              className="bg-white border-l border-gray-200 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedNode ? 'Component Configuration' : 'Workflow Overview'}
                    </h3>
                    <button
                      onClick={() => setShowConfig(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto">
                  {selectedNode ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Component Name
                        </label>
                        <input
                          type="text"
                          value={nodes.find(n => n.id === selectedNode)?.data?.name || ''}
                          onChange={(e) => {
                            const node = nodes.find(n => n.id === selectedNode)!
                            const updatedNode = {
                              ...node,
                              data: { ...node.data, name: e.target.value }
                            }
                            setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                            saveToHistory()
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter component name..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={nodes.find(n => n.id === selectedNode)?.data?.description || ''}
                          onChange={(e) => {
                            const node = nodes.find(n => n.id === selectedNode)!
                            const updatedNode = {
                              ...node,
                              data: { ...node.data, description: e.target.value }
                            }
                            setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                            saveToHistory()
                          }}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter component description..."
                        />
                      </div>

                      {/* Agent-specific configuration */}
                      {nodes.find(n => n.id === selectedNode)?.type === 'agent' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              System Prompt
                            </label>
                            <textarea
                              value={nodes.find(n => n.id === selectedNode)?.data?.systemPrompt || ''}
                              onChange={(e) => {
                                const node = nodes.find(n => n.id === selectedNode)!
                                const updatedNode = {
                                  ...node,
                                  data: { ...node.data, systemPrompt: e.target.value }
                                }
                                setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                saveToHistory()
                              }}
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter system prompt for the AI agent..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Context Window
                            </label>
                            <input
                              type="number"
                              value={nodes.find(n => n.id === selectedNode)?.data?.contextWindow || 4000}
                              onChange={(e) => {
                                const node = nodes.find(n => n.id === selectedNode)!
                                const updatedNode = {
                                  ...node,
                                  data: { ...node.data, contextWindow: parseInt(e.target.value) || 4000 }
                                }
                                setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                saveToHistory()
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="1000"
                              max="32000"
                              step="1000"
                            />
                          </div>
                          
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Conversation Memory</h4>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Conversation History Length
                                </label>
                                <input
                                  type="number"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.maxConversations || 10}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, maxConversations: parseInt(e.target.value) || 10 }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  min="1"
                                  max="100"
                                  step="1"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  Number of previous conversation turns to remember (1-100)
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Include System Messages
                                </label>
                                <div className="flex items-center space-x-4">
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={nodes.find(n => n.id === selectedNode)?.data?.includeSystemMessages !== false}
                                      onChange={(e) => {
                                        const node = nodes.find(n => n.id === selectedNode)!
                                        const updatedNode = {
                                          ...node,
                                          data: { ...node.data, includeSystemMessages: e.target.checked }
                                        }
                                        setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                        saveToHistory()
                                      }}
                                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Include system messages in context</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* LLM-specific configuration */}
                      {nodes.find(n => n.id === selectedNode)?.type === 'llm' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              LLM Configuration
                            </label>
                            <div className="space-y-3">
                              {/* Existing LLM Configs */}
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Select Existing Config
                                </label>
                                <select
                                  value={nodes.find(n => n.id === selectedNode)?.data?.llmConfigId || ''}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const selectedConfig = llmConfigs.find(c => c.id === e.target.value)
                                    const updatedNode = {
                                      ...node,
                                      data: { 
                                        ...node.data, 
                                        llmConfigId: e.target.value,
                                        provider: selectedConfig?.provider || '',
                                        model: selectedConfig?.model_name || '',
                                        temperature: selectedConfig?.temperature ? parseFloat(selectedConfig.temperature) : 0.7,
                                        maxTokens: selectedConfig?.max_tokens ? parseInt(selectedConfig.max_tokens) : 4000,
                                        apiBase: selectedConfig?.api_base || '',
                                        apiKeySecretRef: selectedConfig?.api_key_secret_ref || ''
                                      }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="">Select existing LLM config...</option>
                                  {llmConfigs.map(config => (
                                    <option key={config.id} value={config.id}>
                                      {config.provider} - {config.model_name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Divider */}
                              <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-gray-300" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                  <span className="px-2 bg-white text-gray-500">Or configure manually</span>
                                </div>
                              </div>

                              {/* Manual Configuration */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Provider
                                </label>
                                <input
                                  type="text"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.provider || ''}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, provider: e.target.value }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="e.g., Azure OpenAI, OpenAI, Anthropic"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Model
                                </label>
                                <input
                                  type="text"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.model || ''}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, model: e.target.value }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="e.g., gpt-4, claude-3, gemini-pro..."
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  API Base URL
                                </label>
                                <input
                                  type="url"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.apiBase || ''}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, apiBase: e.target.value }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="https://your-resource.openai.azure.com/"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  API Key Secret Reference
                                </label>
                                <input
                                  type="text"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.apiKeySecretRef || ''}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, apiKeySecretRef: e.target.value }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="secret://azure/keyvault/openai-api-key"
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Temperature
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={nodes.find(n => n.id === selectedNode)?.data?.temperature || 0.7}
                                    onChange={(e) => {
                                      const node = nodes.find(n => n.id === selectedNode)!
                                      const updatedNode = {
                                        ...node,
                                        data: { ...node.data, temperature: parseFloat(e.target.value) }
                                      }
                                      setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                      saveToHistory()
                                    }}
                                    className="w-full"
                                  />
                                  <div className="text-xs text-gray-500 mt-1">
                                    {nodes.find(n => n.id === selectedNode)?.data?.temperature || 0.7}
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Tokens
                                  </label>
                                  <input
                                    type="number"
                                    value={nodes.find(n => n.id === selectedNode)?.data?.maxTokens || 4000}
                                    onChange={(e) => {
                                      const node = nodes.find(n => n.id === selectedNode)!
                                      const updatedNode = {
                                        ...node,
                                        data: { ...node.data, maxTokens: parseInt(e.target.value) || 4000 }
                                      }
                                      setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                      saveToHistory()
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    min="100"
                                    max="32000"
                                    step="100"
                                  />
                                </div>
                              </div>

                              {/* Save as New LLM Config Button */}
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() => saveAsNewLLMConfig(nodes.find(n => n.id === selectedNode)!)}
                                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                                >
                                  💾 Save as New LLM Config
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Tool-specific configuration */}
                      {nodes.find(n => n.id === selectedNode)?.type === 'tool' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Tool Type
                            </label>
                            <select
                              value={nodes.find(n => n.id === selectedNode)?.data?.type || ''}
                              onChange={(e) => {
                                const node = nodes.find(n => n.id === selectedNode)!
                                const updatedNode = {
                                  ...node,
                                  data: { ...node.data, type: e.target.value }
                                }
                                setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                saveToHistory()
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select tool type...</option>
                              <option value="api">API Integration</option>
                              <option value="function">Function Call</option>
                              <option value="database">Database Query</option>
                              <option value="file">File Operation</option>
                              <option value="webhook">Webhook</option>
                              <option value="custom">Custom Tool</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Parameters (JSON)
                            </label>
                            <textarea
                              value={JSON.stringify(nodes.find(n => n.id === selectedNode)?.data?.parameters || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const node = nodes.find(n => n.id === selectedNode)!
                                  const parameters = JSON.parse(e.target.value)
                                  const updatedNode = {
                                    ...node,
                                    data: { ...node.data, parameters }
                                  }
                                  setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                  saveToHistory()
                                } catch (error) {
                                  // Invalid JSON, don't update
                                }
                              }}
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                              placeholder='{"key": "value", "url": "https://..."}'
                            />
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={nodes.find(n => n.id === selectedNode)?.data?.enabled !== false}
                                onChange={(e) => {
                                  const node = nodes.find(n => n.id === selectedNode)!
                                  const updatedNode = {
                                    ...node,
                                    data: { ...node.data, enabled: e.target.checked }
                                  }
                                  setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                  saveToHistory()
                                }}
                                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">Tool Enabled</span>
                            </label>
                          </div>
                        </>
                      )}

                      {/* Memory-specific configuration */}
                      {nodes.find(n => n.id === selectedNode)?.type === 'memory' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Memory Type
                            </label>
                            <select
                              value={nodes.find(n => n.id === selectedNode)?.data?.type || 'conversation'}
                              onChange={(e) => {
                                const node = nodes.find(n => n.id === selectedNode)!
                                const updatedNode = {
                                  ...node,
                                  data: { ...node.data, type: e.target.value }
                                }
                                setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                saveToHistory()
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="rag">RAG (Retrieval Augmented Generation)</option>
                              <option value="vector">Vector Database</option>
                              <option value="sql">SQL Database</option>
                              <option value="redis">Redis Cache</option>
                              <option value="file">File-based</option>
                              <option value="custom">Custom Implementation</option>
                            </select>
                          </div>
                          
                          {/* Conversation Context Memory Configuration */}
                          {nodes.find(n => n.id === selectedNode)?.data?.type === 'conversation' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Conversation History Length
                                </label>
                                <input
                                  type="number"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.maxConversations || 10}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, maxConversations: parseInt(e.target.value) || 10 }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  min="1"
                                  max="100"
                                  step="1"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  Number of previous conversation turns to remember (1-100)
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Include System Messages
                                </label>
                                <div className="flex items-center space-x-4">
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={nodes.find(n => n.id === selectedNode)?.data?.includeSystemMessages !== false}
                                      onChange={(e) => {
                                        const node = nodes.find(n => n.id === selectedNode)!
                                        const updatedNode = {
                                          ...node,
                                          data: { ...node.data, includeSystemMessages: e.target.checked }
                                        }
                                        setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                        saveToHistory()
                                      }}
                                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Include system messages in context</span>
                                  </label>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Memory Strategy
                                </label>
                                <select
                                  value={nodes.find(n => n.id === selectedNode)?.data?.memoryStrategy || 'sliding_window'}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, memoryStrategy: e.target.value }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="sliding_window">Sliding Window (Keep last N conversations)</option>
                                  <option value="token_based">Token-based (Keep within token limit)</option>
                                  <option value="time_based">Time-based (Keep recent conversations)</option>
                                </select>
                              </div>
                            </>
                          )}

                          {/* Vector/Advanced Memory Configuration */}
                          {nodes.find(n => n.id === selectedNode)?.data?.type !== 'conversation' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Max Size
                                </label>
                                <input
                                  type="number"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.maxSize || 1000}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, maxSize: parseInt(e.target.value) || 1000 }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  min="100"
                                  max="100000"
                                  step="100"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Similarity Threshold
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={nodes.find(n => n.id === selectedNode)?.data?.similarity || 0.8}
                                  onChange={(e) => {
                                    const node = nodes.find(n => n.id === selectedNode)!
                                    const updatedNode = {
                                      ...node,
                                      data: { ...node.data, similarity: parseFloat(e.target.value) }
                                    }
                                    setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                    saveToHistory()
                                  }}
                                  className="w-full"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  {nodes.find(n => n.id === selectedNode)?.data?.similarity || 0.8}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Retention Period
                            </label>
                            <select
                              value={nodes.find(n => n.id === selectedNode)?.data?.retention || '7d'}
                              onChange={(e) => {
                                const node = nodes.find(n => n.id === selectedNode)!
                                const updatedNode = {
                                  ...node,
                                  data: { ...node.data, retention: e.target.value }
                                }
                                setNodes(prev => prev.map(n => n.id === selectedNode ? updatedNode : n))
                                saveToHistory()
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="1d">1 Day</option>
                              <option value="7d">7 Days</option>
                              <option value="30d">30 Days</option>
                              <option value="90d">90 Days</option>
                              <option value="1y">1 Year</option>
                              <option value="never">Never</option>
                            </select>
                          </div>
                        </>
                      )}
                      
                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={() => setSelectedNode(null)}
                          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Close Configuration
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <WorkflowValidator nodes={nodes} connections={connections} />
                      
                      <div className="mt-6">
                        <h4 className="font-medium text-gray-900 mb-3">Workflow Statistics</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-gray-600">Total Nodes</div>
                            <div className="text-2xl font-bold text-blue-600">{nodes.length}</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-gray-600">Connections</div>
                            <div className="text-2xl font-bold text-green-600">{connections.length}</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-gray-600">Start Points</div>
                            <div className="text-2xl font-bold text-purple-600">
                              {nodes.filter(node => 
                                connections.every(conn => conn.target !== node.id)
                              ).length}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-gray-600">End Points</div>
                            <div className="text-2xl font-bold text-orange-600">
                              {nodes.filter(node => 
                                connections.every(conn => conn.source !== node.id)
                              ).length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chatbot Test Panel */}
        <AnimatePresence>
          {showTestPanel && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 500 }}
              exit={{ width: 0 }}
              className="bg-white border-l border-gray-200 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">AI Agent Chat</h3>
                        <p className="text-sm text-blue-100">
                          {nodes.find(n => n.type === 'agent')?.data?.name || 'AI Agent'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTestPanel(false)}
                      className="text-white hover:text-blue-100 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Chat Messages Area */}
                <div ref={chatMessagesRef} className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
                  {/* Welcome Message */}
                  {conversationHistory.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">👋</span>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Welcome to your AI Agent!</h4>
                      <p className="text-gray-600 text-sm">
                        Start a conversation below. Your agent will remember the context of your chat.
                      </p>
                    </div>
                  )}
                  
                  {/* Chat Messages */}
                  {conversationHistory.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white rounded-br-none' 
                          : 'bg-white text-gray-800 rounded-bl-none shadow-sm border'
                      }`}>
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.role === 'user' ? 'You' : 'AI Agent'} • {new Date().toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Typing Indicator */}
                  {isExecuting && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white text-gray-800 rounded-lg rounded-bl-none shadow-sm border px-4 py-2">
                        <div className="flex items-center space-x-1">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span className="text-sm text-gray-500 ml-2">AI is thinking...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                {/* Chat Input Area */}
                <div className="border-t border-gray-200 bg-white p-4">
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <textarea
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (testInput.trim() && !isExecuting) {
                              testExecution()
                            }
                          }
                        }}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                        disabled={isExecuting}
                      />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={testExecution}
                        disabled={isExecuting || !testInput.trim()}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed text-sm flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Send</span>
                      </button>
                      <button
                        onClick={streamExecution}
                        disabled={isExecuting || !testInput.trim()}
                        className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed text-xs flex items-center space-x-1"
                        title="Stream response in real-time"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Stream</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>💬 {conversationHistory.length} messages</span>
                      {conversationHistory.length > 0 && (
                        <>
                          <button
                            onClick={() => setConversationHistory([])}
                            className="text-red-500 hover:text-red-700 underline"
                          >
                            Clear chat
                          </button>
                          <span className="text-gray-300">•</span>
                          <button
                            onClick={() => {
                              setConversationHistory([])
                              setTestInput('')
                              setTestResults('')
                              setExecutionLogs([])
                            }}
                            className="text-blue-500 hover:text-blue-700 underline"
                          >
                            New chat
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className={testInput.length > 1000 ? 'text-red-500' : 'text-gray-500'}>
                        {testInput.length}/1000
                      </span>
                      <button
                        onClick={() => {
                          setTestInput('')
                          setTestResults('')
                          setExecutionLogs([])
                        }}
                        disabled={isExecuting}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        title="Clear input and results"
                      >
                        🗑️ Clear
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Workflow Status (Collapsible) */}
                <div className="border-t border-gray-200 bg-gray-50">
                  <details className="group">
                    <summary className="px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Workflow Status</span>
                      <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-4 pb-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Agent:</span>
                        <span className={nodes.find(n => n.type === 'agent') ? 'text-green-600' : 'text-red-600'}>
                          {nodes.find(n => n.type === 'agent') ? '✅ Found' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">LLM:</span>
                        <span className={nodes.find(n => n.type === 'llm') ? 'text-green-600' : 'text-red-600'}>
                          {nodes.find(n => n.type === 'llm') ? '✅ Found' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Memory:</span>
                        <span className={nodes.find(n => n.type === 'memory') ? 'text-green-600' : 'text-red-600'}>
                          {nodes.find(n => n.type === 'memory') ? '✅ Found' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Connection:</span>
                        <span className={connections.some(c => 
                          nodes.find(n => n.id === c.source)?.type === 'agent' && 
                          nodes.find(n => n.id === c.target)?.type === 'llm'
                        ) ? 'text-green-600' : 'text-red-600'}>
                          {connections.some(c => 
                            nodes.find(n => n.id === c.source)?.type === 'agent' && 
                            nodes.find(n => n.id === c.target)?.type === 'llm'
                          ) ? '✅ Connected' : '❌ Not Connected'}
                        </span>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
