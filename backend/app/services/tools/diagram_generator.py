try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

import json
import re

@tool(name="diagram_generator", description="Generate diagrams and charts using Mermaid syntax. Supports flowcharts, sequence diagrams, class diagrams, ER diagrams, and more.")
def diagram_generator(diagram_type: str, description: str, data: str = None, custom_syntax: str = None):
    """
    Generate diagrams and charts using Mermaid syntax.
    
    Args:
        diagram_type: Type of diagram to generate (flowchart, sequence, class, er, gantt, pie, etc.)
        description: Description of what the diagram should show
        data: Optional structured data to include in the diagram
        custom_syntax: Optional custom Mermaid syntax if provided
    
    Returns:
        Dictionary containing the Mermaid syntax and rendering information
    """
    try:
        # If custom syntax is provided, validate and use it
        if custom_syntax:
            # Basic validation that it starts with the diagram type
            if not custom_syntax.strip().startswith(diagram_type):
                return {
                    "success": False,
                    "error": f"Custom syntax must start with '{diagram_type}' for diagram type '{diagram_type}'"
                }
            
            mermaid_syntax = custom_syntax
        else:
            # Generate Mermaid syntax based on diagram type and description
            mermaid_syntax = _generate_mermaid_syntax(diagram_type, description, data)
        
        # Validate the generated syntax
        if not _validate_mermaid_syntax(mermaid_syntax):
            return {
                "success": False,
                "error": "Generated Mermaid syntax is invalid"
            }
        
        return {
            "success": True,
            "diagram_type": diagram_type,
            "description": description,
            "mermaid_syntax": mermaid_syntax,
            "rendering_info": {
                "mermaid_version": "10.6.1",
                "supported_browsers": "Modern browsers with Mermaid support",
                "usage": f"Copy the Mermaid syntax into any Mermaid-compatible editor or viewer"
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Error generating diagram: {str(e)}"
        }

def _generate_mermaid_syntax(diagram_type: str, description: str, data: str = None):
    """Generate Mermaid syntax based on diagram type and description"""
    
    if diagram_type.lower() == "flowchart":
        return _generate_flowchart(description, data)
    elif diagram_type.lower() == "sequence":
        return _generate_sequence_diagram(description, data)
    elif diagram_type.lower() == "class":
        return _generate_class_diagram(description, data)
    elif diagram_type.lower() == "er":
        return _generate_er_diagram(description, data)
    elif diagram_type.lower() == "gantt":
        return _generate_gantt_chart(description, data)
    elif diagram_type.lower() == "pie":
        return _generate_pie_chart(description, data)
    else:
        # Generic diagram generation
        return f"""graph TD
    A[Start] --> B[Process]
    B --> C[End]
    
    %% {description}
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8"""

def _generate_flowchart(description: str, data: str = None):
    """Generate a flowchart diagram"""
    return f"""flowchart TD
    A[Start] --> B[Process Step 1]
    B --> C[Decision Point]
    C -->|Yes| D[Process Step 2]
    C -->|No| E[Alternative Process]
    D --> F[End]
    E --> F
    
    %% {description}
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#fff3e0
    style D fill:#e8f5e8
    style E fill:#fce4ec
    style F fill:#f1f8e9"""

def _generate_sequence_diagram(description: str, data: str = None):
    """Generate a sequence diagram"""
    return f"""sequenceDiagram
    participant User
    participant System
    participant Database
    
    User->>System: Request
    System->>Database: Query Data
    Database-->>System: Return Data
    System-->>User: Response
    
    %% {description}
    Note over User,System: {description}"""

def _generate_class_diagram(description: str, data: str = None):
    """Generate a class diagram"""
    return f"""classDiagram
    class MainClass {{
        +String name
        +int value
        +process()
        +getResult()
    }}
    
    class HelperClass {{
        +String helperData
        +help()
    }}
    
    MainClass --> HelperClass
    
    %% {description}
    Note: {description}"""

def _generate_er_diagram(description: str, data: str = None):
    """Generate an Entity-Relationship diagram"""
    return f"""erDiagram
    USER {{
        string id
        string name
        string email
    }}
    
    ORDER {{
        string id
        string userId
        date orderDate
        float total
    }}
    
    USER ||--o{{ ORDER : places
    
    %% {description}
    Note: {description}"""

def _generate_gantt_chart(description: str, data: str = None):
    """Generate a Gantt chart"""
    return f"""gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Task 1           :a1, 2024-01-01, 30d
    Task 2           :after a1  , 20d
    section Phase 2
    Task 3           :2024-02-01  , 12d
    Task 4           :24d
    
    %% {description}"""

def _generate_pie_chart(description: str, data: str = None):
    """Generate a pie chart"""
    return f"""pie title {description}
    "Category A" : 30
    "Category B" : 25
    "Category C" : 20
    "Category D" : 15
    "Category E" : 10"""

def _validate_mermaid_syntax(syntax: str) -> bool:
    """Basic validation of Mermaid syntax"""
    if not syntax or not syntax.strip():
        return False
    
    # Check if it starts with a valid diagram type
    valid_types = [
        "graph", "flowchart", "sequenceDiagram", "classDiagram", 
        "erDiagram", "gantt", "pie", "journey", "gitgraph"
    ]
    
    first_line = syntax.strip().split('\n')[0].strip()
    return any(first_line.startswith(valid_type) for valid_type in valid_types)
