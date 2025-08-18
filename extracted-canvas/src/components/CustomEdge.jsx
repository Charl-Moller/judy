import React from 'react'
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow'
import { IconButton } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { useFlow } from '../context/FlowContext'

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd
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

  const onEdgeClick = (evt, id) => {
    evt.stopPropagation()
    deleteEdge(id)
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all'
          }}
        >
          <IconButton
            size="small"
            onClick={(evt) => onEdgeClick(evt, id)}
            sx={{
              backgroundColor: 'white',
              border: '1px solid #ccc',
              padding: '2px',
              '&:hover': {
                backgroundColor: '#ff5252',
                color: 'white'
              }
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default CustomEdge