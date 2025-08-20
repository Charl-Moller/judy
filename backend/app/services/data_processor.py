"""
Data Processing Service Factory
Routes data processing requests to platform-specific processors
"""

import logging
from typing import Dict, List, Any, Optional
from .data_processors import (
    BaseDataProcessor, 
    ServiceNowDataProcessor, 
    SalesforceDataProcessor,
    BRMDataProcessor,
    MerakiDataProcessor
)

logger = logging.getLogger(__name__)

class DataProcessor:
    """Factory service for routing to platform-specific data processors"""
    
    def __init__(self):
        self.processors = {
            'servicenow': ServiceNowDataProcessor(),
            'salesforce': SalesforceDataProcessor(), 
            'brm': BRMDataProcessor(),
            'meraki': MerakiDataProcessor()
        }
        
    def get_processor(self, platform: str) -> BaseDataProcessor:
        """Get the appropriate processor for a platform"""
        platform_key = platform.lower()
        if platform_key not in self.processors:
            raise ValueError(f"No processor available for platform: {platform}")
        return self.processors[platform_key]
    
    def process_servicenow_incidents(self, incidents: List[Dict], query_type: str = "general") -> Dict[str, Any]:
        """
        Process ServiceNow incidents list and return summarized data
        
        Args:
            incidents: List of incident dictionaries from ServiceNow API
            query_type: Type of query (grouping, top_by, status_analysis, etc.)
            
        Returns:
            Processed and summarized data ready for LLM consumption
        """
        processor = self.get_processor('servicenow')
        return processor.process_data(incidents, query_type)
    
    def process_platform_data(self, platform: str, data: List[Dict], query_type: str = "general") -> Dict[str, Any]:
        """
        Process data for any supported platform
        
        Args:
            platform: Platform identifier (servicenow, salesforce, brm, meraki)
            data: List of records from the platform API
            query_type: Type of analysis to perform
            
        Returns:
            Processed and summarized data ready for LLM consumption
        """
        try:
            processor = self.get_processor(platform)
            return processor.process_data(data, query_type)
        except ValueError as e:
            logger.error(f"❌ {e}")
            return {"error": str(e)}
        except Exception as e:
            logger.error(f"❌ Error processing {platform} data: {e}")
            return {"error": f"{platform} data processing failed: {str(e)}"}
    
    def get_supported_query_types(self, platform: str) -> List[str]:
        """Get supported query types for a platform"""
        try:
            processor = self.get_processor(platform)
            return processor.get_supported_query_types()
        except ValueError:
            return []

# Factory function for backward compatibility
def create_data_processor() -> DataProcessor:
    """Create data processor instance"""
    return DataProcessor()