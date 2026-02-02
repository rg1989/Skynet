"""Streaming sentencizer for chunked TTS processing."""

import re
from typing import Optional


class StreamingSentencizer:
    """Buffers streaming tokens and yields complete sentences for TTS.

    This enables the TTS to start speaking before the LLM has finished
    generating the full response, significantly reducing perceived latency.
    """

    # Sentence-ending punctuation (high priority)
    SENTENCE_ENDINGS = {'.', '!', '?'}

    # Clause-ending punctuation (lower priority, for earlier TTS)
    CLAUSE_ENDINGS = {',', ':', ';', '—', '–'}

    # Patterns that should NOT trigger sentence end (abbreviations, etc.)
    ABBREVIATIONS = {
        'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.',
        'vs.', 'etc.', 'e.g.', 'i.e.', 'no.', 'nos.',
        'st.', 'ave.', 'blvd.', 'rd.', 'apt.', 'dept.',
        'inc.', 'ltd.', 'corp.', 'co.',
        'a.m.', 'p.m.', 'a.d.', 'b.c.',
        'ph.d.', 'm.d.', 'b.a.', 'm.a.',
        'u.s.', 'u.k.', 'u.n.',
    }

    def __init__(
        self,
        min_sentence_length: int = 10,
        min_clause_length: int = 30,
        max_buffer_length: int = 500,
    ):
        """Initialize sentencizer.

        Args:
            min_sentence_length: Minimum characters before yielding a sentence
            min_clause_length: Minimum characters before yielding on clause break
            max_buffer_length: Force yield if buffer exceeds this length
        """
        self.min_sentence_length = min_sentence_length
        self.min_clause_length = min_clause_length
        self.max_buffer_length = max_buffer_length
        self._buffer = ""

    def _is_abbreviation(self, text: str) -> bool:
        """Check if text ends with a common abbreviation."""
        text_lower = text.lower().strip()
        for abbrev in self.ABBREVIATIONS:
            if text_lower.endswith(abbrev):
                return True
        return False

    def _is_sentence_end(self, char: str, buffer: str) -> bool:
        """Check if character ends a sentence in context."""
        if char not in self.SENTENCE_ENDINGS:
            return False

        if self._is_abbreviation(buffer + char):
            return False

        if char == '.' and buffer:
            if buffer[-1].isdigit():
                return False

        return True

    def _find_sentence_boundary(self, text: str) -> Optional[int]:
        """Find the position of the last sentence boundary."""
        for i in range(len(text) - 1, -1, -1):
            if self._is_sentence_end(text[i], text[:i]):
                return i + 1
        return None

    def _find_clause_boundary(self, text: str) -> Optional[int]:
        """Find the position of the last clause boundary."""
        for i in range(len(text) - 1, -1, -1):
            if text[i] in self.CLAUSE_ENDINGS:
                if i + 1 < len(text) and text[i + 1] == ' ':
                    return i + 1
                elif i + 1 == len(text):
                    return i + 1
        return None

    def add_token(self, token: str) -> Optional[str]:
        """Add a token and return complete sentence if available.

        Args:
            token: Token from LLM stream

        Returns:
            Complete sentence if one is ready, None otherwise
        """
        self._buffer += token

        # First priority: Check for sentence boundary
        boundary = self._find_sentence_boundary(self._buffer)

        if boundary and boundary >= self.min_sentence_length:
            sentence = self._buffer[:boundary].strip()
            self._buffer = self._buffer[boundary:].lstrip()
            return sentence

        # Second priority: Check for clause boundary
        if len(self._buffer) >= self.min_clause_length:
            clause_boundary = self._find_clause_boundary(self._buffer)
            if clause_boundary and clause_boundary >= self.min_clause_length:
                clause = self._buffer[:clause_boundary].strip()
                self._buffer = self._buffer[clause_boundary:].lstrip()
                return clause

        # Force yield if buffer is too long
        if len(self._buffer) > self.max_buffer_length:
            last_space = self._buffer.rfind(' ', 0, self.max_buffer_length)
            if last_space > self.min_sentence_length:
                sentence = self._buffer[:last_space].strip()
                self._buffer = self._buffer[last_space:].lstrip()
                return sentence

        return None

    def flush(self) -> Optional[str]:
        """Flush remaining buffer content."""
        if self._buffer.strip():
            sentence = self._buffer.strip()
            self._buffer = ""
            return sentence
        return None

    def reset(self) -> None:
        """Reset the buffer."""
        self._buffer = ""


def split_into_sentences(text: str) -> list[str]:
    """Split text into sentences.

    Args:
        text: Text to split

    Returns:
        List of sentences
    """
    sentence_pattern = r'(?<=[.!?])\s+'
    sentences = re.split(sentence_pattern, text)
    return [s.strip() for s in sentences if s.strip()]
