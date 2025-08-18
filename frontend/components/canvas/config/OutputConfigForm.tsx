import React from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert
} from '@mui/material'

interface OutputConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const OutputConfigForm: React.FC<OutputConfigFormProps> = ({ data, updateData }) => {
  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Output Handler Configuration
      </Typography>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Output Format
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Format</InputLabel>
          <Select
            value={data.format || 'json'}
            onChange={(e) => handleInputChange('format', e.target.value)}
            label="Format"
          >
            <MenuItem value="json">JSON</MenuItem>
            <MenuItem value="text">Plain Text</MenuItem>
            <MenuItem value="markdown">Markdown</MenuItem>
            <MenuItem value="html">HTML</MenuItem>
            <MenuItem value="xml">XML</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Destination
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Destination</InputLabel>
          <Select
            value={data.destination || 'api'}
            onChange={(e) => handleInputChange('destination', e.target.value)}
            label="Destination"
          >
            <MenuItem value="api">API Response</MenuItem>
            <MenuItem value="webhook">Webhook</MenuItem>
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="file">File System</MenuItem>
            <MenuItem value="database">Database</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Output Template
        </Typography>
        <TextField
          label="Template"
          value={data.template || ''}
          onChange={(e) => handleInputChange('template', e.target.value)}
          fullWidth
          multiline
          rows={4}
          placeholder="{{result}}"
          helperText="Use {{variable}} for dynamic content"
        />
      </Box>

      {data.destination === 'webhook' && (
        <Box>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Webhook Settings
          </Typography>
          <TextField
            label="Webhook URL"
            value={data.webhookUrl || ''}
            onChange={(e) => handleInputChange('webhookUrl', e.target.value)}
            fullWidth
            placeholder="https://example.com/webhook"
          />
        </Box>
      )}

      <Alert severity="info">
        Output handlers format and deliver the final results from your agent.
      </Alert>
    </Box>
  )
}

export default OutputConfigForm