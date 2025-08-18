import React, { useState, useEffect } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Tooltip,
  Chip
} from '@mui/material'
import {
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Clear as ClearIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  PlayArrow as RunIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useFlow } from '../../context/FlowContext'

const CanvasHeader: React.FC = () => {
  const { reactFlowInstance, saveFlow, loadFlow, exportFlow } = useFlow()
  const [fileName, setFileName] = useState('Untitled Workflow')
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

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
      
      // Set up polling for updates (simpler than subscribe)
      const interval = setInterval(updateCounts, 100)
      return () => clearInterval(interval)
    }
  }, [reactFlowInstance])

  const handleSave = () => {
    saveFlow()
    // TODO: Show toast notification instead of alert
    alert('Workflow saved to browser storage!')
  }

  const handleLoad = () => {
    if (!reactFlowInstance) return
    
    const savedFlow = localStorage.getItem('judy-flow')
    if (savedFlow) {
      const flowData = JSON.parse(savedFlow)
      loadFlow(flowData)
      setTimeout(() => {
        reactFlowInstance.fitView()
      }, 100)
      alert('Workflow loaded successfully!')
    } else {
      alert('No saved workflow found!')
    }
  }

  const handleClear = () => {
    if (!reactFlowInstance) return
    
    if (window.confirm('Are you sure you want to clear the canvas?')) {
      reactFlowInstance.setNodes([])
      reactFlowInstance.setEdges([])
    }
  }

  const handleExport = () => {
    const dataStr = exportFlow()
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${fileName.replace(/\s+/g, '_')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!reactFlowInstance) return
    
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const result = e.target?.result
          if (typeof result === 'string') {
            const flowData = JSON.parse(result)
            loadFlow(flowData)
            setFileName(file.name.replace('.json', ''))
            setTimeout(() => {
              reactFlowInstance.fitView()
            }, 100)
            alert('Workflow imported successfully!')
          }
        } catch (error) {
          alert('Invalid workflow file!')
        }
      }
      reader.readAsText(file)
    }
    // Reset input
    event.target.value = ''
  }

  const handleRun = () => {
    if (!reactFlowInstance) return
    
    const nodes = reactFlowInstance.getNodes()
    const edges = reactFlowInstance.getEdges()
    
    // TODO: Implement workflow execution
    console.log('Running workflow:', { nodes, edges })
    alert('Workflow execution not yet implemented!')
  }

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 0, mr: 3 }}>
          🎭 Judy Canvas
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
          <Tooltip title="Save to Browser">
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSave}
              variant="outlined"
              size="small"
            >
              Save
            </Button>
          </Tooltip>
          
          <Tooltip title="Load from Browser">
            <Button
              startIcon={<LoadIcon />}
              onClick={handleLoad}
              variant="outlined"
              size="small"
            >
              Load
            </Button>
          </Tooltip>
          
          <Tooltip title="Export as JSON">
            <Button
              startIcon={<ExportIcon />}
              onClick={handleExport}
              variant="outlined"
              size="small"
            >
              Export
            </Button>
          </Tooltip>
          
          <Tooltip title="Import JSON">
            <Button
              component="label"
              startIcon={<ImportIcon />}
              variant="outlined"
              size="small"
            >
              Import
              <input
                type="file"
                hidden
                accept=".json"
                onChange={handleImport}
              />
            </Button>
          </Tooltip>
          
          <Tooltip title="Run Workflow">
            <Button
              startIcon={<RunIcon />}
              onClick={handleRun}
              variant="contained"
              size="small"
              color="primary"
            >
              Run
            </Button>
          </Tooltip>
          
          <Tooltip title="Clear Canvas">
            <Button
              startIcon={<ClearIcon />}
              onClick={handleClear}
              variant="outlined"
              size="small"
              color="error"
            >
              Clear
            </Button>
          </Tooltip>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip 
            label={`${nodeCount} nodes`} 
            size="small" 
            variant="outlined"
            color={nodeCount > 0 ? 'primary' : 'default'}
          />
          <Chip 
            label={`${edgeCount} connections`} 
            size="small" 
            variant="outlined"
            color={edgeCount > 0 ? 'secondary' : 'default'}
          />
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default CanvasHeader