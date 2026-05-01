import { memo, useMemo, Component, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface StreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * 检测是否在代码块内部
 */
function isInCodeBlock(text: string): boolean {
  const matches = text.match(/```/g);
  return matches !== null && matches.length % 2 !== 0;
}

/**
 * 流式代码块组件
 */
const StreamingCodeBlock = memo(function StreamingCodeBlock({
  language,
  code,
  isComplete,
}: {
  language: string;
  code: string;
  isComplete: boolean;
}) {
  if (!isComplete) {
    // 流式中的代码块：简单样式 + 光标
    return (
      <div style={{
        background: '#1e1e1e',
        borderRadius: 8,
        margin: '8px 0',
        overflow: 'hidden',
      }}>
        {language && (
          <div style={{
            padding: '4px 12px',
            background: '#2d2d2d',
            fontSize: 11,
            color: '#888',
            borderBottom: '1px solid #333',
          }}>
            {language}
          </div>
        )}
        <pre style={{
          padding: '12px 16px',
          margin: 0,
          overflow: 'auto',
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          <code style={{ color: '#d4d4d4', fontFamily: 'monospace' }}>
            {code}
            <span style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: '#3b82f6',
              marginLeft: 1,
              animation: 'cursor-blink 0.8s ease-in-out infinite',
              verticalAlign: 'text-bottom',
            }} />
          </code>
        </pre>
      </div>
    );
  }

  // 完成的代码块：语法高亮
  return (
    <SyntaxHighlighter
      style={oneDark}
      language={language || 'text'}
      PreTag="div"
      customStyle={{
        borderRadius: 8,
        fontSize: 12,
        margin: '8px 0',
        background: '#1e1e1e',
      }}
    >
      {code.replace(/\n$/, '')}
    </SyntaxHighlighter>
  );
});

/**
 * Markdown 错误边界
 */
class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * 自定义渲染组件 - 处理流式代码块
 */
function createMarkdownComponents(isStreaming: boolean) {
  return {
    code({ className, children, ...props }: any) {
      const codeContent = String(children).replace(/\n$/, '');
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : null;

      // 内联代码
      const isInline = !codeContent.includes('\n') && codeContent.length < 100;
      if (isInline && !language) {
        return (
          <code style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--accent)',
            padding: '1px 5px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'monospace',
          }} {...props}>
            {children}
          </code>
        );
      }

      return (
        <StreamingCodeBlock
          language={language || 'text'}
          code={codeContent}
          isComplete={!isStreaming}
        />
      );
    },
    p({ children }: any) {
      return <p style={{ marginBottom: 8, lineHeight: 1.7 }}>{children}</p>;
    },
    ul({ children }: any) {
      return <ul style={{ marginBottom: 8, paddingLeft: 20 }}>{children}</ul>;
    },
    ol({ children }: any) {
      return <ol style={{ marginBottom: 8, paddingLeft: 20 }}>{children}</ol>;
    },
    li({ children }: any) {
      return <li style={{ marginBottom: 4 }}>{children}</li>;
    },
    h1({ children }: any) {
      return <h1 style={{ fontSize: 20, marginBottom: 12, marginTop: 16 }}>{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 style={{ fontSize: 18, marginBottom: 10, marginTop: 14 }}>{children}</h2>;
    },
    h3({ children }: any) {
      return <h3 style={{ fontSize: 16, marginBottom: 8, marginTop: 12 }}>{children}</h3>;
    },
    blockquote({ children }: any) {
      return (
        <blockquote style={{
          borderLeft: '3px solid var(--accent)',
          paddingLeft: 12,
          margin: '8px 0',
          color: 'var(--text-secondary)',
        }}>
          {children}
        </blockquote>
      );
    },
    table({ children }: any) {
      return (
        <div style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            {children}
          </table>
        </div>
      );
    },
    th({ children }: any) {
      return (
        <th style={{
          border: '1px solid var(--border-primary)',
          padding: '6px 12px',
          background: 'var(--bg-tertiary)',
          textAlign: 'left',
        }}>
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return (
        <td style={{
          border: '1px solid var(--border-primary)',
          padding: '6px 12px',
        }}>
          {children}
        </td>
      );
    },
  };
}

/**
 * 主组件：实时流式 Markdown 渲染
 */
export const StreamingMarkdown = memo(function StreamingMarkdown({
  content,
  isStreaming = false,
}: StreamingMarkdownProps) {
  const inCodeBlock = isInCodeBlock(content);

  // 处理不完整的 Markdown（主要是未闭合的代码块）
  const processedContent = useMemo(() => {
    if (!isStreaming) return content;

    // 如果在代码块内，添加临时闭合让 ReactMarkdown 能解析
    if (inCodeBlock) {
      return content + '\n```';
    }

    return content;
  }, [content, isStreaming, inCodeBlock]);

  // 流式输出时在代码块外显示光标
  const showStreamingCursor = isStreaming && !inCodeBlock;

  return (
    <>
      <MarkdownErrorBoundary
        fallback={<pre style={{ whiteSpace: 'pre-wrap' }}>{content}</pre>}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={createMarkdownComponents(isStreaming && inCodeBlock)}
        >
          {processedContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>

      {/* 流式光标（代码块外） */}
      {showStreamingCursor && (
        <span style={{
          display: 'inline-block',
          width: 2,
          height: '1em',
          background: 'var(--accent)',
          marginLeft: 1,
          animation: 'cursor-blink 0.8s ease-in-out infinite',
          verticalAlign: 'text-bottom',
        }} />
      )}

      {/* CSS 动画 */}
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
});

export default StreamingMarkdown;
