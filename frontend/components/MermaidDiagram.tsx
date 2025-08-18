import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

interface MermaidDiagramProps {
  chart: string
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log('MermaidDiagram component mounted with chart:', chart)
    
    if (containerRef.current && chart) {
      console.log('Initializing Mermaid...')
      
      try {
        // Initialize mermaid
        mermaid.initialize({
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Arial, sans-serif',
        })
        
        console.log('Mermaid initialized successfully')

        // Clear previous content
        containerRef.current.innerHTML = ''

        // Render the diagram
        mermaid.render(`mermaid-${Date.now()}`, chart).then(({ svg }) => {
          console.log('Mermaid diagram rendered successfully:', svg.substring(0, 100) + '...')
          if (containerRef.current) {
            containerRef.current.innerHTML = svg
          }
        }).catch((error) => {
          console.error('Error rendering Mermaid diagram:', error)
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="text-red-500 text-sm">Error rendering diagram: ${error.message}</div>`
          }
        })
      } catch (error) {
        console.error('Error initializing Mermaid:', error)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="text-red-500 text-sm">Error initializing Mermaid: ${error.message}</div>`
        }
      }
    } else {
      console.log('MermaidDiagram: No container ref or chart content')
    }
  }, [chart])

  return (
    <div className="my-4 p-4 bg-white border rounded-lg shadow-sm">
      <div className="text-xs text-gray-500 mb-2 font-mono">Mermaid Diagram</div>
      <div ref={containerRef} className="flex justify-center" />
      <div className="text-xs text-gray-400 mt-2 font-mono">Chart: {chart.substring(0, 50)}...</div>
    </div>
  )
}
