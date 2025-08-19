import React, { useState, useEffect } from 'react'
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Typography,
  Alert,
  Switch,
  FormControlLabel,
  Chip
} from '@mui/material'

interface MCPServerConfig {
  name: string
  description: string
  transport: 'sse' | 'stdio' | 'http'
  url: string
  command: string
  auth_token: string
  auto_connect: boolean
  status?: 'active' | 'inactive' | 'error' | 'connecting'
  tools_count?: number
  server_id?: string
}

interface MCPServerConfigFormProps {
  config: Partial<MCPServerConfig>
  onChange: (config: Partial<MCPServerConfig>) => void
  nodeId: string
}

export default function MCPServerConfigForm({ config, onChange, nodeId }: MCPServerConfigFormProps) {
  const [localConfig, setLocalConfig] = useState<Partial<MCPServerConfig>>({
    name: '',
    description: '',
    transport: 'sse',
    url: '',
    command: '',
    auth_token: '',
    auto_connect: true,
    ...config
  })
  const [connecting, setConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const [availableTools, setAvailableTools] = useState<string[]>([])

  useEffect(() => {
    onChange(localConfig)
  }, [localConfig, onChange])

  const updateConfig = (field: keyof MCPServerConfig, value: any) => {
    const updated = { ...localConfig, [field]: value }
    setLocalConfig(updated)
  }

  const testConnection = async () => {
    if (!localConfig.name || (!localConfig.url && !localConfig.command)) {
      setConnectionStatus('Please fill in required fields first')
      return
    }

    setConnecting(true)
    setConnectionStatus(null)

    try {
      // First create/update the MCP server
      const serverData = {
        name: localConfig.name,
        description: localConfig.description || '',
        transport: localConfig.transport,
        url: localConfig.url || '',
        command: localConfig.command || '',
        auth_token: localConfig.auth_token || ''
      }

      let response = await fetch('http://localhost:8000/mcp-servers/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      })

      if (response.status === 422) {
        // Server might already exist, try to find it
        const listResponse = await fetch('http://localhost:8000/mcp-servers/')
        if (listResponse.ok) {
          const servers = await listResponse.json()
          const existingServer = servers.find((s: any) => s.name === localConfig.name)
          if (existingServer) {
            response = await fetch(`http://localhost:8000/mcp-servers/${existingServer.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(serverData)
            })
          }
        }
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create/update MCP server')
      }

      const server = await response.json()
      
      // Now try to connect
      const connectResponse = await fetch(`http://localhost:8000/mcp-servers/${server.id}/connect`, {
        method: 'POST'
      })

      if (connectResponse.ok) {
        setConnectionStatus('Connected successfully!')
        
        // Get available tools
        const toolsResponse = await fetch(`http://localhost:8000/mcp-servers/${server.id}/tools`)
        if (toolsResponse.ok) {
          const toolsData = await toolsResponse.json()
          setAvailableTools(Object.keys(toolsData.tools || {}))
        }

        // Update config with server ID
        setLocalConfig(prev => ({ 
          ...prev, 
          server_id: server.id,
          status: 'active',
          tools_count: Object.keys(toolsData?.tools || {}).length
        }))
      } else {
        const error = await connectResponse.json()
        throw new Error(error.detail || 'Failed to connect to MCP server')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionStatus(`Connection failed: ${error.message}`)
      setLocalConfig(prev => ({ ...prev, status: 'error' }))
    } finally {
      setConnecting(false)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'connecting': return 'warning'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  return (
    <Box sx={{ p: 2, space: 2 }}>
      <Typography variant="h6" gutterBottom>
        MCP Server Configuration
      </Typography>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Server Name"
          value={localConfig.name || ''}
          onChange={(e) => updateConfig('name', e.target.value)}
          margin="normal"
          required
          helperText="Unique name for this MCP server"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Description"
          value={localConfig.description || ''}
          onChange={(e) => updateConfig('description', e.target.value)}
          margin="normal"
          multiline
          rows={2}
          helperText="What does this MCP server provide?"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel>Transport Type</InputLabel>
          <Select
            value={localConfig.transport || 'sse'}
            onChange={(e) => updateConfig('transport', e.target.value)}
            label="Transport Type"
          >
            <MenuItem value="sse">SSE (Server-Sent Events)</MenuItem>
            <MenuItem value="http">HTTP</MenuItem>
            <MenuItem value="stdio">Stdio (Command Line)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {(localConfig.transport === 'sse' || localConfig.transport === 'http') && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Server URL"
            value={localConfig.url || ''}
            onChange={(e) => updateConfig('url', e.target.value)}
            margin="normal"
            required
            placeholder="http://localhost:3001/mcp"
            helperText="URL endpoint for the MCP server"
          />
        </Box>
      )}

      {localConfig.transport === 'stdio' && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Command"
            value={localConfig.command || ''}
            onChange={(e) => updateConfig('command', e.target.value)}
            margin="normal"
            required
            placeholder="node server.js"
            helperText="Command to start the MCP server process"
          />
        </Box>
      )}

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Auth Token (Optional)"
          value={localConfig.auth_token || ''}
          onChange={(e) => updateConfig('auth_token', e.target.value)}
          margin="normal"
          type="password"
          helperText="Authentication token if required"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={localConfig.auto_connect || false}
              onChange={(e) => updateConfig('auto_connect', e.target.checked)}
            />
          }
          label="Auto-connect when workflow starts"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={testConnection}
          disabled={connecting || !localConfig.name}
          fullWidth
        >
          {connecting ? 'Testing Connection...' : 'Test Connection'}
        </Button>
      </Box>

      {connectionStatus && (
        <Alert 
          severity={connectionStatus.includes('successfully') ? 'success' : 'error'} 
          sx={{ mb: 2 }}
        >
          {connectionStatus}
        </Alert>
      )}

      {localConfig.status && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Status:
          </Typography>
          <Chip 
            label={localConfig.status} 
            color={getStatusColor(localConfig.status)}
            size="small"
          />
          {localConfig.tools_count !== undefined && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {localConfig.tools_count} tools available
            </Typography>
          )}
        </Box>
      )}

      {availableTools.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Available Tools:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {availableTools.map((tool) => (
              <Chip key={tool} label={tool} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>How to use:</strong> After testing the connection successfully, 
          connect this MCP Server node to Agent nodes to make the tools available to those agents.
        </Typography>
      </Alert>
    </Box>
  )
}