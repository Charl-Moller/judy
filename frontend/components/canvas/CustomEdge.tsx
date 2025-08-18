import React from 'react'
import { getBezierPath, EdgeLabelRenderer, BaseEdge, EdgeProps } from 'reactflow'
import { IconButton, Tooltip } from '@mui/material'
import { 
  Close as CloseIcon,
  Link as LinkIcon 
} from '@mui/icons-material'
import { useFlow } from '../../context/FlowContext'

interface CustomEdgeData {
  label?: string
  type?: string
}

type CustomEdgeProps = EdgeProps<CustomEdgeData>

const CustomEdge: React.FC<CustomEdgeProps> = ({
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
  selected
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

  const edgeStyle = {
    ...style,
    stroke: selected ? '#3b82f6' : '#b1b1b7',
    strokeWidth: selected ? 3 : 2
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
            opacity: selected ? 1 : 0.7
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4,
            backgroundColor: 'white',
            padding: '2px 6px',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {data?.label && (
              <span style={{ 
                fontSize: '10px', 
                color: '#666',
                fontWeight: 500
              }}>
                {data.label}
              </span>
            )}
            
            <LinkIcon sx={{ fontSize: 12, color: '#666' }} />
            
            <Tooltip title="Delete connection">
              <IconButton
                size="small"
                onClick={(evt) => onEdgeClick(evt, id)}
                sx={{
                  padding: '2px',
                  '&:hover': {
                    backgroundColor: '#ff5252',
                    color: 'white'
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

export default CustomEdge