try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

import re
import json
from typing import List, Dict, Any
from collections import Counter


@tool(name="extract_text_patterns", description="Extract patterns from text using regular expressions.")
def extract_text_patterns(text: str, pattern: str, flags: str = ""):
    """Extract text patterns using regex."""
    try:
        # Convert flags string to regex flags
        regex_flags = 0
        if 'i' in flags.lower():
            regex_flags |= re.IGNORECASE
        if 'm' in flags.lower():
            regex_flags |= re.MULTILINE
        if 's' in flags.lower():
            regex_flags |= re.DOTALL
        
        matches = re.findall(pattern, text, regex_flags)
        
        return {
            "matches": matches,
            "count": len(matches),
            "pattern": pattern,
            "attachments": [
                {"type": "text", "content": f"Found {len(matches)} matches for pattern '{pattern}':\n" + 
                 "\n".join([f"- {match}" for match in matches[:10]])}
            ]
        }
    except re.error as e:
        return {"error": f"Invalid regex pattern: {str(e)}"}
    except Exception as e:
        return {"error": f"Error extracting patterns: {str(e)}"}


@tool(name="replace_text_patterns", description="Replace text patterns using regular expressions.")
def replace_text_patterns(text: str, pattern: str, replacement: str, flags: str = ""):
    """Replace text patterns using regex."""
    try:
        # Convert flags string to regex flags
        regex_flags = 0
        if 'i' in flags.lower():
            regex_flags |= re.IGNORECASE
        if 'm' in flags.lower():
            regex_flags |= re.MULTILINE
        if 's' in flags.lower():
            regex_flags |= re.DOTALL
        
        # Count matches before replacement
        matches = re.findall(pattern, text, regex_flags)
        
        # Perform replacement
        result_text = re.sub(pattern, replacement, text, flags=regex_flags)
        
        return {
            "result": result_text,
            "replacements_made": len(matches),
            "pattern": pattern,
            "replacement": replacement,
            "attachments": [
                {"type": "text", "content": f"Made {len(matches)} replacements for pattern '{pattern}' with '{replacement}'"}
            ]
        }
    except re.error as e:
        return {"error": f"Invalid regex pattern: {str(e)}"}
    except Exception as e:
        return {"error": f"Error replacing patterns: {str(e)}"}


@tool(name="split_text", description="Split text into chunks based on delimiters or patterns.")
def split_text(text: str, delimiter: str = "\n", max_length: int = None):
    """Split text into chunks."""
    try:
        if delimiter == "\\n":
            delimiter = "\n"
        elif delimiter == "\\t":
            delimiter = "\t"
        
        # Split by delimiter
        chunks = text.split(delimiter)
        
        # If max_length specified, further split long chunks
        if max_length:
            final_chunks = []
            for chunk in chunks:
                if len(chunk) <= max_length:
                    final_chunks.append(chunk)
                else:
                    # Split long chunks into smaller pieces
                    for i in range(0, len(chunk), max_length):
                        final_chunks.append(chunk[i:i + max_length])
            chunks = final_chunks
        
        # Remove empty chunks
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
        
        return {
            "chunks": chunks,
            "count": len(chunks),
            "total_length": sum(len(chunk) for chunk in chunks),
            "attachments": [
                {"type": "text", "content": f"Split text into {len(chunks)} chunks using delimiter '{delimiter}'" + 
                 (f" with max length {max_length}" if max_length else "")}
            ]
        }
    except Exception as e:
        return {"error": f"Error splitting text: {str(e)}"}


