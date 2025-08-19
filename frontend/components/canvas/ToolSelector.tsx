import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Typography,
  Box,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Paper,
  Divider
} from '@mui/material'
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'

interface Tool {
  id: string
  name: string
  display_name: string
  description: string
  category: {
    id: string
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
  examples: Array<{
    input: any
    description?: string
    output?: any
  }>
  is_active: boolean
  is_builtin: boolean
  version: string
  usage_count: number
  success_rate: number
  avg_execution_time_ms?: number
}

interface ToolCategory {
  id: string
  name: string
  description: string
  icon: string
  color: string
  tool_count: number
}

interface ToolSelectorProps {
  open: boolean
  onClose: () => void
  onSelectTool: (tool: Tool) => void
  selectedTools?: string[]
}

const ToolSelector: React.FC<ToolSelectorProps> = ({
  open,
  onClose,
  onSelectTool,
  selectedTools = []
}) => {
  const [categories, setCategories] = useState<ToolCategory[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [filteredTools, setFilteredTools] = useState<Tool[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showOnlyActive, setShowOnlyActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Load categories and tools
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  // Filter tools based on search and category
  useEffect(() => {
    let filtered = tools

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tool => 
        tool.name.toLowerCase().includes(query) ||
        tool.display_name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.category.name.toLowerCase().includes(query)
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(tool => tool.category.id === selectedCategory)
    }

    if (showOnlyActive) {
      filtered = filtered.filter(tool => tool.is_active)
    }

    setFilteredTools(filtered)
  }, [tools, searchQuery, selectedCategory, showOnlyActive])

  const loadData = async () => {
    setLoading(true)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
      
      // Load categories and tools in parallel
      const [categoriesRes, toolsRes] = await Promise.all([
        fetch(`${apiBase}/tools/categories`),
        fetch(`${apiBase}/tools`)
      ])

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        setCategories(categoriesData.categories)
      }

      if (toolsRes.ok) {
        const toolsData = await toolsRes.json()
        setTools(toolsData.tools)
      }
    } catch (error) {
      console.error('Error loading tools:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToolSelect = (tool: Tool) => {
    onSelectTool(tool)
    onClose()
  }

  const handleCategoryFilter = (categoryId: string | null) => {
    setSelectedCategory(categoryId)
    setExpandedCategory(categoryId)
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return '#4CAF50' // Green
    if (rate >= 70) return '#FF9800' // Orange
    return '#F44336' // Red
  }

  const formatExecutionTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '70vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">🔧 Select Tools</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Choose tools to add to your agent's capabilities
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {/* Search and Filters */}
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showOnlyActive}
                    onChange={(e) => setShowOnlyActive(e.target.checked)}
                    size="small"
                  />
                }
                label="Active tools only"
              />
            </Grid>
          </Grid>

          {/* Category Filter */}
          <Box sx={{ mt: 2 }}>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                Categories:
              </Typography>
              <Chip
                label="All"
                onClick={() => handleCategoryFilter(null)}
                variant={selectedCategory === null ? "filled" : "outlined"}
                size="small"
              />
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={`${category.icon} ${category.name}`}
                  onClick={() => handleCategoryFilter(category.id)}
                  variant={selectedCategory === category.id ? "filled" : "outlined"}
                  size="small"
                  sx={{
                    backgroundColor: selectedCategory === category.id ? category.color : undefined,
                    color: selectedCategory === category.id ? 'white' : undefined,
                    '&:hover': {
                      backgroundColor: category.color,
                      color: 'white'
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Tools List */}
        <Box sx={{ height: '50vh', overflow: 'auto' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="200px">
              <Typography>Loading tools...</Typography>
            </Box>
          ) : filteredTools.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="200px">
              <Typography color="text.secondary">
                {searchQuery || selectedCategory ? 'No tools match your criteria' : 'No tools available'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 1 }}>
              {/* Group by category if not filtering by category */}
              {!selectedCategory ? (
                categories.map((category) => {
                  const categoryTools = filteredTools.filter(tool => tool.category.id === category.id)
                  if (categoryTools.length === 0) return null

                  return (
                    <Accordion 
                      key={category.id}
                      expanded={expandedCategory === category.id}
                      onChange={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                      sx={{ mb: 1 }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6">
                            {category.icon} {category.name}
                          </Typography>
                          <Chip 
                            label={categoryTools.length} 
                            size="small" 
                            variant="outlined"
                            sx={{ backgroundColor: category.color, color: 'white' }}
                          />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Grid container spacing={1}>
                          {categoryTools.map((tool) => (
                            <Grid item xs={12} key={tool.id}>
                              <ToolCard
                                tool={tool}
                                isSelected={selectedTools.includes(tool.id)}
                                onSelect={handleToolSelect}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  )
                })
              ) : (
                <Grid container spacing={1} sx={{ p: 1 }}>
                  {filteredTools.map((tool) => (
                    <Grid item xs={12} key={tool.id}>
                      <ToolCard
                        tool={tool}
                        isSelected={selectedTools.includes(tool.id)}
                        onSelect={handleToolSelect}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} available
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

// Tool Card Component
const ToolCard: React.FC<{
  tool: Tool
  isSelected: boolean
  onSelect: (tool: Tool) => void
}> = ({ tool, isSelected, onSelect }) => {
  return (
    <Card 
      variant="outlined"
      sx={{ 
        cursor: 'pointer',
        border: isSelected ? '2px solid #1976d2' : undefined,
        backgroundColor: isSelected ? '#f3f9ff' : undefined,
        '&:hover': {
          backgroundColor: '#f5f5f5',
          transform: 'translateY(-1px)',
          boxShadow: 2
        },
        transition: 'all 0.2s ease-in-out'
      }}
      onClick={() => onSelect(tool)}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                {tool.display_name}
              </Typography>
              {tool.is_builtin && (
                <Chip label="Built-in" size="small" variant="outlined" />
              )}
              {isSelected && (
                <CheckCircleIcon color="primary" fontSize="small" />
              )}
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {tool.description}
            </Typography>

            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Box display="flex" alignItems="center" gap={0.5}>
                <TrendingUpIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {tool.usage_count} uses
                </Typography>
              </Box>
              
              {tool.success_rate > 0 && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CheckCircleIcon 
                    fontSize="small" 
                    sx={{ color: getSuccessRateColor(tool.success_rate) }}
                  />
                  <Typography variant="caption">
                    {tool.success_rate.toFixed(1)}% success
                  </Typography>
                </Box>
              )}

              {tool.avg_execution_time_ms && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <SpeedIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {formatExecutionTime(tool.avg_execution_time_ms)}
                  </Typography>
                </Box>
              )}
            </Box>

            {tool.parameters.length > 0 && (
              <Box mt={1}>
                <Typography variant="caption" color="text.secondary">
                  Parameters: {tool.parameters.map(p => p.name).join(', ')}
                </Typography>
              </Box>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={`Add ${tool.display_name}`}>
              <IconButton size="small" color="primary">
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 90) return '#4CAF50' // Green
  if (rate >= 70) return '#FF9800' // Orange
  return '#F44336' // Red
}

function formatExecutionTime(ms?: number): string {
  if (!ms) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default ToolSelector