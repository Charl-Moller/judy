import React, { createContext, useContext, useState, ReactNode } from 'react'

interface ExecutionMessage {
  id: string
  timestamp: Date
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string
  nodeId?: string
  nodeName?: string
  agentName?: string
}

interface ExecutionLog {
  id: string
  timestamp: Date
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  nodeId?: string
  data?: any
}

interface ExecutionContextType {
  isExecuting: boolean
  conversationHistory: ExecutionMessage[]
  executionLogs: ExecutionLog[]
  currentInput: string
  isTestPanelOpen: boolean
  startExecution: () => void
  stopExecution: () => void
  addMessage: (message: Omit<ExecutionMessage, 'id' | 'timestamp'>) => void
  addLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void
  setCurrentInput: (input: string) => void
  openTestPanel: () => void
  closeTestPanel: () => void
  clearHistory: () => void
  clearLogs: () => void
}

const ExecutionContext = createContext<ExecutionContextType | null>(null)

export const useExecution = (): ExecutionContextType => {
  const context = useContext(ExecutionContext)
  if (!context) {
    throw new Error('useExecution must be used within an ExecutionProvider')
  }
  return context
}

interface ExecutionProviderProps {
  children: ReactNode
}

export const ExecutionProvider: React.FC<ExecutionProviderProps> = ({ children }) => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ExecutionMessage[]>([])
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false)

  const startExecution = () => {
    setIsExecuting(true)
  }

  const stopExecution = () => {
    setIsExecuting(false)
  }

  const addMessage = (message: Omit<ExecutionMessage, 'id' | 'timestamp'>) => {
    const newMessage: ExecutionMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    setConversationHistory(prev => [...prev, newMessage])
  }

  const addLog = (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
    const newLog: ExecutionLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    setExecutionLogs(prev => [...prev, newLog])
  }

  const openTestPanel = () => {
    setIsTestPanelOpen(true)
  }

  const closeTestPanel = () => {
    setIsTestPanelOpen(false)
  }

  const clearHistory = () => {
    setConversationHistory([])
  }

  const clearLogs = () => {
    setExecutionLogs([])
  }

  const value: ExecutionContextType = {
    isExecuting,
    conversationHistory,
    executionLogs,
    currentInput,
    isTestPanelOpen,
    startExecution,
    stopExecution,
    addMessage,
    addLog,
    setCurrentInput,
    openTestPanel,
    closeTestPanel,
    clearHistory,
    clearLogs
  }

  return (
    <ExecutionContext.Provider value={value}>
      {children}
    </ExecutionContext.Provider>
  )
}