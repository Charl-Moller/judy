import React from 'react'
import { getBezierPath, EdgeLabelRenderer, BaseEdge, EdgeProps } from 'reactflow'
import { IconButton, Tooltip, Chip } from '@mui/material'
import { 
  Close as CloseIcon,
  DataObject as DataIcon,
  Memory as MemoryIcon,
  ControlCamera as ControlIcon
} from '@mui/icons-material'
import { useFlow } from '../../context/FlowContext'

interface AgentEdgeData {
  label?: string
  dataType?: string
}

type AgentEdgeProps = EdgeProps<AgentEdgeData>

const AgentEdge: React.FC<AgentEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
  type = 'data'
}) => {
  const { deleteEdge } = useFlow()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })

  const onEdgeClick = (evt: React.MouseEvent, edgeId: string) => {
    evt.stopPropagation()
    if (window.confirm('Delete this connection?')) {
      deleteEdge(edgeId)
    }
  }

  const getEdgeColor = () => {
    switch (type) {
      case 'data':
        return '#2196f3'
      case 'control':
        return '#ff9800'
      case 'memory':
        return '#9c27b0'
      default:
        return '#b1b1b7'
    }
  }

  const getEdgeIcon = () => {
    switch (type) {
      case 'data':
        return <DataIcon sx={{ fontSize: 12 }} />
      case 'control':
        return <ControlIcon sx={{ fontSize: 12 }} />
      case 'memory':
        return <MemoryIcon sx={{ fontSize: 12 }} />
      default:
        return <DataIcon sx={{ fontSize: 12 }} />
    }
  }

  const getConnectionLabel = () => {
    if (data?.label) return data.label
    
    switch (type) {
      case 'data':
        return data?.dataType || 'data'
      case 'control':
        return 'control'
      case 'memory':
        return 'memory'
      default:
        return 'connection'
    }
  }

  const edgeColor = getEdgeColor()
  const edgeStyle = {
    ...style,
    stroke: selected ? edgeColor : `${edgeColor}80`,
    strokeWidth: selected ? 3 : 2,
    strokeDasharray: type === 'control' ? '5,5' : type === 'memory' ? '3,3' : 'none'
  }

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={edgeStyle} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
            opacity: selected ? 1 : 0.8
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4,
            backgroundColor: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${edgeColor}40`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            minWidth: 'fit-content'
          }}>
            <Chip
              icon={getEdgeIcon()}
              label={getConnectionLabel()}
              size="small"
              sx={{
                height: '20px',
                fontSize: '0.7rem',
                backgroundColor: `${edgeColor}15`,
                color: edgeColor,
                border: `1px solid ${edgeColor}40`,
                '& .MuiChip-icon': {
                  fontSize: 12,
                  color: edgeColor
                }
              }}
            />
            
            <Tooltip title="Delete connection">
              <IconButton
                size="small"
                onClick={(evt) => onEdgeClick(evt, id)}
                sx={{
                  padding: '2px',
                  '&:hover': {
                    backgroundColor: '#ff525250',
                    color: '#f44336'
                  }
                }}
              >
                <CloseIcon sx={{ fontSize: 10 }} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default AgentEdge