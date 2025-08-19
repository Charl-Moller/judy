import React from 'react'
import {
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Divider,
  Alert,
  AlertTitle
} from '@mui/material'
import {
  SmartToy as AgentIcon,
  Psychology as LlmIcon,
  Build as ToolIcon,
  Storage as MemoryIcon,
  PlayArrow as TriggerIcon,
  Output as OutputIcon,
  AccountTree as OrchestratorIcon,
  Masks as PersonaIcon
} from '@mui/icons-material'

interface NodeType {
  type: string
  label: string
  icon: React.ComponentType<any>
  color: string
  description: string
  category: string
}

const nodeTypes: NodeType[] = [
  // Core AI Components
  { 
    type: 'agent', 
    label: 'Agent', 
    icon: AgentIcon, 
    color: '#4caf50',
    description: 'Single-purpose AI agent with basic behavior',
    category: 'Core Components'
  },
  { 
    type: 'persona_router', 
    label: 'Persona Router', 
    icon: PersonaIcon, 
    color: '#e91e63',
    description: 'Multi-persona agent with intent-based routing',
    category: 'Core Components'
  },
  { 
    type: 'llm', 
    label: 'LLM Model', 
    icon: LlmIcon, 
    color: '#2196f3',
    description: 'Language model for text generation',
    category: 'Core Components'
  },

  // Memory & Tools
  { 
    type: 'memory', 
    label: 'Memory', 
    icon: MemoryIcon, 
    color: '#9c27b0',
    description: 'Conversation, knowledge, or smart memory',
    category: 'Memory & Tools'
  },
  { 
    type: 'tool', 
    label: 'Tool', 
    icon: ToolIcon, 
    color: '#ff9800',
    description: 'External tool or function integration',
    category: 'Memory & Tools'
  },

  // Advanced Components
  { 
    type: 'orchestrator', 
    label: 'Orchestrator', 
    icon: OrchestratorIcon, 
    color: '#673ab7',
    description: 'Coordinates multiple agents and workflows',
    category: 'Advanced'
  },
  { 
    type: 'trigger', 
    label: 'Trigger', 
    icon: TriggerIcon, 
    color: '#00bcd4',
    description: 'Webhook, API, or event trigger',
    category: 'Advanced'
  },
  { 
    type: 'output', 
    label: 'Output', 
    icon: OutputIcon, 
    color: '#f44336',
    description: 'Format and deliver results',
    category: 'Advanced'
  }
]

// Group node types by category
const nodeCategories = nodeTypes.reduce((acc, nodeType) => {
  if (!acc[nodeType.category]) {
    acc[nodeType.category] = []
  }
  acc[nodeType.category].push(nodeType)
  return acc
}, {} as Record<string, NodeType[]>)

const AgentPalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <Paper
      elevation={3}
      onWheel={(e) => e.stopPropagation()}
      sx={{
        width: 300,
        height: '100%',
        overflow: 'hidden',
        borderRadius: 0,
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Typography variant="h6" gutterBottom>
          🤖 Agent Components
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Drag components to build your AI agent workflow
        </Typography>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'auto' }} onWheel={(e) => e.stopPropagation()}>
      {Object.entries(nodeCategories).map(([category, nodes]) => (
        <Box key={category}>
          <Divider />
          <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
              {category}
            </Typography>
          </Box>
          <List sx={{ py: 0 }}>
            {nodes.map((node) => {
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
                      border: '1px dashed #ccc',
                      backgroundColor: 'action.selected'
                    },
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    py: 1.5,
                    px: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.5 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      backgroundColor: `${node.color}15`,
                      mr: 2
                    }}>
                      <Icon
                        sx={{
                          color: node.color,
                          fontSize: 18
                        }}
                      />
                    </Box>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {node.label}
                        </Typography>
                      }
                      sx={{ margin: 0 }}
                    />
                  </Box>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ ml: 5, fontSize: '0.75rem', lineHeight: 1.2 }}
                  >
                    {node.description}
                  </Typography>
                </ListItem>
              )
            })}
          </List>
        </Box>
      ))}
      </Box>
      
      <Divider />
      
      {/* Enhanced Quick Start Guide */}
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Alert severity="info" sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>🚀 Quick Start</AlertTitle>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
            <strong>Drag components</strong> from here to canvas<br/>
            <strong>Click connection points</strong> to auto-create linked components
          </Typography>
        </Alert>
        
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.3 }}>
          💡 <strong>Smart Connections:</strong><br/>
          • Click the <span style={{color: '#2196f3', fontWeight: 'bold'}}>LLM</span> point on Agent → Creates linked LLM<br/>
          • Click the <span style={{color: '#ff9800', fontWeight: 'bold'}}>Tool</span> point on Agent → Creates linked Tool<br/>
          • Click any connection point → Auto-connects appropriate components<br/>
          <br/>
          ⚡ <strong>Best Practices:</strong><br/>
          • Start with Trigger → Agent → LLM → Output<br/>
          • Add Memory for context storage<br/>
          • Use Tools for external integrations
        </Typography>
      </Box>
    </Paper>
  )
}

export default AgentPalette