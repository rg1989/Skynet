import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyButton } from './CopyButton';

interface CodeBlockProps {
  code: string;
  language?: string;
  inline?: boolean;
}

// Map common language aliases
const languageMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};

/**
 * Code block component with syntax highlighting and copy button
 */
export function CodeBlock({ code, language, inline = false }: CodeBlockProps) {
  // Normalize language name
  const normalizedLang = language ? (languageMap[language.toLowerCase()] || language.toLowerCase()) : 'text';
  
  // For inline code, render a simple styled span
  if (inline) {
    return (
      <code className="bg-slate-700/50 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">
        {code}
      </code>
    );
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden">
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between bg-slate-700/80 px-3 py-1.5 text-xs">
        <span className="text-slate-400 font-mono">{normalizedLang}</span>
        <CopyButton text={code} className="opacity-0 group-hover:opacity-100" />
      </div>
      
      {/* Code content */}
      <SyntaxHighlighter
        language={normalizedLang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          background: '#1e1e2e',
          borderRadius: 0,
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
