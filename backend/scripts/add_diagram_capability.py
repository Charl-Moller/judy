#!/usr/bin/env python3
"""
Script to add diagram generation capability to the database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db import models
import uuid

def add_diagram_capability():
    """Add diagram generation capability to the database"""
    try:
        db = SessionLocal()
        
        # Check if capability already exists
        existing = db.query(models.Capability).filter(models.Capability.name == "diagram_generation").first()
        if existing:
            print("Capability 'diagram_generation' already exists")
            return existing.id
        
        # Create the new capability
        capability = models.Capability(
            id=uuid.uuid4(),
            name="diagram_generation",
            description="Generate diagrams and charts using Mermaid syntax. Supports flowcharts, sequence diagrams, class diagrams, ER diagrams, Gantt charts, pie charts, and more.",
            tool_config={
                "tool_name": "diagram_generator",
                "description": "Generate diagrams and charts using Mermaid syntax",
                "parameters": {
                    "diagram_type": "Type of diagram (flowchart, sequence, class, er, gantt, pie, etc.)",
                    "description": "Description of what the diagram should show",
                    "data": "Optional structured data to include",
                    "custom_syntax": "Optional custom Mermaid syntax"
                }
            }
        )
        
        db.add(capability)
        db.commit()
        db.refresh(capability)
        
        print(f"Successfully added 'diagram_generation' capability with ID: {capability.id}")
        return capability.id
        
    except Exception as e:
        print(f"Error adding capability: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    add_diagram_capability()
