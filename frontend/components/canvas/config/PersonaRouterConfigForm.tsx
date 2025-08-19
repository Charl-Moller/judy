import React, { useState, useEffect } from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Alert,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  FormControlLabel,
  Switch,
  Autocomplete,
  Divider
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Psychology as PersonaIcon,
  SmartToy as BotIcon,
  Link as LinkIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useFlow } from '../../../context/FlowContext'

interface PersonaRouterConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const PersonaRouterConfigForm: React.FC<PersonaRouterConfigFormProps> = ({ data, updateData }) => {
  const { reactFlowInstance } = useFlow()
  const [connectedAgents, setConnectedAgents] = useState<any[]>([])
  const [agentIntentMappings, setAgentIntentMappings] = useState<any>({})

  // Get connected agents from the canvas
  useEffect(() => {
    if (reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()
      
      // Find all agent nodes connected FROM this persona router
      const currentNodeId = nodes.find(n => n.selected)?.id || data.nodeId
      const outgoingAgentEdges = edges.filter(edge => 
        edge.source === currentNodeId && 
        nodes.some(n => n.id === edge.target && n.type === 'agent')
      )
      
      const connectedAgentNodes = outgoingAgentEdges.map(edge => 
        nodes.find(n => n.id === edge.target)
      ).filter(Boolean)
      
      setConnectedAgents(connectedAgentNodes)
      
      // Initialize intent mappings for new agents
      const currentMappings = data.agentIntentMappings || {}
      const newMappings = { ...currentMappings }
      
      connectedAgentNodes.forEach(agent => {
        if (!newMappings[agent.id]) {
          newMappings[agent.id] = {
            triggers: [],
            confidence: 0.7,
            priority: 1
          }
        }
      })
      
      // Remove mappings for disconnected agents
      Object.keys(newMappings).forEach(agentId => {
        if (!connectedAgentNodes.some(agent => agent.id === agentId)) {
          delete newMappings[agentId]
        }
      })
      
      setAgentIntentMappings(newMappings)
      if (JSON.stringify(newMappings) !== JSON.stringify(currentMappings)) {
        updateData({ agentIntentMappings: newMappings })
      }
    }
  }, [reactFlowInstance, data.nodeId])

  const handleIntentMethodChange = (method: string) => {
    updateData({
      intents: {
        ...data.intents,
        method: method
      }
    })
  }

  const handleConfidenceThresholdChange = (threshold: number) => {
    updateData({
      intents: {
        ...data.intents,
        confidenceThreshold: threshold
      }
    })
  }

  const updateAgentIntentMapping = (agentId: string, field: string, value: any) => {
    const newMappings = {
      ...agentIntentMappings,
      [agentId]: {
        ...agentIntentMappings[agentId],
        [field]: value
      }
    }
    setAgentIntentMappings(newMappings)
    updateData({ agentIntentMappings: newMappings })
  }

  const addTriggerToAgent = (agentId: string) => {
    const currentTriggers = agentIntentMappings[agentId]?.triggers || []
    updateAgentIntentMapping(agentId, 'triggers', [...currentTriggers, ''])
  }

  const updateAgentTrigger = (agentId: string, triggerIndex: number, value: string) => {
    const currentTriggers = agentIntentMappings[agentId]?.triggers || []
    const newTriggers = [...currentTriggers]
    newTriggers[triggerIndex] = value
    updateAgentIntentMapping(agentId, 'triggers', newTriggers)
  }

  const removeTriggerFromAgent = (agentId: string, triggerIndex: number) => {
    const currentTriggers = agentIntentMappings[agentId]?.triggers || []
    const newTriggers = currentTriggers.filter((_, index) => index !== triggerIndex)
    updateAgentIntentMapping(agentId, 'triggers', newTriggers)
  }

