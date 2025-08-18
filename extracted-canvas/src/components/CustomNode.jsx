import React, { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  TextField,
  Chip
} from '@mui/material'
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import { useFlow } from '../context/FlowContext'

const CustomNode = ({ data, selected, id }) => {
  const { deleteNode, duplicateNode, updateNodeData } = useFlow()
  const [anchorEl, setAnchorEl] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(data.label)

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = () => {
    deleteNode(id)
    handleMenuClose()
  }

  const handleDuplicate = () => {
    duplicateNode(id)
    handleMenuClose()
  }

  const handleEdit = () => {
    setIsEditing(true)
    handleMenuClose()
  }

  const handleSaveEdit = () => {
    updateNodeData(id, { label: editLabel })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditLabel(data.label)
    setIsEditing(false)
  }

  const getNodeColor = () => {
    switch (data.type) {
      case 'input':
        return '#4caf50'
      case 'process':
        return '#2196f3'
      case 'output':
        return '#ff9800'
      case 'decision':
        return '#9c27b0'
      default:
        return '#757575'
    }
  }

  return (
    <Paper
      elevation={selected ? 8 : 3}
      sx={{
        padding: 2,
        borderRadius: 2,
        minWidth: 200,
        border: selected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
        backgroundColor: 'white',
        position: 'relative'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#555',
          width: 10,
          height: 10
        }}
      />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Chip
          label={data.type || 'node'}
          size="small"
          sx={{
            backgroundColor: getNodeColor(),
            color: 'white',
            fontSize: '0.7rem'
          }}
        />
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{ ml: 'auto' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {isEditing ? (
        <Box>
          <TextField
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
            }}
          />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <button onClick={handleSaveEdit}>Save</button>
            <button onClick={handleCancelEdit}>Cancel</button>
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {data.label}
        </Typography>
      )}

      {data.description && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          {data.description}
        </Typography>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#555',
          width: 10,
          height: 10
        }}
      />
    </Paper>
  )
}

export default memo(CustomNode)