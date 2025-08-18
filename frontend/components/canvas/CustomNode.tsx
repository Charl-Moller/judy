import React, { memo, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  TextField,
  Chip,
  Divider,
  Select,
  FormControl,
  InputLabel,
  Button,
  CircularProgress
} from '@mui/material'
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useFlow } from '../../context/FlowContext'

interface CustomNodeData {
  label: string
  type: string
  description?: string
  agentId?: string | null
  llmConfigId?: string | null
  capabilities?: string[]
  ragIndexes?: string[]
  inputs?: any
  outputs?: any
}

type CustomNodeProps = NodeProps<CustomNodeData>

const CustomNode: React.FC<CustomNodeProps> = ({ data, selected, id }) => {
  const { deleteNode, duplicateNode, updateNodeData } = useFlow()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [editLabel, setEditLabel] = useState(data.label)
  
  // Configuration state
  const [agentId, setAgentId] = useState<string>(data.agentId || '')
  const [llmConfigId, setLlmConfigId] = useState<string>(data.llmConfigId || '')
  
  // API data
  const [agents, setAgents] = useState<any[]>([])
  const [llmConfigs, setLlmConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

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

  const handleEdit = () => {
    setIsEditing(true)
    handleMenuClose()
  }

  const handleConfigure = async () => {
    setIsConfiguring(true)
    handleMenuClose()
    await loadConfigOptions()
  }
  
  const loadConfigOptions = async () => {
    setLoading(true)
    try {
      const [agentsRes, llmConfigsRes] = await Promise.all([
        fetch(`${apiBase}/agents`),
        fetch(`${apiBase}/llm-configs`)
      ])
      
      if (agentsRes.ok) {
        setAgents(await agentsRes.json())
      }
      if (llmConfigsRes.ok) {
        setLlmConfigs(await llmConfigsRes.json())
      }
    } catch (error) {
      console.error('Failed to load configuration options:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = () => {
    updateNodeData(id, { label: editLabel })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditLabel(data.label)
    setIsEditing(false)
  }

  const handleSaveConfig = () => {
    updateNodeData(id, { 
      agentId: agentId || null, 
      llmConfigId: llmConfigId || null 
    })
    setIsConfiguring(false)
  }

  const handleCancelConfig = () => {
    setAgentId(data.agentId || '')
    setLlmConfigId(data.llmConfigId || '')
    setIsConfiguring(false)
  }

  const getNodeColor = () => {
    switch (data.type) {
      case 'agent':
        return '#4caf50'
      case 'llm':
        return '#2196f3'
      case 'rag':
        return '#ff9800'
      case 'capability':
        return '#9c27b0'
      case 'input':
        return '#00bcd4'
      case 'output':
        return '#f44336'
      case 'orchestrator':
        return '#673ab7'
      default:
        return '#757575'
    }
  }

  const getNodeIcon = () => {
    switch (data.type) {
      case 'agent':
        return '🤖'
      case 'llm':
        return '🧠'
      case 'rag':
        return '📚'
      case 'capability':
        return '⚙️'
      case 'input':
        return '📥'
      case 'output':
        return '📤'
      case 'orchestrator':
        return '🎭'
      default:
        return '📦'
    }
  }

  return (
    <Paper
      elevation={selected ? 8 : 3}
      sx={{
        padding: 2,
        borderRadius: 2,
        minWidth: 200,
        maxWidth: 300,
        border: selected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
        backgroundColor: 'white',
        position: 'relative'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#555',
          width: 10,
          height: 10
        }}
      />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>{getNodeIcon()}</span>
          <Chip
            label={data.type || 'node'}
            size="small"
            sx={{
              backgroundColor: getNodeColor(),
              color: 'white',
              fontSize: '0.7rem'
            }}
          />
        </Box>
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{ ml: 'auto' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {isEditing ? (
        <Box>
          <TextField
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
            }}
          />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button size="small" onClick={handleSaveEdit} variant="contained">
              Save
            </Button>
            <Button size="small" onClick={handleCancelEdit} variant="outlined">
              Cancel
            </Button>
          </Box>
        </Box>
      ) : isConfiguring ? (
        <Box>
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            Configuration
          </Typography>
          
          {(data.type === 'agent' || data.type === 'llm') && (
            <>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <>
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Agent</InputLabel>
                    <Select
                      value={agentId}
                      label="Agent"
                      onChange={(e) => setAgentId(e.target.value)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {agents.map((agent) => (
                        <MenuItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.status})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>LLM Config</InputLabel>
                    <Select
                      value={llmConfigId}
                      label="LLM Config"
                      onChange={(e) => setLlmConfigId(e.target.value)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {llmConfigs.map((config) => (
                        <MenuItem key={config.id} value={config.id}>
                          {config.provider} - {config.model_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </>
          )}
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={handleSaveConfig} variant="contained">
              Save
            </Button>
            <Button size="small" onClick={handleCancelConfig} variant="outlined">
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
            {data.label}
          </Typography>
          
          {data.description && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              {data.description}
            </Typography>
          )}

          {/* Show configuration status */}
          {(data.agentId || data.llmConfigId) && (
            <Box sx={{ mt: 1 }}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {data.agentId && (
                  <Chip
                    label="Agent"
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ fontSize: '0.6rem', height: '20px' }}
                  />
                )}
                {data.llmConfigId && (
                  <Chip
                    label="LLM"
                    size="small"
                    variant="outlined"
                    color="secondary"
                    sx={{ fontSize: '0.6rem', height: '20px' }}
                  />
                )}
              </Box>
            </Box>
          )}
        </>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Label
        </MenuItem>
        <MenuItem onClick={handleConfigure}>
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
          Configure
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#555',
          width: 10,
          height: 10
        }}
      />
    </Paper>
  )
}

export default memo(CustomNode)