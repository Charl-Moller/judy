import React, { useState, useRef, useEffect } from 'react'
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import {
  Close as CloseIcon,
  Send as SendIcon,
  Clear as ClearIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  History as HistoryIcon,
  BugReport as DebugIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { useExecution } from '../../context/ExecutionContext'
import { useFlow } from '../../context/FlowContext'
import MessageRenderer from '../MessageRenderer'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`test-tabpanel-${index}`}
      aria-labelledby={`test-tab-${index}`}
      {...other}
      style={{ height: '100%', display: value === index ? 'flex' : 'none', flexDirection: 'column' }}
    >
      {children}
    </div>
  )
}

const TestPanel: React.FC = () => {
  const {
    isTestPanelOpen,
    closeTestPanel,
    conversationHistory,
    executionLogs,
    currentInput,
    setCurrentInput,
    isExecuting,
    startExecution,
    stopExecution,
    addMessage,
    updateMessage,
    getLatestConversationHistory,
    addLog,
    clearHistory,
    clearLogs
  } = useExecution()
  
  const { reactFlowInstance } = useFlow()
  const [tabValue, setTabValue] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages/logs arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversationHistory])

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [executionLogs])

  const handleSendMessage = async () => {
    console.log('🚨 TEST LAB: handleSendMessage called')
    if (!currentInput.trim() || isExecuting || !reactFlowInstance) {
      console.log('🚨 TEST LAB: Early return - input:', currentInput.trim(), 'isExecuting:', isExecuting, 'reactFlowInstance:', !!reactFlowInstance)
      return
    }

    const input = currentInput.trim()
    setCurrentInput('')

    // Add user message
    addMessage({
      type: 'user',
      content: input
    })

    // Start execution
    startExecution()
    addLog({
      level: 'info',
      message: `🚀 Starting agent execution with input: "${input}"`
    })

    try {
      // Get current workflow state
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()

      // Validate workflow
      if (nodes.length === 0) {
        throw new Error('No nodes in the workflow. Add some components first!')
      }

      // Check for required components
      const hasAgent = nodes.some(n => n.data?.nodeType === 'agent')
      const hasLlm = nodes.some(n => n.data?.nodeType === 'llm')
      const hasTrigger = nodes.some(n => n.data?.nodeType === 'trigger')

      if (!hasAgent && !hasLlm) {
        throw new Error('Workflow needs at least an Agent or LLM component')
      }

      addLog({
        level: 'info',
        message: `📊 Workflow validation passed: ${nodes.length} nodes, ${edges.length} connections`
      })

      // Log workflow components
      const componentTypes = nodes.reduce((acc, node) => {
        const type = node.data?.nodeType || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      addLog({
        level: 'debug',
        message: `🔍 Workflow components: ${Object.entries(componentTypes).map(([type, count]) => `${count} ${type}`).join(', ')}`
      })

      // Simulate execution steps
      addLog({
        level: 'info',
        message: '⚡ Initializing agent execution pipeline...'
      })

      await new Promise(resolve => setTimeout(resolve, 500))

      // Find starting point (trigger or first node)
      let startNode = nodes.find(n => n.data?.nodeType === 'trigger')
      if (!startNode) {
        startNode = nodes[0]
        addLog({
          level: 'warning',
          message: '⚠️ No trigger found, starting from first node'
        })
      }

      addLog({
        level: 'info',
        message: `🎯 Starting execution from: ${startNode.data?.label || startNode.id}`,
        nodeId: startNode.id
      })

      await new Promise(resolve => setTimeout(resolve, 300))

      // Simulate processing through connected nodes
      const processedNodes = new Set<string>()
      const queue = [startNode.id]

      while (queue.length > 0 && isExecuting) {
        const currentNodeId = queue.shift()!
        if (processedNodes.has(currentNodeId)) continue

        const currentNode = nodes.find(n => n.id === currentNodeId)
        if (!currentNode) continue

        processedNodes.add(currentNodeId)

        addLog({
          level: 'info',
          message: `🔄 Processing ${currentNode.data?.nodeType}: ${currentNode.data?.label || currentNodeId}`,
          nodeId: currentNodeId
        })

        // Simulate node-specific processing
        await simulateNodeProcessing(currentNode, input, addLog)

        // Find connected nodes
        const connectedEdges = edges.filter(e => e.source === currentNodeId)
        connectedEdges.forEach(edge => {
          if (!processedNodes.has(edge.target)) {
            queue.push(edge.target)
          }
        })

        await new Promise(resolve => setTimeout(resolve, 400))
      }

      // Call actual API if available
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      
      // Debug API base
      addLog({
        level: 'debug',
        message: `🔍 TEST LAB: API Base = "${apiBase}", will call API: ${!!apiBase}`
      })
      
      // CRITICAL: Debug if this code block is executed
      addLog({
        level: 'debug',
        message: '🚨 TEST LAB: About to check if apiBase exists and enter API call block'
      })
      
      if (apiBase) {
        addLog({
          level: 'info',
          message: '🌐 Sending request to execution API...'
        })

        // ALWAYS log this to confirm Test Lab is executing this code
        addLog({
          level: 'debug',
          message: `🔍 TEST LAB DEBUG: About to check streaming detection with ${nodes.length} nodes`
        })

        try {
          // First, log ALL nodes to understand the structure
          console.log('🔍 ALL Test Lab Nodes:', nodes.map(n => ({
            id: n.id,
            type: n.type,
            data: n.data
          })))
          
          // Check if any agent node has streaming enabled - check both type and nodeType
          const hasStreamingAgent = nodes.some((node: any) => 
            (node.type === 'agent' || node.data?.nodeType === 'agent') && node.data?.streamResponse === true
          )
          
          // Debug streaming detection
          const debugInfo = {
            nodeCount: nodes.length,
            allNodes: nodes.map((node: any) => ({
              id: node.id,
              type: node.type,
              data: node.data
            })),
            agentNodes: nodes.filter((node: any) => node.type === 'agent' || node.data?.nodeType === 'agent').map((node: any) => ({
              id: node.id,
              type: node.type,
              nodeType: node.data?.nodeType,
              name: node.data?.name,
              streamResponse: node.data?.streamResponse,
              hasData: !!node.data,
              fullData: node.data
            })),
            hasStreamingAgent
          }
          console.log('🔍 Test Lab streaming detection:', debugInfo)
          
          // Also send this debug info to backend for logging
          addLog({
            level: 'debug',
            message: `🔍 Test Lab streaming detection: hasStreamingAgent=${hasStreamingAgent}, nodeCount=${nodes.length}, agentNodes=${nodes.filter(n => n.type === 'agent').length}`
          })
          
          addLog({
            level: 'debug',
            message: `🔍 Agent nodes details: ${JSON.stringify(nodes.filter(n => n.type === 'agent' || n.data?.nodeType === 'agent').map(n => ({id: n.id, type: n.type, nodeType: n.data?.nodeType, streamResponse: n.data?.streamResponse})), null, 2)}`
          })
          
          if (hasStreamingAgent) {
            addLog({
              level: 'info',
              message: '🌊 Streaming enabled - using streaming endpoint for real-time responses'
            })
            
            addLog({
              level: 'debug',
              message: `🌊 About to call streaming endpoint: ${apiBase}/chat/workflow/stream`
            })
            
            // Use streaming endpoint
            const response = await fetch(`${apiBase}/chat/workflow/stream`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                nodes: nodes,
                connections: edges,
                input: input,
                session_id: `canvas_test_${Date.now()}`,
                conversation_history: conversationHistory.map(msg => ({
                  role: msg.type === 'user' ? 'user' : 'assistant',
                  content: msg.content
                }))
              })
            })
            
            if (!response.ok) {
              throw new Error(`Streaming request failed: ${response.status}`)
            }
            
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            
            if (reader) {
              let accumulatedContent = ''
              
              // Add initial empty assistant message for real-time streaming
              const streamingMessage = {
                type: 'assistant' as const,
                content: ''
              }
              const streamingMessageId = addMessage(streamingMessage)
              
              try {
                while (true) {
                  const { done, value } = await reader.read()
                  
                  if (done) break
                  
                  const chunk = decoder.decode(value, { stream: true })
                  const lines = chunk.split('\n')
                  
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue
                        
                        const parsed = JSON.parse(data)
                        if (parsed.content) {
                          accumulatedContent += parsed.content
                          
                          // Update the streaming message in real-time using its ID
                          updateMessage(streamingMessageId, { content: accumulatedContent })
                          
                          // Log streaming progress for Test Lab  
                          console.log('🌊 Streaming chunk received:', {
                            raw: parsed.content,
                            accumulated: accumulatedContent,
                            messageId: streamingMessageId
                          })
                        }
                      } catch (e) {
                        // Skip invalid JSON lines
                      }
                    }
                  }
                }
              } finally {
                reader.releaseLock()
              }
              
              addLog({
                level: 'success',
                message: '✅ Streaming response completed'
              })
              
              return // Exit early for streaming
            }
          } else {
            addLog({
              level: 'info',
              message: '📦 Non-streaming mode - using regular endpoint'
            })
            
            // Use regular endpoint for non-streaming
            const response = await fetch(`${apiBase}/chat/workflow`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                nodes: nodes,
                connections: edges,
                input: input,
                session_id: `canvas_test_${Date.now()}`,
                conversation_history: conversationHistory.map(msg => ({
                  role: msg.type === 'user' ? 'user' : 'assistant',
                  content: msg.content
                }))
              })
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
            }

            const result = await response.json()
          
          // Log agent information if available
          if (result.workflow_execution?.agent_name) {
            addLog({
              level: 'info',
              message: `🤖 Response from Agent: ${result.workflow_execution.agent_name}`
            })
            
            if (result.workflow_execution.router_used) {
              addLog({
                level: 'info',
                message: `🎭 Persona Router: Selected "${result.workflow_execution.selected_agent}" (${result.workflow_execution.routing_method}, confidence: ${result.workflow_execution.routing_confidence?.toFixed(2) || 'N/A'})`
              })
            }
          }
          
          // Log tool execution details if available
          if (result.tool_calls && result.tool_calls.length > 0) {
            addLog({
              level: 'info',
              message: `🔧 Executed ${result.tool_calls.length} tool(s):`
            })
            result.tool_calls.forEach((toolCall: any, index: number) => {
              // Handle both OpenAI format and simplified format
              const toolName = toolCall.function?.name || toolCall.tool_name || 'unknown'
              const toolParams = toolCall.function?.arguments || toolCall.parameters || toolCall.arguments
              
              let paramStr = ''
              if (toolParams) {
                try {
                  const parsedParams = typeof toolParams === 'string' ? JSON.parse(toolParams) : toolParams
                  paramStr = `with params: ${JSON.stringify(parsedParams).substring(0, 100)}...`
                } catch {
                  paramStr = `with params: ${String(toolParams).substring(0, 100)}...`
                }
              }
              
              addLog({
                level: 'debug',
                message: `  ${index + 1}. ${toolName} ${paramStr}`
              })
            })
          } else {
            addLog({
              level: 'warning',
              message: '⚠️ No tools were executed during this request'
            })
          }
          
          // Log execution statistics
          if (result.workflow_execution) {
            const exec = result.workflow_execution
            addLog({
              level: 'debug',
              message: `📊 Execution Stats: LLM=${exec.llm_model}, Provider=${exec.provider}, Memory=${exec.memory_used ? 'Yes' : 'No'}`
            })
          }
          
          addLog({
            level: 'info',
            message: '✅ API execution completed successfully'
          })

          // Add assistant response
          addMessage({
            type: 'assistant',
            content: result.response || 'Agent executed successfully!',
            agentName: result.workflow_execution?.agent_name
          })
          } // End of non-streaming else block

        } catch (apiError) {
          addLog({
            level: 'error',
            message: `❌ API execution failed: ${apiError}`
          })

          // Add simulated response as fallback
          addMessage({
            type: 'assistant',
            content: `I processed your request: "${input}". This is a simulated response since the API is not available.`
          })
        }
      } else {
        // Simulated response
        addMessage({
          type: 'assistant',
          content: `I processed your request: "${input}". This is a simulated response from your agent workflow.`
        })
      }

      addLog({
        level: 'info',
        message: '🎉 Agent execution completed successfully!'
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      addLog({
        level: 'error',
        message: `❌ Execution failed: ${errorMessage}`
      })

      addMessage({
        type: 'error',
        content: `Execution failed: ${errorMessage}`
      })
    } finally {
      stopExecution()
    }
  }

  const simulateNodeProcessing = async (node: any, input: string, addLog: any) => {
    const nodeType = node.data?.nodeType || 'unknown'
    const nodeName = node.data?.label || node.id

    switch (nodeType) {
      case 'agent':
        addLog({
          level: 'info',
          message: `🤖 Agent "${nodeName}" processing request...`,
          nodeId: node.id
        })
        if (node.data?.systemPrompt) {
          addLog({
            level: 'debug',
            message: `💭 System prompt: ${node.data.systemPrompt.substring(0, 50)}...`,
            nodeId: node.id
          })
        }
        break

      case 'llm':
        addLog({
          level: 'info',
          message: `🧠 LLM "${node.data?.model || 'model'}" generating response...`,
          nodeId: node.id
        })
        if (node.data?.temperature !== undefined) {
          addLog({
            level: 'debug',
            message: `🌡️ Temperature: ${node.data.temperature}`,
            nodeId: node.id
          })
        }
        break

      case 'tool':
        addLog({
          level: 'info',
          message: `🔧 Tool "${nodeName}" executing...`,
          nodeId: node.id
        })
        break

      case 'memory':
        addLog({
          level: 'info',
          message: `💾 Memory "${nodeName}" storing/retrieving context...`,
          nodeId: node.id
        })
        break

      case 'output':
        addLog({
          level: 'info',
          message: `📤 Output handler formatting response...`,
          nodeId: node.id
        })
        break
    }
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <PersonIcon />
      case 'assistant':
        return <BotIcon />
      case 'error':
        return <ErrorIcon />
      default:
        return <InfoIcon />
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <ErrorIcon color="error" />
      case 'warning':
        return <WarningIcon color="warning" />
      case 'debug':
        return <DebugIcon color="action" />
      default:
        return <InfoIcon color="info" />
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <Drawer
      anchor="right"
      open={isTestPanelOpen}
      onClose={closeTestPanel}
      PaperProps={{
        sx: {
          width: { xs: '100vw', md: '500px' },
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        p: 2, 
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: 'primary.main',
        color: 'white'
      }}>
        <Typography variant="h6">
          🧪 Agent Test Lab
        </Typography>
        <IconButton 
          onClick={closeTestPanel} 
          size="small"
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Execution Progress */}
      {isExecuting && (
        <Box sx={{ px: 2, pt: 1 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Agent is processing...
          </Typography>
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        variant="fullWidth"
        sx={{ borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab icon={<HistoryIcon />} label="Chat" />
        <Tab icon={<DebugIcon />} label="Logs" />
      </Tabs>

      {/* Chat Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {conversationHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                Start a conversation with your agent
              </Typography>
            </Box>
          ) : (
            conversationHistory.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  mb: 2,
                  flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <Box sx={{ mx: 1 }}>
                  {getMessageIcon(message.type)}
                </Box>
                <Paper
                  sx={{
                    p: 2,
                    maxWidth: '85%',
                    minWidth: '200px',
                    backgroundColor: 
                      message.type === 'user' ? 'primary.main' : 
                      message.type === 'error' ? 'error.light' : 'grey.100',
                    color: 
                      message.type === 'user' ? 'white' :
                      message.type === 'error' ? 'white' : 'text.primary',
                    wordBreak: 'break-word',
                    overflow: 'hidden'
                  }}
                >
                  {/* Show agent name for assistant messages */}
                  {message.type === 'assistant' && message.agentName && (
                    <Chip 
                      label={`Agent: ${message.agentName}`}
                      size="small"
                      sx={{ mb: 1, fontSize: '0.75rem' }}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  
                  {/* Enhanced message content with markdown support */}
                  <Box sx={{ 
                    '& a': { 
                      color: message.type === 'user' ? 'white' : 'primary.main',
                      textDecoration: 'underline',
                      '&:hover': { 
                        textDecoration: 'underline',
                        opacity: 0.8 
                      }
                    },
                    '& code': {
                      backgroundColor: message.type === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                      color: message.type === 'user' ? 'white' : 'text.primary'
                    },
                    '& pre': {
                      backgroundColor: message.type === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      maxWidth: '100%',
                      overflow: 'auto'
                    }
                  }}>
                    <MessageRenderer 
                      content={message.content}
                      variant="body2"
                      darkMode={message.type === 'user'}
                    />
                  </Box>
                  
                  <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 1 }}>
                    {formatTime(message.timestamp)}
                  </Typography>
                </Paper>
              </Box>
            ))
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button
              size="small"
              onClick={clearHistory}
              startIcon={<ClearIcon />}
              disabled={isExecuting}
            >
              Clear
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type your message..."
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              disabled={isExecuting}
            />
            <Button
              variant="contained"
              onClick={() => {
                console.log('🚨 TEST LAB: Send button clicked!')
                handleSendMessage()
              }}
              disabled={isExecuting || !currentInput.trim()}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </TabPanel>

      {/* Logs Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              onClick={clearLogs}
              startIcon={<ClearIcon />}
            >
              Clear Logs
            </Button>
            <Chip 
              label={`${executionLogs.length} logs`}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {executionLogs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No execution logs yet
              </Typography>
            </Box>
          ) : (
            <List dense>
              {executionLogs.map((log) => (
                <ListItem key={log.id} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {getLogIcon(log.level)}
                  </ListItemIcon>
                  <ListItemText
                    primary={log.message}
                    secondary={formatTime(log.timestamp)}
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      sx: { fontFamily: 'monospace' }
                    }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          <div ref={logsEndRef} />
        </Box>
      </TabPanel>
    </Drawer>
  )
}

export default TestPanel