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
  Android as AgentIcon,
  Psychology as LlmIcon,
  Book as RagIcon,
  Settings as CapabilityIcon,
  Login as InputIcon,
  Logout as OutputIcon,
  AccountTree as OrchestratorIcon,
  Storage as DataIcon
} from '@mui/icons-material'

interface NodeType {
  type: string
  label: string
  icon: React.ComponentType<any>
  color: string
  description: string
}

const nodeTypes: NodeType[] = [
  { 
    type: 'agent', 
    label: 'Agent Node', 
    icon: AgentIcon, 
    color: '#4caf50',
    description: 'AI Agent with specific capabilities'
  },
  { 
    type: 'llm', 
    label: 'LLM Node', 
    icon: LlmIcon, 
    color: '#2196f3',
    description: 'Large Language Model processor'
  },
  { 
    type: 'rag', 
    label: 'RAG Node', 
    icon: RagIcon, 
    color: '#ff9800',
    description: 'Retrieval Augmented Generation'
  },
  { 
    type: 'capability', 
    label: 'Capability Node', 
    icon: CapabilityIcon, 
    color: '#9c27b0',
    description: 'Specialized tool or function'
  },
  { 
    type: 'input', 
    label: 'Input Node', 
    icon: InputIcon, 
    color: '#00bcd4',
    description: 'Data input point'
  },
  { 
    type: 'output', 
    label: 'Output Node', 
    icon: OutputIcon, 
    color: '#f44336',
    description: 'Data output point'
  },
  { 
    type: 'orchestrator', 
    label: 'Orchestrator Node', 
    icon: OrchestratorIcon, 
    color: '#673ab7',
    description: 'Workflow orchestration'
  },
  { 
    type: 'data', 
    label: 'Data Node', 
    icon: DataIcon, 
    color: '#795548',
    description: 'Data storage or transformation'
  }
]

const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Prevent wheel events from bubbling to parent
    e.stopPropagation()
  }

  return (
    <Paper
      elevation={3}
      onWheel={handleWheel}
      sx={{
        width: 280,
        height: 'calc(100vh - 64px)', // Subtract header height
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        position: 'relative'
      }}
    >
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Typography variant="h6" gutterBottom>
          🎨 Node Palette
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Drag nodes to the canvas to build your workflow
        </Typography>
      </Box>
      <Divider />
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '3px',
          }
        }}
        onWheel={(e) => e.stopPropagation()}
      >
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
                },
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 1.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.5 }}>
                <Icon
                  sx={{
                    mr: 2,
                    color: node.color
                  }}
                />
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {node.label}
                    </Typography>
                  }
                  sx={{ margin: 0 }}
                />
              </Box>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ ml: 5, fontSize: '0.75rem' }}
              >
                {node.description}
              </Typography>
            </ListItem>
          )
        })}
        </List>
      </Box>
      
      <Divider />
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary">
          💡 Tip: Connect nodes to create workflows. Right-click nodes to configure them.
        </Typography>
      </Box>
    </Paper>
  )
}

export default NodePalette