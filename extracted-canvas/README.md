# React Flow Canvas - Extracted from Flowise

A simplified, reusable flow canvas component extracted from Flowise. This provides a drag-and-drop visual programming interface that can be integrated into any React project.

## Features

- **Drag & Drop Nodes**: Drag nodes from the palette onto the canvas
- **Connect Nodes**: Create connections between nodes by dragging from output to input handles
- **Node Operations**: 
  - Edit node labels inline
  - Duplicate nodes
  - Delete nodes via context menu
- **Edge Operations**: Delete connections with the X button
- **Canvas Controls**:
  - Pan and zoom
  - Mini-map navigation
  - Background grid
  - Fit view
- **Save/Load**:
  - Save to browser local storage
  - Export/Import as JSON files
- **Node Types**: Pre-configured node types (Input, Process, Output, Decision, Data, Function)

## Installation

1. Clone or copy this folder to your project
2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
```

## Integration into Your Project

### Option 1: Copy Components

Copy the following folders to your existing React project:
- `src/components/` - All canvas components
- `src/context/` - Flow context provider

Then install required dependencies:
```bash
npm install reactflow @mui/material @emotion/react @emotion/styled lodash uuid
```

### Option 2: Use as Standalone Module

1. Build the project:
```bash
npm run build
```

2. Import the built files into your project

### Option 3: Customize and Extend

The components are designed to be easily customizable:

1. **Custom Node Types**: Modify `CustomNode.jsx` or create new node components
2. **Custom Edge Types**: Modify `CustomEdge.jsx` for different connection styles
3. **Node Palette**: Edit `NodePalette.jsx` to add your domain-specific nodes
4. **Styling**: Uses Material-UI theming - customize in `App.jsx`

## Core Components

### FlowCanvas
Main canvas component that integrates ReactFlow with custom nodes and edges.

### FlowContext
Context provider that manages:
- Node and edge state
- CRUD operations
- Canvas instance

### CustomNode
Reusable node component with:
- Editable labels
- Type indicators
- Context menu
- Input/output handles

### NodePalette
Draggable node palette with predefined node types.

### CanvasHeader
Toolbar with save/load/export functionality.

## Usage Example

```jsx
import FlowCanvas from './components/FlowCanvas'
import { FlowProvider } from './context/FlowContext'

function App() {
  return (
    <FlowProvider>
      <FlowCanvas />
    </FlowProvider>
  )
}
```

## Customization Guide

### Adding New Node Types

1. Add to `NodePalette.jsx`:
```jsx
const nodeTypes = [
  // ... existing types
  { type: 'custom', label: 'Custom Node', icon: CustomIcon, color: '#color' }
]
```

2. Handle in `CustomNode.jsx`:
```jsx
const getNodeColor = () => {
  switch (data.type) {
    case 'custom':
      return '#yourcolor'
    // ...
  }
}
```

### Connecting to Backend

Add API calls in `FlowContext.jsx`:
```jsx
const saveToBackend = async () => {
  const flowData = { nodes, edges }
  await fetch('/api/flows', {
    method: 'POST',
    body: JSON.stringify(flowData)
  })
}
```

## Dependencies

- **ReactFlow**: Core flow diagram library
- **Material-UI**: UI components and theming
- **Lodash**: Utility functions
- **UUID**: Unique ID generation

## License

This extraction maintains the original Flowise license. See the Flowise repository for details.

## Credits

Based on the Flowise project (https://github.com/FlowiseAI/Flowise)