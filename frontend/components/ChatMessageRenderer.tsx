import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

interface ChatMessageRendererProps {
  content: string
  isUser?: boolean
}

const ChatMessageRenderer: React.FC<ChatMessageRendererProps> = ({ 
  content, 
  isUser = false 
}) => {
  return (
    <div className={`
      ${isUser ? 'text-white' : 'text-gray-900'}
      max-w-none leading-relaxed
    `}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className={`text-xl font-bold mb-2 ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-lg font-bold mb-2 ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-base font-bold mb-2 ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={`text-sm font-bold mb-1 ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </h4>
          ),
          
          // Paragraphs
          p: ({ children }) => (
            <p className={`mb-2 last:mb-0 leading-relaxed ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </p>
          ),
          
          // Links
          a: ({ href, children, ...props }) => (
            <a 
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              className={`
                underline font-medium hover:no-underline transition-all
                ${isUser 
                  ? 'text-blue-100 hover:text-white' 
                  : 'text-blue-600 hover:text-blue-800'
                }
              `}
              {...props}
            >
              {children}
            </a>
          ),
          
          // Code blocks
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            
            if (!inline && match) {
              // Block code with syntax highlighting
              return (
                <div className="my-3 rounded-lg overflow-hidden">
                  <SyntaxHighlighter
                    style={isUser ? oneDark : oneLight}
                    language={match[1]}
                    PreTag="div"
                    className="text-sm"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              )
            }
            
            // Inline code
            return (
              <code 
                className={`
                  px-1 py-0.5 rounded text-sm font-mono
                  ${isUser 
                    ? 'bg-white/20 text-blue-100' 
                    : 'bg-gray-100 text-gray-800'
                  }
                `}
                {...props}
              >
                {children}
              </code>
            )
          },
          
          // Lists
          ul: ({ children }) => (
            <ul className={`list-disc pl-5 mb-2 space-y-1 ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`list-decimal pl-5 mb-2 space-y-1 ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className={`${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </li>
          ),
          
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className={`
              border-l-4 pl-4 my-3 italic
              ${isUser 
                ? 'border-white/40 text-blue-100' 
                : 'border-blue-500 text-gray-700'
              }
            `}>
              {children}
            </blockquote>
          ),
          
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className={`
                min-w-full border-collapse border rounded-lg
                ${isUser 
                  ? 'border-white/30' 
                  : 'border-gray-300'
                }
              `}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`
              border px-3 py-2 font-semibold text-left
              ${isUser 
                ? 'border-white/30 bg-white/10 text-white' 
                : 'border-gray-300 bg-gray-50 text-gray-900'
              }
            `}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`
              border px-3 py-2
              ${isUser 
                ? 'border-white/30 text-white' 
                : 'border-gray-300 text-gray-900'
              }
            `}>
              {children}
            </td>
          ),
          
          // Text formatting
          strong: ({ children }) => (
            <strong className={`font-bold ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </em>
          ),
          
          // Horizontal rule
          hr: () => (
            <hr className={`
              my-4 border-0 h-px
              ${isUser 
                ? 'bg-white/30' 
                : 'bg-gray-300'
              }
            `} />
          ),
          
          // Pre blocks (for non-highlighted code)
          pre: ({ children }) => (
            <pre className={`
              p-3 rounded-lg overflow-x-auto text-sm font-mono my-3
              ${isUser 
                ? 'bg-white/10 text-blue-100' 
                : 'bg-gray-100 text-gray-800'
              }
            `}>
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default ChatMessageRenderer