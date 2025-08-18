import React from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  FormControlLabel,
  Switch,
  Alert
} from '@mui/material'

interface ToolConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const ToolConfigForm: React.FC<ToolConfigFormProps> = ({ data, updateData }) => {
  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  const toolTypes = [
    { value: 'web_search', label: 'Web Search' },
    { value: 'image_analysis', label: 'Image Analysis' },
    { value: 'document_processing', label: 'Document Processing' },
    { value: 'data_analysis', label: 'Data Analysis' },
    { value: 'api_call', label: 'API Call' },
    { value: 'database_query', label: 'Database Query' },
    { value: 'file_manipulation', label: 'File Manipulation' },
    { value: 'custom_function', label: 'Custom Function' }
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Tool/Capability Configuration
      </Typography>

      {/* Basic Information */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Basic Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Tool Name"
            value={data.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            fullWidth
            placeholder="e.g., Web Search Tool"
          />
          
          <TextField
            label="Description"
            value={data.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="What this tool does"
          />

          <FormControl fullWidth>
            <InputLabel>Tool Type</InputLabel>
            <Select
              value={data.type || ''}
              onChange={(e) => handleInputChange('type', e.target.value)}
              label="Tool Type"
            >
              {toolTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Tool Parameters */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Parameters
        </Typography>
        <TextField
          label="Tool Parameters (JSON)"
          value={data.parameters ? JSON.stringify(data.parameters, null, 2) : ''}
          onChange={(e) => {
            try {
              const params = JSON.parse(e.target.value || '{}')
              handleInputChange('parameters', params)
            } catch {
              // Invalid JSON, ignore
            }
          }}
          fullWidth
          multiline
          rows={4}
          placeholder='{\n  "max_results": 10,\n  "timeout": 30\n}'
          helperText="Tool-specific configuration parameters"
        />
      </Box>

      {/* Settings */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={data.enabled !== false}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
              />
            }
            label="Tool Enabled"
          />

          <TextField
            label="Timeout (seconds)"
            type="number"
            value={data.timeout || 30}
            onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 30)}
            InputProps={{ inputProps: { min: 1, max: 300 } }}
            helperText="Maximum execution time"
          />

          <TextField
            label="Max Retries"
            type="number"
            value={data.maxRetries || 3}
            onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value) || 3)}
            InputProps={{ inputProps: { min: 0, max: 10 } }}
            helperText="Number of retry attempts on failure"
          />
        </Box>
      </Box>

      {/* Configuration Status */}
      {data.name && data.type ? (
        <Alert severity="success">
          Tool configuration is complete!
        </Alert>
      ) : (
        <Alert severity="warning">
          Please provide at least a name and type for this tool.
        </Alert>
      )}
    </Box>
  )
}

export default ToolConfigForm