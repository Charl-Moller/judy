import React, { useCallback, useRef } from 'react'
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
  OnEdgesChange
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Box } from '@mui/material'
import CustomNode from './CustomNode'
import CustomEdge from './CustomEdge'
import NodePalette from './NodePalette'
import CanvasHeader from './CanvasHeader'
import { useFlow } from '../../context/FlowContext'

const nodeTypes = {
  custom: CustomNode
}

const edgeTypes = {
  custom: CustomEdge
}

interface FlowProps {}

const Flow: React.FC<FlowProps> = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { setReactFlowInstance, reactFlowInstance } = useFlow()
  const [nodes, setNodes, onNodesChange]: [Node[], (nodes: Node[]) => void, OnNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange]: [Edge[], (edges: Edge[]) => void, OnEdgesChange] = useEdgesState([])

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'custom',
        id: `${params.source}-${params.target}`
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  const onInit = (instance: ReactFlowInstance) => {
    setReactFlowInstance(instance)
  }

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

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'custom',
        position,
        data: { 
          label: type,
          type: type,
          inputs: {},
          outputs: {},
          agentId: null,
          llmConfigId: null,
          capabilities: [],
          ragIndexes: []
        }
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes, reactFlowInstance]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CanvasHeader />
      <Box sx={{ display: 'flex', flex: 1, position: 'relative' }}>
        <NodePalette />
        <Box ref={reactFlowWrapper} sx={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </Box>
      </Box>
    </Box>
  )
}

interface FlowCanvasProps {
  height?: string
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({ height = '600px' }) => {
  return (
    <Box sx={{ height }}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </Box>
  )
}

export default FlowCanvas