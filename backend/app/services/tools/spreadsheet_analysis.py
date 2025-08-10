try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


@tool(name="spreadsheet_analysis", description="Analyze a spreadsheet file id and return insights.")
def spreadsheet_analysis(file_id: str):
    # Placeholder analytics
    insights = [
        "Total rows: 1,234",
        "Columns: Date, Sales, Region",
        "Top region: West",
    ]
    return {"attachments": [{"type": "text", "content": "\n".join(insights)}]}

