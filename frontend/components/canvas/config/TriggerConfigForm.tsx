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

interface TriggerConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const TriggerConfigForm: React.FC<TriggerConfigFormProps> = ({ data, updateData }) => {
  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Input Trigger Configuration
      </Typography>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Trigger Type
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={data.type || 'webhook'}
            onChange={(e) => handleInputChange('type', e.target.value)}
            label="Type"
          >
            <MenuItem value="webhook">Webhook</MenuItem>
            <MenuItem value="schedule">Scheduled</MenuItem>
            <MenuItem value="event">Event</MenuItem>
            <MenuItem value="manual">Manual</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {data.type === 'webhook' && (
        <Box>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Webhook Configuration
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                value={data.method || 'POST'}
                onChange={(e) => handleInputChange('method', e.target.value)}
                label="Method"
              >
                <MenuItem value="GET">GET</MenuItem>
                <MenuItem value="POST">POST</MenuItem>
                <MenuItem value="PUT">PUT</MenuItem>
                <MenuItem value="DELETE">DELETE</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Path"
              value={data.path || ''}
              onChange={(e) => handleInputChange('path', e.target.value)}
              fullWidth
              placeholder="/webhook/trigger"
              helperText="Webhook endpoint path"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={data.authentication || false}
                  onChange={(e) => handleInputChange('authentication', e.target.checked)}
                />
              }
              label="Require Authentication"
            />
          </Box>
        </Box>
      )}

      {data.type === 'schedule' && (
        <Box>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Schedule Configuration
          </Typography>
          <TextField
            label="Cron Expression"
            value={data.cron || ''}
            onChange={(e) => handleInputChange('cron', e.target.value)}
            fullWidth
            placeholder="0 9 * * MON-FRI"
            helperText="Cron schedule expression"
          />
        </Box>
      )}

      <Alert severity="info">
        Triggers define how your agent receives input and starts processing.
      </Alert>
    </Box>
  )
}

export default TriggerConfigForm