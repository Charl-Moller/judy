import React from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import FlowCanvas from './components/FlowCanvas'
import { FlowProvider } from './context/FlowContext'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3b82f6',
    },
    secondary: {
      main: '#8b5cf6',
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FlowProvider>
        <FlowCanvas />
      </FlowProvider>
    </ThemeProvider>
  )
}

export default App