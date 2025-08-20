"""
Prompt Processing Service

Processes agent system prompts into content-policy-safe summaries for persona router.
"""

import re
from typing import Optional
from openai import AzureOpenAI
from ..config import settings


class PromptProcessor:
    """Service for processing agent system prompts into safe summaries."""
    
    def __init__(self):
        self.client = None
        
        if settings.AZURE_OPENAI_API_KEY and settings.AZURE_OPENAI_API_BASE:
            try:
                self.client = AzureOpenAI(
                    api_key=settings.AZURE_OPENAI_API_KEY,
                    azure_endpoint=settings.AZURE_OPENAI_API_BASE,
                    api_version="2024-02-01"
                )
                print(f"✅ PROMPT PROCESSOR: LLM client initialized successfully")
            except Exception as e:
                print(f"❌ PROMPT PROCESSOR: Failed to initialize Azure OpenAI client: {e}")
        else:
            print(f"⚠️ PROMPT PROCESSOR: Missing environment variables - prompt processing will not be available")
    
    def generate_routing_summary(self, system_prompt: str, agent_name: str = "Agent") -> Optional[str]:
        """
        Generate a content-policy-safe summary of an agent's system prompt for routing decisions.
        
        Args:
            system_prompt: The original system prompt
            agent_name: Name of the agent for context
            
        Returns:
            Content-policy-safe summary or None if processing fails
        """
        if not system_prompt or not system_prompt.strip():
            return f"{agent_name} is a general-purpose AI assistant."
        
        if not self.client:
            print("❌ PROMPT PROCESSOR: No LLM client available for processing")
            return self._fallback_summary_extraction(system_prompt, agent_name)
        
        try:
            # Create a safe processing prompt that focuses on capabilities and domain
            processing_prompt = """You are a system that creates safe, concise summaries of AI agent capabilities for routing decisions.

Your task is to analyze the given agent system prompt and create a brief, content-policy-compliant summary that describes:
1. What domain or area this agent specializes in
2. What types of tasks it can help with
3. What tools or capabilities it might use

Guidelines:
- Keep the summary under 200 words
- Focus on capabilities and specialization, not specific instructions
- Use neutral, professional language
- Avoid repeating any potentially problematic content
- If the prompt contains sensitive content, focus only on the general domain/capability

Respond with ONLY the summary, no additional text or explanation."""

            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": processing_prompt},
                    {"role": "user", "content": f"Agent Name: {agent_name}\n\nSystem Prompt to Summarize:\n{system_prompt}"}
                ],
                max_tokens=300,
                temperature=0.1
            )
            
            summary = response.choices[0].message.content.strip()
            
            # Basic validation - ensure summary is reasonable
            if len(summary) > 500 or len(summary) < 10:
                print(f"⚠️ PROMPT PROCESSOR: Generated summary length unusual ({len(summary)} chars), using fallback")
                return self._fallback_summary_extraction(system_prompt, agent_name)
            
            print(f"✅ PROMPT PROCESSOR: Generated routing summary for '{agent_name}' ({len(summary)} chars)")
            return summary
            
        except Exception as e:
            print(f"❌ PROMPT PROCESSOR: LLM processing failed for '{agent_name}': {e}")
            return self._fallback_summary_extraction(system_prompt, agent_name)
    
    def _fallback_summary_extraction(self, system_prompt: str, agent_name: str) -> str:
        """
        Fallback method to extract safe summary without LLM processing.
        Uses simple text analysis to identify key terms and capabilities.
        """
        try:
            # Clean the prompt
            cleaned_prompt = system_prompt.lower().strip()
            
            # Extract domain/specialty keywords
            domain_keywords = []
            
            # Common domain indicators
            domain_patterns = {
                'servicenow': ['servicenow', 'service now', 'incident', 'ticket', 'itsm'],
                'data': ['data', 'analytics', 'analysis', 'database', 'sql', 'report'],
                'code': ['code', 'programming', 'development', 'coding', 'software'],
                'search': ['search', 'web search', 'google', 'internet', 'browse'],
                'document': ['document', 'pdf', 'word', 'excel', 'file'],
                'image': ['image', 'photo', 'visual', 'picture', 'graphic'],
                'email': ['email', 'mail', 'message', 'communication']
            }
            
            for domain, keywords in domain_patterns.items():
                if any(keyword in cleaned_prompt for keyword in keywords):
                    domain_keywords.append(domain)
            
            # Build summary based on detected domains
            if domain_keywords:
                if 'servicenow' in domain_keywords:
                    summary = f"{agent_name} specializes in ServiceNow ITSM operations, handling incidents, tickets, and service management tasks."
                elif 'data' in domain_keywords:
                    summary = f"{agent_name} specializes in data analysis, database operations, and generating reports from structured information."
                elif 'code' in domain_keywords:
                    summary = f"{agent_name} specializes in software development, code analysis, and programming assistance."
                elif 'search' in domain_keywords:
                    summary = f"{agent_name} specializes in web search and information retrieval from internet sources."
                elif 'document' in domain_keywords:
                    summary = f"{agent_name} specializes in document processing, analysis, and file manipulation tasks."
                elif 'image' in domain_keywords:
                    summary = f"{agent_name} specializes in image analysis, visual content processing, and graphic-related tasks."
                elif 'email' in domain_keywords:
                    summary = f"{agent_name} specializes in email and communication management tasks."
                else:
                    # Multiple domains
                    domains_str = ", ".join(domain_keywords[:3])  # Limit to first 3
                    summary = f"{agent_name} specializes in {domains_str} and related operations."
            else:
                # No specific domain detected - create generic summary
                summary = f"{agent_name} is a specialized AI assistant designed to help with specific tasks and domain expertise."
            
            # Add capability hint from first few words if available
            first_sentence = system_prompt.split('.')[0].strip()
            if len(first_sentence) > 10 and len(first_sentence) < 100:
                # Check if first sentence looks like a safe capability description
                if not any(word in first_sentence.lower() for word in ['you are', 'your role', 'never', 'always']):
                    summary += f" This agent focuses on {first_sentence.lower()}."
            
            print(f"📝 PROMPT PROCESSOR: Generated fallback summary for '{agent_name}' from {len(domain_keywords)} detected domains")
            return summary
            
        except Exception as e:
            print(f"❌ PROMPT PROCESSOR: Fallback processing failed for '{agent_name}': {e}")
            return f"{agent_name} is a specialized AI assistant with domain-specific capabilities."


# Global instance
prompt_processor = PromptProcessor()


def generate_agent_routing_summary(system_prompt: str, agent_name: str = "Agent") -> Optional[str]:
    """
    Convenience function for generating routing summaries.
    
    Args:
        system_prompt: Agent's system prompt
        agent_name: Agent's name for context
        
    Returns:
        Content-policy-safe routing summary
    """
    return prompt_processor.generate_routing_summary(system_prompt, agent_name)