try:
    from openai.agents import tool
except Exception:  # pragma: no cover - fallback if Agents SDK not installed
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

try:
    from azure.search.documents import SearchClient
    from azure.core.credentials import AzureKeyCredential
except Exception:  # pragma: no cover
    SearchClient = None
    AzureKeyCredential = None
from ...config import settings

@tool(name="azure_rag", description="Query Azure Cognitive Search for relevant documents.")
def azure_rag(query: str, index_name: str):
    if not (SearchClient and AzureKeyCredential and settings.AZURE_SEARCH_SERVICE_URL and settings.AZURE_SEARCH_API_KEY):
        return {"attachments": [{"type": "text", "content": "Azure Search not configured"}]}
    try:
        search_client = SearchClient(
            endpoint=settings.AZURE_SEARCH_SERVICE_URL,
            index_name=index_name,
            credential=AzureKeyCredential(settings.AZURE_SEARCH_API_KEY)
        )
        results = search_client.search(query, top=5)
        attachments = []
        for r in results:
            content = None
            try:
                content = r.get("content") if isinstance(r, dict) else r["content"]
            except Exception:
                content = str(r)
            attachments.append({"type": "text", "content": content})
        return {"attachments": attachments}
    except Exception as exc:  # pragma: no cover
        return {"attachments": [{"type": "text", "content": f"RAG error: {exc}"}]}