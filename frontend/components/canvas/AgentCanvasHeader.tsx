import React, { useState, useEffect } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Tooltip,
  Chip,
  IconButton
} from '@mui/material'
import {
  Save as SaveIcon,
  PlayArrow as RunIcon,
  Fullscreen as FullscreenIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon
} from '@mui/icons-material'
import { useFlow } from '../../context/FlowContext'
import { useExecution } from '../../context/ExecutionContext'

interface AgentCanvasHeaderProps {
  agentName: string
  onSave?: () => void
  onExecute?: () => void
}

const AgentCanvasHeader: React.FC<AgentCanvasHeaderProps> = ({ 
  agentName, 
  onSave, 
  onExecute 
}) => {
  const { reactFlowInstance } = useFlow()
  const { openTestPanel, isExecuting } = useExecution()
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Update counts when instance changes
  useEffect(() => {
    if (reactFlowInstance) {
      const updateCounts = () => {
        try {
          setNodeCount(reactFlowInstance.getNodes().length)
          setEdgeCount(reactFlowInstance.getEdges().length)
        } catch (e) {
          // Instance might not be ready yet
        }
      }
      
      // Initial update
      updateCounts()
      
      // Set up polling for updates
      const interval = setInterval(updateCounts, 500)
      return () => clearInterval(interval)
    }
  }, [reactFlowInstance])

  const handleSave = () => {
    if (onSave) {
      onSave()
      // TODO: Show toast notification instead of alert in Phase 4
    }
  }

  const handleExecute = () => {
    if (!reactFlowInstance) return
    
    const nodes = reactFlowInstance.getNodes()
    
    // Basic validation
    if (nodes.length === 0) {
      alert('Add some components to your agent first!')
      return
    }

    // Check for required components
    const hasAgent = nodes.some(n => n.data?.nodeType === 'agent')
    const hasLlm = nodes.some(n => n.data?.nodeType === 'llm')
    
    if (!hasAgent && !hasLlm) {
      alert('Your agent needs at least an AI Agent or LLM component to execute!')
      return
    }

    // Open test panel instead of executing directly
    openTestPanel()
  }

  const handleZoomIn = () => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn()
    }
  }

  const handleZoomOut = () => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut()
    }
  }

  const handleFitView = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 })
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ borderBottom: '1px solid #e0e0e0' }}>
      <Toolbar sx={{ minHeight: '56px !important', px: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 0, mr: 3, fontSize: '1.1rem' }}>
          🤖 {agentName}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, alignItems: 'center' }}>
          <Tooltip title="Save Agent">
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSave}
              variant="contained"
              size="small"
              color="primary"
              sx={{ textTransform: 'none' }}
            >
              Save
            </Button>
          </Tooltip>
          
          <Tooltip title="Open Test Lab">
            <Button
              startIcon={<RunIcon />}
              onClick={handleExecute}
              variant="contained"
              size="small"
              color={isExecuting ? "warning" : "success"}
              sx={{ textTransform: 'none' }}
              disabled={isExecuting}
            >
              {isExecuting ? 'Running...' : 'Test Lab'}
            </Button>
          </Tooltip>

          {/* Canvas Controls */}
          <Box sx={{ ml: 2, display: 'flex', gap: 0.5 }}>
            <Tooltip title="Zoom In">
              <IconButton size="small" onClick={handleZoomIn}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton size="small" onClick={handleZoomOut}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fit to View">
              <IconButton size="small" onClick={handleFitView}>
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
              <IconButton size="small" onClick={toggleFullscreen}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Status Indicators */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip 
            label={`${nodeCount} components`} 
            size="small" 
            variant="outlined"
            color={nodeCount > 0 ? 'primary' : 'default'}
            sx={{ fontSize: '0.75rem' }}
          />
          <Chip 
            label={`${edgeCount} connections`} 
            size="small" 
            variant="outlined"
            color={edgeCount > 0 ? 'secondary' : 'default'}
            sx={{ fontSize: '0.75rem' }}
          />
          
          {/* Agent Status */}
          <Chip 
            label={nodeCount === 0 ? 'Empty' : edgeCount === 0 ? 'Draft' : 'Configured'}
            size="small"
            color={
              nodeCount === 0 ? 'default' : 
              edgeCount === 0 ? 'warning' : 
              'success'
            }
            sx={{ fontSize: '0.75rem' }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default AgentCanvasHeader