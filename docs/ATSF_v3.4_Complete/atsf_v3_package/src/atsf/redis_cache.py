"""
ATSF Redis Caching Layer
========================

High-performance caching for ATSF with Redis.

Features:
- Trust score caching
- Action decision caching
- Rate limiting with Redis
- Distributed locks
- Pub/sub for real-time events

Usage:
    from atsf.redis_cache import ATSFRedisCache
    
    # Initialize cache
    cache = ATSFRedisCache(host="localhost", port=6379)
    
    # Cache trust scores
    cache.set_trust("agent_001", 0.65, ttl=300)
    trust = cache.get_trust("agent_001")

Author: ATSF Development Team
Version: 3.4.0
"""

import json
import logging
import time
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Callable, Union
from dataclasses import dataclass, asdict
from contextlib import contextmanager
import threading

logger = logging.getLogger("atsf.redis_cache")


# =============================================================================
# CACHE KEY PREFIXES
# =============================================================================

class CachePrefix:
    """Cache key prefixes for organization."""
    TRUST = "atsf:trust:"
    ACTION = "atsf:action:"
    DECISION = "atsf:decision:"
    RATE_LIMIT = "atsf:rate:"
    LOCK = "atsf:lock:"
    SESSION = "atsf:session:"
    METRICS = "atsf:metrics:"
    AGENT = "atsf:agent:"
    EVENT = "atsf:event:"


# =============================================================================
# MOCK REDIS CLIENT (for when Redis is not available)
# =============================================================================

class MockRedisClient:
    """
    In-memory mock Redis client for development/testing.
    Provides basic Redis-like functionality without Redis server.
    """
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._pubsub_handlers: Dict[str, List[Callable]] = {}
    
    def _check_expiry(self, key: str) -> bool:
        """Check if key has expired."""
        if key in self._expiry:
            if time.time() > self._expiry[key]:
                del self._data[key]
                del self._expiry[key]
                return True
        return False
    
    def get(self, key: str) -> Optional[bytes]:
        with self._lock:
            self._check_expiry(key)
            value = self._data.get(key)
            if value is not None:
                return value.encode() if isinstance(value, str) else value
            return None
    
    def set(self, key: str, value: Any, ex: int = None, px: int = None) -> bool:
        with self._lock:
            self._data[key] = value if isinstance(value, str) else str(value)
            if ex:
                self._expiry[key] = time.time() + ex
            elif px:
                self._expiry[key] = time.time() + (px / 1000)
            return True
    
    def setex(self, key: str, seconds: int, value: Any) -> bool:
        return self.set(key, value, ex=seconds)
    
    def delete(self, *keys) -> int:
        count = 0
        with self._lock:
            for key in keys:
                if key in self._data:
                    del self._data[key]
                    self._expiry.pop(key, None)
                    count += 1
        return count
    
    def exists(self, key: str) -> int:
        with self._lock:
            self._check_expiry(key)
            return 1 if key in self._data else 0
    
    def expire(self, key: str, seconds: int) -> bool:
        with self._lock:
            if key in self._data:
                self._expiry[key] = time.time() + seconds
                return True
            return False
    
    def ttl(self, key: str) -> int:
        with self._lock:
            if key in self._expiry:
                remaining = self._expiry[key] - time.time()
                return max(0, int(remaining))
            return -1 if key in self._data else -2
    
    def incr(self, key: str) -> int:
        with self._lock:
            value = int(self._data.get(key, 0))
            value += 1
            self._data[key] = str(value)
            return value
    
    def incrby(self, key: str, amount: int) -> int:
        with self._lock:
            value = int(self._data.get(key, 0))
            value += amount
            self._data[key] = str(value)
            return value
    
    def incrbyfloat(self, key: str, amount: float) -> float:
        with self._lock:
            value = float(self._data.get(key, 0))
            value += amount
            self._data[key] = str(value)
            return value
    
    def hset(self, name: str, key: str = None, value: Any = None, mapping: Dict = None) -> int:
        with self._lock:
            if name not in self._data:
                self._data[name] = {}
            
            if mapping:
                self._data[name].update(mapping)
                return len(mapping)
            elif key is not None:
                self._data[name][key] = value
                return 1
            return 0
    
    def hget(self, name: str, key: str) -> Optional[bytes]:
        with self._lock:
            if name in self._data and key in self._data[name]:
                val = self._data[name][key]
                return val.encode() if isinstance(val, str) else val
            return None
    
    def hgetall(self, name: str) -> Dict:
        with self._lock:
            return self._data.get(name, {}).copy()
    
    def hdel(self, name: str, *keys) -> int:
        count = 0
        with self._lock:
            if name in self._data:
                for key in keys:
                    if key in self._data[name]:
                        del self._data[name][key]
                        count += 1
        return count
    
    def lpush(self, key: str, *values) -> int:
        with self._lock:
            if key not in self._data:
                self._data[key] = []
            for v in values:
                self._data[key].insert(0, v)
            return len(self._data[key])
    
    def rpush(self, key: str, *values) -> int:
        with self._lock:
            if key not in self._data:
                self._data[key] = []
            self._data[key].extend(values)
            return len(self._data[key])
    
    def lrange(self, key: str, start: int, stop: int) -> List:
        with self._lock:
            if key not in self._data:
                return []
            if stop == -1:
                return self._data[key][start:]
            return self._data[key][start:stop+1]
    
    def ltrim(self, key: str, start: int, stop: int) -> bool:
        with self._lock:
            if key in self._data:
                if stop == -1:
                    self._data[key] = self._data[key][start:]
                else:
                    self._data[key] = self._data[key][start:stop+1]
            return True
    
    def sadd(self, key: str, *values) -> int:
        with self._lock:
            if key not in self._data:
                self._data[key] = set()
            before = len(self._data[key])
            self._data[key].update(values)
            return len(self._data[key]) - before
    
    def smembers(self, key: str) -> set:
        with self._lock:
            return self._data.get(key, set()).copy()
    
    def srem(self, key: str, *values) -> int:
        count = 0
        with self._lock:
            if key in self._data:
                for v in values:
                    if v in self._data[key]:
                        self._data[key].discard(v)
                        count += 1
        return count
    
    def publish(self, channel: str, message: str) -> int:
        handlers = self._pubsub_handlers.get(channel, [])
        for handler in handlers:
            try:
                handler({"channel": channel, "data": message})
            except Exception:
                pass
        return len(handlers)
    
    def pubsub(self):
        return MockPubSub(self)
    
    def pipeline(self):
        return MockPipeline(self)
    
    def ping(self) -> bool:
        return True
    
    def flushdb(self) -> bool:
        with self._lock:
            self._data.clear()
            self._expiry.clear()
        return True


