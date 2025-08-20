import React, { useCallback, useRef, useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  ReactFlowInstance,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  useReactFlow
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Box, Typography, Paper } from '@mui/material'
import AgentNode from './AgentNode'
import AgentEdge from './AgentEdge'
import AgentPalette from './AgentPalette'
import AgentCanvasHeader from './AgentCanvasHeader'
import NodeConfigPanel from './NodeConfigPanel'
import TestPanel from './TestPanel'
import { useFlow } from '../../context/FlowContext'
import { NodeConfigProvider, useNodeConfig } from '../../context/NodeConfigContext'
import { ExecutionProvider } from '../../context/ExecutionContext'

const nodeTypes = {
  custom: AgentNode,
  agent: AgentNode,
  persona_router: AgentNode,
  llm: AgentNode,
  tool: AgentNode,
  memory: AgentNode,
  trigger: AgentNode,
  output: AgentNode,
  orchestrator: AgentNode
}

const edgeTypes = {
  custom: AgentEdge,
  data: AgentEdge,
  control: AgentEdge,
  memory: AgentEdge
}

interface AgentCanvasProps {
  height?: string
  onSave?: (agent: any) => void
  onExecute?: (agent: any) => void
  onBack?: () => void
  onNodeSelect?: (node: any) => void
  onOpenTestChat?: () => void
  initialAgent?: any
}

