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
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Chip,
  Autocomplete
} from '@mui/material'
import {
  Chat as ChatIcon,
  MenuBook as KnowledgeIcon,
  Psychology as SmartIcon
} from '@mui/icons-material'

interface MemoryConfigFormProps {
  data: any
  updateData: (updates: any) => void
}

const MemoryConfigForm: React.FC<MemoryConfigFormProps> = ({ data, updateData }) => {
  const [ragIndexes, setRagIndexes] = useState<any[]>([])
  
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''

  // Load RAG indexes
  useEffect(() => {
    const loadRagIndexes = async () => {
      try {
        const response = await fetch(`${apiBase}/rag-indexes`)
        if (response.ok) {
          setRagIndexes(await response.json())
        }
      } catch (error) {
        console.error('Failed to load RAG indexes:', error)
      }
    }
    loadRagIndexes()
  }, [apiBase])

  const handleTypeChange = (type: string) => {
    // Reset settings when type changes
    const newData: any = { type }
    
    // Set default configurations for each type
    switch (type) {
      case 'conversation':
        newData.conversation = {
          windowSize: 10,
          includeSystem: false
        }
        break
      case 'knowledge':
        newData.knowledge = {
          ragIndexes: [],
          topK: 5,
          minSimilarity: 0.7
        }
        break
      case 'smart':
        newData.smart = {
          conversation: {
            windowSize: 10,
            includeSystem: false
          },
          knowledge: {
            ragIndexes: [],
            topK: 5,
            minSimilarity: 0.7
          },
          strategy: 'parallel'
        }
        break
    }
    
    updateData(newData)
  }

  const updateConversationSettings = (updates: any) => {
    if (data.type === 'conversation') {
      updateData({
        ...data,
        conversation: { ...data.conversation, ...updates }
      })
    } else if (data.type === 'smart') {
      updateData({
        ...data,
        smart: {
          ...data.smart,
          conversation: { ...data.smart.conversation, ...updates }
        }
      })
    }
  }

  const updateKnowledgeSettings = (updates: any) => {
    if (data.type === 'knowledge') {
      updateData({
        ...data,
        knowledge: { ...data.knowledge, ...updates }
      })
    } else if (data.type === 'smart') {
      updateData({
        ...data,
        smart: {
          ...data.smart,
          knowledge: { ...data.smart.knowledge, ...updates }
        }
      })
    }
  }

  const getMemoryIcon = (type: string) => {
    switch (type) {
      case 'conversation': return <ChatIcon />
      case 'knowledge': return <KnowledgeIcon />
      case 'smart': return <SmartIcon />
      default: return null
    }
  }

  const getMemoryDescription = (type: string) => {
    switch (type) {
      case 'conversation':
        return 'Maintains conversation history for contextual responses. Perfect for chatbots and assistants.'
      case 'knowledge':
        return 'Searches through documents and knowledge bases using RAG. Ideal for Q&A and documentation.'
      case 'smart':
        return 'Intelligently combines conversation context with knowledge search. Best for advanced assistants.'
      default:
        return ''
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        🧠 Memory Configuration
      </Typography>

      {/* Memory Type Selection */}
      <Box>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Memory Type
        </Typography>
        <FormControl fullWidth>
          <Select
            value={data.type || 'conversation'}
            onChange={(e) => handleTypeChange(e.target.value)}
            displayEmpty
          >
            <MenuItem value="conversation">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ChatIcon fontSize="small" />
                <span>💬 Conversation Memory</span>
              </Box>
            </MenuItem>
            <MenuItem value="knowledge">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <KnowledgeIcon fontSize="small" />
                <span>📚 Knowledge Memory (RAG)</span>
              </Box>
            </MenuItem>
            <MenuItem value="smart">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartIcon fontSize="small" />
                <span>🧠 Smart Memory (Both)</span>
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
        
        <Alert severity="info" sx={{ mt: 2 }}>
          {getMemoryDescription(data.type || 'conversation')}
        </Alert>
      </Box>

      {/* Conversation Settings */}
      {(data.type === 'conversation' || data.type === 'smart') && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom color="primary">
              💬 Conversation Settings
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Box>
                <Typography gutterBottom>
                  Conversation Window: {
                    data.type === 'conversation' 
                      ? data.conversation?.windowSize || 10
                      : data.smart?.conversation?.windowSize || 10
                  } messages
                </Typography>
                <Slider
                  value={
                    data.type === 'conversation'
                      ? data.conversation?.windowSize || 10
                      : data.smart?.conversation?.windowSize || 10
                  }
                  onChange={(_, value) => updateConversationSettings({ windowSize: value })}
                  min={2}
                  max={50}
                  step={1}
                  marks={[
                    { value: 2, label: '2' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' },
                    { value: 50, label: '50' }
                  ]}
                />
                <Typography variant="caption" color="text.secondary">
                  How many previous messages to remember
                </Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      data.type === 'conversation'
                        ? data.conversation?.includeSystem || false
                        : data.smart?.conversation?.includeSystem || false
                    }
                    onChange={(e) => updateConversationSettings({ includeSystem: e.target.checked })}
                  />
                }
                label="Include system messages in context"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Settings */}
      {(data.type === 'knowledge' || data.type === 'smart') && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom color="primary">
              📚 Knowledge Settings (RAG)
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {/* RAG Indexes */}
              <Autocomplete
                multiple
                options={ragIndexes}
                getOptionLabel={(option) => option.name || option}
                value={
                  data.type === 'knowledge'
                    ? data.knowledge?.ragIndexes || []
                    : data.smart?.knowledge?.ragIndexes || []
                }
                onChange={(_, value) => updateKnowledgeSettings({ 
                  ragIndexes: value.map(v => typeof v === 'string' ? v : v.id) 
                })}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={typeof option === 'string' ? option : option.name}
                      {...getTagProps({ index })}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Knowledge Sources"
                    placeholder="Select RAG indexes"
                    helperText="Documents and data to search through"
                  />
                )}
              />

              {/* Top K Results */}
              <Box>
                <Typography gutterBottom>
                  Search Results: Top {
                    data.type === 'knowledge'
                      ? data.knowledge?.topK || 5
                      : data.smart?.knowledge?.topK || 5
                  } results
                </Typography>
                <Slider
                  value={
                    data.type === 'knowledge'
                      ? data.knowledge?.topK || 5
                      : data.smart?.knowledge?.topK || 5
                  }
                  onChange={(_, value) => updateKnowledgeSettings({ topK: value })}
                  min={1}
                  max={20}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' }
                  ]}
                />
                <Typography variant="caption" color="text.secondary">
                  Number of relevant documents to retrieve
                </Typography>
              </Box>

              {/* Similarity Threshold */}
              <Box>
                <Typography gutterBottom>
                  Similarity Threshold: {
                    data.type === 'knowledge'
                      ? data.knowledge?.minSimilarity || 0.7
                      : data.smart?.knowledge?.minSimilarity || 0.7
                  }
                </Typography>
                <Slider
                  value={
                    data.type === 'knowledge'
                      ? data.knowledge?.minSimilarity || 0.7
                      : data.smart?.knowledge?.minSimilarity || 0.7
                  }
                  onChange={(_, value) => updateKnowledgeSettings({ minSimilarity: value })}
                  min={0.3}
                  max={1.0}
                  step={0.05}
                  marks={[
                    { value: 0.3, label: 'Low' },
                    { value: 0.7, label: 'Medium' },
                    { value: 1.0, label: 'High' }
                  ]}
                />
                <Typography variant="caption" color="text.secondary">
                  Minimum relevance score for search results
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Smart Memory Strategy */}
      {data.type === 'smart' && (
        <Box>
          <Typography variant="subtitle2" gutterBottom color="primary">
            🧠 Combination Strategy
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Strategy</InputLabel>
            <Select
              value={data.smart?.strategy || 'parallel'}
              onChange={(e) => updateData({
                ...data,
                smart: { ...data.smart, strategy: e.target.value }
              })}
              label="Strategy"
            >
              <MenuItem value="parallel">
                <Box>
                  <Typography variant="body2">Parallel</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Search knowledge and conversation simultaneously
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="sequential">
                <Box>
                  <Typography variant="body2">Sequential</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Check conversation first, then search if needed
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Quick Tips */}
      <Card sx={{ bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            💡 Quick Tips
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Conversation:</strong> Best for chatbots and support agents<br />
            • <strong>Knowledge:</strong> Perfect for Q&A and documentation search<br />
            • <strong>Smart:</strong> Ideal for advanced assistants that need both context and knowledge
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

export default MemoryConfigForm