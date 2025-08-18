import React, { useState, useEffect } from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Chip,
  Autocomplete,
  Slider,
  Alert
} from '@mui/material'

interface AgentConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const AgentConfigForm: React.FC<AgentConfigFormProps> = ({ data, updateData }) => {
  const [agents, setAgents] = useState<any[]>([])
  const [llmConfigs, setLlmConfigs] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [ragIndexes, setRagIndexes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  // Load configuration options
  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true)
      try {
        const [agentsRes, llmConfigsRes, capabilitiesRes, ragRes] = await Promise.all([
          fetch(`${apiBase}/agents`),
          fetch(`${apiBase}/llm-configs`),
          fetch(`${apiBase}/capabilities`),
          fetch(`${apiBase}/rag-indexes`)
        ])

        if (agentsRes.ok) setAgents(await agentsRes.json())
        if (llmConfigsRes.ok) setLlmConfigs(await llmConfigsRes.json())
        if (capabilitiesRes.ok) setCapabilities(await capabilitiesRes.json())
        if (ragRes.ok) setRagIndexes(await ragRes.json())
      } catch (error) {
        console.error('Failed to load configuration options:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOptions()
  }, [apiBase])

  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  const availableCapabilities = [
    'chat',
    'general_knowledge',
    'image_analysis',
    'visual_recognition',
    'document_processing',
    'web_search',
    'data_analysis',
    'code_generation',
    'translation',
    'summarization'
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Agent Configuration
      </Typography>

      {/* Basic Information */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Basic Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Agent Name"
            value={data.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            fullWidth
            placeholder="e.g., Customer Service Agent"
          />
          
          <TextField
            label="Description"
            value={data.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Brief description of what this agent does"
          />

          <TextField
            label="Label (Display Name)"
            value={data.label || ''}
            onChange={(e) => handleInputChange('label', e.target.value)}
            fullWidth
            placeholder="Name shown on canvas"
          />
        </Box>
      </Box>

      {/* System Prompt */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          AI Behavior
        </Typography>
        <TextField
          label="System Prompt"
          value={data.systemPrompt || ''}
          onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
          fullWidth
          multiline
          rows={4}
          placeholder="You are a helpful AI assistant. Your role is to..."
          helperText="Define the agent's personality, expertise, and behavior"
        />
      </Box>

      {/* Capabilities */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Capabilities & Tools
        </Typography>
        <Autocomplete
          multiple
          options={availableCapabilities}
          value={data.capabilities || []}
          onChange={(_, newValue) => handleInputChange('capabilities', newValue)}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Agent Capabilities"
              placeholder="Select capabilities"
              helperText="Choose what this agent can do"
            />
          )}
        />
      </Box>

      {/* Memory Settings */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Memory & Context
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={data.memory || false}
                onChange={(e) => handleInputChange('memory', e.target.checked)}
              />
            }
            label="Enable Memory"
          />

          {data.memory && (
            <>
              <Box sx={{ px: 2 }}>
                <Typography gutterBottom>
                  Context Window: {data.contextWindow || 4000} tokens
                </Typography>
                <Slider
                  value={data.contextWindow || 4000}
                  onChange={(_, value) => handleInputChange('contextWindow', value)}
                  min={1000}
                  max={32000}
                  step={1000}
                  marks={[
                    { value: 1000, label: '1K' },
                    { value: 8000, label: '8K' },
                    { value: 16000, label: '16K' },
                    { value: 32000, label: '32K' }
                  ]}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel>RAG Index</InputLabel>
                <Select
                  value={data.ragIndex || ''}
                  onChange={(e) => handleInputChange('ragIndex', e.target.value)}
                  label="RAG Index"
                >
                  <MenuItem value="">None</MenuItem>
                  {ragIndexes.map((index) => (
                    <MenuItem key={index.id} value={index.id}>
                      {index.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
        </Box>
      </Box>

      {/* LLM Configuration */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Language Model
        </Typography>
        <FormControl fullWidth>
          <InputLabel>LLM Configuration</InputLabel>
          <Select
            value={data.llmConfigId || ''}
            onChange={(e) => handleInputChange('llmConfigId', e.target.value)}
            label="LLM Configuration"
            disabled={loading}
          >
            <MenuItem value="">None (will use default)</MenuItem>
            {llmConfigs.map((config) => (
              <MenuItem key={config.id} value={config.id}>
                {config.provider} - {config.model_name}
                {config.temperature !== undefined && ` (temp: ${config.temperature})`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Advanced Settings */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Advanced Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Max Response Length"
            type="number"
            value={data.maxTokens || 1000}
            onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value) || 1000)}
            InputProps={{ inputProps: { min: 100, max: 4000 } }}
            helperText="Maximum tokens in agent response"
          />

          <Box sx={{ px: 2 }}>
            <Typography gutterBottom>
              Temperature: {data.temperature || 0.7}
            </Typography>
            <Slider
              value={data.temperature || 0.7}
              onChange={(_, value) => handleInputChange('temperature', value)}
              min={0}
              max={2}
              step={0.1}
              marks={[
                { value: 0, label: 'Focused' },
                { value: 1, label: 'Balanced' },
                { value: 2, label: 'Creative' }
              ]}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={data.streamResponse || false}
                onChange={(e) => handleInputChange('streamResponse', e.target.checked)}
              />
            }
            label="Stream Response"
          />
        </Box>
      </Box>

      {/* Configuration Status */}
      {data.name && data.systemPrompt && (
        <Alert severity="success">
          Agent configuration looks good! This agent is ready to use.
        </Alert>
      )}
    </Box>
  )
}

export default AgentConfigForm