import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab
} from '@mui/material'
import {
  Close as CloseIcon,
  SmartToy as AgentIcon,
  Psychology as LlmIcon,
  Build as ToolIcon,
  Storage as MemoryIcon,
  PlayArrow as TriggerIcon,
  Output as OutputIcon,
  AccountTree as OrchestratorIcon,
} from '@mui/icons-material'
import { useNodeConfig } from '../../context/NodeConfigContext'
import { useFlow } from '../../context/FlowContext'
import AgentConfigForm from './config/AgentConfigForm'
import LLMConfigForm from './config/LLMConfigForm'
import ToolConfigForm from './config/ToolConfigForm'
import MemoryConfigForm from './config/MemoryConfigForm'
import TriggerConfigForm from './config/TriggerConfigForm'
import OutputConfigForm from './config/OutputConfigForm'
import OrchestratorConfigForm from './config/OrchestratorConfigForm'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

const NodeConfigModal: React.FC = () => {
  const { configNodeId, configNodeData, isConfigOpen, closeConfig } = useNodeConfig()
  const { updateNodeData } = useFlow()
  const [tabValue, setTabValue] = useState(0)
  const [formData, setFormData] = useState<any>({})

  // Initialize form data when modal opens
  useEffect(() => {
    if (isConfigOpen && configNodeData) {
      setFormData({ ...configNodeData })
      setTabValue(0)
    }
  }, [isConfigOpen, configNodeData])

  const handleSave = () => {
    if (configNodeId) {
      updateNodeData(configNodeId, formData)
      closeConfig()
    }
  }

  const handleCancel = () => {
    closeConfig()
  }

  const updateFormData = (updates: any) => {
    setFormData((prev: any) => ({ ...prev, ...updates }))
  }

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'agent':
        return <AgentIcon />
      case 'llm':
        return <LlmIcon />
      case 'tool':
        return <ToolIcon />
      case 'memory':
        return <MemoryIcon />
      case 'trigger':
        return <TriggerIcon />
      case 'output':
        return <OutputIcon />
      case 'orchestrator':
        return <OrchestratorIcon />
      default:
        return <AgentIcon />
    }
  }

  const getNodeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'agent':
        return '#4caf50'
      case 'llm':
        return '#2196f3'
      case 'tool':
        return '#ff9800'
      case 'memory':
        return '#9c27b0'
      case 'trigger':
        return '#00bcd4'
      case 'output':
        return '#f44336'
      case 'orchestrator':
        return '#673ab7'
      default:
        return '#757575'
    }
  }

  const renderConfigForm = () => {
    const nodeType = formData?.nodeType || 'agent'

    switch (nodeType) {
      case 'agent':
        return <AgentConfigForm data={formData} updateData={updateFormData} />
      case 'llm':
        return <LLMConfigForm data={formData} updateData={updateFormData} />
      case 'tool':
        return <ToolConfigForm data={formData} updateData={updateFormData} />
      case 'memory':
        return <MemoryConfigForm data={formData} updateData={updateFormData} />
      case 'trigger':
        return <TriggerConfigForm data={formData} updateData={updateFormData} />
      case 'output':
        return <OutputConfigForm data={formData} updateData={updateFormData} />
      case 'orchestrator':
        return <OrchestratorConfigForm data={formData} updateData={updateFormData} />
      default:
        return <div>Unknown node type: {nodeType}</div>
    }
  }

  const getTabs = () => {
    const nodeType = formData?.nodeType || 'agent'
    const tabs = ['Configuration']

    // Add specific tabs based on node type
    switch (nodeType) {
      case 'agent':
        tabs.push('Input/Output', 'LLM Settings', 'Memory', 'Tools', 'Advanced')
        break
      case 'llm':
        tabs.push('Model Settings', 'Parameters', 'API Config')
        break
      case 'tool':
        tabs.push('Parameters', 'Authentication')
        break
      case 'memory':
        tabs.push('Vector Settings', 'Retention')
        break
      case 'trigger':
        tabs.push('Webhook Config', 'Authentication')
        break
      case 'output':
        tabs.push('Format Settings', 'Templates')
        break
      case 'orchestrator':
        tabs.push('Routing', 'Agents', 'Advanced')
        break
    }

    return tabs
  }

  if (!isConfigOpen || !configNodeData) {
    return null
  }

  const nodeType = formData?.nodeType || 'agent'
  const nodeColor = getNodeColor(nodeType)
  const tabs = getTabs()

  return (
    <Dialog
      open={isConfigOpen}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '800px',
          overflow: 'hidden'
        },
        onWheel: (e: React.WheelEvent) => e.stopPropagation()
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #e0e0e0', 
        backgroundColor: `${nodeColor}10`,
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <Box sx={{ color: nodeColor }}>
          {getNodeIcon(nodeType)}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">
            Configure {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formData?.label || 'Untitled Node'}
          </Typography>
        </Box>
        <IconButton onClick={handleCancel} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Tabs */}
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: 'grey.50',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.875rem'
            }
          }}
        >
          {tabs.map((tab, index) => (
            <Tab key={tab} label={tab} id={`config-tab-${index}`} />
          ))}
        </Tabs>

        {/* Tab Content */}
        <Box 
          sx={{ flex: 1, overflow: 'auto', p: 3 }}
          onWheel={(e: React.WheelEvent) => e.stopPropagation()}
        >
          {tabs.map((_, index) => (
            <TabPanel key={index} value={tabValue} index={index}>
              {index === 0 ? renderConfigForm() : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    {tabs[index]} configuration coming soon...
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Advanced configuration options will be added in the next update
                  </Typography>
                </Box>
              )}
            </TabPanel>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #e0e0e0', backgroundColor: 'grey.50' }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          sx={{ 
            backgroundColor: nodeColor,
            '&:hover': {
              backgroundColor: nodeColor,
              filter: 'brightness(0.9)'
            }
          }}
        >
          Save Configuration
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default NodeConfigModal