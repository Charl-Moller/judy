import React, { useState, useEffect } from 'react'
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Button,
  Divider,
  TextField
} from '@mui/material'
import {
  Close as CloseIcon,
  SmartToy as AgentIcon,
  Psychology as LlmIcon,
  Build as ToolIcon,
  Storage as MemoryIcon,
  PlayArrow as TriggerIcon,
  Output as OutputIcon,
  AccountTree as OrchestratorIcon
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

const NodeConfigPanel: React.FC = () => {
  const { configNodeId, configNodeData, isConfigOpen, closeConfig } = useNodeConfig()
  const { updateNodeData } = useFlow()
  const [tabValue, setTabValue] = useState(0)
  const [formData, setFormData] = useState<any>({})

  // Initialize form data when panel opens
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
    <Paper 
      elevation={3}
      sx={{ 
        width: '400px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: '1px solid #e0e0e0'
      }}
    >
      {/* Header */}
      <Box sx={{ 
        borderBottom: '1px solid #e0e0e0', 
        backgroundColor: `${nodeColor}10`,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2
      }}>
        <Box sx={{ color: nodeColor }}>
          {getNodeIcon(nodeType)}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            Configure {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            {formData?.label || 'Untitled Node'}
          </Typography>
        </Box>
        <IconButton onClick={handleCancel} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        orientation="horizontal"
        sx={{ 
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: 'grey.50',
          minHeight: '48px',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '0.75rem',
            minHeight: '48px',
            padding: '6px 12px'
          },
          '& .MuiTabs-scrollButtons': {
            width: '32px'
          }
        }}
      >
        {tabs.map((tab, index) => (
          <Tab key={tab} label={tab} id={`config-tab-${index}`} />
        ))}
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tabs.map((_, index) => (
          <TabPanel key={index} value={tabValue} index={index}>
            <Box sx={{ px: 2 }}>
              {index === 0 ? (
                <>
                  {/* Name/Label Editor */}
                  <Box sx={{ mb: 3, pt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Component Name
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={formData?.label || formData?.name || ''}
                      onChange={(e) => updateFormData({ label: e.target.value, name: e.target.value })}
                      placeholder={`Enter ${formData?.nodeType || 'component'} name...`}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      This name appears on the component in the canvas
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  {/* Original Configuration Form */}
                  {renderConfigForm()}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                    {tabs[index]} configuration coming soon...
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Advanced configuration options will be added in the next update
                  </Typography>
                </Box>
              )}
            </Box>
          </TabPanel>
        ))}
      </Box>

      {/* Footer Actions */}
      <Box sx={{ 
        borderTop: '1px solid #e0e0e0', 
        backgroundColor: 'grey.50',
        p: 2,
        display: 'flex',
        gap: 1,
        justifyContent: 'flex-end'
      }}>
        <Button 
          onClick={handleCancel} 
          color="inherit"
          size="small"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          size="small"
          sx={{ 
            backgroundColor: nodeColor,
            '&:hover': {
              backgroundColor: nodeColor,
              filter: 'brightness(0.9)'
            }
          }}
        >
          Save
        </Button>
      </Box>
    </Paper>
  )
}

export default NodeConfigPanel