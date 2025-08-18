import React from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Slider,
  Alert
} from '@mui/material'

interface MemoryConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const MemoryConfigForm: React.FC<MemoryConfigFormProps> = ({ data, updateData }) => {
  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Memory Store Configuration
      </Typography>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Memory Type
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={data.type || 'vector'}
            onChange={(e) => handleInputChange('type', e.target.value)}
            label="Type"
          >
            <MenuItem value="vector">Vector Memory</MenuItem>
            <MenuItem value="conversation">Conversation Memory</MenuItem>
            <MenuItem value="episodic">Episodic Memory</MenuItem>
            <MenuItem value="semantic">Semantic Memory</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Capacity Settings
        </Typography>
        <TextField
          label="Max Size"
          type="number"
          value={data.maxSize || 1000}
          onChange={(e) => handleInputChange('maxSize', parseInt(e.target.value) || 1000)}
          fullWidth
          helperText="Maximum number of entries"
        />
      </Box>

      {data.type === 'vector' && (
        <Box sx={{ px: 2 }}>
          <Typography gutterBottom>
            Similarity Threshold: {data.similarity || 0.8}
          </Typography>
          <Slider
            value={data.similarity || 0.8}
            onChange={(_, value) => handleInputChange('similarity', value)}
            min={0.1}
            max={1.0}
            step={0.05}
            marks={[
              { value: 0.1, label: '0.1' },
              { value: 0.5, label: '0.5' },
              { value: 0.8, label: '0.8' },
              { value: 1.0, label: '1.0' }
            ]}
          />
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Retention Policy
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Retention</InputLabel>
          <Select
            value={data.retention || '7d'}
            onChange={(e) => handleInputChange('retention', e.target.value)}
            label="Retention"
          >
            <MenuItem value="1h">1 Hour</MenuItem>
            <MenuItem value="24h">24 Hours</MenuItem>
            <MenuItem value="7d">7 Days</MenuItem>
            <MenuItem value="30d">30 Days</MenuItem>
            <MenuItem value="never">Never Expire</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Alert severity="info">
        Memory stores help agents maintain context across conversations.
      </Alert>
    </Box>
  )
}

export default MemoryConfigForm