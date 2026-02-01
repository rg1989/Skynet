"""Markdown filter for TTS to make speech sound natural.

Filters out code blocks, mermaid diagrams, and markdown formatting
that shouldn't be read aloud, replacing them with spoken announcements.
"""

import re
from typing import Optional


class TTSMarkdownFilter:
    """Filters markdown from text for natural TTS output.

    Tracks state across sentence chunks to handle multi-line elements
    like code blocks and mermaid diagrams that span multiple sentences.
    """

    def __init__(self):
        """Initialize the filter."""
        self._in_code_block = False
        self._in_mermaid = False
        self._code_block_announced = False
        self._pending_backticks = ""

    def reset(self) -> None:
        """Reset filter state for a new response."""
        self._in_code_block = False
        self._in_mermaid = False
        self._code_block_announced = False
        self._pending_backticks = ""

    def filter_for_tts(self, text: str) -> Optional[str]:
        """Filter markdown from text for TTS.

        Args:
            text: Text chunk to filter (typically a sentence)

        Returns:
            Filtered text ready for TTS, an announcement string,
            or None to skip this chunk entirely
        """
        if not text:
            return None

        # Prepend any pending backticks from previous chunk
        if self._pending_backticks:
            text = self._pending_backticks + text
            self._pending_backticks = ""

        # Handle code block boundaries
        result = self._handle_code_blocks(text)
        if result is None:
            return None

        text = result

        # If we're inside a code block, skip this text
        if self._in_code_block:
            return None

        # Apply inline markdown filtering
        text = self._filter_inline_markdown(text)

        # Clean up and return
        text = text.strip()
        if not text:
            return None

        return text

    def _handle_code_blocks(self, text: str) -> Optional[str]:
        """Handle fenced code block detection and filtering."""
        was_in_code_block = self._in_code_block

        # Check for trailing backticks that might be start of code fence
        if text.endswith('`') and not text.endswith('```'):
            trailing = 0
            for c in reversed(text):
                if c == '`':
                    trailing += 1
                else:
                    break
            if trailing < 3:
                self._pending_backticks = text[-trailing:]
                text = text[:-trailing]

        # Pattern for code fence
        code_fence_pattern = r'```(\w*)'

        parts = []
        last_end = 0
        announcement = None
        found_any_fence = False

        for match in re.finditer(code_fence_pattern, text):
            found_any_fence = True
            fence_start = match.start()
            fence_end = match.end()
            language = match.group(1).lower() if match.group(1) else ""

            if not self._in_code_block:
                if not was_in_code_block:
                    before_text = text[last_end:fence_start].strip()
                    if before_text:
                        parts.append(before_text)

                self._in_code_block = True
                self._in_mermaid = language == "mermaid"

                if not self._code_block_announced:
                    if self._in_mermaid:
                        announcement = "Here's a diagram."
                    else:
                        announcement = "Here's a code snippet."
                    self._code_block_announced = True

            else:
                self._in_code_block = False
                self._in_mermaid = False
                self._code_block_announced = False

            last_end = fence_end

        # Handle remaining text after last fence
        if last_end < len(text):
            remaining = text[last_end:].strip()
            if remaining and not self._in_code_block:
                parts.append(remaining)

        if was_in_code_block and not found_any_fence:
            return None

        if was_in_code_block and found_any_fence and not parts and not announcement:
            return None

        if announcement and not parts:
            return announcement

        if parts:
            result = " ".join(parts)
            if announcement:
                return f"{announcement} {result}"
            return result

        if self._in_code_block:
            return None

        return text

    def _filter_inline_markdown(self, text: str) -> str:
        """Remove inline markdown formatting for natural speech."""
        # Skip images entirely
        text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'Here is an image: \1.', text)

        # Convert links to just their text
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

        # Remove inline code backticks but keep the content
        text = re.sub(r'(?<!`)`(?!`)([^`]+)`(?!`)', r'\1', text)

        # Remove bold markers
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)

        # Remove italic markers
        text = re.sub(r'(?<!\w)\*([^*]+)\*(?!\w)', r'\1', text)
        text = re.sub(r'(?<!\w)_([^_]+)_(?!\w)', r'\1', text)

        # Remove strikethrough
        text = re.sub(r'~~([^~]+)~~', r'\1', text)

        # Remove heading markers
        text = re.sub(r'^#{1,6}\s+', '', text)
        text = re.sub(r'\n#{1,6}\s+', '\n', text)

        # Remove bullet point markers
        text = re.sub(r'^[\-\*\+]\s+', '', text)
        text = re.sub(r'\n[\-\*\+]\s+', '\n', text)

        # Remove numbered list markers
        text = re.sub(r'^\d+\.\s+', '', text)
        text = re.sub(r'\n\d+\.\s+', '\n', text)

        # Remove blockquote markers
        text = re.sub(r'^>\s*', '', text)
        text = re.sub(r'\n>\s*', '\n', text)

        # Remove horizontal rules
        text = re.sub(r'^[\-\*_]{3,}\s*$', '', text, flags=re.MULTILINE)

        # Clean up multiple spaces and newlines
        text = re.sub(r'\s+', ' ', text)

        return text.strip()
