import React, { useState } from 'react'
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
  Alert,
  Button,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import ToolSelector from '../ToolSelector'

interface ToolConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

interface Tool {
  id: string
  name: string
  display_name: string
  description: string
  category: {
    name: string
    icon: string
    color: string
  }
  parameters: Array<{
    name: string
    type: string
    required: boolean
    description: string
  }>
  examples: Array<any>
}

const ToolConfigForm: React.FC<ToolConfigFormProps> = ({ data, updateData }) => {
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false)
  const [selectedTools, setSelectedTools] = useState<Tool[]>(data.selectedTools || [])

  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  const handleToolSelect = (tool: Tool) => {
    const newTools = [...selectedTools, tool]
    setSelectedTools(newTools)
    updateData({ selectedTools: newTools })
  }

  const handleToolRemove = (toolId: string) => {
    const newTools = selectedTools.filter(tool => tool.id !== toolId)
    setSelectedTools(newTools)
    updateData({ selectedTools: newTools })
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
        🔧 Tool Configuration
      </Typography>

      {/* Selected Tools */}
      <Box>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle2" color="primary">
            Selected Tools ({selectedTools.length})
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setToolSelectorOpen(true)}
            variant="outlined"
            size="small"
          >
            Add Tool
          </Button>
        </Box>

        {selectedTools.length === 0 ? (
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 3, 
              textAlign: 'center', 
              backgroundColor: '#f9f9f9',
              border: '2px dashed #ddd' 
            }}
          >
            <Typography color="text.secondary" gutterBottom>
              No tools selected
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add tools to give your agent specific capabilities
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setToolSelectorOpen(true)}
              variant="contained"
              size="small"
            >
              Browse Tools
            </Button>
          </Paper>
        ) : (
          <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            {selectedTools.map((tool, index) => (
              <React.Fragment key={tool.id}>
                <ListItem>
                  <Box display="flex" alignItems="center" gap={1} mr={2}>
                    <Typography sx={{ fontSize: '1.2em' }}>
                      {tool.category.icon}
                    </Typography>
                    <Chip 
                      label={tool.category.name} 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        backgroundColor: tool.category.color, 
                        color: 'white',
                        '& .MuiChip-label': { color: 'white' }
                      }}
                    />
                  </Box>
                  <ListItemText
                    primary={tool.display_name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {tool.description}
                        </Typography>
                        {tool.parameters.length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Parameters: {tool.parameters.map(p => p.name).join(', ')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleToolRemove(tool.id)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < selectedTools.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Legacy Tool Configuration - Keep for backward compatibility */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Legacy Configuration
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
      {selectedTools.length > 0 ? (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} configured successfully!
        </Alert>
      ) : data.name && data.type ? (
        <Alert severity="success">
          Legacy tool configuration is complete!
        </Alert>
      ) : (
        <Alert severity="info">
          Add tools from the library above or configure a legacy tool manually.
        </Alert>
      )}

      {/* Tool Selector Dialog */}
      <ToolSelector
        open={toolSelectorOpen}
        onClose={() => setToolSelectorOpen(false)}
        onSelectTool={handleToolSelect}
        selectedTools={selectedTools.map(t => t.id)}
      />
    </Box>
  )
}

export default ToolConfigForm