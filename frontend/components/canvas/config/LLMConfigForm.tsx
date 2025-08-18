import React, { useState, useEffect } from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Slider,
  Alert,
  FormHelperText,
  Tabs,
  Tab,
  Paper
} from '@mui/material'

interface LLMConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const LLMConfigForm: React.FC<LLMConfigFormProps> = ({ data, updateData }) => {
  const [savedConfigs, setSavedConfigs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConfigType, setSelectedConfigType] = useState<string>('') // 'saved_config_id' or 'create_new'

  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  // Load saved LLM configs from database
  useEffect(() => {
    const loadSavedConfigs = async () => {
      try {
        setIsLoading(true)
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
        const response = await fetch(`${apiBase}/llm-configs`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const configs = await response.json()
          console.log('🔍 Loaded LLM configs:', configs.length, 'configs')
          console.log('🔍 First config:', configs[0])
          setSavedConfigs(configs)
        } else {
          console.error('Failed to load LLM configs:', response.statusText)
          setSavedConfigs([])
        }
      } catch (error) {
        console.error('Error loading LLM configs:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedConfigs()
  }, [])

  // Initialize selected config type based on existing data
  useEffect(() => {
    if (data.savedConfigId) {
      setSelectedConfigType(data.savedConfigId)
    } else if (data.provider || data.model) {
      setSelectedConfigType('create_new')
    }
  }, [data])


  const providers = [
    { value: 'OpenAI', label: 'OpenAI' },
    { value: 'Azure', label: 'Azure OpenAI' },
    { value: 'Anthropic', label: 'Anthropic' },
    { value: 'Google', label: 'Google AI' },
    { value: 'Ollama', label: 'Ollama (Local)' },
    { value: 'Custom', label: 'Custom API' }
  ]

  const getModelsForProvider = (provider: string) => {
    switch (provider) {
      case 'OpenAI':
        return [
          'gpt-4',
          'gpt-4-turbo',
          'gpt-4-turbo-preview',
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k'
        ]
      case 'Azure':
        return [
          'gpt-4',
          'gpt-4-32k',
          'gpt-35-turbo',
          'gpt-35-turbo-16k'
        ]
      case 'Anthropic':
        return [
          'claude-3-opus',
          'claude-3-sonnet',
          'claude-3-haiku',
          'claude-2.1',
          'claude-2.0'
        ]
      case 'Google':
        return [
          'gemini-pro',
          'gemini-pro-vision',
          'palm-2'
        ]
      case 'Ollama':
        return [
          'llama2',
          'codellama',
          'mistral',
          'neural-chat'
        ]
      default:
        return []
    }
  }

  const handleConfigSelection = (value: string) => {
    setSelectedConfigType(value)
    
    if (value === 'create_new') {
      // Clear saved config data and set up for manual creation
      updateData({
        savedConfigId: undefined,
        configName: undefined,
        provider: '',
        model: '',
        apiBase: '',
        apiKey: '',
        maxTokens: 1000,
        temperature: 0.7
      })
    } else {
      // Handle saved config selection
      const selectedConfig = savedConfigs.find(config => config.id === value)
      if (selectedConfig) {
        updateData({
          savedConfigId: value,
          provider: selectedConfig.provider,
          model: selectedConfig.model_name,
          apiBase: selectedConfig.api_base,
          maxTokens: parseInt(selectedConfig.max_tokens) || 1000,
          temperature: parseFloat(selectedConfig.temperature) || 0.7,
          configName: `${selectedConfig.provider} - ${selectedConfig.model_name}`,
          // Clear manual config fields
          apiKey: undefined,
          deploymentName: undefined
        })
      }
    }
  }


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Language Model Configuration
      </Typography>

      {/* Unified Configuration Selection */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          LLM Configuration
        </Typography>
        {isLoading ? (
          <Alert severity="info">Loading saved configurations...</Alert>
        ) : (
          <FormControl fullWidth>
            <InputLabel>Select LLM Configuration</InputLabel>
            <Select
              value={selectedConfigType}
              onChange={(e) => handleConfigSelection(e.target.value)}
              label="Select LLM Configuration"
            >
              {/* Saved Configurations */}
              {savedConfigs.map((config) => (
                <MenuItem key={config.id} value={config.id}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      🔧 {config.provider} - {config.model_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tokens: {config.max_tokens} | Temp: {config.temperature} | Saved Config
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
              
              {/* Create New Option */}
              <MenuItem value="create_new">
                <Box>
                  <Typography variant="body2" fontWeight="bold" color="primary">
                    ➕ Create New LLM Configuration
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Configure a new LLM and optionally save it
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
            <FormHelperText>
              {selectedConfigType && selectedConfigType !== 'create_new' 
                ? 'Using saved configuration - settings are pre-populated below'
                : 'Choose a saved configuration or create a new one'
              }
            </FormHelperText>
          </FormControl>
        )}
      </Box>

      {/* Configuration Status */}
      {data.savedConfigId ? (
        <Alert severity="success" icon="🔧">
          <strong>Using Saved Configuration:</strong> {data.configName || 'Selected Config'}
          <br />
          <Typography variant="caption">
            Settings are automatically applied. You can view them below.
          </Typography>
        </Alert>
      ) : selectedConfigType === 'create_new' ? (
        <Alert severity="info" icon="➕">
          <strong>Creating New Configuration</strong>
          <br />
          <Typography variant="caption">
            Configure your LLM settings below. You can save this configuration after setup.
          </Typography>
        </Alert>
      ) : (
        <Alert severity="info">
          Please select an LLM configuration above to continue.
        </Alert>
      )}

      {/* Show configuration fields when a selection is made */}
      {(selectedConfigType && selectedConfigType !== '') && (
        <>
          {/* Configuration Details - Always Shown for Transparency */}
          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Configuration Details
            </Typography>
            <Paper elevation={1} sx={{ p: 2, backgroundColor: 'grey.50' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Provider</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {data.provider || 'Not set'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Model</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {data.model || 'Not set'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Temperature</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {data.temperature || 'Not set'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Max Tokens</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {data.maxTokens || 'Not set'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Manual Configuration Fields - Only for Create New */}
          {selectedConfigType === 'create_new' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                LLM Settings
              </Typography>
              
              {/* Provider Selection */}
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={data.provider || ''}
                  onChange={(e) => handleInputChange('provider', e.target.value)}
                  label="Provider"
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Choose your LLM provider</FormHelperText>
              </FormControl>

              {/* Model Selection */}
              {data.provider && (
                <FormControl fullWidth>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={data.model || ''}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    label="Model"
                  >
                    {getModelsForProvider(data.provider).map((model) => (
                      <MenuItem key={model} value={model}>
                        {model}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Select the specific model to use</FormHelperText>
                </FormControl>
              )}

              {/* API Configuration */}
              <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="API Base URL"
                  value={data.apiBase || ''}
                  onChange={(e) => handleInputChange('apiBase', e.target.value)}
                  fullWidth
                  placeholder="https://api.openai.com/v1"
                  helperText="Base URL for the API endpoint"
                  autoComplete="url"
                />
                
                <TextField
                  label="API Key"
                  type="password"
                  value={data.apiKey || ''}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  fullWidth
                  placeholder="sk-..."
                  helperText="Your API key (will be encrypted)"
                  autoComplete="new-password"
                />

                {data.provider === 'Azure' && (
                  <TextField
                    label="Deployment Name"
                    value={data.deploymentName || ''}
                    onChange={(e) => handleInputChange('deploymentName', e.target.value)}
                    fullWidth
                    placeholder="my-gpt4-deployment"
                    helperText="Azure deployment name"
                    autoComplete="off"
                  />
                )}
              </Box>

              {/* Model Parameters */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Max Tokens"
                  type="number"
                  value={data.maxTokens || 1000}
                  onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value) || 1000)}
                  InputProps={{ inputProps: { min: 1, max: 8000 } }}
                  helperText="Maximum tokens to generate"
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
                      { value: 0, label: 'Precise' },
                      { value: 0.7, label: 'Balanced' },
                      { value: 1.4, label: 'Creative' },
                      { value: 2, label: 'Very Creative' }
                    ]}
                  />
                </Box>
              </Box>

              {/* Configuration Status for Manual */}
              {data.provider && data.model && data.apiBase && data.apiKey ? (
                <Alert severity="success">
                  ✅ LLM configuration is complete and ready to use!
                </Alert>
              ) : (
                <Alert severity="warning">
                  ⚠️ Please configure: Provider, Model, API Base, and API Key
                </Alert>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

export default LLMConfigForm