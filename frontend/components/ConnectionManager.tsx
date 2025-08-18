import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiLink, FiTrash2, FiCopy } from 'react-icons/fi'

interface ConnectionPoint {
  id: string
  nodeId: string
  type: 'input' | 'output'
  position: { x: number; y: number }
  dataType: string
  label: string
  onClick?: () => void
}

interface Connection {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  type: 'data' | 'control' | 'memory'
  dataType: string
}

interface ConnectionManagerProps {
  nodes: any[]
  connections: Connection[]
  onConnectionsChange: (connections: Connection[]) => void
  onConnectionCreate: (connection: Connection) => void
  onConnectionDelete: (connectionId: string) => void
  onNodeCreate: (node: any) => void
  pan: { x: number; y: number }
  zoom: number
}

export default function ConnectionManager({
  nodes,
  connections,
  onConnectionsChange,
  onConnectionCreate,
  onConnectionDelete,
  onNodeCreate,
  pan,
  zoom
}: ConnectionManagerProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<ConnectionPoint | null>(null)
  const [previewConnection, setPreviewConnection] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  // Get all connection points from nodes
  const getConnectionPoints = (): ConnectionPoint[] => {
    const points: ConnectionPoint[] = []
    
    console.log('🔗 Calculating connection points with zoom/pan:', { zoom, pan })
    
    nodes.forEach(node => {
      // Calculate the actual node boundaries (nodes are positioned at top-left corner)
      const nodeLeft = node.position.x * zoom + pan.x
      const nodeTop = node.position.y * zoom + pan.y
      const nodeRight = nodeLeft + 192 * zoom // w-48 = 192px
      const nodeBottom = nodeTop + (node.type === 'agent' || node.type === 'orchestrator' ? 128 : 
                                     node.type === 'llm' || node.type === 'tool' || node.type === 'memory' ? 80 : 120) * zoom // Match WorkflowEditor heights
      
      console.log(`📍 Node "${node.label || 'Unnamed'}" (${node.type}) boundaries:`, {
        nodeId: node.id,
        nodeType: node.type,
        nodePosition: node.position,
        nodeLeft,
        nodeTop,
        nodeRight,
        nodeBottom,
        nodeWidth: 192 * zoom,
        nodeHeight: (node.type === 'agent' || node.type === 'orchestrator' ? 160 : 120) * zoom
      })
      
      // Standard input/output points for most components
      if (node.type !== 'agent' && node.type !== 'orchestrator' && node.type !== 'llm' && node.type !== 'tool' && node.type !== 'memory') {
        // Input connection point (left edge)
        points.push({
          id: `${node.id}-input`,
          nodeId: node.id,
          type: 'input',
          position: {
            x: nodeLeft, // Exactly at the left edge
            y: nodeTop + (60 * zoom) // Center of the node height
          },
          dataType: 'any',
          label: 'Input'
        })
        
        // Output connection point (right edge)
        points.push({
          id: `${node.id}-output`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeRight, // Exactly at the right edge
            y: nodeTop + (60 * zoom) // Center of the node height
          },
          dataType: 'any',
          label: 'Output'
        })
      }
      
      // Special handling for AI Agent components
      if (node.type === 'agent') {
        // Main input (left edge)
        points.push({
          id: `${node.id}-input`,
          nodeId: node.id,
          type: 'input',
          position: {
            x: nodeLeft, // Exactly at the left edge
            y: nodeTop + (60 * zoom) // Center of the node height
          },
          dataType: 'any',
          label: 'Input'
        })
        
        // Main output (right edge)
        points.push({
          id: `${node.id}-output`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeRight, // Exactly at the right edge
            y: nodeTop + (60 * zoom) // Center of the node height
          },
          dataType: 'any',
          label: 'Output'
        })
        
        // AI-specific endpoints (bottom edge)
        const bottomY = nodeBottom + 20 // Further below the bottom edge for full visibility
        
        // LLM endpoint
        points.push({
          id: `${node.id}-llm`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeLeft + (40 * zoom), // Left side of the node
            y: bottomY // Well below the bottom edge
          },
          dataType: 'llm',
          label: 'LLM',
          onClick: () => createLLMComponent(node.id, nodeLeft + (40 * zoom), bottomY + 30)
        })
        
        // Memory endpoint
        points.push({
          id: `${node.id}-memory`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeLeft + (96 * zoom), // Center of the node
            y: bottomY // Well below the bottom edge
          },
          dataType: 'memory',
          label: 'Memory',
          onClick: () => createMemoryComponent(node.id, nodeLeft + (96 * zoom), bottomY + 30)
        })
        
        // Tools endpoint
        points.push({
          id: `${node.id}-tools`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeLeft + (152 * zoom), // Right side of the node
            y: bottomY // Well below the bottom edge
          },
          dataType: 'tools',
          label: 'Tools',
          onClick: () => createToolComponent(node.id, nodeLeft + (152 * zoom), bottomY + 30)
        })
      }
      
      // Special handling for Orchestrator components
      if (node.type === 'orchestrator') {
        // Main input (top edge)
        points.push({
          id: `${node.id}-input`,
          nodeId: node.id,
          type: 'input',
          position: {
            x: nodeLeft + (96 * zoom), // Center of the node
            y: nodeTop // Exactly at the top edge
          },
          dataType: 'any',
          label: 'Input'
        })
        
        // Multiple agent outputs (bottom edge)
        const bottomY = nodeBottom + 20 // Further below the bottom edge for full visibility
        const agentSpacing = 50 * zoom
        
        // Agent 1 output
        points.push({
          id: `${node.id}-agent1`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeLeft + (50 * zoom),
            y: bottomY // Exactly at the bottom edge
          },
          dataType: 'agent',
          label: 'Agent 1'
        })
        
        // Agent 2 output
        points.push({
          id: `${node.id}-agent2`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeLeft + (96 * zoom), // Center of the node
            y: bottomY // Exactly at the bottom edge
          },
          dataType: 'agent',
          label: 'Agent 2'
        })
        
        // Agent 3 output
        points.push({
          id: `${node.id}-agent3`,
          nodeId: node.id,
          type: 'output',
          position: {
            x: nodeLeft + (142 * zoom),
            y: bottomY // Exactly at the bottom edge
          },
          dataType: 'agent',
          label: 'Agent 3'
        })
      }
      
      console.log(`📍 Node "${node.label || 'Unnamed'}" (${node.type}) connection points:`, {
        nodeId: node.id,
        nodeType: node.type,
        nodePosition: node.position,
        pointsCount: points.length
      })
    })
    
    return points
  }

  const handleConnectionStart = (point: ConnectionPoint) => {
    if (point.type === 'output') {
      setIsConnecting(true)
      setConnectionStart(point)
      setPreviewConnection({
        start: point.position,
        end: point.position
      })
    }
  }

  const handleConnectionEnd = (targetPoint: ConnectionPoint) => {
    if (isConnecting && targetPoint.type === 'input' && connectionStart) {
      // Validate connection
      if (connectionStart.nodeId !== targetPoint.nodeId) {
        const newConnection: Connection = {
          id: `conn_${Date.now()}`,
          source: connectionStart.nodeId,
          target: targetPoint.nodeId,
          sourceHandle: connectionStart.id,
          targetHandle: targetPoint.id,
          type: 'data',
          dataType: 'any'
        }
        
        onConnectionCreate(newConnection)
      }
    }
    
    setIsConnecting(false)
    setConnectionStart(null)
    setPreviewConnection(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    if (isConnecting && connectionStart) {
      setPreviewConnection({
        start: connectionStart.position,
        end: mousePos
      })
    }
  }

  const handleMouseUp = () => {
    if (isConnecting) {
      setIsConnecting(false)
      setConnectionStart(null)
      setPreviewConnection(null)
    }
  }

  const deleteConnection = (connectionId: string) => {
    onConnectionDelete(connectionId)
  }

  const handleConnectionContextMenu = (e: React.MouseEvent, connectionId: string) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      connectionId
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Component creation functions
  const createLLMComponent = (sourceNodeId: string, x: number, y: number) => {
    const newNode = {
      id: `llm_${Date.now()}`,
      type: 'llm' as const,
      position: { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom + 80 }, // Position below source
      data: { name: 'Language Model', description: 'Large language model for text generation' },
      connections: { inputs: [], outputs: [] }
    }
    
    // Add the new node
    onNodeCreate(newNode)
    
    // Create connection from source to new component (no input handle needed)
    const newConnection = {
      id: `conn_${Date.now()}`,
      source: sourceNodeId,
      target: newNode.id,
      sourceHandle: `${sourceNodeId}-llm`,
      targetHandle: newNode.id, // Connect directly to the component, not a specific handle
      type: 'data' as const,
      dataType: 'llm'
    }
    
    onConnectionCreate(newConnection)
  }

  const createMemoryComponent = (sourceNodeId: string, x: number, y: number) => {
    const newNode = {
      id: `memory_${Date.now()}`,
      type: 'memory' as const,
      position: { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom + 80 }, // Position below source
      data: { name: 'Memory System', description: 'Persistent memory storage system' },
      connections: { inputs: [], outputs: [] }
    }
    
    // Add the new node
    onNodeCreate(newNode)
    
    const newConnection = {
      id: `conn_${Date.now()}`,
      source: sourceNodeId,
      target: newNode.id,
      sourceHandle: `${sourceNodeId}-memory`,
      targetHandle: newNode.id, // Connect directly to the component, not a specific handle
      type: 'data' as const,
      dataType: 'memory'
    }
    
    onConnectionCreate(newConnection)
  }

  const createToolComponent = (sourceNodeId: string, x: number, y: number) => {
    const newNode = {
      id: `tool_${Date.now()}`,
      type: 'tool' as const,
      position: { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom + 80 }, // Position below source
      data: { name: 'External Tool', description: 'External tool or API integration' },
      connections: { inputs: [], outputs: [] }
    }
    
    // Add the new node
    onNodeCreate(newNode)
    
    const newConnection = {
      id: `conn_${Date.now()}`,
      source: sourceNodeId,
      target: newNode.id,
      sourceHandle: `${sourceNodeId}-tools`,
      targetHandle: newNode.id, // Connect directly to the component, not a specific handle
      type: 'data' as const,
      dataType: 'tool'
    }
    
    onConnectionCreate(newConnection)
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => closeContextMenu()
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const connectionPoints = getConnectionPoints()

  // Simple connection path with gentle curves
  const createConnectionPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const deltaX = end.x - start.x
    const deltaY = end.y - start.y
    
    // Simple curved path that bends around components
    const midX = start.x + deltaX * 0.5
    const midY = start.y + deltaY * 0.5
    
    // Add some offset to avoid going directly through components
    const offset = 30
    
    if (Math.abs(deltaY) < 50) { // Nearly horizontal
      const routeAbove = start.y > 200
      const offsetY = routeAbove ? -offset : offset
      return `M ${start.x} ${start.y} Q ${start.x} ${start.y + offsetY} ${midX} ${start.y + offsetY} Q ${end.x} ${start.y + offsetY} ${end.x} ${end.y}`
    } else if (Math.abs(deltaX) < 50) { // Nearly vertical
      const routeRight = start.x < 400
      const offsetX = routeRight ? offset : -offset
      return `M ${start.x} ${start.y} Q ${start.x + offsetX} ${start.y} ${start.x + offsetX} ${midY} Q ${start.x + offsetX} ${end.y} ${end.x} ${end.y}`
    } else { // Diagonal
      return `M ${start.x} ${start.y} Q ${midX} ${start.y} ${midX} ${midY} Q ${midX} ${end.y} ${end.x} ${end.y}`
    }
  }

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Connection Points */}
      {connectionPoints.map(point => (
        <motion.div
          key={point.id}
          className={`absolute w-6 h-6 rounded-full border-2 border-white cursor-pointer pointer-events-auto shadow-md transition-all duration-200 z-30 bg-white hover:scale-110 ${
            hoveredPoint === point.id ? 'ring-4 ring-yellow-300' : ''
          }`}
          style={{
            left: point.position.x - 12,
            top: point.position.y - 12,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
          onMouseDown={() => handleConnectionStart(point)}
          onMouseUp={() => handleConnectionEnd(point)}
          onMouseEnter={() => setHoveredPoint(point.id)}
          onMouseLeave={() => setHoveredPoint(null)}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (point.onClick) {
              point.onClick()
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={`${point.type === 'input' ? 'Input' : 'Output'} - ${point.label}${point.onClick ? ' (Click to create component)' : ''}`}
        >
          {/* Input/Output Text Buttons instead of complex icons */}
          <div className="w-full h-full flex items-center justify-center">
            <span className={`text-xs font-medium ${
              point.type === 'input' ? 'text-blue-600' : 'text-green-600'
            }`}>
              {point.label}
            </span>
          </div>
        </motion.div>
      ))}

      {/* Preview Connection */}
      {previewConnection && (
        <svg className="absolute inset-0 pointer-events-none z-25" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <path
            d={createConnectionPath(previewConnection.start, previewConnection.end)}
            stroke="#3B82F6"
            strokeWidth="4"
            fill="none"
            strokeDasharray="8,8"
            markerEnd="url(#preview-arrowhead)"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
            vectorEffect="non-scaling-stroke"
          />
          <defs>
            <marker
              id="preview-arrowhead"
              markerWidth="12"
              markerHeight="8"
              refX="10"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 12 4, 0 8" fill="#3B82F6" />
            </marker>
          </defs>
        </svg>
      )}

      {/* Existing Connections */}
      {connections.map(connection => {
        const sourcePoint = connectionPoints.find(p => p.id === connection.sourceHandle)
        let targetPoint = connectionPoints.find(p => p.id === connection.targetHandle)
        
        // If no target handle found, the connection targets the component directly
        if (!targetPoint && connection.targetHandle) {
          const targetNode = nodes.find(n => n.id === connection.targetHandle)
          if (targetNode) {
            // Create a virtual connection point at the center of the target component
            const nodeLeft = targetNode.position.x * zoom + pan.x
            const nodeTop = targetNode.position.y * zoom + pan.y
            const nodeWidth = 192 * zoom
            const nodeHeight = (targetNode.type === 'agent' || targetNode.type === 'orchestrator' ? 128 : 
                               targetNode.type === 'llm' || targetNode.type === 'tool' || targetNode.type === 'memory' ? 80 : 120) * zoom
            
            targetPoint = {
              id: connection.targetHandle,
              nodeId: connection.targetHandle,
              type: 'input',
              position: { 
                x: nodeLeft + (nodeWidth / 2), 
                y: nodeTop + (nodeHeight / 2) 
              },
              dataType: 'any',
              label: 'Center'
            }
          }
        }
        
        if (!sourcePoint || !targetPoint) {
          return null
        }

        // Calculate the bounding box for the SVG
        const minX = Math.min(sourcePoint.position.x, targetPoint.position.x) - 10
        const minY = Math.min(sourcePoint.position.y, targetPoint.position.y) - 10
        const width = Math.abs(targetPoint.position.x - sourcePoint.position.x) + 20
        const height = Math.abs(targetPoint.position.y - sourcePoint.position.y) + 20
        
        // Create path using improved routing
        const startX = sourcePoint.position.x - minX
        const startY = sourcePoint.position.y - minY
        const endX = targetPoint.position.x - minX
        const endY = targetPoint.position.y - minY
        
        const path = createConnectionPath({ x: startX, y: startY }, { x: endX, y: endY })

        return (
          <svg 
            key={connection.id} 
            className="absolute pointer-events-none z-20" 
            style={{ 
              left: minX, 
              top: minY, 
              width: width, 
              height: height,
              overflow: 'visible'
            }}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <path
              d={path}
              stroke="#6B7280"
              strokeWidth="3"
              fill="none"
              markerEnd="url(#connection-arrowhead)"
              className="cursor-pointer hover:stroke-blue-500 transition-colors duration-200"
              onClick={() => deleteConnection(connection.id)}
              filter="drop-shadow(0 1px 2px rgba(0,0,0,0.2))"
              vectorEffect="non-scaling-stroke"
            />
            
            {/* Delete button that appears on hover */}
            <g className="pointer-events-auto">
              <circle
                cx={width / 2}
                cy={height / 2}
                r="12"
                fill="rgba(239, 68, 68, 0.9)"
                stroke="white"
                strokeWidth="2"
                className="opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                onClick={() => deleteConnection(connection.id)}
              />
              <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="12"
                fontWeight="bold"
                className="opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer pointer-events-none"
              >
                ×
              </text>
            </g>
            
            <defs>
              <marker
                id={`connection-arrowhead-${connection.id}`}
                markerWidth="12"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 12 4, 0 8" fill="#6B7280" />
              </marker>
            </defs>
          </svg>
        )
      })}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 pointer-events-auto"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
            onClick={() => {
              deleteConnection(contextMenu.connectionId)
              closeContextMenu()
            }}
          >
            <FiTrash2 className="w-4 h-4" />
            <span>Delete Connection</span>
          </button>
        </div>
      )}
    </div>
  )
}