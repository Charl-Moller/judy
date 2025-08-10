try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@tool(name="doc_understanding", description="Extract key info from a document file id.")
def doc_understanding(file_id: str):
    # Placeholder: In real impl, fetch file and run OCR/LLM
    summary = f"Extracted summary for file {file_id}"
    return {"attachments": [{"type": "text", "content": summary}]}

