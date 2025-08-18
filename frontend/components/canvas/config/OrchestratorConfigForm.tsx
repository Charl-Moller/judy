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

interface OrchestratorConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const OrchestratorConfigForm: React.FC<OrchestratorConfigFormProps> = ({ data, updateData }) => {
  const handleInputChange = (field: string, value: any) => {
    updateData({ [field]: value })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        Orchestrator Configuration
      </Typography>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Basic Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={data.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            fullWidth
            placeholder="Agent Orchestrator"
          />
          
          <TextField
            label="Description"
            value={data.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Coordinates multiple agents"
          />
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Routing Strategy
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Strategy</InputLabel>
          <Select
            value={data.routing || 'round_robin'}
            onChange={(e) => handleInputChange('routing', e.target.value)}
            label="Strategy"
          >
            <MenuItem value="round_robin">Round Robin</MenuItem>
            <MenuItem value="random">Random</MenuItem>
            <MenuItem value="priority">Priority-based</MenuItem>
            <MenuItem value="load_balanced">Load Balanced</MenuItem>
            <MenuItem value="intent_based">Intent-based</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Execution Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Timeout (milliseconds)"
            type="number"
            value={data.timeout || 30000}
            onChange={(e) => handleInputChange('timeout', parseInt(e.target.value) || 30000)}
            InputProps={{ inputProps: { min: 1000, max: 300000 } }}
            helperText="Maximum execution time per agent"
          />

          <TextField
            label="Max Concurrent Agents"
            type="number"
            value={data.maxConcurrent || 3}
            onChange={(e) => handleInputChange('maxConcurrent', parseInt(e.target.value) || 3)}
            InputProps={{ inputProps: { min: 1, max: 10 } }}
            helperText="Maximum agents running simultaneously"
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.parallelExecution || false}
                onChange={(e) => handleInputChange('parallelExecution', e.target.checked)}
              />
            }
            label="Enable Parallel Execution"
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.errorRecovery || true}
                onChange={(e) => handleInputChange('errorRecovery', e.target.checked)}
              />
            }
            label="Enable Error Recovery"
          />
        </Box>
      </Box>

      <Alert severity="info">
        Orchestrators manage the execution flow between multiple agents and components.
      </Alert>
    </Box>
  )
}

export default OrchestratorConfigForm