import React, { createContext, useState, useContext } from 'react'
import { v4 as uuidv4 } from 'uuid'

const FlowContext = createContext()

export const useFlow = () => {
  const context = useContext(FlowContext)
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider')
  }
  return context
}

export const FlowProvider = ({ children }) => {
  const [reactFlowInstance, setReactFlowInstance] = useState(null)

  const deleteNode = (nodeId) => {
    if (reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()
      reactFlowInstance.setNodes(nodes.filter((node) => node.id !== nodeId))
      reactFlowInstance.setEdges(edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    }
  }

  const deleteEdge = (edgeId) => {
    if (reactFlowInstance) {
      const edges = reactFlowInstance.getEdges()
      reactFlowInstance.setEdges(edges.filter((edge) => edge.id !== edgeId))
    }
  }

  const duplicateNode = (nodeId) => {
    if (reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes()
      const node = nodes.find((n) => n.id === nodeId)
      if (node) {
        const newNode = {
          ...node,
          id: uuidv4(),
          position: {
            x: node.position.x + 100,
            y: node.position.y + 50
          },
          data: {
            ...node.data,
            label: `${node.data.label} (Copy)`
          },
          selected: false
        }
        reactFlowInstance.setNodes([...nodes, newNode])
      }
    }
  }

  const updateNodeData = (nodeId, data) => {
    if (reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes()
      reactFlowInstance.setNodes(
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...data
              }
            }
          }
          return node
        })
      )
    }
  }

  const value = {
    reactFlowInstance,
    setReactFlowInstance,
    deleteNode,
    deleteEdge,
    duplicateNode,
    updateNodeData
  }

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}