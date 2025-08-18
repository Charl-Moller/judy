# React Flow Canvas Integration Guide

This document provides instructions for integrating the extracted Flowise canvas component into your existing React application.

## Overview

This is a drag-and-drop visual flow builder extracted from Flowise, providing:
- Node creation via drag-and-drop
- Visual connections between nodes
- Node editing, duplication, and deletion
- Save/load functionality
- JSON import/export

## Prerequisites

Your target application should have:
- React 18.2+ 
- A build system (Vite, Webpack, CRA, etc.)
- Basic React state management understanding

## Integration Steps

### Step 1: Install Required Dependencies

Add these packages to your target application:

```bash
npm install reactflow @mui/material @emotion/react @emotion/styled lodash uuid
```

Or if using yarn:
```bash
yarn add reactflow @mui/material @emotion/react @emotion/styled lodash uuid
```

### Step 2: Copy Core Files

Copy the following directories and files from the extracted-canvas folder to your application's src folder:

```
src/
├── components/
│   ├── FlowCanvas.jsx       # Main canvas component
│   ├── CustomNode.jsx       # Node component
│   ├── CustomEdge.jsx       # Edge/connection component
│   ├── NodePalette.jsx      # Draggable node sidebar
│   └── CanvasHeader.jsx     # Toolbar with save/load
├── context/
│   └── FlowContext.jsx      # State management context
```

### Step 3: Import Required Styles

Add ReactFlow CSS to your main application file (App.js or index.js):

```javascript
import 'reactflow/dist/style.css'
```

### Step 4: Basic Integration

Replace your existing canvas component with the new Flow Canvas:

```javascript
import React from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import FlowCanvas from './components/FlowCanvas'
import { FlowProvider } from './context/FlowContext'

// Optional: Customize Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3b82f6',
    },
    secondary: {
      main: '#8b5cf6',
    },
  },
})

function CanvasPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FlowProvider>
        <FlowCanvas />
      </FlowProvider>
    </ThemeProvider>
  )
}

export default CanvasPage
```

### Step 5: Customization Options

#### A. Custom Node Types

Modify `NodePalette.jsx` to add your domain-specific node types:

```javascript
const nodeTypes = [
  { type: 'yourType', label: 'Your Node', icon: YourIcon, color: '#color' },
  // Add more custom types
]
```

Update `CustomNode.jsx` to handle your custom types:

```javascript
const getNodeColor = () => {
  switch (data.type) {
    case 'yourType':
      return '#yourcolor'
    // Add cases for your types
    default:
      return '#757575'
  }
}
```

#### B. Custom Node Data Structure

Modify the node creation in `FlowCanvas.jsx`:

```javascript
const newNode = {
  id: `node-${Date.now()}`,
  type: 'custom',
  position,
  data: { 
    label: type,
    type: type,
    // Add your custom fields here
    yourField: 'value',
    config: {},
    metadata: {}
  }
}
```

#### C. Backend Integration

Add API calls in `FlowContext.jsx`:

```javascript
// Example: Save flow to backend
const saveToBackend = async () => {
  if (reactFlowInstance) {
    const flowData = {
      nodes: reactFlowInstance.getNodes(),
      edges: reactFlowInstance.getEdges()
    }
    
    try {
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowData)
      })
      return response.json()
    } catch (error) {
      console.error('Save failed:', error)
    }
  }
}

// Add to context value
const value = {
  // ... existing values
  saveToBackend
}
```

#### D. Custom Actions/Callbacks

Add callbacks for node/edge events in `FlowCanvas.jsx`:

```javascript
// In Flow component
const onNodeClick = (event, node) => {
  console.log('Node clicked:', node)
  // Your custom logic
}

const onEdgeClick = (event, edge) => {
  console.log('Edge clicked:', edge)
  // Your custom logic
}

// Add to ReactFlow component
<ReactFlow
  // ... existing props
  onNodeClick={onNodeClick}
  onEdgeClick={onEdgeClick}
  onNodeDoubleClick={handleNodeDoubleClick}
  onEdgeUpdate={handleEdgeUpdate}
>
```

