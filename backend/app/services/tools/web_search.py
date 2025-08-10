try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@tool(name="web_search", description="Search the web and return short snippets.")
def web_search(query: str):
    # Placeholder implementation. Integrate Bing/SerpAPI/Brave as needed.
    snippets = [
        {"title": "Result 1", "snippet": f"Summary about '{query}' #1", "url": "https://example.com/1"},
        {"title": "Result 2", "snippet": f"Summary about '{query}' #2", "url": "https://example.com/2"},
    ]
    attachments = [
        {"type": "text", "content": f"{s['title']}: {s['snippet']} ({s['url']})"} for s in snippets
    ]
    return {"attachments": attachments}