class MockPubSub:
    def __init__(self, client: MockRedisClient):
        self._client = client
        self._channels: List[str] = []
    
    def subscribe(self, *channels) -> None:
        self._channels.extend(channels)
    
    def unsubscribe(self, *channels) -> None:
        for ch in channels:
            if ch in self._channels:
                self._channels.remove(ch)
    
    def listen(self):
        # In mock, just yield nothing
        return iter([])


class MockPipeline:
    def __init__(self, client: MockRedisClient):
        self._client = client
        self._commands: List = []
    
    def __getattr__(self, name):
        def method(*args, **kwargs):
            self._commands.append((name, args, kwargs))
            return self
        return method
    
    def execute(self):
        results = []
        for name, args, kwargs in self._commands:
            method = getattr(self._client, name)
            results.append(method(*args, **kwargs))
        self._commands.clear()
        return results


# =============================================================================
# ATSF REDIS CACHE
# =============================================================================

class ATSFRedisCache:
    """
    Redis caching layer for ATSF.
    
    Provides high-performance caching for:
    - Trust scores
    - Action decisions
    - Rate limiting
    - Distributed locks
    - Real-time event pub/sub
    
    Falls back to in-memory mock when Redis is unavailable.
    """
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        default_ttl: int = 300,  # 5 minutes
        use_mock: bool = False
    ):
        self.host = host
        self.port = port
        self.db = db
        self.default_ttl = default_ttl
        
        if use_mock:
            self._client = MockRedisClient()
            self._using_mock = True
            logger.info("ATSFRedisCache using mock client")
        else:
            try:
                import redis
                self._client = redis.Redis(
                    host=host,
                    port=port,
                    db=db,
                    password=password,
                    decode_responses=False
                )
                # Test connection
                self._client.ping()
                self._using_mock = False
                logger.info(f"ATSFRedisCache connected to {host}:{port}")
            except Exception as e:
                logger.warning(f"Redis unavailable ({e}), using mock client")
                self._client = MockRedisClient()
                self._using_mock = True
    
    def _serialize(self, value: Any) -> str:
        """Serialize value to JSON string."""
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return str(value)
    
    def _deserialize(self, value: Optional[bytes]) -> Any:
        """Deserialize value from Redis."""
        if value is None:
            return None
        
        if isinstance(value, bytes):
            value = value.decode()
        
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    
    # =========================================================================
    # TRUST SCORE CACHING
    # =========================================================================
    
    def set_trust(self, agent_id: str, score: float, ttl: int = None) -> bool:
        """Cache trust score for an agent."""
        key = f"{CachePrefix.TRUST}{agent_id}"
        data = {
            "score": score,
            "cached_at": datetime.now().isoformat()
        }
        return self._client.setex(key, ttl or self.default_ttl, self._serialize(data))
    
    def get_trust(self, agent_id: str) -> Optional[float]:
        """Get cached trust score."""
        key = f"{CachePrefix.TRUST}{agent_id}"
        data = self._deserialize(self._client.get(key))
        if data and isinstance(data, dict):
            return data.get("score")
        return None
    
    def invalidate_trust(self, agent_id: str) -> bool:
        """Invalidate cached trust score."""
        key = f"{CachePrefix.TRUST}{agent_id}"
        return self._client.delete(key) > 0
    
    # =========================================================================
    # ACTION DECISION CACHING
    # =========================================================================
    
    def cache_decision(
        self,
        agent_id: str,
        action_type: str,
        action_hash: str,
        decision: str,
        ttl: int = 60
    ) -> bool:
        """Cache action decision for deduplication."""
        key = f"{CachePrefix.DECISION}{agent_id}:{action_type}:{action_hash}"
        data = {
            "decision": decision,
            "cached_at": datetime.now().isoformat()
        }
        return self._client.setex(key, ttl, self._serialize(data))
    
    def get_cached_decision(
        self,
        agent_id: str,
        action_type: str,
        action_hash: str
    ) -> Optional[str]:
        """Get cached decision if available."""
        key = f"{CachePrefix.DECISION}{agent_id}:{action_type}:{action_hash}"
        data = self._deserialize(self._client.get(key))
        if data and isinstance(data, dict):
            return data.get("decision")
        return None
    
    @staticmethod
    def hash_action(action_type: str, payload: Dict) -> str:
        """Generate hash for action deduplication."""
        data = f"{action_type}:{json.dumps(payload, sort_keys=True)}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    # =========================================================================
    # RATE LIMITING
    # =========================================================================
    
    def check_rate_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> tuple:
        """
        Check rate limit using sliding window.
        
        Returns:
            Tuple of (allowed: bool, remaining: int, reset_at: float)
        """
        redis_key = f"{CachePrefix.RATE_LIMIT}{key}"
        now = time.time()
        window_start = now - window_seconds
        
        # Use pipeline for atomicity
        pipe = self._client.pipeline()
        
        # Remove old entries
        if not self._using_mock:
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, window_seconds)
            results = pipe.execute()
            current_count = results[1]
        else:
            # Mock implementation
            current_count = int(self._client.get(redis_key) or b'0')
            self._client.incr(redis_key)
            self._client.expire(redis_key, window_seconds)
        
        allowed = current_count < limit
        remaining = max(0, limit - current_count - 1)
        reset_at = now + window_seconds
        
        return allowed, remaining, reset_at
    
    def get_rate_limit_status(self, key: str) -> Dict:
        """Get current rate limit status."""
        redis_key = f"{CachePrefix.RATE_LIMIT}{key}"
        
        if self._using_mock:
            count = int(self._client.get(redis_key) or b'0')
        else:
            count = self._client.zcard(redis_key) if hasattr(self._client, 'zcard') else 0
        
        ttl = self._client.ttl(redis_key)
        
        return {
            "key": key,
            "current_count": count,
            "ttl_seconds": ttl
        }
    
    # =========================================================================
    # DISTRIBUTED LOCKS
    # =========================================================================
    
    @contextmanager
    def lock(self, name: str, timeout: int = 10, blocking: bool = True):
        """
        Distributed lock using Redis.
        
        Usage:
            with cache.lock("my_resource"):
                # Critical section
                pass
        """
        key = f"{CachePrefix.LOCK}{name}"
        token = hashlib.sha256(f"{time.time()}:{threading.current_thread().ident}".encode()).hexdigest()[:16]
        
        acquired = False
        start = time.time()
        
        while True:
            # Try to acquire
            if self._client.set(key, token, ex=timeout, px=None) if not self._using_mock else self._set_nx(key, token, timeout):
                acquired = True
                break
            
            if not blocking:
                break
            
            if time.time() - start > timeout:
                break
            
            time.sleep(0.1)
        
        try:
            if acquired:
                yield True
            else:
                yield False
        finally:
            if acquired:
                # Only release if we still hold the lock
                current = self._client.get(key)
                if current and current.decode() == token:
                    self._client.delete(key)
    
    def _set_nx(self, key: str, value: str, timeout: int) -> bool:
        """Set if not exists (for mock client)."""
        if not self._client.exists(key):
            self._client.setex(key, timeout, value)
            return True
        return False
    
    # =========================================================================
    # AGENT SESSION MANAGEMENT
    # =========================================================================
    
    def start_session(self, agent_id: str, metadata: Dict = None) -> str:
        """Start a new agent session."""
        session_id = hashlib.sha256(f"{agent_id}:{time.time()}".encode()).hexdigest()[:16]
        key = f"{CachePrefix.SESSION}{agent_id}:{session_id}"
        
        data = {
            "session_id": session_id,
            "agent_id": agent_id,
            "started_at": datetime.now().isoformat(),
            "metadata": metadata or {},
            "action_count": 0
        }
        
        self._client.setex(key, 3600, self._serialize(data))  # 1 hour TTL
        return session_id
    
    def update_session(self, agent_id: str, session_id: str, updates: Dict) -> bool:
        """Update session data."""
        key = f"{CachePrefix.SESSION}{agent_id}:{session_id}"
        data = self._deserialize(self._client.get(key))
        
        if data:
            data.update(updates)
            data["updated_at"] = datetime.now().isoformat()
            return self._client.set(key, self._serialize(data))
        return False
    
    def get_session(self, agent_id: str, session_id: str) -> Optional[Dict]:
        """Get session data."""
        key = f"{CachePrefix.SESSION}{agent_id}:{session_id}"
        return self._deserialize(self._client.get(key))
    
    def end_session(self, agent_id: str, session_id: str) -> bool:
        """End an agent session."""
        key = f"{CachePrefix.SESSION}{agent_id}:{session_id}"
        return self._client.delete(key) > 0
    
    # =========================================================================
    # METRICS CACHING
    # =========================================================================
    
    def increment_metric(self, name: str, value: float = 1.0) -> float:
        """Increment a metric counter."""
        key = f"{CachePrefix.METRICS}{name}"
        return self._client.incrbyfloat(key, value)
    
    def get_metric(self, name: str) -> float:
        """Get metric value."""
        key = f"{CachePrefix.METRICS}{name}"
        value = self._client.get(key)
        return float(value) if value else 0.0
    
    def set_metric(self, name: str, value: float, ttl: int = None) -> bool:
        """Set metric value."""
        key = f"{CachePrefix.METRICS}{name}"
        if ttl:
            return self._client.setex(key, ttl, str(value))
        return self._client.set(key, str(value))
    
    # =========================================================================
    # EVENT STREAMING
    # =========================================================================
    
    def publish_event(self, channel: str, event: Dict) -> int:
        """Publish event to channel."""
        return self._client.publish(
            f"{CachePrefix.EVENT}{channel}",
            self._serialize(event)
        )
    
    def subscribe_events(self, channel: str, handler: Callable) -> None:
        """Subscribe to event channel."""
        pubsub = self._client.pubsub()
        pubsub.subscribe(f"{CachePrefix.EVENT}{channel}")
        
        if self._using_mock:
            if channel not in self._client._pubsub_handlers:
                self._client._pubsub_handlers[channel] = []
            self._client._pubsub_handlers[channel].append(handler)
    
    # =========================================================================
    # AGENT DATA CACHING
    # =========================================================================
    
    def cache_agent(self, agent_id: str, data: Dict, ttl: int = None) -> bool:
        """Cache agent data."""
        key = f"{CachePrefix.AGENT}{agent_id}"
        return self._client.setex(key, ttl or self.default_ttl, self._serialize(data))
    
    def get_agent(self, agent_id: str) -> Optional[Dict]:
        """Get cached agent data."""
        key = f"{CachePrefix.AGENT}{agent_id}"
        return self._deserialize(self._client.get(key))
    
    def invalidate_agent(self, agent_id: str) -> bool:
        """Invalidate cached agent data."""
        key = f"{CachePrefix.AGENT}{agent_id}"
        return self._client.delete(key) > 0
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def health_check(self) -> Dict:
        """Check cache health."""
        try:
            start = time.time()
            self._client.ping()
            latency = (time.time() - start) * 1000
            
            return {
                "status": "healthy",
                "using_mock": self._using_mock,
                "latency_ms": round(latency, 2)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def clear_all(self) -> bool:
        """Clear all ATSF cache data."""
        return self._client.flushdb()
    
    def get_stats(self) -> Dict:
        """Get cache statistics."""
        return {
            "using_mock": self._using_mock,
            "host": self.host if not self._using_mock else "mock",
            "port": self.port if not self._using_mock else 0,
            "default_ttl": self.default_ttl
        }


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF Redis Cache Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Use mock for testing
    cache = ATSFRedisCache(use_mock=True)
    
    # Test 1: Trust caching
    tests_total += 1
    try:
        cache.set_trust("agent_001", 0.75)
        trust = cache.get_trust("agent_001")
        assert trust == 0.75
        print("  ✓ Trust caching works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Trust caching failed: {e}")
    
    # Test 2: Decision caching
    tests_total += 1
    try:
        action_hash = cache.hash_action("read", {"target": "file.txt"})
        cache.cache_decision("agent_001", "read", action_hash, "allow")
        decision = cache.get_cached_decision("agent_001", "read", action_hash)
        assert decision == "allow"
        print("  ✓ Decision caching works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Decision caching failed: {e}")
    
    # Test 3: Rate limiting
    tests_total += 1
    try:
        for i in range(5):
            allowed, remaining, reset = cache.check_rate_limit("test_key", 10, 60)
            assert allowed is True
        print("  ✓ Rate limiting works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Rate limiting failed: {e}")
    
    # Test 4: Distributed lock
    tests_total += 1
    try:
        with cache.lock("test_resource", timeout=5) as acquired:
            assert acquired is True
        print("  ✓ Distributed lock works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Distributed lock failed: {e}")
    
    # Test 5: Session management
    tests_total += 1
    try:
        session_id = cache.start_session("agent_001", {"source": "test"})
        assert session_id is not None
        
        session = cache.get_session("agent_001", session_id)
        assert session["agent_id"] == "agent_001"
        
        cache.end_session("agent_001", session_id)
        print("  ✓ Session management works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Session management failed: {e}")
    
    # Test 6: Metrics
    tests_total += 1
    try:
        cache.set_metric("actions_total", 0)
        cache.increment_metric("actions_total", 5)
        value = cache.get_metric("actions_total")
        assert value == 5
        print("  ✓ Metrics work")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Metrics failed: {e}")
    
    # Test 7: Agent caching
    tests_total += 1
    try:
        cache.cache_agent("agent_002", {"trust": 0.5, "tier": "gray_box"})
        agent = cache.get_agent("agent_002")
        assert agent["trust"] == 0.5
        print("  ✓ Agent caching works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Agent caching failed: {e}")
    
    # Test 8: Invalidation
    tests_total += 1
    try:
        cache.set_trust("agent_003", 0.8)
        assert cache.get_trust("agent_003") == 0.8
        
        cache.invalidate_trust("agent_003")
        assert cache.get_trust("agent_003") is None
        print("  ✓ Invalidation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Invalidation failed: {e}")
    
    # Test 9: Health check
    tests_total += 1
    try:
        health = cache.health_check()
        assert health["status"] == "healthy"
        print(f"  ✓ Health check works (latency={health['latency_ms']}ms)")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Health check failed: {e}")
    
    # Test 10: Action hash
    tests_total += 1
    try:
        hash1 = cache.hash_action("read", {"target": "a"})
        hash2 = cache.hash_action("read", {"target": "a"})
        hash3 = cache.hash_action("read", {"target": "b"})
        
        assert hash1 == hash2  # Same action = same hash
        assert hash1 != hash3  # Different action = different hash
        print("  ✓ Action hashing works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Action hashing failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
