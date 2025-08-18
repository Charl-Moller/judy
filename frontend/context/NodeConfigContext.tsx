import React, { createContext, useContext, useState, ReactNode } from 'react'

interface NodeConfigContextType {
  configNodeId: string | null
  configNodeData: any
  isConfigOpen: boolean
  openConfig: (nodeId: string, nodeData: any) => void
  closeConfig: () => void
  updateConfigData: (data: any) => void
}

const NodeConfigContext = createContext<NodeConfigContextType | null>(null)

export const useNodeConfig = (): NodeConfigContextType => {
  const context = useContext(NodeConfigContext)
  if (!context) {
    throw new Error('useNodeConfig must be used within a NodeConfigProvider')
  }
  return context
}

interface NodeConfigProviderProps {
  children: ReactNode
}

export const NodeConfigProvider: React.FC<NodeConfigProviderProps> = ({ children }) => {
  const [configNodeId, setConfigNodeId] = useState<string | null>(null)
  const [configNodeData, setConfigNodeData] = useState<any>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  const openConfig = (nodeId: string, nodeData: any) => {
    setConfigNodeId(nodeId)
    setConfigNodeData({ ...nodeData })
    setIsConfigOpen(true)
  }

  const closeConfig = () => {
    setConfigNodeId(null)
    setConfigNodeData(null)
    setIsConfigOpen(false)
  }

  const updateConfigData = (data: any) => {
    setConfigNodeData({ ...configNodeData, ...data })
  }

  const value: NodeConfigContextType = {
    configNodeId,
    configNodeData,
    isConfigOpen,
    openConfig,
    closeConfig,
    updateConfigData
  }

  return (
    <NodeConfigContext.Provider value={value}>
      {children}
    </NodeConfigContext.Provider>
  )
}