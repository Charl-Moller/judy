import React from 'react'
import {
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Divider
} from '@mui/material'
import {
  Input as InputIcon,
  Settings as ProcessIcon,
  Output as OutputIcon,
  QuestionMark as DecisionIcon,
  DataObject as DataIcon,
  Functions as FunctionIcon
} from '@mui/icons-material'

const nodeTypes = [
  { type: 'input', label: 'Input Node', icon: InputIcon, color: '#4caf50' },
  { type: 'process', label: 'Process Node', icon: ProcessIcon, color: '#2196f3' },
  { type: 'output', label: 'Output Node', icon: OutputIcon, color: '#ff9800' },
  { type: 'decision', label: 'Decision Node', icon: DecisionIcon, color: '#9c27b0' },
  { type: 'data', label: 'Data Node', icon: DataIcon, color: '#00bcd4' },
  { type: 'function', label: 'Function Node', icon: FunctionIcon, color: '#e91e63' }
]

const NodePalette = () => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <Paper
      elevation={3}
      sx={{
        width: 250,
        height: '100%',
        overflow: 'auto',
        borderRadius: 0
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Node Palette
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Drag nodes to the canvas
        </Typography>
      </Box>
      <Divider />
      <List>
        {nodeTypes.map((node) => {
          const Icon = node.icon
          return (
            <ListItem
              key={node.type}
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
              sx={{
                cursor: 'move',
                '&:hover': {
                  backgroundColor: 'action.hover'
                },
                border: '1px solid transparent',
                '&:active': {
                  border: '1px dashed #ccc'
                }
              }}
            >
              <Icon
                sx={{
                  mr: 2,
                  color: node.color
                }}
              />
              <ListItemText
                primary={node.label}
                secondary={`Type: ${node.type}`}
              />
            </ListItem>
          )
        })}
      </List>
    </Paper>
  )
}

export default NodePalette