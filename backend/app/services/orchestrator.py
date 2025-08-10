from ..db.database import SessionLocal
from ..db.models import Agent, File as FileModel, Conversation, Message, AgentPipeline, PipelineRun
from ..config import settings
from openai import AzureOpenAI
try:
    from openai.agents import Assistant
except Exception:  # pragma: no cover
    Assistant = None
from datetime import datetime
import uuid

from .tools.azure_rag import azure_rag
from .tools.web_search import web_search
from .tools.generate_chart import generate_chart
from .tools.doc_understanding import doc_understanding
from .tools.spreadsheet_analysis import spreadsheet_analysis
from .tools.generate_document import generate_document
from .tools.generate_spreadsheet import generate_spreadsheet

capability_map = {
    "rag": azure_rag,
    "chart_generation": generate_chart,
    "web_search": web_search,
    "doc_understanding": doc_understanding,
    "spreadsheet_analysis": spreadsheet_analysis,
    "document_generation": generate_document,
    "spreadsheet_generation": generate_spreadsheet
}

def hybrid_rag_web_search(agent, query):
    rag_att = azure_rag(query, agent.rag_indexes[0].name) if agent.rag_indexes else {"attachments": []}
    web_att = web_search(query)
    attachments = rag_att.get("attachments", []) + web_att.get("attachments", [])
    prompt = f"Internal results: {rag_att}\nExternal results: {web_att}\nUsing these, answer: {query}"
    return {"attachments": attachments, "prompt": prompt}

def execute_single_agent(agent, message, files, prev_output):
    tools = []
    caps = [c.name for c in agent.capabilities]
    if "rag" in caps and "web_search" in caps:
        hybrid = hybrid_rag_web_search(agent, message)
        message = hybrid["prompt"]
        prev_output["attachments"].extend(hybrid["attachments"])
    for cap_name in caps:
        if cap_name in capability_map:
            tools.append(capability_map[cap_name])
    # Fallback path if Assistant SDK is unavailable
    if Assistant is None:
        return {"response": f"[Assistant SDK unavailable] {message}", "attachments": prev_output.get("attachments", []), "tool_calls": []}

    client = AzureOpenAI(api_key=settings.AZURE_OPENAI_API_KEY,
                         azure_endpoint=settings.AZURE_OPENAI_API_BASE,
                         api_version="2024-02-01")
    assistant = Assistant(name=agent.name, model=agent.llm_config.model_name,
                          instructions=f"Agent {agent.name} with capabilities {caps}.", tools=tools)
    messages = [{"role": "system", "content": f"You are agent {agent.name}"}]
    if prev_output.get("response"):
        messages.append({"role": "system", "content": prev_output["response"]})
    messages.append({"role": "user", "content": message or ""})
    result = assistant.chat(messages=messages)
    attachments = prev_output.get("attachments", [])
    for call in getattr(result, "tool_calls", []) or []:
        if isinstance(getattr(call, "result", None), dict):
            attachments.extend(call.result.get("attachments", []))
    return {"response": getattr(result, "output_text", ""), "attachments": attachments, "tool_calls": getattr(result, "tool_calls", [])}

def run_agent(agent_id: str, message: str = None, files: list[str] = None, session_id: str = None):
    db = SessionLocal()
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return {"error": "Agent not found"}
        # Conversation handling
        if session_id:
            convo = db.query(Conversation).filter(Conversation.id == session_id).first()
            if not convo:
                convo = Conversation(id=session_id)
                db.add(convo)
        else:
            convo = Conversation(id=uuid.uuid4())
            db.add(convo)
            session_id = str(convo.id)
        db.commit()
        past_msgs = db.query(Message).filter(Message.conversation_id == convo.id).order_by(Message.created_at).all()
        hist = [{"role": m.role, "content": m.content} for m in past_msgs]
        # Pipeline execution
        steps = [agent] + [db.query(Agent).filter(Agent.id == p.child_agent_id).first()
                           for p in db.query(AgentPipeline).filter(AgentPipeline.parent_agent_id == agent.id).order_by(AgentPipeline.order)]
        output = {"response": message, "attachments": []}
        run_id = uuid.uuid4()
        for step in steps:
            prun = PipelineRun(id=uuid.uuid4(), agent_id=step.id, started_at=datetime.utcnow(), status="running")
            db.add(prun)
            try:
                output = execute_single_agent(step, output["response"], files, output)
                prun.status = "success"
            except Exception as e:
                prun.status = "failed"
                prun.error_message = str(e)
            prun.completed_at = datetime.utcnow()
            db.commit()
        # Save conversation
        db.add(Message(conversation_id=convo.id, role="user", content=message))
        db.add(Message(conversation_id=convo.id, role="assistant", content=output["response"], attachments=output["attachments"]))
        db.commit()
        return {"session_id": session_id, **output}
    finally:
        db.close()