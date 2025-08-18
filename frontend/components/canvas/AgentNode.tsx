import React, { memo, useState, useCallback } from 'react'
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow'
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Chip,
  Divider,
  Tooltip
} from '@mui/material'
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  SmartToy as AgentIcon,
  Psychology as LlmIcon,
  Build as ToolIcon,
  Storage as MemoryIcon,
  PlayArrow as TriggerIcon,
  Output as OutputIcon,
  AccountTree as OrchestratorIcon
} from '@mui/icons-material'
import { useFlow } from '../../context/FlowContext'
import { useNodeConfig } from '../../context/NodeConfigContext'

interface AgentNodeData {
  label: string
  nodeType: string
  name?: string
  description?: string
  systemPrompt?: string
  provider?: string
  model?: string
  temperature?: number
  type?: string
  [key: string]: any
}

type AgentNodeProps = NodeProps<AgentNodeData>

const AgentNode: React.FC<AgentNodeProps> = ({ data, selected, id }) => {
  const { deleteNode, duplicateNode } = useFlow()
  const { openConfig } = useNodeConfig()
  const reactFlowInstance = useReactFlow()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = () => {
    deleteNode(id)
    handleMenuClose()
  }

  const handleDuplicate = () => {
    duplicateNode(id)
    handleMenuClose()
  }

  const getNodeIcon = () => {
    switch (data.nodeType) {
      case 'agent':
        return <AgentIcon sx={{ fontSize: 20 }} />
      case 'llm':
        return <LlmIcon sx={{ fontSize: 20 }} />
      case 'tool':
        return <ToolIcon sx={{ fontSize: 20 }} />
      case 'memory':
        return <MemoryIcon sx={{ fontSize: 20 }} />
      case 'trigger':
        return <TriggerIcon sx={{ fontSize: 20 }} />
      case 'output':
        return <OutputIcon sx={{ fontSize: 20 }} />
      case 'orchestrator':
        return <OrchestratorIcon sx={{ fontSize: 20 }} />
      default:
        return <AgentIcon sx={{ fontSize: 20 }} />
    }
  }

  const getNodeColor = () => {
    switch (data.nodeType) {
      case 'agent':
        return '#4caf50'
      case 'llm':
        return '#2196f3'
      case 'tool':
        return '#ff9800'
      case 'memory':
        return '#9c27b0'
      case 'trigger':
        return '#00bcd4'
      case 'output':
        return '#f44336'
      case 'orchestrator':
        return '#673ab7'
      default:
        return '#757575'
    }
  }

  const handleCreateLinkedNode = useCallback((handleId: string, targetType: string) => {
    const currentNode = reactFlowInstance.getNode(id)
    if (!currentNode) return

    // Prevent creating node on regular connection drag
    if (event && (event as any).detail > 1) return // Ignore double clicks
    
    // Calculate position for new node with better spacing
    const isOutput = handleId.includes('output')
    
    // For bottom handles, position nodes below
    let newPosition
    if (handleId.includes('output-llm') || handleId.includes('output-tool') || handleId.includes('output-memory')) {
      const horizontalOffset = handleId.includes('llm') ? -150 : handleId.includes('tool') ? 0 : handleId.includes('memory') ? 150 : 0
      newPosition = {
        x: currentNode.position.x + horizontalOffset,
        y: currentNode.position.y + 200
      }
    } else {
      // Standard left/right positioning
      const offset = isOutput ? 300 : -300
      const verticalOffset = handleId.includes('tool') ? 80 : handleId.includes('llm') ? -80 : 0
      newPosition = {
        x: currentNode.position.x + offset,
        y: currentNode.position.y + verticalOffset
      }
    }

    // Create node data based on type
    const getNodeData = (nodeType: string) => {
      const baseData = {
        label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
        nodeType: nodeType
      }

      switch (nodeType) {
        case 'llm':
          return {
            ...baseData,
            name: 'Language Model',
            provider: 'OpenAI',
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 1000,
            apiKey: ''
          }
        case 'tool':
          return {
            ...baseData,
            name: 'New Tool',
            type: 'function',
            description: 'Tool for specific task',
            parameters: {},
            enabled: true
          }
        case 'memory':
          return {
            ...baseData,
            name: 'Memory Store',
            type: 'vector',
            maxSize: 1000,
            similarity: 0.8,
            retention: '7d'
          }
        case 'agent':
          return {
            ...baseData,
            name: 'Sub-Agent',
            description: 'Specialized agent',
            systemPrompt: 'You are a helpful assistant.',
            capabilities: [],
            memory: false,
            contextWindow: 4000
          }
        case 'output':
          return {
            ...baseData,
            name: 'Output Handler',
            format: 'json',
            destination: 'api',
            template: '{{result}}'
          }
        case 'trigger':
          return {
            ...baseData,
            name: 'Trigger',
            type: 'webhook',
            method: 'POST',
            path: '/webhook',
            authentication: false
          }
        case 'orchestrator':
          return {
            ...baseData,
            name: 'Orchestrator',
            routing: 'round_robin',
            timeout: 30000
          }
        default:
          return baseData
      }
    }

    // Create new node
    const newNodeId = `${targetType}_${Date.now()}`
    const newNode = {
      id: newNodeId,
      type: targetType,
      position: newPosition,
      data: getNodeData(targetType)
    }

    // Add node to canvas
    reactFlowInstance.addNodes(newNode)

    // Create connection with proper handle mapping
    const isBottomHandle = handleId.includes('output-llm') || handleId.includes('output-tool') || handleId.includes('output-memory')
    
    // Determine correct target handle based on component type
    let targetHandle = 'input-main'
    if (targetType === 'llm' || targetType === 'tool' || targetType === 'memory') {
      targetHandle = 'connector-top'
    }
    
    const newEdge = {
      id: `${id}-${newNodeId}-${Date.now()}`,
      source: isOutput ? id : newNodeId,
      target: isOutput ? newNodeId : id,
      sourceHandle: isOutput ? handleId : 'output-main',
      targetHandle: isOutput ? targetHandle : handleId,
      type: handleId.includes('memory') ? 'memory' : 'data',
      animated: true,
      style: {
        strokeWidth: 2,
        stroke: handleId.includes('llm') ? '#2196f3' : handleId.includes('tool') ? '#ff9800' : handleId.includes('memory') ? '#9c27b0' : '#666'
      }
    }

    // Add edge to canvas
    setTimeout(() => {
      reactFlowInstance.addEdges(newEdge)
      // Auto-open configuration for new node
      openConfig(newNodeId, getNodeData(targetType))
    }, 100)
  }, [id, reactFlowInstance, openConfig])

  const getHandles = () => {
    const nodeType = data.nodeType
    const handles = []

    // Single top connector for LLM, Tool, Memory components
    if (nodeType === 'llm' || nodeType === 'tool' || nodeType === 'memory') {
      handles.push(
        <div key="connector-top-wrapper" style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)' }}>
          <div
            onMouseEnter={() => setHoveredHandle('connector-top')}
            onMouseLeave={() => setHoveredHandle(null)}
            style={{ position: 'relative' }}
          >
            <Handle
              type="target"
              position={Position.Top}
              id="connector-top"
              style={{
                background: hoveredHandle === 'connector-top' ? getNodeColor() : '#555',
                width: 12,
                height: 12,
                border: '2px solid white',
                cursor: 'crosshair',
                transition: 'all 0.2s'
              }}
              onConnect={() => {}} // Allow normal connections
            />
            {hoveredHandle === 'connector-top' && (
              <div style={{
                position: 'absolute',
                top: -25,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '10px',
                whiteSpace: 'nowrap',
                background: `rgba(${nodeType === 'llm' ? '33, 150, 243' : nodeType === 'tool' ? '255, 152, 0' : '156, 39, 176'}, 0.9)`,
                color: 'white',
                padding: '2px 4px',
                borderRadius: '3px',
                pointerEvents: 'none'
              }}>
                Connect
              </div>
            )}
          </div>
        </div>
      )
    }
    // Input handles (left side) for other components
    else if (nodeType !== 'trigger') {
      handles.push(
        <div key="input-main-wrapper" style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)' }}>
          <Tooltip title="Click to add input" placement="left">
            <div
              onMouseEnter={() => setHoveredHandle('input-main')}
              onMouseLeave={() => setHoveredHandle(null)}
              style={{ position: 'relative' }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id="input-main"
                style={{
                  background: hoveredHandle === 'input-main' ? '#2196f3' : '#555',
                  width: 12,
                  height: 12,
                  border: '2px solid white',
                  cursor: 'crosshair'
                }}
                onConnect={() => {}} // Allow normal connections
              />
              {/* Invisible click area for creating nodes */}
              <div
                style={{
                  position: 'absolute',
                  width: 20,
                  height: 20,
                  left: -4,
                  top: -4,
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleCreateLinkedNode('input-main', 'trigger')
                }}
              />
              {hoveredHandle === 'input-main' && (
                <div style={{
                  position: 'absolute',
                  left: -40,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  pointerEvents: 'none'
                }}>
                  Input
                </div>
              )}
            </div>
          </Tooltip>
        </div>
      )
    }

    // Output handles (right side) - exclude single-connector components
    if (nodeType !== 'output' && nodeType !== 'llm' && nodeType !== 'tool' && nodeType !== 'memory') {
      handles.push(
        <div key="output-main-wrapper" style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)' }}>
          <Tooltip title="Click to add output" placement="right">
            <div
              onMouseEnter={() => setHoveredHandle('output-main')}
              onMouseLeave={() => setHoveredHandle(null)}
              style={{ position: 'relative' }}
            >
              <Handle
                type="source"
                position={Position.Right}
                id="output-main"
                style={{
                  background: hoveredHandle === 'output-main' ? '#2196f3' : '#555',
                  width: 12,
                  height: 12,
                  border: '2px solid white',
                  cursor: 'crosshair'
                }}
                onConnect={() => {}} // Allow normal connections
              />
              {/* Invisible click area for creating nodes */}
              <div
                style={{
                  position: 'absolute',
                  width: 20,
                  height: 20,
                  left: -4,
                  top: -4,
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleCreateLinkedNode('output-main', 'output')
                }}
              />
              {hoveredHandle === 'output-main' && (
                <div style={{
                  position: 'absolute',
                  right: -45,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  pointerEvents: 'none'
                }}>
                  Output
                </div>
              )}
            </div>
          </Tooltip>
        </div>
      )
    }

    // Special handles for specific node types - moved to bottom
    if (nodeType === 'agent') {
      // Agent can have multiple outputs for different purposes at the bottom
      handles.push(
        <div key="output-llm-wrapper" style={{ position: 'absolute', bottom: -8, left: '25%', transform: 'translateX(-50%)' }}>
          {/* Extended hover zone that covers dot, tooltip, and text label */}
          <div
            onMouseEnter={() => setHoveredHandle('output-llm')}
            onMouseLeave={() => setHoveredHandle(null)}
            style={{ 
              position: 'absolute',
              // Extended zone that includes text label below
              width: '60px',
              height: '48px', // Extended to cover text label
              left: '-30px', // Center over the dot
              top: '-23px',  // Cover tooltip area above
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 15
            }}
          >
            <Handle
              type="source"
              position={Position.Bottom}
              id="output-llm"
              style={{
                background: hoveredHandle === 'output-llm' ? '#64b5f6' : '#2196f3',
                width: 12,
                height: 12,
                border: '2px solid white',
                cursor: 'crosshair',
                transition: 'all 0.2s',
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10
              }}
              onConnect={() => {}} // Allow normal connections
            />
            {/* Clickable tooltip area that stays visible */}
            {hoveredHandle === 'output-llm' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  background: 'rgba(33, 150, 243, 0.9)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  zIndex: 20,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleCreateLinkedNode('output-llm', 'llm')
                  setHoveredHandle(null)
                }}
              >
                + LLM
              </div>
            )}
          </div>
        </div>,
        <div key="output-tool-wrapper" style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)' }}>
          {/* Extended hover zone that covers dot, tooltip, and text label */}
          <div
            onMouseEnter={() => setHoveredHandle('output-tool')}
            onMouseLeave={() => setHoveredHandle(null)}
            style={{ 
              position: 'absolute',
              // Extended zone that includes text label below
              width: '60px',
              height: '48px', // Extended to cover text label
              left: '-30px', // Center over the dot
              top: '-23px',  // Cover tooltip area above
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 15
            }}
          >
            <Handle
              type="source"
              position={Position.Bottom}
              id="output-tool"
              style={{
                background: hoveredHandle === 'output-tool' ? '#ffb74d' : '#ff9800',
                width: 12,
                height: 12,
                border: '2px solid white',
                cursor: 'crosshair',
                transition: 'all 0.2s',
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10
              }}
              onConnect={() => {}} // Allow normal connections
            />
            {/* Clickable tooltip area that stays visible */}
            {hoveredHandle === 'output-tool' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  background: 'rgba(255, 152, 0, 0.9)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  zIndex: 20,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleCreateLinkedNode('output-tool', 'tool')
                  setHoveredHandle(null)
                }}
              >
                + Tool
              </div>
            )}
          </div>
        </div>,
        
        // Add Memory connection point
        <div key="output-memory-wrapper" style={{ position: 'absolute', bottom: -8, left: '75%', transform: 'translateX(-50%)' }}>
          {/* Extended hover zone that covers dot, tooltip, and text label */}
          <div
            onMouseEnter={() => setHoveredHandle('output-memory')}
            onMouseLeave={() => setHoveredHandle(null)}
            style={{ 
              position: 'absolute',
              // Extended zone that includes text label below
              width: '70px',
              height: '48px', // Extended to cover text label
              left: '-35px', // Center over the dot (slightly wider for "Memory")
              top: '-23px',  // Cover tooltip area above
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 15
            }}
          >
            <Handle
              type="source"
              position={Position.Bottom}
              id="output-memory"
              style={{
                background: hoveredHandle === 'output-memory' ? '#ba68c8' : '#9c27b0',
                width: 12,
                height: 12,
                border: '2px solid white',
                cursor: 'crosshair',
                transition: 'all 0.2s',
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10
              }}
              onConnect={() => {}} // Allow normal connections
            />
            {/* Clickable tooltip area that stays visible */}
            {hoveredHandle === 'output-memory' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  background: 'rgba(156, 39, 176, 0.9)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  zIndex: 20,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleCreateLinkedNode('output-memory', 'memory')
                  setHoveredHandle(null)
                }}
              >
                + Memory
              </div>
            )}
          </div>
        </div>
      )
    }

    // Memory component now uses single top connector like LLM and Tool (handled above)

    return handles
  }

  const getNodeDetails = () => {
    const details = []
    
    switch (data.nodeType) {
      case 'agent':
        if (data.systemPrompt) {
          details.push(`Prompt: ${data.systemPrompt.substring(0, 30)}...`)
        }
        if (data.capabilities?.length > 0) {
          details.push(`${data.capabilities.length} capabilities`)
        }
        break
      case 'llm':
        if (data.provider && data.model) {
          details.push(`${data.provider} ${data.model}`)
        }
        if (data.temperature !== undefined) {
          details.push(`Temp: ${data.temperature}`)
        }
        break
      case 'tool':
        if (data.type) {
          details.push(`Type: ${data.type}`)
        }
        break
      case 'memory':
        if (data.type) {
          details.push(`${data.type} memory`)
        }
        if (data.maxSize) {
          details.push(`Size: ${data.maxSize}`)
        }
        break
      case 'trigger':
        if (data.type && data.method) {
          details.push(`${data.method} ${data.type}`)
        }
        if (data.path) {
          details.push(`Path: ${data.path}`)
        }
        break
      case 'output':
        if (data.format) {
          details.push(`Format: ${data.format}`)
        }
        break
    }
    
    return details
  }

  return (
    <Paper
      elevation={selected ? 8 : 3}
      onClick={() => {
        console.log('🔧 Node clicked:', id, data)
        openConfig(id, data)
      }}
      sx={{
        padding: 2,
        borderRadius: 2,
        minWidth: 200,
        maxWidth: 280,
        border: selected ? `2px solid ${getNodeColor()}` : '1px solid #e0e0e0',
        backgroundColor: 'white',
        position: 'relative',
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 4
        },
        // Add margin for handle labels
        margin: '20px 30px'
      }}
    >
      {/* Render handles outside the main content */}
      {getHandles()}
      
      {/* Add interactive permanent handle labels at bottom for agent */}
      {data.nodeType === 'agent' && (
        <>
          <Typography
            onMouseEnter={() => setHoveredHandle('output-llm')}
            onMouseLeave={() => setHoveredHandle(null)}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleCreateLinkedNode('output-llm', 'llm')
              setHoveredHandle(null)
            }}
            sx={{
              position: 'absolute',
              bottom: -25,
              left: '25%',
              transform: 'translateX(-50%)',
              fontSize: '8px',
              color: hoveredHandle === 'output-llm' ? '#64b5f6' : '#2196f3',
              fontWeight: 'bold',
              background: hoveredHandle === 'output-llm' ? '#e3f2fd' : 'white',
              padding: '2px 4px',
              borderRadius: '3px',
              border: hoveredHandle === 'output-llm' ? '1px solid #2196f3' : '1px solid #e0e0e0',
              cursor: 'pointer',
              transition: 'all 0.2s',
              zIndex: 25,
              '&:hover': {
                transform: 'translateX(-50%) scale(1.1)',
                boxShadow: '0 2px 4px rgba(33, 150, 243, 0.3)'
              }
            }}
          >
            LLM
          </Typography>
          <Typography
            onMouseEnter={() => setHoveredHandle('output-tool')}
            onMouseLeave={() => setHoveredHandle(null)}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleCreateLinkedNode('output-tool', 'tool')
              setHoveredHandle(null)
            }}
            sx={{
              position: 'absolute',
              bottom: -25,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '8px',
              color: hoveredHandle === 'output-tool' ? '#ffb74d' : '#ff9800',
              fontWeight: 'bold',
              background: hoveredHandle === 'output-tool' ? '#fff3e0' : 'white',
              padding: '2px 4px',
              borderRadius: '3px',
              border: hoveredHandle === 'output-tool' ? '1px solid #ff9800' : '1px solid #e0e0e0',
              cursor: 'pointer',
              transition: 'all 0.2s',
              zIndex: 25,
              '&:hover': {
                transform: 'translateX(-50%) scale(1.1)',
                boxShadow: '0 2px 4px rgba(255, 152, 0, 0.3)'
              }
            }}
          >
            Tool
          </Typography>
          <Typography
            onMouseEnter={() => setHoveredHandle('output-memory')}
            onMouseLeave={() => setHoveredHandle(null)}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleCreateLinkedNode('output-memory', 'memory')
              setHoveredHandle(null)
            }}
            sx={{
              position: 'absolute',
              bottom: -25,
              left: '75%',
              transform: 'translateX(-50%)',
              fontSize: '8px',
              color: hoveredHandle === 'output-memory' ? '#ba68c8' : '#9c27b0',
              fontWeight: 'bold',
              background: hoveredHandle === 'output-memory' ? '#f3e5f5' : 'white',
              padding: '2px 4px',
              borderRadius: '3px',
              border: hoveredHandle === 'output-memory' ? '1px solid #9c27b0' : '1px solid #e0e0e0',
              cursor: 'pointer',
              transition: 'all 0.2s',
              zIndex: 25,
              '&:hover': {
                transform: 'translateX(-50%) scale(1.1)',
                boxShadow: '0 2px 4px rgba(156, 39, 176, 0.3)'
              }
            }}
          >
            Memory
          </Typography>
        </>
      )}
      
      {/* Memory now uses single connector like LLM/Tool - no separate labels needed */}
      
      {/* Labels for single-connector components (LLM, Tool, Memory) */}
      {(data.nodeType === 'llm' || data.nodeType === 'tool' || data.nodeType === 'memory') && (
        <Typography
          sx={{
            position: 'absolute',
            top: -15,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '8px',
            color: getNodeColor(),
            fontWeight: 'bold',
            background: 'white',
            padding: '0 3px',
            borderRadius: '2px',
            border: `1px solid ${getNodeColor()}20`
          }}
        >
          Connect
        </Typography>
      )}
      
      {/* Labels for other nodes with separate input/output */}
      {data.nodeType !== 'trigger' && data.nodeType !== 'agent' && data.nodeType !== 'memory' && data.nodeType !== 'llm' && data.nodeType !== 'tool' && (
        <Typography
          sx={{
            position: 'absolute',
            left: -25,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '8px',
            color: '#666',
            fontWeight: 'bold',
            background: 'white',
            padding: '0 2px',
            borderRadius: '2px'
          }}
        >
          In
        </Typography>
      )}
      
      {data.nodeType !== 'output' && data.nodeType !== 'agent' && data.nodeType !== 'memory' && data.nodeType !== 'llm' && data.nodeType !== 'tool' && (
        <Typography
          sx={{
            position: 'absolute',
            right: -25,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '8px',
            color: '#666',
            fontWeight: 'bold',
            background: 'white',
            padding: '0 2px',
            borderRadius: '2px'
          }}
        >
          Out
        </Typography>
      )}
      
      {/* Header with icon and node type */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Box sx={{ color: getNodeColor() }}>
            {getNodeIcon()}
          </Box>
          <Chip
            label={data.nodeType || 'node'}
            size="small"
            sx={{
              backgroundColor: getNodeColor(),
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 'bold'
            }}
          />
        </Box>
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{ padding: 0.5 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Node Label/Name */}
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem' }}>
        {data.label || data.name || 'Unnamed Node'}
      </Typography>

      {/* Node Details */}
      <Box sx={{ mb: 1 }}>
        {data.description && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            {data.description}
          </Typography>
        )}
        
        {getNodeDetails().map((detail, index) => (
          <Typography 
            key={index}
            variant="caption" 
            sx={{ 
              color: 'text.secondary', 
              display: 'block', 
              fontSize: '0.75rem',
              backgroundColor: 'grey.50',
              padding: '2px 6px',
              borderRadius: '4px',
              mb: 0.5
            }}
          >
            {detail}
          </Typography>
        ))}
      </Box>

      {/* Configuration Status */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {data.systemPrompt && (
          <Chip
            label="Prompt"
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.6rem', height: '18px' }}
          />
        )}
        {data.capabilities && data.capabilities.length > 0 && (
          <Chip
            label={`${data.capabilities.length} tools`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.6rem', height: '18px' }}
          />
        )}
        {data.memory && (
          <Chip
            label="Memory"
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.6rem', height: '18px' }}
          />
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDuplicate}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Paper>
  )
}

export default memo(AgentNode)