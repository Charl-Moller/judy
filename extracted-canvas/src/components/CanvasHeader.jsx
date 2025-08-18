import React, { useState, useEffect } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Tooltip
} from '@mui/material'
import {
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Clear as ClearIcon,
  Download as ExportIcon,
  Upload as ImportIcon
} from '@mui/icons-material'
import { useFlow } from '../context/FlowContext'

const CanvasHeader = () => {
  const { reactFlowInstance } = useFlow()
  const [fileName, setFileName] = useState('Untitled Flow')
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
    if (!reactFlowInstance) return
    
    const flowData = {
      nodes: reactFlowInstance.getNodes(),
      edges: reactFlowInstance.getEdges(),
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('savedFlow', JSON.stringify(flowData))
    alert('Flow saved to browser storage!')
  }

  const handleLoad = () => {
    if (!reactFlowInstance) return
    
    const savedFlow = localStorage.getItem('savedFlow')
    if (savedFlow) {
      const flowData = JSON.parse(savedFlow)
      reactFlowInstance.setNodes(flowData.nodes || [])
      reactFlowInstance.setEdges(flowData.edges || [])
      setTimeout(() => {
        reactFlowInstance.fitView()
      }, 100)
      alert('Flow loaded successfully!')
    } else {
      alert('No saved flow found!')
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
    if (!reactFlowInstance) return
    
    const flowData = {
      nodes: reactFlowInstance.getNodes(),
      edges: reactFlowInstance.getEdges(),
      timestamp: new Date().toISOString()
    }
    const dataStr = JSON.stringify(flowData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${fileName.replace(/\s+/g, '_')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImport = (event) => {
    if (!reactFlowInstance) return
    
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const flowData = JSON.parse(e.target.result)
          reactFlowInstance.setNodes(flowData.nodes || [])
          reactFlowInstance.setEdges(flowData.edges || [])
          setFileName(file.name.replace('.json', ''))
          setTimeout(() => {
            reactFlowInstance.fitView()
          }, 100)
          alert('Flow imported successfully!')
        } catch (error) {
          alert('Invalid flow file!')
        }
      }
      reader.readAsText(file)
    }
  }

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 0, mr: 3 }}>
          Flow Canvas
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
        
        <Typography variant="body2" color="text.secondary">
          Nodes: {nodeCount} | Edges: {edgeCount}
        </Typography>
      </Toolbar>
    </AppBar>
  )
}

export default CanvasHeader