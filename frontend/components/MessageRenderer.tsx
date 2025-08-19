import React from 'react'
import { Box, Typography, Link } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

interface MessageRendererProps {
  content: string
  variant?: 'body1' | 'body2'
  darkMode?: boolean
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  content, 
  variant = 'body2',
  darkMode = false 
}) => {
  return (
    <Box sx={{ 
      '& p': { margin: 0, marginBottom: 1 },
      '& p:last-child': { marginBottom: 0 },
      '& pre': { 
        backgroundColor: darkMode ? '#1e1e1e' : '#f5f5f5',
        padding: 1.5,
        borderRadius: 1,
        overflowX: 'auto',
        fontSize: '0.875rem'
      },
      '& code': {
        backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
        padding: '0.125rem 0.25rem',
        borderRadius: '0.25rem',
        fontSize: '0.875em',
        fontFamily: 'Monaco, Menlo, "Roboto Mono", monospace'
      },
      '& pre code': {
        backgroundColor: 'transparent',
        padding: 0
      },
      '& a': {
        color: 'primary.main',
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline'
        }
      },
      '& ul, & ol': {
        paddingLeft: 2,
        marginBottom: 1
      },
      '& li': {
        marginBottom: 0.5
      },
      '& blockquote': {
        borderLeft: '4px solid',
        borderColor: 'primary.main',
        paddingLeft: 2,
        marginLeft: 0,
        marginRight: 0,
        fontStyle: 'italic'
      },
      '& table': {
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: 1
      },
      '& th, & td': {
        border: '1px solid #ddd',
        padding: '8px',
        textAlign: 'left'
      },
      '& th': {
        backgroundColor: darkMode ? '#2d2d2d' : '#f5f5f5',
        fontWeight: 'bold'
      },
      wordBreak: 'break-word',
      wordWrap: 'break-word',
      overflowWrap: 'break-word'
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom link component to handle external links
          a: ({ href, children, ...props }) => (
            <Link 
              href={href} 
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </Link>
          ),
          // Custom code block component with syntax highlighting
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={darkMode ? oneDark : oneLight}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // Custom paragraph component for proper text wrapping
          p: ({ children }) => (
            <Typography 
              variant={variant} 
              component="p" 
              sx={{ 
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                marginBottom: 1,
                '&:last-child': { marginBottom: 0 }
              }}
            >
              {children}
            </Typography>
          ),
          // Handle other text elements
          h1: ({ children }) => <Typography variant="h5" component="h1" sx={{ marginBottom: 1, fontWeight: 'bold' }}>{children}</Typography>,
          h2: ({ children }) => <Typography variant="h6" component="h2" sx={{ marginBottom: 1, fontWeight: 'bold' }}>{children}</Typography>,
          h3: ({ children }) => <Typography variant="subtitle1" component="h3" sx={{ marginBottom: 1, fontWeight: 'bold' }}>{children}</Typography>,
          h4: ({ children }) => <Typography variant="subtitle2" component="h4" sx={{ marginBottom: 1, fontWeight: 'bold' }}>{children}</Typography>,
          strong: ({ children }) => <Typography component="strong" sx={{ fontWeight: 'bold' }}>{children}</Typography>,
          em: ({ children }) => <Typography component="em" sx={{ fontStyle: 'italic' }}>{children}</Typography>,
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  )
}

export default MessageRenderer