@tool(name="analyze_text_stats", description="Analyze text and provide statistics like word count, character count, etc.")
def analyze_text_stats(text: str):
    """Analyze text and return various statistics."""
    try:
        # Basic counts
        char_count = len(text)
        char_count_no_spaces = len(text.replace(" ", ""))
        word_count = len(text.split())
        line_count = len(text.split("\n"))
        paragraph_count = len([p for p in text.split("\n\n") if p.strip()])
        
        # Sentence count (rough estimate)
        sentence_count = len(re.findall(r'[.!?]+', text))
        
        # Word frequency analysis
        words = re.findall(r'\b\w+\b', text.lower())
        word_freq = Counter(words)
        most_common = word_freq.most_common(10)
        
        # Average word length
        avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
        
        # Reading time estimate (average 200 words per minute)
        reading_time_minutes = word_count / 200
        
        return {
            "character_count": char_count,
            "character_count_no_spaces": char_count_no_spaces,
            "word_count": word_count,
            "line_count": line_count,
            "paragraph_count": paragraph_count,
            "sentence_count": sentence_count,
            "unique_words": len(word_freq),
            "most_common_words": most_common,
            "average_word_length": round(avg_word_length, 2),
            "estimated_reading_time_minutes": round(reading_time_minutes, 2),
            "attachments": [
                {"type": "text", "content": f"Text Analysis:\n- {word_count} words, {char_count} characters\n- {sentence_count} sentences, {paragraph_count} paragraphs\n- {len(word_freq)} unique words\n- ~{round(reading_time_minutes, 1)} minutes reading time\n\nMost common words: {', '.join([f'{word}({count})' for word, count in most_common[:5]])}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error analyzing text: {str(e)}"}


@tool(name="extract_emails", description="Extract email addresses from text.")
def extract_emails(text: str):
    """Extract email addresses from text."""
    try:
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        
        # Remove duplicates while preserving order
        unique_emails = list(dict.fromkeys(emails))
        
        return {
            "emails": unique_emails,
            "count": len(unique_emails),
            "total_found": len(emails),
            "attachments": [
                {"type": "text", "content": f"Found {len(unique_emails)} unique email addresses:\n" + 
                 "\n".join([f"- {email}" for email in unique_emails[:10]])}
            ]
        }
    except Exception as e:
        return {"error": f"Error extracting emails: {str(e)}"}


@tool(name="extract_urls", description="Extract URLs from text.")
def extract_urls(text: str):
    """Extract URLs from text."""
    try:
        url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        urls = re.findall(url_pattern, text)
        
        # Also look for www. URLs
        www_pattern = r'www\.(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        www_urls = re.findall(www_pattern, text)
        
        all_urls = urls + www_urls
        unique_urls = list(dict.fromkeys(all_urls))
        
        return {
            "urls": unique_urls,
            "count": len(unique_urls),
            "total_found": len(all_urls),
            "attachments": [
                {"type": "text", "content": f"Found {len(unique_urls)} unique URLs:\n" + 
                 "\n".join([f"- {url}" for url in unique_urls[:10]])}
            ]
        }
    except Exception as e:
        return {"error": f"Error extracting URLs: {str(e)}"}


@tool(name="clean_text", description="Clean and normalize text by removing extra whitespace, special characters, etc.")
def clean_text(text: str, remove_extra_whitespace: bool = True, remove_special_chars: bool = False, 
               normalize_case: str = "none"):
    """Clean and normalize text."""
    try:
        result = text
        
        if remove_extra_whitespace:
            # Remove extra whitespace
            result = re.sub(r'\s+', ' ', result)
            result = result.strip()
        
        if remove_special_chars:
            # Remove special characters, keep alphanumeric and basic punctuation
            result = re.sub(r'[^\w\s.,!?;:()\-"]', '', result)
        
        if normalize_case == "lower":
            result = result.lower()
        elif normalize_case == "upper":
            result = result.upper()
        elif normalize_case == "title":
            result = result.title()
        
        return {
            "cleaned_text": result,
            "original_length": len(text),
            "cleaned_length": len(result),
            "changes_made": {
                "whitespace_normalized": remove_extra_whitespace,
                "special_chars_removed": remove_special_chars,
                "case_normalized": normalize_case
            },
            "attachments": [
                {"type": "text", "content": f"Cleaned text (length: {len(text)} → {len(result)}):\n{result[:200]}..."}
            ]
        }
    except Exception as e:
        return {"error": f"Error cleaning text: {str(e)}"}