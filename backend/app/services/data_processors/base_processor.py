"""
Base Data Processor Interface
Provides common interface for all platform-specific data processors
"""

import pandas as pd
import logging
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseDataProcessor(ABC):
    """Base interface for all data processors"""
    
    def __init__(self):
        self.max_llm_items = 50  # Maximum items to send to LLM
        self.summary_threshold = 100  # When to start summarizing
    
    @abstractmethod
    def process_data(self, data: List[Dict], query_type: str = "general") -> Dict[str, Any]:
        """
        Process platform-specific data and return summarized results
        
        Args:
            data: List of data records from the platform API
            query_type: Type of query/analysis to perform
            
        Returns:
            Processed and summarized data ready for LLM consumption
        """
        pass
    
    @abstractmethod
    def get_supported_query_types(self) -> List[str]:
        """Return list of supported query types for this processor"""
        pass
    
    def _normalize_reference_fields(self, df: pd.DataFrame, field_mappings: Dict[str, str]) -> pd.DataFrame:
        """
        Normalize platform-specific reference fields
        
        Args:
            df: DataFrame to process
            field_mappings: Dictionary mapping field names to extraction methods
        """
        for field, method in field_mappings.items():
            if field in df.columns:
                if method == "reference_value":
                    df[f'{field}_id'] = df[field].apply(self._extract_reference_value)
                elif method == "direct":
                    df[f'{field}_id'] = df[field]
        
        return df
    
    def _extract_reference_value(self, field_value) -> str:
        """Extract ID from platform reference field - can be overridden"""
        if isinstance(field_value, dict) and 'value' in field_value:
            return field_value['value']
        elif isinstance(field_value, str):
            return field_value
        else:
            return ""
    
    def _get_date_range(self, df: pd.DataFrame, date_fields: List[str]) -> Dict[str, Any]:
        """Extract date range from records"""
        for field in date_fields:
            if field in df.columns:
                try:
                    dates = pd.to_datetime(df[field], errors='coerce')
                    return {
                        "field": field,
                        "earliest": dates.min().isoformat(),
                        "latest": dates.max().isoformat(),
                        "span_days": (dates.max() - dates.min()).days
                    }
                except:
                    continue
        
        return {"error": "No valid date fields found"}