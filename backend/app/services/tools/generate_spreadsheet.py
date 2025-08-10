try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@tool(name="generate_spreadsheet", description="Generate an Excel spreadsheet; returns a placeholder URL.")
def generate_spreadsheet(title: str, rows: int = 10):
    return {"attachments": [{"type": "document", "url": "https://placehold.co/excel?sheet=generated"}]}

