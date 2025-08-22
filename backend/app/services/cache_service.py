"""
Cache Service for Performance Optimization

Provides caching for expensive operations like Azure Key Vault secrets,
LLM clients, and database queries to improve response times.
"""

import time
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
from functools import lru_cache


class CacheService:
    """
    Singleton cache service for application-wide caching.
    Supports TTL-based expiration and pre-warming.
    """
    
    _instance = None
    _cache: Dict[str, Dict[str, Any]] = {}
    _locks: Dict[str, asyncio.Lock] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CacheService, cls).__new__(cls)
            cls._instance._cache = {}
            cls._instance._locks = {}
        return cls._instance
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        if key in self._cache:
            entry = self._cache[key]
            if entry['expires_at'] > datetime.now():
                print(f"✅ Cache hit for: {key}")
                return entry['value']
            else:
                # Expired, remove from cache
                del self._cache[key]
                print(f"⏰ Cache expired for: {key}")
        return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        """Set value in cache with TTL"""
        expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
        self._cache[key] = {
            'value': value,
            'expires_at': expires_at,
            'created_at': datetime.now()
        }
        print(f"💾 Cached: {key} (TTL: {ttl_seconds}s)")
    
    async def get_or_set_async(self, key: str, factory_fn, ttl_seconds: int = 3600):
        """Get from cache or compute and cache the value (async-safe)"""
        # Check cache first
        cached_value = self.get(key)
        if cached_value is not None:
            return cached_value
        
        # Ensure we have a lock for this key
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        
        # Acquire lock to prevent duplicate computations
        async with self._locks[key]:
            # Double-check cache after acquiring lock
            cached_value = self.get(key)
            if cached_value is not None:
                return cached_value
            
            # Compute value
            print(f"🔄 Computing value for: {key}")
            if asyncio.iscoroutinefunction(factory_fn):
                value = await factory_fn()
            else:
                value = factory_fn()
            
            # Cache and return
            self.set(key, value, ttl_seconds)
            return value
    
    def clear(self, pattern: Optional[str] = None):
        """Clear cache entries matching pattern or all if pattern is None"""
        if pattern is None:
            self._cache.clear()
            print("🗑️ Cleared entire cache")
        else:
            keys_to_remove = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self._cache[key]
            print(f"🗑️ Cleared {len(keys_to_remove)} cache entries matching: {pattern}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_entries = len(self._cache)
        expired_entries = sum(1 for entry in self._cache.values() 
                            if entry['expires_at'] <= datetime.now())
        
        return {
            'total_entries': total_entries,
            'active_entries': total_entries - expired_entries,
            'expired_entries': expired_entries,
            'cache_keys': list(self._cache.keys())
        }


class KeyVaultCache:
    """Specialized cache for Azure Key Vault secrets"""
    
    def __init__(self, cache_service: Optional[CacheService] = None):
        self.cache = cache_service or CacheService()
        self._resolved_secrets = {}
    
    @lru_cache(maxsize=128)
    def _parse_vault_reference(self, secret_ref: str) -> tuple:
        """Parse vault reference and cache the parsing result"""
        if secret_ref.startswith("https://"):
            parts = secret_ref.replace("https://", "").split("/")
            vault_name = parts[0].split(".")[0]
            secret_name = parts[2] if len(parts) > 2 else None
            secret_version = parts[3] if len(parts) > 3 else None
            return vault_name, secret_name, secret_version
        return None, None, None
    
    async def get_secret(self, secret_ref: str) -> Optional[str]:
        """Get secret from cache or Azure Key Vault"""
        # Check in-memory cache first
        if secret_ref in self._resolved_secrets:
            return self._resolved_secrets[secret_ref]
        
        # Use cache service with longer TTL for secrets (12 hours)
        cache_key = f"keyvault:{secret_ref}"
        
        async def fetch_from_vault():
            """Fetch secret from Azure Key Vault"""
            from azure.keyvault.secrets import SecretClient
            from azure.identity import DefaultAzureCredential
            
            vault_name, secret_name, secret_version = self._parse_vault_reference(secret_ref)
            if not vault_name or not secret_name:
                raise ValueError(f"Invalid Key Vault reference: {secret_ref}")
            
            print(f"🔑 Fetching secret from Key Vault: {secret_name}")
            start_time = time.time()
            
            credential = DefaultAzureCredential()
            vault_url = f"https://{vault_name}.vault.azure.net/"
            client = SecretClient(vault_url=vault_url, credential=credential)
            
            secret = client.get_secret(secret_name, version=secret_version)
            
            elapsed = time.time() - start_time
            print(f"✅ Retrieved secret in {elapsed:.2f}s")
            
            # Also store in memory cache
            self._resolved_secrets[secret_ref] = secret.value
            
            return secret.value
        
        # 12 hour TTL for secrets
        return await self.cache.get_or_set_async(cache_key, fetch_from_vault, ttl_seconds=43200)
    
    def get_secret_sync(self, secret_ref: str) -> Optional[str]:
        """Synchronous version of get_secret for compatibility"""
        import asyncio
        
        # Check in-memory cache first
        if secret_ref in self._resolved_secrets:
            return self._resolved_secrets[secret_ref]
        
        # Use standard cache service with shorter TTL for sync operations
        cache_key = f"keyvault_sync:{secret_ref}"
        cached_value = self.cache.get(cache_key)
        if cached_value is not None:
            return cached_value
        
        # Fetch from vault synchronously
        from azure.keyvault.secrets import SecretClient
        from azure.identity import DefaultAzureCredential
        
        vault_name, secret_name, secret_version = self._parse_vault_reference(secret_ref)
        if not vault_name or not secret_name:
            raise ValueError(f"Invalid Key Vault reference: {secret_ref}")
        
        print(f"🔑 Fetching secret from Key Vault (sync): {secret_name}")
        start_time = time.time()
        
        credential = DefaultAzureCredential()
        vault_url = f"https://{vault_name}.vault.azure.net/"
        client = SecretClient(vault_url=vault_url, credential=credential)
        
        secret = client.get_secret(secret_name, version=secret_version)
        
        elapsed = time.time() - start_time
        print(f"✅ Retrieved secret in {elapsed:.2f}s")
        
        # Cache both in memory and cache service (6 hour TTL for sync)
        self._resolved_secrets[secret_ref] = secret.value
        self.cache.set(cache_key, secret.value, ttl_seconds=21600)
        
        return secret.value
    
    def pre_warm(self, secret_refs: list):
        """Pre-warm cache with commonly used secrets"""
        print(f"🔥 Pre-warming Key Vault cache with {len(secret_refs)} secrets")
        for secret_ref in secret_refs:
            asyncio.create_task(self.get_secret(secret_ref))


class LLMClientCache:
    """Cache for LLM client instances to avoid repeated initialization"""
    
    def __init__(self, cache_service: Optional[CacheService] = None):
        self.cache = cache_service or CacheService()
        self._clients = {}
    
    def get_or_create_client(self, config_key: str, factory_fn):
        """Get cached LLM client or create new one"""
        if config_key in self._clients:
            print(f"✅ Using cached LLM client: {config_key}")
            return self._clients[config_key]
        
        print(f"🔧 Creating new LLM client: {config_key}")
        client = factory_fn()
        self._clients[config_key] = client
        return client
    
    def clear_client(self, config_key: str):
        """Remove a specific client from cache"""
        if config_key in self._clients:
            del self._clients[config_key]
            print(f"🗑️ Cleared LLM client: {config_key}")


# Global cache instances
cache_service = CacheService()
keyvault_cache = KeyVaultCache(cache_service)
llm_client_cache = LLMClientCache(cache_service)