const FlowContent: React.FC<AgentCanvasProps> = ({ onSave, onExecute, onBack, onNodeSelect, onOpenTestChat, initialAgent }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { setReactFlowInstance, reactFlowInstance } = useFlow()
  const { isConfigOpen } = useNodeConfig()
  const [nodes, setNodes, onNodesChange]: [Node[], (nodes: Node[]) => void, OnNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange]: [Edge[], (edges: Edge[]) => void, OnEdgesChange] = useEdgesState([])
  const [zoomLevel, setZoomLevel] = useState<number>(100)

  // Load initial agent data
  useEffect(() => {
    if (initialAgent && reactFlowInstance) {
      console.log('🤖 Loading initial agent:', initialAgent)
      
      // Convert workflow nodes to ReactFlow nodes
      const flowNodes = (initialAgent.nodes || []).map((node: any) => ({
        id: node.id,
        type: node.type === 'custom' ? 'agent' : node.type, // Default custom to agent
        position: node.position || { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          ...node.data,
          label: node.data?.name || node.data?.label || `${node.type} Node`,
          nodeType: node.type
        }
      }))

      // Convert workflow connections to ReactFlow edges
      const flowEdges = (initialAgent.connections || []).map((conn: any) => ({
        id: conn.id || `${conn.source}-${conn.target}`,
        source: conn.source,
        target: conn.target,
        type: conn.type || 'data',
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
        data: {
          dataType: conn.dataType || 'any'
        }
      }))

      setNodes(flowNodes)
      setEdges(flowEdges)

      // Set default zoom to 100% after a short delay
      setTimeout(() => {
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1.0 })
      }, 100)
    }
  }, [initialAgent, reactFlowInstance, setNodes, setEdges])

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'data',
        id: `${params.source}-${params.target}-${Date.now()}`
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  // Handle node click for automatic config panel opening
  const onNodeClick = useCallback((event: any, node: Node) => {
    console.log('Node clicked:', node)
    if (onNodeSelect) {
      // Convert ReactFlow node back to our component format
      const componentData = {
        id: node.id,
        type: node.data?.nodeType || node.type || 'unknown',
        data: node.data
      }
      onNodeSelect(componentData)
    }
  }, [onNodeSelect])

  const onInit = (instance: ReactFlowInstance) => {
    setReactFlowInstance(instance)
    // Set default zoom to 100%
    instance.setViewport({ x: 0, y: 0, zoom: 1.0 })
    setZoomLevel(100)
  }

  // Handle zoom changes
  const onMove = useCallback(() => {
    if (reactFlowInstance) {
      const viewport = reactFlowInstance.getViewport()
      setZoomLevel(Math.round(viewport.zoom * 100))
    }
  }, [reactFlowInstance])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      if (!reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const type = event.dataTransfer.getData('application/reactflow')

      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = reactFlowInstance 
        ? reactFlowInstance.project({
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top
          })
        : {
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top
          }

      // Create node data based on type
      const getNodeData = (nodeType: string) => {
        const baseData = {
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
          nodeType: nodeType
        }

        switch (nodeType) {
          case 'agent':
            return {
              ...baseData,
              name: 'New Agent',
              description: 'AI Agent description',
              systemPrompt: 'You are a helpful AI assistant.',
              capabilities: [],
              memory: false,
              contextWindow: 4000
            }
          case 'llm':
            return {
              ...baseData,
              provider: 'OpenAI',
              model: 'gpt-4',
              temperature: 0.7,
              maxTokens: 1000,
              apiBase: '',
              apiKey: ''
            }
          case 'tool':
            return {
              ...baseData,
              name: 'New Tool',
              type: 'function',
              description: 'Tool description',
              parameters: {},
              enabled: true
            }
          case 'persona_router':
            return {
              ...baseData,
              name: 'Persona Router',
              description: 'Routes user input to appropriate connected agents',
              intents: {
                method: 'hybrid',
                confidenceThreshold: 0.7
              },
              agentIntentMappings: {},
              // Legacy personas field removed - now uses connected agents
            }
          case 'memory':
            return {
              ...baseData,
              type: 'conversation',
              conversation: {
                windowSize: 10,
                includeSystem: false
              }
            }
          case 'trigger':
            return {
              ...baseData,
              type: 'webhook',
              method: 'POST',
              path: '/trigger',
              authentication: false
            }
          case 'output':
            return {
              ...baseData,
              format: 'json',
              destination: 'api',
              template: '{{result}}'
            }
          case 'orchestrator':
            return {
              ...baseData,
              name: 'Agent Orchestrator',
              routing: 'round_robin',
              timeout: 30000
            }
          default:
            return baseData
        }
      }

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type: type,
        position,
        data: getNodeData(type)
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes, reactFlowInstance]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleSave = useCallback(() => {
    if (!reactFlowInstance) return

    const currentNodes = reactFlowInstance.getNodes()
    const currentEdges = reactFlowInstance.getEdges()

    // Convert back to workflow format
    const agentData = {
      ...(initialAgent || {}),
      nodes: currentNodes.map(node => ({
        id: node.id,
        type: node.data?.nodeType || node.type,
        position: node.position,
        data: {
          ...node.data,
          // Remove ReactFlow specific fields
          nodeType: undefined
        }
      })),
      connections: currentEdges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type || 'data',
        dataType: edge.data?.dataType || 'any'
      })),
      // Update metadata
      name: initialAgent?.name || 'Untitled Agent',
      description: initialAgent?.description || 'Agent description',
      updated_at: new Date().toISOString()
    }

    console.log('🤖 Saving agent:', agentData)
    
    if (onSave) {
      onSave(agentData)
    }
  }, [reactFlowInstance, initialAgent, onSave])

  const handleExecute = useCallback(() => {
    if (!reactFlowInstance) return

    const currentNodes = reactFlowInstance.getNodes()
    const currentEdges = reactFlowInstance.getEdges()

    const agentData = {
      ...(initialAgent || {}),
      nodes: currentNodes.map(node => ({
        id: node.id,
        type: node.data?.nodeType || node.type,
        position: node.position,
        data: node.data
      })),
      connections: currentEdges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'data'
      }))
    }

    console.log('🤖 Executing agent:', agentData)
    
    if (onExecute) {
      onExecute(agentData)
    }
  }, [reactFlowInstance, initialAgent, onExecute])

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      maxHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <AgentCanvasHeader 
        agentName={initialAgent?.name || 'New Agent'}
        onSave={handleSave}
        onExecute={handleExecute}
        onBack={onBack}
        onOpenTestChat={onOpenTestChat}
      />
      <Box sx={{ 
        display: 'flex', 
        flex: 1, 
        position: 'relative',
        minHeight: 0 // Important: allows flex items to shrink below content size
      }}>
        <AgentPalette />
        <Box 
          ref={reactFlowWrapper} 
          sx={{ 
            flex: 1,
            transition: 'margin-right 0.3s ease-in-out',
            marginRight: isConfigOpen ? '400px' : '0px'
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={onInit}
            onMove={onMove}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            <MiniMap 
              nodeStrokeColor="#666"
              nodeColor="#fff"
              nodeBorderRadius={2}
            />
          </ReactFlow>

          {/* Zoom Percentage Display */}
          <Paper
            elevation={2}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              padding: '8px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                fontFamily: 'monospace', 
                fontWeight: 600,
                color: zoomLevel < 50 ? 'error.main' : zoomLevel > 200 ? 'warning.main' : 'text.primary'
              }}
            >
              {zoomLevel}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              zoom
            </Typography>
          </Paper>
        </Box>
        
        {/* Right-side configuration panel */}
        {isConfigOpen && (
          <Box sx={{ 
            position: 'absolute',
            right: 0,
            top: 0,
            height: '100%',
            zIndex: 1000
          }}>
            <NodeConfigPanel />
          </Box>
        )}
      </Box>
    </Box>
  )
}

const Flow: React.FC<AgentCanvasProps> = (props) => {
  return (
    <ExecutionProvider>
      <NodeConfigProvider>
        <FlowContent {...props} />
      </NodeConfigProvider>
    </ExecutionProvider>
  )
}

const AgentCanvas: React.FC<AgentCanvasProps> = ({ height = '100%', ...props }) => {
  return (
    <Box sx={{ height }}>
      <ReactFlowProvider>
        <Flow {...props} />
      </ReactFlowProvider>
    </Box>
  )
}

export default AgentCanvas