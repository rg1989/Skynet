import { memo, useState } from 'react';
import type { Message } from '../store';
import { formatThoughtProcess } from '../utils/formatThoughtProcess';

interface ChatMessageProps {
  message: Message;
}

// Copy icon
function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

// Check icon for copy confirmation
function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// User avatar icon
function UserAvatar() {
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

// AI/Bot avatar icon (robot)
function BotAvatar() {
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {/* Robot head */}
        <rect x="5" y="8" width="14" height="10" rx="2" strokeWidth={1.5} />
        {/* Antenna */}
        <line x1="12" y1="8" x2="12" y2="5" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx="12" cy="4" r="1" fill="currentColor" />
        {/* Eyes */}
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <circle cx="15" cy="12" r="1.5" fill="currentColor" />
        {/* Mouth */}
        <line x1="9" y1="15" x2="15" y2="15" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Tool icon for tool call messages
function ToolIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Format time
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Check if content contains a tool call
function hasToolCallSyntax(content: string): boolean {
  const trimmed = content.trim();
  // Check for {"tool": "..."} format
  if (trimmed.match(/^\s*\{[\s\S]*"tool"\s*:\s*"[^"]+"/)) return true;
  // Check for {"name": "..."} format (common Ollama pattern)
  if (trimmed.match(/^\s*\{[\s\S]*"name"\s*:\s*"[^"]+"/)) return true;
  // Check for <tool_call> tags
  if (trimmed.includes('<tool_call>') && trimmed.includes('</tool_call>')) return true;
  // Check for markdown code blocks with tool calls
  if (trimmed.match(/```(?:json)?\s*\{[\s\S]*"tool"\s*:/)) return true;
  return false;
}

// Extract tool name from content
function getToolName(content: string): string | null {
  // Try "tool" format first
  const toolMatch = content.match(/"tool"\s*:\s*"([^"]+)"/);
  if (toolMatch) return toolMatch[1];
  // Try "name" format (Ollama pattern)
  const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
  if (nameMatch) return nameMatch[1];
  return null;
}

// Try to extract actual text from a tool call JSON (for "speak" type tools)
function extractTextFromToolCall(content: string): string | null {
  const trimmed = content.trim();
  
  // Check if it's a JSON tool call
  if (!trimmed.startsWith('{') || (!trimmed.includes('"name"') && !trimmed.includes('"tool"'))) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    
    // Check for common tool call patterns with text content
    if ((parsed.name || parsed.tool) && parsed.arguments) {
      // Look for text/content in arguments (speak, say, respond, etc.)
      const textContent = parsed.arguments.text 
        || parsed.arguments.content 
        || parsed.arguments.message
        || parsed.arguments.response;
      
      if (typeof textContent === 'string') {
        return textContent;
      }
    }
  } catch {
    // Not valid JSON
  }

  return null;
}

// Render text with clickable links
function TextWithLinks({ text, className }: { text: string; className?: string }) {
  const urlPattern = /(https?:\/\/[^\s<>"\]]+)/g;
  const parts = text.split(urlPattern);
  
  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (part.match(urlPattern)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline break-all"
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

// Thought process box - displays the steps the AI took
function ThoughtProcessBox({ content }: { content: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const steps = formatThoughtProcess(content);
  
  if (steps.length === 0) return null;
  
  return (
    <div className="mb-3">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors mb-2"
      >
        <svg 
          className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">Thought Process</span>
        <span className="text-slate-500">({steps.length} step{steps.length !== 1 ? 's' : ''})</span>
      </button>
      
      {!isCollapsed && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-600/30 p-3 text-xs">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className="text-slate-400 leading-relaxed py-1.5 border-b border-slate-700/50 last:border-b-0"
            >
              <span className="text-emerald-500/70 mr-2 font-medium">{index + 1}.</span>
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check if this is a tool call message and try to extract text
  const isRawToolCall = !isUser && !isSystem && hasToolCallSyntax(message.content);
  const extractedText = isRawToolCall ? extractTextFromToolCall(message.content) : null;
  
  // If we extracted text from a tool call (like "speak"), display the text instead
  const displayContent = extractedText || message.content;
  const isToolCall = isRawToolCall && !extractedText; // Only show as tool call if no text extracted
  
  // Check if there are active tool calls
  const hasActiveTools = message.toolCalls && message.toolCalls.length > 0;

  return (
    <div className={`group flex gap-3 mb-5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isSystem && (isUser ? <UserAvatar /> : <BotAvatar />)}

      {/* Message bubble */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-slate-800/90 text-slate-100 rounded-tr-md border border-violet-500/30 shadow-lg shadow-violet-500/10'
              : isSystem
                ? 'bg-amber-900/30 text-amber-200 rounded-md border border-amber-500/30'
                : isToolCall
                  ? 'bg-[#2a2d32] text-slate-100 rounded-tl-md border border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'bg-[#2a2d32] text-slate-100 rounded-tl-md border border-emerald-500/20 shadow-lg shadow-emerald-500/10'
          }`}
        >
          {/* Thought process section - shown for assistant messages with thought process */}
          {!isUser && !isSystem && message.thoughtProcess && (
            <ThoughtProcessBox content={message.thoughtProcess} />
          )}
          
          {isToolCall ? (
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                <ToolIcon />
                <span>Using tool: {getToolName(message.content) || 'unknown'}()</span>
              </div>
            </div>
          ) : (
            <TextWithLinks text={displayContent} className="text-sm leading-relaxed whitespace-pre-wrap" />
          )}
          
          {/* Active tool calls */}
          {hasActiveTools && (
            <div className="mt-2 space-y-1">
              {message.toolCalls!.map((tool, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-400">
                  {tool.status === 'running' ? (
                    <span className="animate-spin">⚙️</span>
                  ) : (
                    <span>✅</span>
                  )}
                  <span>{tool.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Timestamp and copy button */}
        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <p className={`text-xs ${isUser ? 'text-slate-400' : 'text-slate-500'}`}>
            {formatTime(message.timestamp)}
          </p>
          <button
            onClick={handleCopy}
            className={`opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300 cursor-pointer ${
              copied ? 'opacity-100' : ''
            }`}
            title="Copy message"
          >
            {copied ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckIcon />
              </span>
            ) : (
              <CopyIcon />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
