/**
 * Format thought process content by detecting step markers and
 * splitting them into separate lines.
 * 
 * Detects patterns like:
 * - Natural language: "First, let me...", "Now let me...", "Next, I'll..."
 * - Markdown: "**Step 1:**", "## Step", "### Title"
 * - Emojis: "✅ Step 1:", "📋 Summary:", "🔧 Working on..."
 * - Numbered lists: "1. ", "2. ", "1) ", "2) "
 * - Bullet points: "- ", "* "
 * - Double newlines as paragraph breaks
 */
export function formatThoughtProcess(content: string): string[] {
  if (!content || content.trim() === '') {
    return [];
  }

  // First, try to split by double newlines (paragraph breaks)
  // This is the most natural way to separate content
  const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  
  // If we got multiple paragraphs, that's a good split
  if (paragraphs.length > 1) {
    // Further process each paragraph to split by line patterns
    const allSteps: string[] = [];
    for (const para of paragraphs) {
      const subSteps = splitByLinePatterns(para);
      allSteps.push(...subSteps);
    }
    return allSteps.filter(step => step.length > 0);
  }

  // Otherwise, try to split by step markers
  return splitByStepMarkers(content);
}

/**
 * Split content by line-based patterns (markdown, lists, etc.)
 */
function splitByLinePatterns(content: string): string[] {
  // Patterns that indicate a new line/step at the start of a line
  const lineStartPatterns = [
    // Markdown headers
    /^#{1,6}\s+/m,
    // Bold markdown patterns like **Step 1:** or **Title**
    /^\*\*[^*]+\*\*:?\s*/m,
    // Emoji prefixes (common status/step emojis)
    /^[✅✓☑️❌⚠️📋📌🔧⚙️💡🎯📝🚀💬📊🔍👉➡️▶️•●◦◆■□]/m,
    // Numbered lists: "1. ", "2. ", "1) ", "2) "
    /^\d+[.)]\s+/m,
    // Bullet points
    /^[-*•]\s+/m,
  ];

  // Check if content has any line-based patterns
  const lines = content.split('\n');
  
  // If we have multiple lines with patterns, split by lines
  if (lines.length > 1) {
    const steps: string[] = [];
    let currentStep = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if this line starts a new step
      const startsNewStep = lineStartPatterns.some(pattern => pattern.test(trimmedLine));
      
      if (startsNewStep && currentStep) {
        steps.push(currentStep.trim());
        currentStep = trimmedLine;
      } else if (startsNewStep) {
        currentStep = trimmedLine;
      } else if (currentStep) {
        // Continue the current step
        currentStep += ' ' + trimmedLine;
      } else {
        currentStep = trimmedLine;
      }
    }
    
    // Don't forget the last step
    if (currentStep) {
      steps.push(currentStep.trim());
    }
    
    if (steps.length > 1) {
      return steps;
    }
  }

  // No line patterns found, return as single item
  return [content.trim()];
}

/**
 * Split content by natural language step markers
 */
function splitByStepMarkers(content: string): string[] {
  // Step marker patterns that indicate a new thought/step
  // These patterns look for common transitional phrases
  const stepPatterns = [
    /(?:^|\s)(First,?\s+(?:let me|I'll|I will|I need to))/gi,
    /(?:^|\s)(Now,?\s+(?:let me|I'll|I will|I need to))/gi,
    /(?:^|\s)(Next,?\s+(?:let me|I'll|I will|I need to))/gi,
    /(?:^|\s)(Then,?\s+(?:let me|I'll|I will|I need to))/gi,
    /(?:^|\s)(Finally,?\s+(?:let me|I'll|I will|I need to))/gi,
    /(?:^|\s)(Let me\s+(?:check|create|enable|delete|update|look|see|find|get|set|add|remove|verify|confirm))/gi,
    /(?:^|\s)(I'll\s+(?:check|create|enable|delete|update|look|now|first|start|begin))/gi,
    /(?:^|\s)(I can see\s)/gi,
    /(?:^|\s)(I need to\s)/gi,
    /(?:^|\s)(Perfect!?\s)/gi,
    /(?:^|\s)(Great!?\s)/gi,
    /(?:^|\s)(Done!?\s)/gi,
    /(?:^|\s)(Excellent!?\s)/gi,
    /(?:^|\s)(It looks like\s)/gi,
    /(?:^|\s)(I notice\s)/gi,
    /:(?=\s*(?:Now|First|Let me|I'll|Perfect|Great|Next|Then|Finally|Done))/gi,
  ];

  // Find all step marker positions
  const markers: { index: number; match: string }[] = [];
  
  for (const pattern of stepPatterns) {
    let match;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      // Find the actual start of the step phrase (skip leading whitespace/punctuation)
      let startIndex = match.index;
      const matchedText = match[1] || match[0];
      
      // If the match starts with whitespace or colon, adjust
      if (match[0].startsWith(' ') || match[0].startsWith(':')) {
        startIndex++;
      }
      
      markers.push({
        index: startIndex,
        match: matchedText.trim(),
      });
    }
  }

  // Sort markers by position
  markers.sort((a, b) => a.index - b.index);

  // Remove duplicate/overlapping markers (keep the first one at each position)
  const uniqueMarkers = markers.filter((marker, i) => {
    if (i === 0) return true;
    // Skip if too close to previous marker (within 5 chars)
    return marker.index > markers[i - 1].index + 5;
  });

  // If no markers found, return content as single item
  if (uniqueMarkers.length === 0) {
    return [content.trim()];
  }

  // Split content at marker positions
  const steps: string[] = [];
  
  // Add content before first marker if any
  if (uniqueMarkers[0].index > 0) {
    const beforeFirst = content.substring(0, uniqueMarkers[0].index).trim();
    if (beforeFirst) {
      steps.push(beforeFirst);
    }
  }

  // Add each step
  for (let i = 0; i < uniqueMarkers.length; i++) {
    const start = uniqueMarkers[i].index;
    const end = i < uniqueMarkers.length - 1 
      ? uniqueMarkers[i + 1].index 
      : content.length;
    
    const stepContent = content.substring(start, end).trim();
    if (stepContent) {
      steps.push(stepContent);
    }
  }

  // Filter out empty steps and clean up
  return steps
    .map(step => step.trim())
    .filter(step => step.length > 0);
}

/**
 * Check if content appears to be thought process vs final response
 */
export function isThoughtProcess(content: string): boolean {
  const thoughtIndicators = [
    // Natural language step indicators
    /^(First|Now|Next|Then|Finally|Let me|I'll|I need to|I can see|Perfect|Great|Done|Excellent)/i,
    /(checking|enabling|creating|deleting|updating|looking|finding)/i,
    /:\s*(Now|First|Let me)/i,
    // Markdown step patterns
    /^\*\*Step\s+\d+/im,
    /^#{1,3}\s+Step/im,
    // Emoji step patterns
    /^[✅✓☑️📋📌🔧⚙️]\s*\*?\*?Step/im,
    // Workflow indicators
    /^(Workflow|Summary|Ready to test)/im,
  ];
  
  return thoughtIndicators.some(pattern => pattern.test(content));
}
