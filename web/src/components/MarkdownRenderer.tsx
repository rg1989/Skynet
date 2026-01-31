import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown renderer with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - Syntax-highlighted code blocks with copy buttons
 * - Mermaid diagrams
 * - Styled headings, lists, blockquotes, etc.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Custom components for rendering markdown elements
  const components: Components = {
    // Code blocks and inline code
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : undefined;
      const codeString = String(children).replace(/\n$/, '');
      
      // Check if this is an inline code (no language and short)
      const isInline = !match && !codeString.includes('\n');
      
      // Check if this is a mermaid diagram
      if (language === 'mermaid') {
        return <MermaidDiagram code={codeString} />;
      }
      
      // Regular code block or inline code
      return (
        <CodeBlock 
          code={codeString} 
          language={language} 
          inline={isInline}
        />
      );
    },
    
    // Headings
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-slate-100 mb-3 mt-4 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold text-slate-100 mb-2 mt-4 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-slate-100 mb-2 mt-3 first:mt-0">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-slate-200 mb-2 mt-3 first:mt-0">{children}</h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-semibold text-slate-200 mb-1 mt-2 first:mt-0">{children}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-medium text-slate-300 mb-1 mt-2 first:mt-0">{children}</h6>
    ),
    
    // Paragraphs
    p: ({ children }) => (
      <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
    ),
    
    // Links
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-violet-400 hover:text-violet-300 underline"
      >
        {children}
      </a>
    ),
    
    // Bold and italic
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-100">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-slate-200">{children}</em>
    ),
    
    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-3 space-y-1 pl-2">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-3 space-y-1 pl-2">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-slate-200">{children}</li>
    ),
    
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-emerald-500/50 pl-4 py-1 my-3 text-slate-300 italic bg-slate-800/30 rounded-r">
        {children}
      </blockquote>
    ),
    
    // Horizontal rule
    hr: () => (
      <hr className="border-slate-600/50 my-4" />
    ),
    
    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-slate-600/50 rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-700/50">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-slate-600/30">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-slate-700/30">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-sm font-semibold text-slate-200 border-b border-slate-600/50">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-sm text-slate-300">{children}</td>
    ),
    
    // Images
    img: ({ src, alt }) => (
      <img 
        src={src} 
        alt={alt || ''} 
        className="max-w-full h-auto rounded-lg my-3"
        loading="lazy"
      />
    ),
    
    // Strikethrough (GFM)
    del: ({ children }) => (
      <del className="text-slate-400 line-through">{children}</del>
    ),
    
    // Pre (wrapper for code blocks - let code component handle it)
    pre: ({ children }) => (
      <>{children}</>
    ),
  };

  return (
    <div className={`markdown-content text-sm text-slate-100 leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
