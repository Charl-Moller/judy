try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

from datetime import datetime, timedelta, timezone
import pytz
from typing import Optional


@tool(name="get_current_time", description="Get the current date and time in various formats.")
def get_current_time(timezone_name: str = "UTC", format_string: str = None):
    """Get current time in specified timezone and format."""
    try:
        # Get timezone
        if timezone_name == "UTC":
            tz = timezone.utc
        else:
            tz = pytz.timezone(timezone_name)
        
        # Get current time
        now = datetime.now(tz)
        
        # Format time
        if format_string:
            formatted = now.strftime(format_string)
        else:
            formatted = now.isoformat()
        
        return {
            "current_time": formatted,
            "timezone": timezone_name,
            "timestamp": now.timestamp(),
            "iso_format": now.isoformat(),
            "human_readable": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "attachments": [
                {"type": "text", "content": f"Current time in {timezone_name}: {formatted}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error getting current time: {str(e)}"}


@tool(name="parse_datetime", description="Parse a datetime string into various formats.")
def parse_datetime(datetime_string: str, input_format: str = None, output_timezone: str = "UTC"):
    """Parse datetime string and convert to different formats."""
    try:
        # Try to parse the datetime
        if input_format:
            dt = datetime.strptime(datetime_string, input_format)
        else:
            # Try common formats
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%m/%d/%Y",
                "%d/%m/%Y",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S%z"
            ]
            
            dt = None
            for fmt in formats:
                try:
                    dt = datetime.strptime(datetime_string, fmt)
                    break
                except ValueError:
                    continue
            
            if dt is None:
                return {"error": f"Could not parse datetime string: {datetime_string}"}
        
        # Convert to target timezone
        if output_timezone != "UTC":
            target_tz = pytz.timezone(output_timezone)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt = dt.astimezone(target_tz)
        
        return {
            "parsed_datetime": dt.isoformat(),
            "timestamp": dt.timestamp(),
            "year": dt.year,
            "month": dt.month,
            "day": dt.day,
            "hour": dt.hour,
            "minute": dt.minute,
            "second": dt.second,
            "weekday": dt.strftime("%A"),
            "timezone": output_timezone,
            "attachments": [
                {"type": "text", "content": f"Parsed datetime: {dt.strftime('%Y-%m-%d %H:%M:%S %Z')}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error parsing datetime: {str(e)}"}


@tool(name="calculate_time_difference", description="Calculate the difference between two datetime strings.")
def calculate_time_difference(start_datetime: str, end_datetime: str, unit: str = "seconds"):
    """Calculate time difference between two datetimes."""
    try:
        # Parse datetimes
        def parse_dt(dt_string):
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S%z"
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(dt_string, fmt)
                except ValueError:
                    continue
            raise ValueError(f"Could not parse datetime: {dt_string}")
        
        start_dt = parse_dt(start_datetime)
        end_dt = parse_dt(end_datetime)
        
        # Calculate difference
        diff = end_dt - start_dt
        
        # Convert to requested unit
        total_seconds = diff.total_seconds()
        
        if unit == "seconds":
            result = total_seconds
        elif unit == "minutes":
            result = total_seconds / 60
        elif unit == "hours":
            result = total_seconds / 3600
        elif unit == "days":
            result = total_seconds / 86400
        elif unit == "weeks":
            result = total_seconds / 604800
        else:
            result = total_seconds
        
        return {
            "difference": result,
            "unit": unit,
            "start_datetime": start_dt.isoformat(),
            "end_datetime": end_dt.isoformat(),
            "total_seconds": total_seconds,
            "human_readable": str(diff),
            "attachments": [
                {"type": "text", "content": f"Time difference: {result:.2f} {unit}\nFrom: {start_dt.strftime('%Y-%m-%d %H:%M:%S')}\nTo: {end_dt.strftime('%Y-%m-%d %H:%M:%S')}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error calculating time difference: {str(e)}"}


@tool(name="add_time", description="Add or subtract time from a given datetime.")
def add_time(datetime_string: str, amount: int, unit: str = "hours", operation: str = "add"):
    """Add or subtract time from a datetime."""
    try:
        # Parse datetime
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z"
        ]
        
        dt = None
        for fmt in formats:
            try:
                dt = datetime.strptime(datetime_string, fmt)
                break
            except ValueError:
                continue
        
        if dt is None:
            return {"error": f"Could not parse datetime: {datetime_string}"}
        
        # Create timedelta based on unit
        if unit == "seconds":
            delta = timedelta(seconds=amount)
        elif unit == "minutes":
            delta = timedelta(minutes=amount)
        elif unit == "hours":
            delta = timedelta(hours=amount)
        elif unit == "days":
            delta = timedelta(days=amount)
        elif unit == "weeks":
            delta = timedelta(weeks=amount)
        else:
            return {"error": f"Unsupported time unit: {unit}"}
        
        # Apply operation
        if operation == "add":
            result_dt = dt + delta
        elif operation == "subtract":
            result_dt = dt - delta
        else:
            return {"error": f"Unsupported operation: {operation}"}
        
        return {
            "result_datetime": result_dt.isoformat(),
            "original_datetime": dt.isoformat(),
            "operation": f"{operation} {amount} {unit}",
            "timestamp": result_dt.timestamp(),
            "human_readable": result_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "attachments": [
                {"type": "text", "content": f"{operation.title()} {amount} {unit}:\nFrom: {dt.strftime('%Y-%m-%d %H:%M:%S')}\nTo: {result_dt.strftime('%Y-%m-%d %H:%M:%S')}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error adding time: {str(e)}"}


@tool(name="format_datetime", description="Format a datetime in various ways.")
def format_datetime(datetime_string: str, output_format: str, input_timezone: str = "UTC"):
    """Format a datetime string in a specific format."""
    try:
        # Parse datetime
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z"
        ]
        
        dt = None
        for fmt in formats:
            try:
                dt = datetime.strptime(datetime_string, fmt)
                break
            except ValueError:
                continue
        
        if dt is None:
            return {"error": f"Could not parse datetime: {datetime_string}"}
        
        # Apply timezone if specified
        if input_timezone != "UTC":
            tz = pytz.timezone(input_timezone)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
        
        # Format datetime
        formatted = dt.strftime(output_format)
        
        # Provide common format examples
        common_formats = {
            "ISO": dt.isoformat(),
            "US": dt.strftime("%m/%d/%Y %I:%M %p"),
            "European": dt.strftime("%d/%m/%Y %H:%M"),
            "Long": dt.strftime("%A, %B %d, %Y at %I:%M %p"),
            "Short": dt.strftime("%Y-%m-%d %H:%M")
        }
        
        return {
            "formatted_datetime": formatted,
            "original_datetime": datetime_string,
            "format_used": output_format,
            "common_formats": common_formats,
            "attachments": [
                {"type": "text", "content": f"Formatted datetime: {formatted}\n\nOther common formats:\n" + 
                 "\n".join([f"- {name}: {fmt}" for name, fmt in common_formats.items()])}
            ]
        }
    except Exception as e:
        return {"error": f"Error formatting datetime: {str(e)}"}