import React, { useCallback, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Box } from '@mui/material'
import CustomNode from './CustomNode'
import CustomEdge from './CustomEdge'
import NodePalette from './NodePalette'
import CanvasHeader from './CanvasHeader'
import { useFlow } from '../context/FlowContext'

const nodeTypes = {
  custom: CustomNode
}

const edgeTypes = {
  custom: CustomEdge
}

const Flow = () => {
  const reactFlowWrapper = useRef(null)
  const { setReactFlowInstance, reactFlowInstance } = useFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        type: 'custom',
        id: `${params.source}-${params.target}`
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  const onInit = (instance) => {
    setReactFlowInstance(instance)
  }

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()

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

      const newNode = {
        id: `node-${Date.now()}`,
        type: 'custom',
        position,
        data: { 
          label: type,
          type: type,
          inputs: {},
          outputs: {}
        }
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes, reactFlowInstance]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
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

const FlowCanvas = () => {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}

export default FlowCanvas