import React, { createContext, useState, useContext, ReactNode } from 'react'
import { ReactFlowInstance, Node, Edge } from 'reactflow'
import { v4 as uuidv4 } from 'uuid'

interface FlowContextType {
  reactFlowInstance: ReactFlowInstance | null
  setReactFlowInstance: (instance: ReactFlowInstance | null) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edgeId: string) => void
  duplicateNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: any) => void
  saveFlow: () => void
  loadFlow: (flowData: { nodes: Node[], edges: Edge[] }) => void
  exportFlow: () => string
}

const FlowContext = createContext<FlowContextType | null>(null)

export const useFlow = (): FlowContextType => {
  const context = useContext(FlowContext)
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider')
  }
  return context
}

interface FlowProviderProps {
  children: ReactNode
}

export const FlowProvider: React.FC<FlowProviderProps> = ({ children }) => {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  const deleteNode = (nodeId: string) => {
    if (reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()
      reactFlowInstance.setNodes(nodes.filter((node) => node.id !== nodeId))
      reactFlowInstance.setEdges(edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    }
  }

  const deleteEdge = (edgeId: string) => {
    if (reactFlowInstance) {
      const edges = reactFlowInstance.getEdges()
      reactFlowInstance.setEdges(edges.filter((edge) => edge.id !== edgeId))
    }
  }

  const duplicateNode = (nodeId: string) => {
    if (reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes()
      const node = nodes.find((n) => n.id === nodeId)
      if (node) {
        const newNode: Node = {
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

  const updateNodeData = (nodeId: string, data: any) => {
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

  const saveFlow = () => {
    if (reactFlowInstance) {
      const flowData = {
        nodes: reactFlowInstance.getNodes(),
        edges: reactFlowInstance.getEdges()
      }
      localStorage.setItem('judy-flow', JSON.stringify(flowData))
    }
  }

  const loadFlow = (flowData: { nodes: Node[], edges: Edge[] }) => {
    if (reactFlowInstance) {
      reactFlowInstance.setNodes(flowData.nodes || [])
      reactFlowInstance.setEdges(flowData.edges || [])
    }
  }

  const exportFlow = (): string => {
    if (reactFlowInstance) {
      const flowData = {
        nodes: reactFlowInstance.getNodes(),
        edges: reactFlowInstance.getEdges()
      }
      return JSON.stringify(flowData, null, 2)
    }
    return '{}'
  }

  const value: FlowContextType = {
    reactFlowInstance,
    setReactFlowInstance,
    deleteNode,
    deleteEdge,
    duplicateNode,
    updateNodeData,
    saveFlow,
    loadFlow,
    exportFlow
  }

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}