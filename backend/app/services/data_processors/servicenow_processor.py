"""
ServiceNow Data Processor
Specialized processor for ServiceNow incident and record analysis
"""

import pandas as pd
import logging
from typing import Dict, List, Any
from .base_processor import BaseDataProcessor

logger = logging.getLogger(__name__)


class ServiceNowDataProcessor(BaseDataProcessor):
    """ServiceNow-specific data processor for incidents and other ServiceNow records"""
    
    def __init__(self):
        super().__init__()
        self.platform = "ServiceNow"
        
        # ServiceNow-specific field mappings
        self.reference_field_mappings = {
            'company': 'reference_value',
            'assignment_group': 'reference_value',
            'assigned_to': 'reference_value',
            'caller_id': 'reference_value',
            'opened_by': 'reference_value'
        }
        
        # ServiceNow state mappings
        self.status_mapping = {
            1: "New",
            2: "In Progress", 
            3: "On Hold",
            6: "Resolved",
            7: "Closed",
            8: "Cancelled"
        }
    
    def get_supported_query_types(self) -> List[str]:
        """Return ServiceNow-specific query types"""
        return [
            "general",
            "top_customers", "top_companies", "group_by_company",
            "top_teams", "group_by_team",
            "status_analysis", "group_by_status",
            "priority_analysis"
        ]
    
    def process_data(self, incidents: List[Dict], query_type: str = "general") -> Dict[str, Any]:
        """
        Process ServiceNow incidents and return summarized data
        
        Args:
            incidents: List of incident dictionaries from ServiceNow API
            query_type: Type of ServiceNow analysis to perform
            
        Returns:
            Processed and summarized data ready for LLM consumption
        """
        try:
            if not incidents:
                return {"error": "No incidents provided"}
            
            # Convert to DataFrame for efficient processing
            df = pd.DataFrame(incidents)
            
            logger.info(f"📊 Processing {len(df)} ServiceNow incidents for query type: {query_type}")
            
            # Normalize ServiceNow reference fields
            df = self._normalize_servicenow_fields(df)
            
            # Route to appropriate processing method
            if query_type in ["top_customers", "top_companies", "group_by_company"]:
                return self._process_company_grouping(df)
            elif query_type in ["top_teams", "group_by_team"]:
                return self._process_team_grouping(df)
            elif query_type in ["status_analysis", "group_by_status"]:
                return self._process_status_grouping(df)
            elif query_type in ["priority_analysis"]:
                return self._process_priority_analysis(df)
            else:
                return self._process_general_summary(df)
                
        except Exception as e:
            logger.error(f"❌ Error processing ServiceNow incidents: {e}")
            return {"error": f"ServiceNow data processing failed: {str(e)}"}
    
    def _normalize_servicenow_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract sys_ids and normalize ServiceNow-specific fields"""
        
        # Process company field
        if 'company' in df.columns:
            df['company_id'] = df['company'].apply(self._extract_reference_value)
            df['has_company'] = df['company_id'] != ""
        
        # Process assignment_group field  
        if 'assignment_group' in df.columns:
            df['assignment_group_id'] = df['assignment_group'].apply(self._extract_reference_value)
        
        # Process other reference fields
        for field in ['assigned_to', 'caller_id', 'opened_by']:
            if field in df.columns:
                df[f'{field}_id'] = df[field].apply(self._extract_reference_value)
        
        return df
    
    def _process_company_grouping(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Process ServiceNow incidents grouped by company"""
        
        # Filter incidents with company data
        company_incidents = df[df['has_company'] == True].copy()
        
        if company_incidents.empty:
            return {
                "summary": "No ServiceNow incidents found with company information",
                "total_incidents": len(df),
                "incidents_with_company": 0,
                "top_companies": []
            }
        
        # Group by company and aggregate
        company_stats = (company_incidents
                        .groupby('company_id')
                        .agg({
                            'number': 'count',
                            'state': ['nunique', lambda x: list(x.value_counts().to_dict().items())],
                            'priority': lambda x: list(x.value_counts().to_dict().items()),
                            'short_description': lambda x: list(x.head(3))  # Sample incidents
                        })
                        .reset_index())
        
        # Flatten column names
        company_stats.columns = ['company_id', 'incident_count', 'unique_states', 'state_breakdown', 
                               'priority_breakdown', 'sample_incidents']
        
        # Sort by incident count
        company_stats = company_stats.sort_values('incident_count', ascending=False)
        
        # Get top companies
        top_companies = []
        for _, row in company_stats.head(10).iterrows():
            
            # Get sample incident numbers and details
            sample_incidents = company_incidents[company_incidents['company_id'] == row['company_id']].head(3)
            samples = []
            for _, incident in sample_incidents.iterrows():
                samples.append({
                    'number': incident.get('number', 'N/A'),
                    'priority': incident.get('priority', 'N/A'),
                    'state': incident.get('state', 'N/A'),
                    'short_description': incident.get('short_description', 'N/A')[:100]
                })
            
            top_companies.append({
                'company_id': row['company_id'],
                'incident_count': int(row['incident_count']),
                'unique_states': int(row['unique_states']),
                'state_breakdown': dict(row['state_breakdown']),
                'priority_breakdown': dict(row['priority_breakdown']),
                'sample_incidents': samples
            })
        
        return {
            "query_type": "servicenow_company_grouping",
            "platform": "ServiceNow",
            "summary": f"Processed {len(df)} ServiceNow incidents, {len(company_incidents)} have company data",
            "total_incidents": len(df),
            "incidents_with_company": len(company_incidents), 
            "incidents_without_company": len(df) - len(company_incidents),
            "unique_companies": len(company_stats),
            "top_companies": top_companies,
            "processing_method": "pandas_aggregation",
            "company_resolution_needed": True  # Flag that company names need resolution
        }
    
    def _process_team_grouping(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Process ServiceNow incidents grouped by assignment team"""
        
        if 'assignment_group_id' not in df.columns:
            return {"error": "No assignment_group field found in ServiceNow data"}
        
        # Filter incidents with assignment group
        team_incidents = df[df['assignment_group_id'] != ""].copy()
        
        # Group by assignment group
        team_stats = (team_incidents
                     .groupby('assignment_group_id')
                     .agg({
                         'number': 'count',
                         'state': lambda x: list(x.value_counts().to_dict().items()),
                         'priority': 'mean'
                     })
                     .reset_index())
        
        team_stats.columns = ['team_id', 'incident_count', 'state_breakdown', 'avg_priority']
        team_stats = team_stats.sort_values('incident_count', ascending=False)
        
        return {
            "query_type": "servicenow_team_grouping",
            "platform": "ServiceNow", 
            "summary": f"Processed {len(team_incidents)} ServiceNow incidents across {len(team_stats)} teams",
            "total_incidents": len(df),
            "incidents_with_team": len(team_incidents),
            "top_teams": team_stats.head(10).to_dict('records')
        }
    
    def _process_status_grouping(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Process ServiceNow incidents grouped by status/state"""
        
        if 'state' not in df.columns:
            return {"error": "No state field found in ServiceNow data"}
        
        # Group by state
        status_stats = df['state'].value_counts().to_dict()
        
        # Map ServiceNow state numbers to names
        mapped_stats = {}
        for state, count in status_stats.items():
            state_name = self.status_mapping.get(state, f"State {state}")
            mapped_stats[state_name] = count
        
        return {
            "query_type": "servicenow_status_analysis",
            "platform": "ServiceNow",
            "summary": f"ServiceNow status breakdown of {len(df)} incidents",
            "total_incidents": len(df),
            "status_breakdown": mapped_stats,
            "unique_statuses": len(status_stats)
        }
    
    def _process_priority_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Process ServiceNow incidents by priority levels"""
        
        if 'priority' not in df.columns:
            return {"error": "No priority field found in ServiceNow data"}
        
        priority_stats = df['priority'].value_counts().sort_index().to_dict()
        
        return {
            "query_type": "servicenow_priority_analysis",
            "platform": "ServiceNow",
            "summary": f"ServiceNow priority breakdown of {len(df)} incidents", 
            "total_incidents": len(df),
            "priority_breakdown": priority_stats,
            "high_priority_count": len(df[df['priority'].isin([1, 2])]) if 'priority' in df.columns else 0
        }
    
    def _process_general_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """General summary of ServiceNow incidents dataset"""
        
        summary = {
            "query_type": "servicenow_general_summary",
            "platform": "ServiceNow",
            "total_incidents": len(df),
            "date_range": self._get_date_range(df, ['opened_at', 'sys_created_on', 'closed_at']),
            "field_summary": {}
        }
        
        # Analyze available ServiceNow fields
        for col in df.columns:
            if col in ['company_id', 'assignment_group_id']:
                non_empty = len(df[df[col] != ""])
                summary["field_summary"][col] = {
                    "non_empty_count": non_empty,
                    "empty_count": len(df) - non_empty
                }
        
        return summary