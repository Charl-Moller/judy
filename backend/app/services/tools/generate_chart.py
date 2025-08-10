try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@tool(name="generate_chart", description="Generate a simple chart; returns a placeholder image URL.")
def generate_chart(data_description: str):
    # Placeholder chart generation. Integrate chart service later.
    return {"attachments": [{"type": "image", "url": "https://placehold.co/600x400?text=Chart"}]}

