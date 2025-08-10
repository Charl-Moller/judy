try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@tool(name="generate_document", description="Generate a Word/PDF document; returns a placeholder URL.")
def generate_document(title: str, content: str):
    return {"attachments": [{"type": "document", "url": "https://placehold.co/word?doc=generated"}]}

