import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={`markdown-renderer ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ borderRadius: 8, fontSize: 12, margin: '8px 0' }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--accent)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace',
              }} {...props}>
                {children}
              </code>
            )
          },
          p({ children }) {
            return <p style={{ marginBottom: 8, lineHeight: 1.7 }}>{children}</p>
          },
          ul({ children }) {
            return <ul style={{ paddingLeft: 20, marginBottom: 8 }}>{children}</ul>
          },
          ol({ children }) {
            return <ol style={{ paddingLeft: 20, marginBottom: 8 }}>{children}</ol>
          },
          li({ children }) {
            return <li style={{ lineHeight: 1.6, marginBottom: 2 }}>{children}</li>
          },
          h1({ children }) {
            return <h1 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 10px', color: 'var(--text-primary)' }}>{children}</h1>
          },
          h2({ children }) {
            return <h2 style={{ fontSize: 16, fontWeight: 600, margin: '14px 0 8px', color: 'var(--text-primary)' }}>{children}</h2>
          },
          h3({ children }) {
            return <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px', color: 'var(--text-primary)' }}>{children}</h3>
          },
          table({ children }) {
            return (
              <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}>
                  {children}
                </table>
              </div>
            )
          },
          thead({ children }) {
            return <thead style={{ background: 'var(--bg-secondary)' }}>{children}</thead>
          },
          th({ children }) {
            return <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{children}</th>
          },
          td({ children }) {
            return <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>{children}</td>
          },
          a({ href, children }) {
            return <a href={href} style={{ color: 'var(--accent)', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">{children}</a>
          },
          blockquote({ children }) {
            return <blockquote style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: '10px 0', color: 'var(--text-secondary)' }}>{children}</blockquote>
          },
          hr() {
            return <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
