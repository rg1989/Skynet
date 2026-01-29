import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { CopyButton } from './CopyButton';

interface MermaidDiagramProps {
  code: string;
}

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#10b981',
    primaryTextColor: '#f1f5f9',
    primaryBorderColor: '#10b981',
    lineColor: '#64748b',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    background: '#1e1e2e',
    mainBkg: '#1e293b',
    nodeBorder: '#10b981',
    clusterBkg: '#1e293b',
    clusterBorder: '#334155',
    titleColor: '#f1f5f9',
    edgeLabelBackground: '#1e293b',
  },
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
});

// Counter for unique IDs
let mermaidIdCounter = 0;

/**
 * Mermaid diagram renderer component
 */
export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const idRef = useRef<string>(`mermaid-${++mermaidIdCounter}`);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        setError(null);
        
        // Clear previous content
        containerRef.current.innerHTML = '';
        
        // Generate unique ID for this render
        const id = `${idRef.current}-${Date.now()}`;
        
        // Render the diagram
        const { svg } = await mermaid.render(id, code);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code]);

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-600/30 bg-slate-800/50">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-700/50 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-slate-400 font-medium">Diagram</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200 transition-colors text-xs"
            title={isExpanded ? 'Hide source' : 'Show source'}
          >
            {isExpanded ? 'Hide Source' : 'View Source'}
          </button>
          <CopyButton text={code} />
        </div>
      </div>
      
      {/* Diagram content */}
      {error ? (
        <div className="p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium text-sm">Unable to render diagram</span>
          </div>
          <p className="text-slate-400 text-xs mb-3">
            The diagram syntax may be invalid. Click "View Source" to see the raw code.
          </p>
          {/* Only show source if user expands it */}
          {isExpanded && (
            <pre className="p-2 bg-slate-900/50 rounded text-xs text-slate-400 overflow-x-auto border border-slate-600/30">
              <code>{code}</code>
            </pre>
          )}
        </div>
      ) : (
        <div 
          ref={containerRef} 
          className="p-4 flex justify-center overflow-x-auto [&_svg]:max-w-full"
        />
      )}
      
      {/* Expandable source code - shown for both success and error states */}
      {isExpanded && !error && (
        <div className="border-t border-slate-600/30 p-3 bg-slate-900/50">
          <pre className="text-xs text-slate-400 overflow-x-auto">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
