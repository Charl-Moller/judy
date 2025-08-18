import React from 'react'
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi'

interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  message: string
  nodeId?: string
  connectionId?: string
}

interface WorkflowValidatorProps {
  nodes: any[]
  connections: any[]
}

export default function WorkflowValidator({ nodes, connections }: WorkflowValidatorProps) {
  const validateWorkflow = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = []

    // Check for orphaned nodes (no connections)
    nodes.forEach(node => {
      const hasInputs = connections.some(conn => conn.target === node.id)
      const hasOutputs = connections.some(conn => conn.source === node.id)
      
      if (!hasInputs && !hasOutputs) {
        issues.push({
          type: 'warning',
          message: `Node "${node.data.name || node.type}" has no connections`,
          nodeId: node.id
        })
      }
    })

    // Check for cycles in the workflow
    const hasCycle = checkForCycles(nodes, connections)
    if (hasCycle) {
      issues.push({
        type: 'error',
        message: 'Workflow contains cycles which can cause infinite loops'
      })
    }

    // Check for disconnected components
    const connectedNodes = new Set()
    connections.forEach(conn => {
      connectedNodes.add(conn.source)
      connectedNodes.add(conn.target)
    })

    if (connectedNodes.size > 0 && connectedNodes.size < nodes.length) {
      issues.push({
        type: 'warning',
        message: 'Some nodes are not connected to the main workflow'
      })
    }

    // Check for missing required configurations
    nodes.forEach(node => {
      if (node.type === 'agent' && (!node.data.name || !node.data.systemPrompt)) {
        issues.push({
          type: 'error',
          message: `Agent "${node.data.name || 'Unnamed'}" is missing required configuration`,
          nodeId: node.id
        })
      }
      
      if (node.type === 'llm' && (!node.data.provider || !node.data.model)) {
        issues.push({
          type: 'error',
          message: `LLM "${node.data.name || 'Unnamed'}" is missing required configuration`,
          nodeId: node.id
        })
      }
    })

    // Check for multiple start points
    const startNodes = nodes.filter(node => 
      connections.every(conn => conn.target !== node.id)
    )
    
    if (startNodes.length === 0) {
      issues.push({
        type: 'error',
        message: 'No start points found in workflow'
      })
    } else if (startNodes.length > 1) {
      issues.push({
        type: 'warning',
        message: `Multiple start points found (${startNodes.length}). Consider using a trigger node.`
      })
    }

    // Check for multiple end points
    const endNodes = nodes.filter(node => 
      connections.every(conn => conn.source !== node.id)
    )
    
    if (endNodes.length === 0) {
      issues.push({
        type: 'warning',
        message: 'No end points found in workflow'
      })
    }

    return issues
  }

  const checkForCycles = (nodes: any[], connections: any[]): boolean => {
    const visited = new Set()
    const recStack = new Set()

    const hasCycleDFS = (nodeId: string): boolean => {
      if (recStack.has(nodeId)) return true
      if (visited.has(nodeId)) return false

      visited.add(nodeId)
      recStack.add(nodeId)

      const outgoingConnections = connections.filter(conn => conn.source === nodeId)
      for (const conn of outgoingConnections) {
        if (hasCycleDFS(conn.target)) return true
      }

      recStack.delete(nodeId)
      return false
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) return true
      }
    }

    return false
  }

  const issues = validateWorkflow()
  const errorCount = issues.filter(issue => issue.type === 'error').length
  const warningCount = issues.filter(issue => issue.type === 'warning').length
  const infoCount = issues.filter(issue => issue.type === 'info').length

  if (issues.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <FiCheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">Workflow is valid!</span>
        </div>
        <p className="text-green-700 text-sm mt-1">
          No issues found. Your workflow is ready for execution.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FiAlertTriangle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800 font-medium">Workflow Validation</span>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          {errorCount > 0 && (
            <span className="text-red-600 font-medium">{errorCount} errors</span>
          )}
          {warningCount > 0 && (
            <span className="text-yellow-600 font-medium">{warningCount} warnings</span>
          )}
          {infoCount > 0 && (
            <span className="text-blue-600 font-medium">{infoCount} info</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {issues.map((issue, index) => (
          <div
            key={index}
            className={`flex items-start space-x-2 p-2 rounded ${
              issue.type === 'error' ? 'bg-red-100' :
              issue.type === 'warning' ? 'bg-yellow-100' :
              'bg-blue-100'
            }`}
          >
            {issue.type === 'error' && <FiAlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />}
            {issue.type === 'warning' && <FiAlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />}
            {issue.type === 'info' && <FiInfo className="w-4 h-4 text-blue-600 mt-0.5" />}
            
            <div className="flex-1">
              <p className={`text-sm ${
                issue.type === 'error' ? 'text-red-800' :
                issue.type === 'warning' ? 'text-yellow-800' :
                'text-blue-800'
              }`}>
                {issue.message}
              </p>
              {issue.nodeId && (
                <p className="text-xs text-gray-600 mt-1">
                  Node ID: {issue.nodeId}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-yellow-200">
        <p className="text-yellow-700 text-sm">
          {errorCount > 0 
            ? 'Please fix all errors before executing the workflow.'
            : 'Workflow can be executed but consider addressing warnings for optimal performance.'
          }
        </p>
      </div>
    </div>
  )
}
