try:
    from openai.agents import tool
except Exception:  # pragma: no cover
    def tool(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

import json
import statistics
from typing import List, Dict, Any, Union


@tool(name="filter_data", description="Filter a list of dictionaries based on criteria.")
def filter_data(data: List[Dict], field: str, operator: str, value: Any):
    """Filter data based on field, operator, and value."""
    try:
        filtered = []
        
        for item in data:
            if field not in item:
                continue
            
            item_value = item[field]
            
            # Type conversion for comparison
            if isinstance(value, str) and isinstance(item_value, (int, float)):
                try:
                    value = type(item_value)(value)
                except ValueError:
                    continue
            
            if operator == "equals":
                if item_value == value:
                    filtered.append(item)
            elif operator == "not_equals":
                if item_value != value:
                    filtered.append(item)
            elif operator == "greater_than":
                if item_value > value:
                    filtered.append(item)
            elif operator == "less_than":
                if item_value < value:
                    filtered.append(item)
            elif operator == "contains":
                if str(value).lower() in str(item_value).lower():
                    filtered.append(item)
            elif operator == "starts_with":
                if str(item_value).lower().startswith(str(value).lower()):
                    filtered.append(item)
            elif operator == "ends_with":
                if str(item_value).lower().endswith(str(value).lower()):
                    filtered.append(item)
        
        return {
            "filtered_data": filtered,
            "original_count": len(data),
            "filtered_count": len(filtered),
            "attachments": [
                {"type": "text", "content": f"Filtered {len(data)} items to {len(filtered)} items using {field} {operator} {value}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error filtering data: {str(e)}"}


@tool(name="sort_data", description="Sort a list of dictionaries by a specified field.")
def sort_data(data: List[Dict], field: str, ascending: bool = True):
    """Sort data by a specified field."""
    try:
        sorted_data = sorted(data, key=lambda x: x.get(field, ''), reverse=not ascending)
        
        return {
            "sorted_data": sorted_data,
            "count": len(sorted_data),
            "sort_field": field,
            "ascending": ascending,
            "attachments": [
                {"type": "text", "content": f"Sorted {len(sorted_data)} items by {field} ({'ascending' if ascending else 'descending'})"}
            ]
        }
    except Exception as e:
        return {"error": f"Error sorting data: {str(e)}"}


@tool(name="aggregate_data", description="Calculate aggregations (sum, average, count, etc.) on data.")
def aggregate_data(data: List[Dict], field: str, operation: str):
    """Perform aggregation operations on numeric data."""
    try:
        values = []
        for item in data:
            if field in item and item[field] is not None:
                try:
                    values.append(float(item[field]))
                except (ValueError, TypeError):
                    continue
        
        if not values:
            return {"error": f"No numeric values found for field '{field}'"}
        
        result = None
        if operation == "sum":
            result = sum(values)
        elif operation == "average" or operation == "mean":
            result = statistics.mean(values)
        elif operation == "median":
            result = statistics.median(values)
        elif operation == "min":
            result = min(values)
        elif operation == "max":
            result = max(values)
        elif operation == "count":
            result = len(values)
        elif operation == "stdev":
            result = statistics.stdev(values) if len(values) > 1 else 0
        else:
            return {"error": f"Unknown operation: {operation}"}
        
        return {
            "result": result,
            "operation": operation,
            "field": field,
            "value_count": len(values),
            "attachments": [
                {"type": "text", "content": f"{operation.title()} of {field}: {result} (from {len(values)} values)"}
            ]
        }
    except Exception as e:
        return {"error": f"Error aggregating data: {str(e)}"}


@tool(name="group_data", description="Group data by a specified field and optionally aggregate within groups.")
def group_data(data: List[Dict], group_field: str, agg_field: str = None, agg_operation: str = "count"):
    """Group data by field and perform aggregations within groups."""
    try:
        groups = {}
        
        # Group the data
        for item in data:
            group_value = item.get(group_field, "Unknown")
            if group_value not in groups:
                groups[group_value] = []
            groups[group_value].append(item)
        
        # Calculate aggregations for each group
        result = {}
        for group_name, group_items in groups.items():
            if agg_field and agg_operation != "count":
                # Perform numeric aggregation
                values = []
                for item in group_items:
                    if agg_field in item and item[agg_field] is not None:
                        try:
                            values.append(float(item[agg_field]))
                        except (ValueError, TypeError):
                            continue
                
                if values:
                    if agg_operation == "sum":
                        agg_result = sum(values)
                    elif agg_operation == "average":
                        agg_result = statistics.mean(values)
                    elif agg_operation == "min":
                        agg_result = min(values)
                    elif agg_operation == "max":
                        agg_result = max(values)
                    else:
                        agg_result = len(values)
                else:
                    agg_result = 0
            else:
                agg_result = len(group_items)
            
            result[group_name] = {
                "count": len(group_items),
                "aggregation": agg_result,
                "items": group_items
            }
        
        return {
            "groups": result,
            "group_count": len(result),
            "total_items": len(data),
            "attachments": [
                {"type": "text", "content": f"Grouped {len(data)} items into {len(result)} groups by {group_field}"}
            ]
        }
    except Exception as e:
        return {"error": f"Error grouping data: {str(e)}"}


@tool(name="transform_data", description="Transform data by applying operations to fields.")
def transform_data(data: List[Dict], transformations: List[Dict]):
    """Transform data by applying field operations.
    
    transformations format:
    [
        {"field": "price", "operation": "multiply", "value": 1.2},
        {"field": "name", "operation": "uppercase"},
        {"field": "full_name", "operation": "concat", "fields": ["first_name", "last_name"], "separator": " "}
    ]
    """
    try:
        transformed_data = []
        
        for item in data:
            new_item = item.copy()
            
            for transform in transformations:
                field = transform["field"]
                operation = transform["operation"]
                
                if operation == "multiply" and field in new_item:
                    try:
                        new_item[field] = float(new_item[field]) * transform["value"]
                    except (ValueError, TypeError):
                        continue
                
                elif operation == "divide" and field in new_item:
                    try:
                        new_item[field] = float(new_item[field]) / transform["value"]
                    except (ValueError, TypeError, ZeroDivisionError):
                        continue
                
                elif operation == "add" and field in new_item:
                    try:
                        new_item[field] = float(new_item[field]) + transform["value"]
                    except (ValueError, TypeError):
                        continue
                
                elif operation == "uppercase" and field in new_item:
                    new_item[field] = str(new_item[field]).upper()
                
                elif operation == "lowercase" and field in new_item:
                    new_item[field] = str(new_item[field]).lower()
                
                elif operation == "concat":
                    fields = transform.get("fields", [])
                    separator = transform.get("separator", "")
                    values = [str(new_item.get(f, "")) for f in fields if new_item.get(f)]
                    new_item[field] = separator.join(values)
                
                elif operation == "substring" and field in new_item:
                    start = transform.get("start", 0)
                    end = transform.get("end", None)
                    new_item[field] = str(new_item[field])[start:end]
            
            transformed_data.append(new_item)
        
        return {
            "transformed_data": transformed_data,
            "count": len(transformed_data),
            "transformations_applied": len(transformations),
            "attachments": [
                {"type": "text", "content": f"Applied {len(transformations)} transformations to {len(transformed_data)} items"}
            ]
        }
    except Exception as e:
        return {"error": f"Error transforming data: {str(e)}"}