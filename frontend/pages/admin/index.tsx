import Link from 'next/link'

export default function AdminHome() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <AdminCard title="AI Workflows" href="/admin/workflows" description="Visual workflow editor for AI agent orchestration"/>
        <AdminCard title="Relationship Dashboard" href="/admin/relationships" description="Visualize and manage orchestrator, agents, LLMs, and tools connections"/>
        <AdminCard title="Orchestrator" href="/admin/orchestrator" description="Intelligent routing and coordination system"/>
        <AdminCard title="Agents" href="/admin/agents" description="Create and manage agents"/>
        <AdminCard title="LLM Configs" href="/admin/llm-configs" description="Model settings"/>
        <AdminCard title="Capabilities" href="/admin/capabilities" description="Tools available to agents"/>
        <AdminCard title="RAG Indexes" href="/admin/rag-indexes" description="Azure Cognitive Search indexes"/>
        <AdminCard title="Files" href="/admin/files" description="Upload and manage files"/>
      </div>
    </div>
  )
}

function AdminCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="card p-4 hover:shadow-md transition-shadow">
      <div className="font-medium">{title}</div>
      <div className="text-sm text-gray-600">{description}</div>
    </Link>
  )
}

