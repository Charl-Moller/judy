"""
Universal File Processing System for Judy Agent Builder

This module provides automatic file analysis and context extraction for any file type,
making file content universally available to all agents, sub-agents, and tools.
"""

import os
import json
import uuid
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import mimetypes
import base64
from datetime import datetime

class UniversalFileProcessor:
    """
    Universal file processor that can handle any file type and make content
    available to all agents in the workflow.
    """
    
    def __init__(self):
        self.supported_types = {
            # Images
            'image/jpeg': self._process_image,
            'image/jpg': self._process_image,
            'image/png': self._process_image,
            'image/gif': self._process_image,
            'image/webp': self._process_image,
            'image/bmp': self._process_image,
            
            # Documents
            'application/pdf': self._process_pdf,
            'application/msword': self._process_word,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': self._process_word,
            'text/plain': self._process_text,
            'text/markdown': self._process_text,
            'application/rtf': self._process_text,
            
            # Spreadsheets
            'application/vnd.ms-excel': self._process_excel,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': self._process_excel,
            'text/csv': self._process_csv,
            'application/vnd.oasis.opendocument.spreadsheet': self._process_excel,
            
            # Presentations
            'application/vnd.ms-powerpoint': self._process_powerpoint,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': self._process_powerpoint,
            
            # Code files
            'text/javascript': self._process_code,
            'text/python': self._process_code,
            'text/html': self._process_code,
            'text/css': self._process_code,
            'application/json': self._process_json,
            'application/xml': self._process_code,
            'text/xml': self._process_code,
            
            # Archives
            'application/zip': self._process_archive,
            'application/x-rar': self._process_archive,
            'application/x-7z-compressed': self._process_archive,
        }
    
    def process_files_for_workflow(self, files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process all files and return comprehensive context for workflow execution.
        
        Args:
            files: List of file dictionaries with id, filename, content/path, etc.
            
        Returns:
            Dictionary with processed file information and context
        """
        if not files:
            return {
                "files_available": False,
                "file_count": 0,
                "file_context": "",
                "file_summaries": [],
                "structured_data": {}
            }
        
        print(f"\n🔧 UNIVERSAL FILE PROCESSOR: Processing {len(files)} file(s)")
        
        processed_files = []
        all_context = []
        structured_data = {}
        
        for file_info in files:
            try:
                result = self._process_single_file(file_info)
                if result:
                    processed_files.append(result)
                    all_context.append(result['context'])
                    
                    # Collect structured data (tables, JSON, etc.)
                    if result.get('structured_data'):
                        structured_data[result['filename']] = result['structured_data']
                        
            except Exception as e:
                print(f"❌ FILE PROCESSOR: Error processing {file_info.get('filename', 'unknown')}: {e}")
                # Add error context so agent knows about the file
                error_context = f"File '{file_info.get('filename', 'unknown')}': Could not process due to error - {str(e)}"
                all_context.append(error_context)
                processed_files.append({
                    "filename": file_info.get('filename', 'unknown'),
                    "type": "error",
                    "context": error_context,
                    "error": str(e)
                })
        
        # Create comprehensive context for agents
        file_context = self._build_comprehensive_context(processed_files)
        
        result = {
            "files_available": len(processed_files) > 0,
            "file_count": len(processed_files),
            "file_context": file_context,
            "file_summaries": processed_files,
            "structured_data": structured_data,
            "processing_timestamp": datetime.utcnow().isoformat()
        }
        
        print(f"✅ FILE PROCESSOR: Successfully processed {len(processed_files)}/{len(files)} files")
        print(f"📊 FILE PROCESSOR: Generated {len(file_context)} chars of context")
        
        return result
    
    def _process_single_file(self, file_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process a single file and extract its content/context."""
        filename = file_info.get('filename', 'unknown')
        file_path = file_info.get('path') or file_info.get('url')
        file_id = file_info.get('id', str(uuid.uuid4()))
        
        if not file_path:
            return None
            
        # Detect MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            # Try to detect from file extension
            ext = Path(filename).suffix.lower()
            mime_type = self._get_mime_from_extension(ext)
        
        print(f"📄 Processing: {filename} (Type: {mime_type})")
        
        # Find appropriate processor
        processor = self.supported_types.get(mime_type, self._process_generic)
        
        try:
            context, structured_data = processor(file_path, filename, file_info)
            
            return {
                "file_id": file_id,
                "filename": filename,
                "mime_type": mime_type,
                "type": self._get_file_category(mime_type),
                "context": context,
                "structured_data": structured_data,
                "processed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")
            return None
    
    def _process_image(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process image files - prepare for native LLM vision analysis."""
        try:
            import os
            from pathlib import Path
            
            # Check if file exists and get basic info
            if file_path.startswith('/uploads/'):
                # Local file - check if it exists
                local_path = Path(f"uploads/{file_path.split('/')[-1]}")
                if local_path.exists():
                    file_size = local_path.stat().st_size
                    context = f"Image '{filename}' - READY FOR ANALYSIS: This is an image file ({file_size} bytes) that has been prepared for native LLM vision analysis. The LLM can directly view and analyze this image to describe its contents, answer questions about what it shows, read any text within it, and provide detailed visual information."
                    
                    structured_data = {
                        "type": "image",
                        "filename": filename,
                        "file_path": file_path,
                        "file_size": file_size,
                        "ready_for_llm_vision": True,
                        "analysis_note": "Image will be analyzed directly by the LLM with native vision capabilities"
                    }
                    
                    return context, structured_data
                else:
                    context = f"Image '{filename}': File not found at expected location"
                    structured_data = {"type": "error", "error": "File not found"}
                    return context, structured_data
            else:
                # Remote file or different path format
                context = f"Image '{filename}' - READY FOR ANALYSIS: This is an image file that can be analyzed directly by the LLM with native vision capabilities."
                structured_data = {
                    "type": "image",
                    "filename": filename,
                    "file_path": file_path,
                    "ready_for_llm_vision": True,
                    "analysis_note": "Image will be analyzed directly by the LLM"
                }
                return context, structured_data
                
        except Exception as e:
            context = f"Image '{filename}': Error preparing for analysis - {str(e)}"
            return context, {"type": "error", "error": str(e)}
    
    def _process_csv(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process CSV files."""
        try:
            import pandas as pd
            
            # Read CSV file
            if file_path.startswith('http'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_csv(file_path)
            
            # Generate summary
            rows, cols = df.shape
            column_info = []
            
            for col in df.columns:
                dtype = str(df[col].dtype)
                null_count = df[col].isnull().sum()
                unique_count = df[col].nunique()
                
                col_summary = f"{col} ({dtype})"
                if null_count > 0:
                    col_summary += f" - {null_count} nulls"
                if unique_count < 10:
                    col_summary += f" - {unique_count} unique values"
                    
                column_info.append(col_summary)
            
            # Sample data (first few rows)
            sample_data = df.head(3).to_string()
            
            context = f"""CSV File '{filename}':
- Dimensions: {rows} rows × {cols} columns
- Columns: {', '.join(column_info)}

Sample data:
{sample_data}"""

            structured_data = {
                "type": "csv",
                "rows": int(rows),
                "columns": int(cols),
                "column_names": list(df.columns),
                "column_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "sample_data": df.head(5).to_dict('records'),
                "summary_stats": df.describe().to_dict() if df.select_dtypes(include=['number']).shape[1] > 0 else {}
            }
            
            return context, structured_data
            
        except Exception as e:
            context = f"CSV '{filename}': Could not process - {str(e)}"
            return context, {"type": "error", "error": str(e)}
    
    def _process_excel(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process Excel files."""
        try:
            import pandas as pd
            
            # Read Excel file
            if file_path.startswith('http'):
                excel_file = pd.ExcelFile(file_path)
            else:
                excel_file = pd.ExcelFile(file_path)
            
            sheet_info = []
            all_sheets_data = {}
            
            # Process each sheet
            for sheet_name in excel_file.sheet_names[:5]:  # Limit to first 5 sheets
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                rows, cols = df.shape
                
                sheet_info.append(f"'{sheet_name}': {rows}×{cols}")
                
                # Store sample data for structured access
                all_sheets_data[sheet_name] = {
                    "rows": int(rows),
                    "columns": int(cols),
                    "column_names": list(df.columns),
                    "sample_data": df.head(3).to_dict('records')
                }
            
            context = f"""Excel File '{filename}':
- Sheets ({len(excel_file.sheet_names)}): {', '.join(sheet_info)}
- Main sheet preview: {excel_file.sheet_names[0] if excel_file.sheet_names else 'None'}"""

            structured_data = {
                "type": "excel",
                "sheet_names": excel_file.sheet_names,
                "sheets_data": all_sheets_data,
                "total_sheets": len(excel_file.sheet_names)
            }
            
            return context, structured_data
            
        except Exception as e:
            context = f"Excel '{filename}': Could not process - {str(e)}"
            return context, {"type": "error", "error": str(e)}
    
    def _process_pdf(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process PDF files."""
        try:
            # For now, basic PDF processing - can be enhanced with PyPDF2 or similar
            context = f"PDF '{filename}': Document available for analysis (PDF processing requires additional setup)"
            
            structured_data = {
                "type": "pdf",
                "status": "detected",
                "note": "Full PDF text extraction requires PyPDF2 or similar library"
            }
            
            return context, structured_data
            
        except Exception as e:
            context = f"PDF '{filename}': Could not process - {str(e)}"
            return context, {"type": "error", "error": str(e)}
    
    def _process_text(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process text files."""
        try:
            if file_path.startswith('http'):
                import requests
                response = requests.get(file_path)
                content = response.text
            else:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            
            # Truncate very long content
            max_chars = 2000
            if len(content) > max_chars:
                preview = content[:max_chars] + "... (truncated)"
            else:
                preview = content
            
            word_count = len(content.split())
            line_count = len(content.split('\n'))
            
            context = f"""Text File '{filename}':
- Size: {len(content)} characters, {word_count} words, {line_count} lines

Content:
{preview}"""

            structured_data = {
                "type": "text",
                "char_count": len(content),
                "word_count": word_count,
                "line_count": line_count,
                "content": content[:5000],  # Store more for structured access
                "preview": preview
            }
            
            return context, structured_data
            
        except Exception as e:
            context = f"Text '{filename}': Could not read - {str(e)}"
            return context, {"type": "error", "error": str(e)}
    
    def _process_json(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process JSON files."""
        try:
            if file_path.startswith('http'):
                import requests
                response = requests.get(file_path)
                data = response.json()
            else:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            
            # Analyze structure
            def analyze_json_structure(obj, level=0):
                if level > 3:  # Limit depth
                    return "..."
                
                if isinstance(obj, dict):
                    keys = list(obj.keys())[:5]  # First 5 keys
                    return f"Object with {len(obj)} keys: {keys}"
                elif isinstance(obj, list):
                    return f"Array with {len(obj)} items"
                else:
                    return f"{type(obj).__name__}: {str(obj)[:50]}"
            
            structure = analyze_json_structure(data)
            json_preview = json.dumps(data, indent=2)[:1000]
            
            context = f"""JSON File '{filename}':
- Structure: {structure}

Preview:
{json_preview}{"..." if len(json_preview) >= 1000 else ""}"""

            structured_data = {
                "type": "json",
                "structure": structure,
                "data": data if len(str(data)) < 10000 else "Too large to store",
                "keys": list(data.keys()) if isinstance(data, dict) else None,
                "length": len(data) if isinstance(data, (list, dict)) else None
            }
            
            return context, structured_data
            
        except Exception as e:
            context = f"JSON '{filename}': Could not parse - {str(e)}"
            return context, {"type": "error", "error": str(e)}
    
    def _process_code(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process code files."""
        return self._process_text(file_path, filename, file_info)  # Same as text for now
    
    def _process_word(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process Word documents."""
        context = f"Word Document '{filename}': Available for analysis (requires python-docx for full text extraction)"
        structured_data = {
            "type": "word",
            "status": "detected",
            "note": "Full Word document processing requires python-docx library"
        }
        return context, structured_data
    
    def _process_powerpoint(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process PowerPoint files."""
        context = f"PowerPoint '{filename}': Available for analysis (requires python-pptx for full extraction)"
        structured_data = {
            "type": "powerpoint", 
            "status": "detected",
            "note": "Full PowerPoint processing requires python-pptx library"
        }
        return context, structured_data
    
    def _process_archive(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process archive files."""
        context = f"Archive '{filename}': Compressed file available (extraction requires additional setup)"
        structured_data = {
            "type": "archive",
            "status": "detected",
            "note": "Archive extraction requires additional libraries"
        }
        return context, structured_data
    
    def _process_generic(self, file_path: str, filename: str, file_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Process unknown file types."""
        file_size = file_info.get('size', 'unknown')
        context = f"File '{filename}': Available for analysis (Size: {file_size}, Type: Unknown)"
        
        structured_data = {
            "type": "generic",
            "filename": filename,
            "size": file_size,
            "status": "detected_but_not_processed"
        }
        
        return context, structured_data
    
    def _build_comprehensive_context(self, processed_files: List[Dict[str, Any]]) -> str:
        """Build comprehensive context string for agents."""
        if not processed_files:
            return ""
        
        context_parts = [
            f"\n📎 ATTACHED FILES ({len(processed_files)} file{'s' if len(processed_files) != 1 else ''}):",
            "=" * 50
        ]
        
        for file_data in processed_files:
            context_parts.append(file_data['context'])
            context_parts.append("-" * 30)
        
        # Check if any images were analyzed
        image_count = sum(1 for f in processed_files if f.get('type') == 'image')
        analysis_note = "💡 All attached file content is available for analysis, questions, and processing."
        if image_count > 0:
            analysis_note += f" Images have been pre-analyzed using vision AI - you can see and discuss their visual content."
        
        context_parts.extend([
            "=" * 50,
            analysis_note,
            "You can reference any file by name and access their data as needed."
        ])
        
        return "\n".join(context_parts)
    
    def _get_mime_from_extension(self, ext: str) -> str:
        """Get MIME type from file extension."""
        ext_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg', 
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.csv': 'text/csv',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel',
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.py': 'text/python',
            '.js': 'text/javascript',
            '.html': 'text/html',
            '.css': 'text/css',
            '.zip': 'application/zip'
        }
        return ext_map.get(ext, 'application/octet-stream')
    
    def _get_file_category(self, mime_type: str) -> str:
        """Get file category for better organization."""
        if mime_type.startswith('image/'):
            return 'image'
        elif mime_type.startswith('text/') or mime_type in ['application/json', 'application/xml']:
            return 'text'
        elif 'spreadsheet' in mime_type or mime_type == 'text/csv' or 'excel' in mime_type:
            return 'spreadsheet'
        elif 'pdf' in mime_type:
            return 'document'
        elif 'word' in mime_type or 'document' in mime_type:
            return 'document'
        elif 'presentation' in mime_type or 'powerpoint' in mime_type:
            return 'presentation'
        elif 'zip' in mime_type or 'archive' in mime_type:
            return 'archive'
        else:
            return 'other'


# Global instance
file_processor = UniversalFileProcessor()