### Step 6: Styling Adjustments

If the canvas needs to fit within existing layout:

```javascript
// Modify FlowCanvas.jsx Box styling
<Box sx={{ 
  width: '100%',  // Instead of 100vw
  height: '600px', // Fixed height or calc()
  display: 'flex', 
  flexDirection: 'column' 
}}>
```

### Step 7: Data Migration

If migrating from an existing canvas solution, create a converter:

```javascript
// Example converter from old format to ReactFlow format
function convertOldFormatToReactFlow(oldData) {
  const nodes = oldData.nodes.map(node => ({
    id: node.id,
    type: 'custom',
    position: { x: node.x, y: node.y },
    data: {
      label: node.name,
      type: node.nodeType,
      // Map other fields
    }
  }))
  
  const edges = oldData.connections.map(conn => ({
    id: `${conn.from}-${conn.to}`,
    source: conn.from,
    target: conn.to,
    type: 'custom'
  }))
  
  return { nodes, edges }
}
```

### Step 8: Advanced Features

#### Add Validation

```javascript
// In FlowCanvas.jsx
const isValidConnection = (connection) => {
  // Add your validation logic
  const sourceNode = nodes.find(n => n.id === connection.source)
  const targetNode = nodes.find(n => n.id === connection.target)
  
  // Example: Prevent certain connections
  if (sourceNode?.data.type === 'output' && targetNode?.data.type === 'input') {
    return false
  }
  
  return true
}

// Add to ReactFlow
<ReactFlow
  // ... existing props
  isValidConnection={isValidConnection}
>
```

#### Add Keyboard Shortcuts

```javascript
// In Flow component
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.key === 'Delete') {
      // Delete selected nodes/edges
      const selectedNodes = nodes.filter(n => n.selected)
      selectedNodes.forEach(n => deleteNode(n.id))
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }
  
  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [nodes])
```

## Common Issues and Solutions

### Issue 1: Canvas doesn't fit container
**Solution**: Adjust the Box sizing in FlowCanvas.jsx to use relative units or calc()

### Issue 2: Nodes disappear after dropping
**Solution**: Ensure ReactFlowProvider wraps the Flow component and state is properly managed

### Issue 3: Custom node types not working
**Solution**: Register node types in both nodeTypes object and NodePalette component

### Issue 4: Save/Load not persisting
**Solution**: Check localStorage permissions or implement backend persistence

## API Reference

### FlowContext Methods

- `reactFlowInstance` - ReactFlow instance for direct manipulation
- `deleteNode(nodeId)` - Remove a node and its connections
- `deleteEdge(edgeId)` - Remove an edge
- `duplicateNode(nodeId)` - Create a copy of a node
- `updateNodeData(nodeId, data)` - Update node data

### Node Data Structure

```javascript
{
  id: string,           // Unique identifier
  type: string,         // Node type (default: 'custom')
  position: {x, y},     // Canvas position
  data: {
    label: string,      // Display label
    type: string,       // Semantic type
    // Add custom fields as needed
  }
}
```

### Edge Data Structure

```javascript
{
  id: string,           // Unique identifier
  source: string,       // Source node ID
  target: string,       // Target node ID
  type: string,         // Edge type (default: 'custom')
}
```

## Testing Integration

1. **Basic Functionality**:
   - Can drag nodes from palette to canvas
   - Can connect nodes
   - Can delete nodes/edges
   - Can save/load flows

2. **Custom Features**:
   - Custom node types appear correctly
   - Data persistence works
   - Callbacks fire properly

3. **Performance**:
   - Test with 50+ nodes
   - Check for smooth dragging/panning
   - Verify no memory leaks

## Support

For issues specific to ReactFlow, see: https://reactflow.dev/docs
For Material-UI components: https://mui.com/material-ui/

## License

This extraction maintains compatibility with the original Flowise license. Ensure compliance when integrating into commercial applications.