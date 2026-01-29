import { CodeBlock } from './CodeBlock';
import { MermaidDiagram } from './MermaidDiagram';

interface StreamingCodeBlockProps {
  language: string;
  code: string;
  isComplete: boolean;
}

/**
 * Loading spinner component for streaming code blocks
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center gap-1">
      <span 
        className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-thinking-dot"
        style={{ animationDelay: '0ms' }}
      />
      <span 
        className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-thinking-dot"
        style={{ animationDelay: '150ms' }}
      />
      <span 
        className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-thinking-dot"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

/**
 * Get a user-friendly label for the code block type
 */
function getBlockTypeLabel(language: string): string {
  const labels: Record<string, string> = {
    mermaid: 'diagram',
    python: 'Python code',
    javascript: 'JavaScript code',
    typescript: 'TypeScript code',
    tsx: 'React component',
    jsx: 'React component',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    bash: 'shell script',
    sh: 'shell script',
    shell: 'shell script',
    sql: 'SQL query',
    markdown: 'markdown',
    md: 'markdown',
  };
  
  return labels[language.toLowerCase()] || (language ? `${language} code` : 'code');
}

/**
 * Get an icon for the code block type
 */
function getBlockIcon(language: string) {
  if (language === 'mermaid') {
    // Chart/diagram icon
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  
  // Code icon for all other languages
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

/**
 * StreamingCodeBlock - Displays a placeholder while code/diagram is being generated,
 * then renders the final result when complete.
 */
export function StreamingCodeBlock({ language, code, isComplete }: StreamingCodeBlockProps) {
  // Show loading placeholder for incomplete blocks
  if (!isComplete) {
    const label = getBlockTypeLabel(language);
    
    return (
      <div className="my-3 rounded-lg overflow-hidden border border-slate-600/30 bg-slate-800/50">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-700/50 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            {getBlockIcon(language)}
            <span className="text-slate-400 font-medium capitalize">
              {language || 'Code'}
            </span>
          </div>
        </div>
        
        {/* Loading content */}
        <div className="p-4 flex items-center gap-3">
          <LoadingSpinner />
          <span className="text-slate-400 text-sm">
            Generating {label}...
          </span>
        </div>
      </div>
    );
  }
  
  // Render complete blocks
  if (language.toLowerCase() === 'mermaid') {
    return <MermaidDiagram code={code} />;
  }
  
  return <CodeBlock code={code} language={language} />;
}
