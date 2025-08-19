try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

import requests
import json
from typing import Dict, Any, Optional


@tool(name="http_get", description="Make an HTTP GET request to a URL.")
def http_get(url: str, headers: Dict[str, str] = None, params: Dict[str, Any] = None, timeout: int = 30):
    """Make an HTTP GET request and return the response."""
    try:
        response = requests.get(
            url,
            headers=headers or {},
            params=params or {},
            timeout=timeout
        )
        
        # Try to parse JSON response
        try:
            response_data = response.json()
        except ValueError:
            response_data = response.text
        
        return {
            "status_code": response.status_code,
            "success": response.status_code < 400,
            "data": response_data,
            "headers": dict(response.headers),
            "url": response.url,
            "attachments": [
                {"type": "text", "content": f"GET {url}\nStatus: {response.status_code}\nResponse: {json.dumps(response_data, indent=2) if isinstance(response_data, (dict, list)) else str(response_data)[:500]}"}
            ]
        }
    except requests.exceptions.Timeout:
        return {"error": f"Request timeout after {timeout} seconds"}
    except requests.exceptions.ConnectionError:
        return {"error": "Connection error - could not reach the server"}
    except Exception as e:
        return {"error": f"HTTP GET error: {str(e)}"}


@tool(name="http_post", description="Make an HTTP POST request with data.")
def http_post(url: str, data: Dict[str, Any] = None, json_data: Dict[str, Any] = None, 
              headers: Dict[str, str] = None, timeout: int = 30):
    """Make an HTTP POST request and return the response."""
    try:
        # Set default headers for JSON requests
        if json_data and not headers:
            headers = {"Content-Type": "application/json"}
        
        response = requests.post(
            url,
            data=data,
            json=json_data,
            headers=headers or {},
            timeout=timeout
        )
        
        # Try to parse JSON response
        try:
            response_data = response.json()
        except ValueError:
            response_data = response.text
        
        return {
            "status_code": response.status_code,
            "success": response.status_code < 400,
            "data": response_data,
            "headers": dict(response.headers),
            "url": response.url,
            "attachments": [
                {"type": "text", "content": f"POST {url}\nStatus: {response.status_code}\nResponse: {json.dumps(response_data, indent=2) if isinstance(response_data, (dict, list)) else str(response_data)[:500]}"}
            ]
        }
    except requests.exceptions.Timeout:
        return {"error": f"Request timeout after {timeout} seconds"}
    except requests.exceptions.ConnectionError:
        return {"error": "Connection error - could not reach the server"}
    except Exception as e:
        return {"error": f"HTTP POST error: {str(e)}"}


@tool(name="http_put", description="Make an HTTP PUT request with data.")
def http_put(url: str, data: Dict[str, Any] = None, json_data: Dict[str, Any] = None,
             headers: Dict[str, str] = None, timeout: int = 30):
    """Make an HTTP PUT request and return the response."""
    try:
        # Set default headers for JSON requests
        if json_data and not headers:
            headers = {"Content-Type": "application/json"}
        
        response = requests.put(
            url,
            data=data,
            json=json_data,
            headers=headers or {},
            timeout=timeout
        )
        
        # Try to parse JSON response
        try:
            response_data = response.json()
        except ValueError:
            response_data = response.text
        
        return {
            "status_code": response.status_code,
            "success": response.status_code < 400,
            "data": response_data,
            "headers": dict(response.headers),
            "url": response.url,
            "attachments": [
                {"type": "text", "content": f"PUT {url}\nStatus: {response.status_code}\nResponse: {json.dumps(response_data, indent=2) if isinstance(response_data, (dict, list)) else str(response_data)[:500]}"}
            ]
        }
    except requests.exceptions.Timeout:
        return {"error": f"Request timeout after {timeout} seconds"}
    except requests.exceptions.ConnectionError:
        return {"error": "Connection error - could not reach the server"}
    except Exception as e:
        return {"error": f"HTTP PUT error: {str(e)}"}


@tool(name="http_delete", description="Make an HTTP DELETE request.")
def http_delete(url: str, headers: Dict[str, str] = None, timeout: int = 30):
    """Make an HTTP DELETE request and return the response."""
    try:
        response = requests.delete(
            url,
            headers=headers or {},
            timeout=timeout
        )
        
        # Try to parse JSON response
        try:
            response_data = response.json() if response.text else None
        except ValueError:
            response_data = response.text
        
        return {
            "status_code": response.status_code,
            "success": response.status_code < 400,
            "data": response_data,
            "headers": dict(response.headers),
            "url": response.url,
            "attachments": [
                {"type": "text", "content": f"DELETE {url}\nStatus: {response.status_code}\nResponse: {json.dumps(response_data, indent=2) if isinstance(response_data, (dict, list)) else str(response_data)[:500] if response_data else 'No content'}"}
            ]
        }
    except requests.exceptions.Timeout:
        return {"error": f"Request timeout after {timeout} seconds"}
    except requests.exceptions.ConnectionError:
        return {"error": "Connection error - could not reach the server"}
    except Exception as e:
        return {"error": f"HTTP DELETE error: {str(e)}"}


@tool(name="validate_url", description="Validate if a URL is accessible and return basic information.")
def validate_url(url: str, timeout: int = 10):
    """Check if a URL is accessible and return basic information."""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        
        return {
            "valid": True,
            "status_code": response.status_code,
            "accessible": response.status_code < 400,
            "final_url": response.url,
            "headers": dict(response.headers),
            "content_type": response.headers.get('content-type', 'unknown'),
            "content_length": response.headers.get('content-length', 'unknown'),
            "attachments": [
                {"type": "text", "content": f"URL Validation for {url}\nStatus: {response.status_code}\nAccessible: {response.status_code < 400}\nContent-Type: {response.headers.get('content-type', 'unknown')}"}
            ]
        }
    except requests.exceptions.Timeout:
        return {
            "valid": False,
            "error": f"Request timeout after {timeout} seconds",
            "attachments": [
                {"type": "text", "content": f"URL Validation failed for {url}: Timeout"}
            ]
        }
    except requests.exceptions.ConnectionError:
        return {
            "valid": False,
            "error": "Connection error - could not reach the server",
            "attachments": [
                {"type": "text", "content": f"URL Validation failed for {url}: Connection error"}
            ]
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"URL validation error: {str(e)}",
            "attachments": [
                {"type": "text", "content": f"URL Validation failed for {url}: {str(e)}"}
            ]
        }