  const getAgentIcon = (agentType: string) => {
    return <BotIcon />
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Persona Router Configuration
      </Typography>

      {/* Router Basic Settings */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Router Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Router Name"
            value={data.name || 'Multi-Persona Router'}
            onChange={(e) => updateData({ name: e.target.value })}
            fullWidth
            placeholder="e.g., Customer Service Router"
          />
          
          <TextField
            label="Description"
            value={data.description || ''}
            onChange={(e) => updateData({ description: e.target.value })}
            fullWidth
            multiline
            rows={2}
            placeholder="Intelligent routing based on user intent"
          />
        </Box>
      </Box>

      {/* System Prompt for Router */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Router System Prompt
        </Typography>
        <TextField
          label="System Prompt"
          value={data.systemPrompt || ''}
          onChange={(e) => updateData({ systemPrompt: e.target.value })}
          fullWidth
          multiline
          rows={3}
          placeholder="You are an intelligent router that analyzes user intent and selects the most appropriate specialist agent..."
          helperText="Instructions for the persona router itself (used for LLM-based intent detection)"
        />
      </Box>

      {/* Intent Detection Settings */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Intent Detection
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Detection Method</InputLabel>
            <Select
              value={data.intents?.method || 'hybrid'}
              onChange={(e) => handleIntentMethodChange(e.target.value)}
              label="Detection Method"
            >
              <MenuItem value="keywords">Keywords Only (Manual Triggers)</MenuItem>
              <MenuItem value="llm">System Prompt Analysis (Recommended)</MenuItem>
              <MenuItem value="hybrid">Smart Hybrid</MenuItem>
            </Select>
          </FormControl>
          
          {(data.intents?.method === 'llm' || data.intents?.method === 'hybrid') && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Smart Routing:</strong> The router will analyze each connected agent's system prompt 
                to automatically determine the best match for user requests. No manual trigger configuration needed!
              </Typography>
            </Alert>
          )}

          <Box sx={{ px: 2 }}>
            <Typography gutterBottom>
              Confidence Threshold: {data.intents?.confidenceThreshold || 0.7}
            </Typography>
            <Slider
              value={data.intents?.confidenceThreshold || 0.7}
              onChange={(_, value) => handleConfidenceThresholdChange(value as number)}
              min={0.1}
              max={1.0}
              step={0.1}
              marks={[
                { value: 0.3, label: 'Lenient' },
                { value: 0.7, label: 'Balanced' },
                { value: 0.9, label: 'Strict' }
              ]}
            />
          </Box>
        </Box>
      </Box>

      {/* Connected Agents Configuration */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          {data.intents?.method === 'keywords' ? 'Connected Agents & Manual Triggers' : 'Connected Agents'}
        </Typography>
        
        {connectedAgents.length === 0 ? (
          <Alert severity="info">
            <Typography variant="body2">
              <strong>No agents connected.</strong> Connect Agent nodes to this Persona Router 
              by drawing connections from this router to Agent nodes on the canvas.
            </Typography>
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {connectedAgents.map((agent) => (
              <Accordion key={agent.id} defaultExpanded={data.intents?.method === 'keywords' && connectedAgents.length === 1}>
                <AccordionSummary 
                  expandIcon={data.intents?.method === 'keywords' ? <ExpandMoreIcon /> : null}
                  sx={{ 
                    backgroundColor: 'grey.50',
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                      gap: 2
                    }
                  }}
                >
                  <Box sx={{ color: '#4caf50' }}>
                    {getAgentIcon(agent.type)}
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {agent.data?.name || agent.data?.label || 'Untitled Agent'}
                  </Typography>
                  {data.intents?.method === 'keywords' ? (
                    <Chip 
                      size="small" 
                      label={`${agentIntentMappings[agent.id]?.triggers?.filter(Boolean).length || 0} triggers`}
                      variant="outlined"
                    />
                  ) : (
                    <Chip 
                      size="small" 
                      label="Auto-routed"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </AccordionSummary>
                {data.intents?.method === 'keywords' && (
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Agent Description */}
                    {agent.data?.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {agent.data.description}
                      </Typography>
                    )}

                    <Divider />

                    {/* Intent Triggers */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          Intent Triggers
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => addTriggerToAgent(agent.id)}
                        >
                          Add Trigger
                        </Button>
                      </Box>
                      
                      {agentIntentMappings[agent.id]?.triggers?.map((trigger: string, index: number) => (
                        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <TextField
                            size="small"
                            fullWidth
                            value={trigger}
                            onChange={(e) => updateAgentTrigger(agent.id, index, e.target.value)}
                            placeholder="e.g., support, help, technical issue"
                          />
                          <IconButton
                            size="small"
                            onClick={() => removeTriggerFromAgent(agent.id, index)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}

                      {(!agentIntentMappings[agent.id]?.triggers || agentIntentMappings[agent.id].triggers.length === 0) && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', p: 2, textAlign: 'center' }}>
                          No triggers configured. Add triggers to help the router identify when to use this agent.
                        </Typography>
                      )}
                    </Box>

                    {/* Agent Priority */}
                    <Box sx={{ px: 2 }}>
                      <Typography gutterBottom variant="body2" fontWeight={600}>
                        Priority: {agentIntentMappings[agent.id]?.priority || 1}
                      </Typography>
                      <Slider
                        value={agentIntentMappings[agent.id]?.priority || 1}
                        onChange={(_, value) => updateAgentIntentMapping(agent.id, 'priority', value)}
                        min={1}
                        max={10}
                        step={1}
                        marks={[
                          { value: 1, label: 'Low' },
                          { value: 5, label: 'Normal' },
                          { value: 10, label: 'High' }
                        ]}
                      />
                    </Box>
                  </Box>
                </AccordionDetails>
                )}
              </Accordion>
            ))}
          </Box>
        )}
      </Box>

      {/* Connection Instructions */}
      <Alert severity="info">
        <Typography variant="body2">
          <strong>How to use:</strong> Click "+ Agent" to create specialist agents (Sales, Support, Technical, etc.), 
          then click "+ LLM" to add language model. 
          {data.intents?.method === 'keywords' 
            ? ' Configure trigger keywords for each agent above.'
            : ' The router will automatically analyze each agent\'s system prompt to route requests intelligently!'
          }
        </Typography>
      </Alert>

      {/* Configuration Status */}
      {connectedAgents.length > 0 && (
        <Alert severity="success">
          Persona Router configured with {connectedAgents.length} connected agent(s). 
          Ready for intelligent routing!
        </Alert>
      )}
    </Box>
  )
}

export default PersonaRouterConfigForm