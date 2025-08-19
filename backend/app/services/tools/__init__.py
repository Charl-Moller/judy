# Tool registry - Import all available tools here

# Import tools from existing modules
from .web_search import web_search
from .image_analysis import image_analysis

# Import tools from new modules
from .file_operations import read_file, write_file, list_directory, parse_csv, create_csv, create_excel
from .data_processing import filter_data, sort_data, aggregate_data, group_data, transform_data
from .http_requests import http_get, http_post, http_put, http_delete, validate_url
from .text_processing import (
    extract_text_patterns, replace_text_patterns, split_text, analyze_text_stats,
    extract_emails, extract_urls, clean_text
)
from .datetime_utils import (
    get_current_time, parse_datetime, calculate_time_difference, add_time, format_datetime
)

# Tool categories for UI organization
TOOL_CATEGORIES = {
    "File Operations": [
        "read_file", "write_file", "list_directory", "parse_csv", "create_csv", "create_excel"
    ],
    "Data Processing": [
        "filter_data", "sort_data", "aggregate_data", "group_data", "transform_data"
    ],
    "Text Processing": [
        "extract_text_patterns", "replace_text_patterns", "split_text", 
        "analyze_text_stats", "extract_emails", "extract_urls", "clean_text"
    ],
    "Web & API": [
        "http_get", "http_post", "http_put", "http_delete", "validate_url",
        "web_search"
    ],
    "Date & Time": [
        "get_current_time", "parse_datetime", "calculate_time_difference", 
        "add_time", "format_datetime"
    ],
    "Media & Analysis": [
        "image_analysis"
    ]
}

# All available tools for easy reference
ALL_TOOLS = []
for category_tools in TOOL_CATEGORIES.values():
    ALL_TOOLS.extend(category_tools)

# Tool metadata for configuration
TOOL_METADATA = {
    # File Operations
    "read_file": {"description": "Read contents of a file", "parameters": ["file_path", "encoding"], "category": "File Operations"},
    "write_file": {"description": "Write content to a file", "parameters": ["file_path", "content", "encoding"], "category": "File Operations"},
    "list_directory": {"description": "List files in a directory", "parameters": ["directory_path", "include_hidden"], "category": "File Operations"},
    "parse_csv": {"description": "Parse CSV file into structured data", "parameters": ["file_path", "delimiter", "has_header"], "category": "File Operations"},
    "create_csv": {"description": "Create CSV file from data", "parameters": ["file_path", "data", "headers"], "category": "File Operations"},
    "create_excel": {"description": "Create Excel (.xlsx) file from data", "parameters": ["file_path", "data", "sheet_name", "headers"], "category": "File Operations"},
    
    # Data Processing
    "filter_data": {"description": "Filter data based on criteria", "parameters": ["data", "field", "operator", "value"], "category": "Data Processing"},
    "sort_data": {"description": "Sort data by field", "parameters": ["data", "field", "ascending"], "category": "Data Processing"},
    "aggregate_data": {"description": "Calculate aggregations on data", "parameters": ["data", "field", "operation"], "category": "Data Processing"},
    "group_data": {"description": "Group data by field", "parameters": ["data", "group_field", "agg_field", "agg_operation"], "category": "Data Processing"},
    "transform_data": {"description": "Transform data with operations", "parameters": ["data", "transformations"], "category": "Data Processing"},
    
    # Text Processing
    "extract_text_patterns": {"description": "Extract patterns with regex", "parameters": ["text", "pattern", "flags"], "category": "Text Processing"},
    "replace_text_patterns": {"description": "Replace patterns with regex", "parameters": ["text", "pattern", "replacement", "flags"], "category": "Text Processing"},
    "split_text": {"description": "Split text into chunks", "parameters": ["text", "delimiter", "max_length"], "category": "Text Processing"},
    "analyze_text_stats": {"description": "Analyze text statistics", "parameters": ["text"], "category": "Text Processing"},
    "extract_emails": {"description": "Extract email addresses", "parameters": ["text"], "category": "Text Processing"},
    "extract_urls": {"description": "Extract URLs from text", "parameters": ["text"], "category": "Text Processing"},
    "clean_text": {"description": "Clean and normalize text", "parameters": ["text", "remove_extra_whitespace", "remove_special_chars", "normalize_case"], "category": "Text Processing"},
    
    # Web & API
    "http_get": {"description": "Make HTTP GET request", "parameters": ["url", "headers", "params", "timeout"], "category": "Web & API"},
    "http_post": {"description": "Make HTTP POST request", "parameters": ["url", "data", "json_data", "headers", "timeout"], "category": "Web & API"},
    "http_put": {"description": "Make HTTP PUT request", "parameters": ["url", "data", "json_data", "headers", "timeout"], "category": "Web & API"},
    "http_delete": {"description": "Make HTTP DELETE request", "parameters": ["url", "headers", "timeout"], "category": "Web & API"},
    "validate_url": {"description": "Validate URL accessibility", "parameters": ["url", "timeout"], "category": "Web & API"},
    "web_search": {"description": "Search the web", "parameters": ["query"], "category": "Web & API"},
    
    # Date & Time
    "get_current_time": {"description": "Get current date/time", "parameters": ["timezone_name", "format_string"], "category": "Date & Time"},
    "parse_datetime": {"description": "Parse datetime string", "parameters": ["datetime_string", "input_format", "output_timezone"], "category": "Date & Time"},
    "calculate_time_difference": {"description": "Calculate time difference", "parameters": ["start_datetime", "end_datetime", "unit"], "category": "Date & Time"},
    "add_time": {"description": "Add/subtract time", "parameters": ["datetime_string", "amount", "unit", "operation"], "category": "Date & Time"},
    "format_datetime": {"description": "Format datetime string", "parameters": ["datetime_string", "output_format", "input_timezone"], "category": "Date & Time"},
    
    # Media & Analysis
    "image_analysis": {"description": "Analyze and describe image contents", "parameters": ["file_id", "file_url"], "category": "Media & Analysis"}
}