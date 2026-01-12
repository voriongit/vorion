"""
ATSF SQLite Persistence
=======================

Persistent storage for ATSF data structures.

Features:
- Save/load DataCube facts
- Save/load AgentMemory entries
- Save/load TKG nodes and edges
- Automatic schema migration
- Connection pooling

Usage:
    from atsf.persistence import ATSFPersistence
    
    # Initialize with SQLite database
    db = ATSFPersistence("atsf_data.db")
    
    # Save agent knowledge base
    db.save_knowledge_base(agent_id, kb)
    
    # Load on restart
    kb = db.load_knowledge_base(agent_id)

Author: ATSF Development Team
Version: 3.4.0
"""

import sqlite3
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import asdict
from contextlib import contextmanager
import threading

logger = logging.getLogger("atsf.persistence")


class ATSFPersistence:
    """
    SQLite persistence layer for ATSF.
    
    Provides persistent storage for:
    - DataCube facts
    - Agent memory entries
    - TKG nodes and edges
    - Agent profiles
    - Trust history
    """
    
    SCHEMA_VERSION = 1
    
    def __init__(self, db_path: str = "atsf_data.db"):
        """
        Initialize persistence layer.
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._local = threading.local()
        self._init_database()
        
        logger.info(f"ATSFPersistence initialized: {db_path}")
    
    @contextmanager
    def _get_connection(self):
        """Get thread-local database connection."""
        if not hasattr(self._local, 'connection'):
            self._local.connection = sqlite3.connect(
                self.db_path,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            self._local.connection.row_factory = sqlite3.Row
        
        try:
            yield self._local.connection
        except Exception:
            self._local.connection.rollback()
            raise
    
    def _init_database(self):
        """Initialize database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Schema version table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            """)
            
            # Check current version
            cursor.execute("SELECT MAX(version) FROM schema_version")
            result = cursor.fetchone()
            current_version = result[0] if result[0] else 0
            
            if current_version < self.SCHEMA_VERSION:
                self._migrate_schema(conn, current_version)
            
            conn.commit()
    
    def _migrate_schema(self, conn, from_version: int):
        """Migrate schema to latest version."""
        cursor = conn.cursor()
        
        if from_version < 1:
            # Initial schema
            
            # Agents table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agents (
                    agent_id TEXT PRIMARY KEY,
                    creator_id TEXT NOT NULL,
                    tier TEXT NOT NULL,
                    trust_score REAL DEFAULT 0.0,
                    trust_ceiling REAL DEFAULT 1.0,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            """)
            
            # Facts table (DataCube)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    action_type TEXT NOT NULL,
                    action_category TEXT,
                    decision TEXT NOT NULL,
                    trust_score REAL,
                    trust_delta REAL,
                    risk_score REAL,
                    processing_time_ms REAL,
                    request_id TEXT,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
                )
            """)
            
            # Memory entries table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS memory_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    importance REAL DEFAULT 0.5,
                    access_count INTEGER DEFAULT 0,
                    decay_factor REAL DEFAULT 1.0,
                    topics TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_accessed TIMESTAMP,
                    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
                )
            """)
            
            # TKG nodes table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tkg_nodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    node_id TEXT NOT NULL,
                    node_type TEXT NOT NULL,
                    label TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT,
                    UNIQUE(agent_id, node_id),
                    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
                )
            """)
            
            # TKG edges table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tkg_edges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    predicate TEXT NOT NULL,
                    object TEXT NOT NULL,
                    valid_from TIMESTAMP,
                    valid_to TIMESTAMP,
                    confidence REAL DEFAULT 1.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
                )
            """)
            
            # Trust history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trust_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    trust_score REAL NOT NULL,
                    trust_delta REAL,
                    action_type TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
                )
            """)
            
            # Constitutional rules table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS constitutional_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    rule_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    rule_text TEXT NOT NULL,
                    keywords TEXT,
                    priority INTEGER DEFAULT 3,
                    active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(agent_id, rule_id),
                    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_facts_agent ON facts(agent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_facts_timestamp ON facts(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_entries(agent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tkg_nodes_agent ON tkg_nodes(agent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tkg_edges_agent ON tkg_edges(agent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trust_history_agent ON trust_history(agent_id)")
            
            # Update schema version
            cursor.execute("INSERT INTO schema_version (version) VALUES (?)", 
                          (self.SCHEMA_VERSION,))
        
        logger.info(f"Schema migrated from v{from_version} to v{self.SCHEMA_VERSION}")
    
    # =========================================================================
    # AGENT OPERATIONS
    # =========================================================================
    
    def save_agent(
        self,
        agent_id: str,
        creator_id: str,
        tier: str,
        trust_score: float = 0.0,
        trust_ceiling: float = 1.0,
        status: str = "active",
        metadata: Optional[Dict] = None
    ) -> bool:
        """Save or update agent profile."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO agents 
                (agent_id, creator_id, tier, trust_score, trust_ceiling, status, 
                 updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                agent_id, creator_id, tier, trust_score, trust_ceiling, status,
                datetime.now(), json.dumps(metadata or {})
            ))
            
            conn.commit()
            return True
    
    def load_agent(self, agent_id: str) -> Optional[Dict]:
        """Load agent profile."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM agents WHERE agent_id = ?", (agent_id,))
            row = cursor.fetchone()
            
            if row:
                return {
                    "agent_id": row["agent_id"],
                    "creator_id": row["creator_id"],
                    "tier": row["tier"],
                    "trust_score": row["trust_score"],
                    "trust_ceiling": row["trust_ceiling"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
                }
            return None
    
    def list_agents(self, creator_id: Optional[str] = None) -> List[Dict]:
        """List all agents, optionally filtered by creator."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if creator_id:
                cursor.execute(
                    "SELECT agent_id, creator_id, tier, trust_score, status FROM agents WHERE creator_id = ?",
                    (creator_id,)
                )
            else:
                cursor.execute(
                    "SELECT agent_id, creator_id, tier, trust_score, status FROM agents"
                )
            
            return [dict(row) for row in cursor.fetchall()]
    
    # =========================================================================
    # FACTS OPERATIONS (DataCube)
    # =========================================================================
    
    def save_fact(
        self,
        agent_id: str,
        timestamp: datetime,
        action_type: str,
        decision: str,
        trust_score: float,
        trust_delta: float = 0.0,
        risk_score: float = 0.0,
        processing_time_ms: float = 0.0,
        action_category: str = None,
        request_id: str = None,
        metadata: Optional[Dict] = None
    ) -> int:
        """Save a fact to the database."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO facts 
                (agent_id, timestamp, action_type, action_category, decision,
                 trust_score, trust_delta, risk_score, processing_time_ms,
                 request_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                agent_id, timestamp, action_type, action_category, decision,
                trust_score, trust_delta, risk_score, processing_time_ms,
                request_id, json.dumps(metadata or {})
            ))
            
            conn.commit()
            return cursor.lastrowid
    
    def save_facts_batch(self, agent_id: str, facts: List[Dict]) -> int:
        """Save multiple facts in a batch."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.executemany("""
                INSERT INTO facts 
                (agent_id, timestamp, action_type, action_category, decision,
                 trust_score, trust_delta, risk_score, processing_time_ms,
                 request_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                (
                    agent_id,
                    f.get("timestamp", datetime.now()),
                    f.get("action_type", "unknown"),
                    f.get("action_category"),
                    f.get("decision", "unknown"),
                    f.get("trust_score", 0.0),
                    f.get("trust_delta", 0.0),
                    f.get("risk_score", 0.0),
                    f.get("processing_time_ms", 0.0),
                    f.get("request_id"),
                    json.dumps(f.get("metadata", {}))
                )
                for f in facts
            ])
            
            conn.commit()
            return len(facts)
    
    def load_facts(
        self,
        agent_id: str,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        action_type: Optional[str] = None,
        decision: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict]:
        """Load facts with optional filters."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM facts WHERE agent_id = ?"
            params = [agent_id]
            
            if since:
                query += " AND timestamp >= ?"
                params.append(since)
            
            if until:
                query += " AND timestamp <= ?"
                params.append(until)
            
            if action_type:
                query += " AND action_type = ?"
                params.append(action_type)
            
            if decision:
                query += " AND decision = ?"
                params.append(decision)
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            
            return [
                {
                    **dict(row),
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
                }
                for row in cursor.fetchall()
            ]
    
    def get_facts_stats(self, agent_id: str) -> Dict:
        """Get aggregate statistics for facts."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    AVG(trust_score) as avg_trust,
                    AVG(risk_score) as avg_risk,
                    SUM(CASE WHEN decision = 'allow' THEN 1 ELSE 0 END) as allowed,
                    SUM(CASE WHEN decision = 'deny' THEN 1 ELSE 0 END) as denied
                FROM facts WHERE agent_id = ?
            """, (agent_id,))
            
            row = cursor.fetchone()
            return dict(row) if row else {}
    
    # =========================================================================
    # MEMORY OPERATIONS
    # =========================================================================
    
    def save_memory(
        self,
        agent_id: str,
        memory_type: str,
        content: Any,
        importance: float = 0.5,
        topics: Optional[List[str]] = None
    ) -> int:
        """Save a memory entry."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO memory_entries 
                (agent_id, memory_type, content, importance, topics)
                VALUES (?, ?, ?, ?, ?)
            """, (
                agent_id, memory_type, json.dumps(content), importance,
                json.dumps(topics or [])
            ))
            
            conn.commit()
            return cursor.lastrowid
    
    def load_memories(
        self,
        agent_id: str,
        memory_type: Optional[str] = None,
        min_importance: float = 0.0,
        limit: int = 100
    ) -> List[Dict]:
        """Load memory entries."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM memory_entries WHERE agent_id = ? AND importance >= ?"
            params = [agent_id, min_importance]
            
            if memory_type:
                query += " AND memory_type = ?"
                params.append(memory_type)
            
            query += " ORDER BY importance DESC, created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            
            return [
                {
                    **dict(row),
                    "content": json.loads(row["content"]),
                    "topics": json.loads(row["topics"]) if row["topics"] else []
                }
                for row in cursor.fetchall()
            ]
    
    def update_memory_access(self, memory_id: int) -> bool:
        """Update memory access count and timestamp."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE memory_entries 
                SET access_count = access_count + 1, last_accessed = ?
                WHERE id = ?
            """, (datetime.now(), memory_id))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def decay_memories(self, agent_id: str, decay_rate: float = 0.99) -> int:
        """Apply decay to all memories."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE memory_entries 
                SET decay_factor = decay_factor * ?
                WHERE agent_id = ?
            """, (decay_rate, agent_id))
            
            conn.commit()
            return cursor.rowcount
    
    def prune_memories(self, agent_id: str, min_effective_importance: float = 0.1) -> int:
        """Prune low-importance memories."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                DELETE FROM memory_entries 
                WHERE agent_id = ? AND (importance * decay_factor) < ?
            """, (agent_id, min_effective_importance))
            
            conn.commit()
            return cursor.rowcount
    
    # =========================================================================
    # TKG OPERATIONS
    # =========================================================================
    
    def save_tkg_node(
        self,
        agent_id: str,
        node_id: str,
        node_type: str,
        label: str = None,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Save TKG node."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO tkg_nodes 
                (agent_id, node_id, node_type, label, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (agent_id, node_id, node_type, label, json.dumps(metadata or {})))
            
            conn.commit()
            return True
    
    def save_tkg_edge(
        self,
        agent_id: str,
        subject: str,
        predicate: str,
        obj: str,
        valid_from: Optional[datetime] = None,
        valid_to: Optional[datetime] = None,
        confidence: float = 1.0
    ) -> int:
        """Save TKG edge."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO tkg_edges 
                (agent_id, subject, predicate, object, valid_from, valid_to, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (agent_id, subject, predicate, obj, valid_from, valid_to, confidence))
            
            conn.commit()
            return cursor.lastrowid
    
    def load_tkg(self, agent_id: str) -> Tuple[List[Dict], List[Dict]]:
        """Load TKG nodes and edges."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Load nodes
            cursor.execute(
                "SELECT * FROM tkg_nodes WHERE agent_id = ?",
                (agent_id,)
            )
            nodes = [
                {
                    **dict(row),
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
                }
                for row in cursor.fetchall()
            ]
            
            # Load edges
            cursor.execute(
                "SELECT * FROM tkg_edges WHERE agent_id = ?",
                (agent_id,)
            )
            edges = [dict(row) for row in cursor.fetchall()]
            
            return nodes, edges
    
    # =========================================================================
    # TRUST HISTORY
    # =========================================================================
    
    def save_trust_snapshot(
        self,
        agent_id: str,
        trust_score: float,
        trust_delta: float = 0.0,
        action_type: str = None
    ) -> int:
        """Save trust history snapshot."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO trust_history 
                (agent_id, trust_score, trust_delta, action_type)
                VALUES (?, ?, ?, ?)
            """, (agent_id, trust_score, trust_delta, action_type))
            
            conn.commit()
            return cursor.lastrowid
    
    def get_trust_history(
        self,
        agent_id: str,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get trust history."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM trust_history WHERE agent_id = ?"
            params = [agent_id]
            
            if since:
                query += " AND timestamp >= ?"
                params.append(since)
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    # =========================================================================
    # CONSTITUTIONAL RULES
    # =========================================================================
    
    def save_rule(
        self,
        agent_id: str,
        rule_id: str,
        category: str,
        rule_text: str,
        keywords: List[str],
        priority: int = 3
    ) -> bool:
        """Save constitutional rule."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO constitutional_rules 
                (agent_id, rule_id, category, rule_text, keywords, priority)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (agent_id, rule_id, category, rule_text, json.dumps(keywords), priority))
            
            conn.commit()
            return True
    
    def load_rules(self, agent_id: str, category: Optional[str] = None) -> List[Dict]:
        """Load constitutional rules."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM constitutional_rules WHERE agent_id = ? AND active = 1"
            params = [agent_id]
            
            if category:
                query += " AND category = ?"
                params.append(category)
            
            query += " ORDER BY priority DESC"
            
            cursor.execute(query, params)
            return [
                {
                    **dict(row),
                    "keywords": json.loads(row["keywords"]) if row["keywords"] else []
                }
                for row in cursor.fetchall()
            ]
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def export_agent_data(self, agent_id: str) -> Dict:
        """Export all data for an agent."""
        return {
            "agent": self.load_agent(agent_id),
            "facts": self.load_facts(agent_id, limit=10000),
            "memories": self.load_memories(agent_id, limit=10000),
            "tkg": {
                "nodes": self.load_tkg(agent_id)[0],
                "edges": self.load_tkg(agent_id)[1]
            },
            "trust_history": self.get_trust_history(agent_id, limit=10000),
            "rules": self.load_rules(agent_id),
            "exported_at": datetime.now().isoformat()
        }
    
    def import_agent_data(self, data: Dict) -> bool:
        """Import agent data from export."""
        agent = data.get("agent", {})
        if not agent:
            return False
        
        agent_id = agent["agent_id"]
        
        # Save agent
        self.save_agent(
            agent_id=agent_id,
            creator_id=agent["creator_id"],
            tier=agent["tier"],
            trust_score=agent.get("trust_score", 0.0),
            trust_ceiling=agent.get("trust_ceiling", 1.0),
            metadata=agent.get("metadata")
        )
        
        # Save facts
        if data.get("facts"):
            self.save_facts_batch(agent_id, data["facts"])
        
        # Save memories
        for mem in data.get("memories", []):
            self.save_memory(
                agent_id=agent_id,
                memory_type=mem["memory_type"],
                content=mem["content"],
                importance=mem.get("importance", 0.5),
                topics=mem.get("topics", [])
            )
        
        return True
    
    def vacuum(self):
        """Optimize database."""
        with self._get_connection() as conn:
            conn.execute("VACUUM")
    
    def get_stats(self) -> Dict:
        """Get database statistics."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            stats = {}
            
            for table in ["agents", "facts", "memory_entries", "tkg_nodes", "tkg_edges"]:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                stats[table] = cursor.fetchone()[0]
            
            return stats


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    import tempfile
    import os
    
    print("=" * 70)
    print("ATSF Persistence Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Use temp database
    db_path = tempfile.mktemp(suffix=".db")
    
    try:
        # Test 1: Initialize database
        tests_total += 1
        try:
            db = ATSFPersistence(db_path)
            assert os.path.exists(db_path)
            print("  ✓ Database initialization works")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Database initialization failed: {e}")
        
        # Test 2: Save/load agent
        tests_total += 1
        try:
            db.save_agent(
                agent_id="test_agent",
                creator_id="test_creator",
                tier="gray_box",
                trust_score=0.5
            )
            
            agent = db.load_agent("test_agent")
            assert agent is not None
            assert agent["agent_id"] == "test_agent"
            assert agent["trust_score"] == 0.5
            print("  ✓ Agent save/load works")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Agent save/load failed: {e}")
        
        # Test 3: Save/load facts
        tests_total += 1
        try:
            fact_id = db.save_fact(
                agent_id="test_agent",
                timestamp=datetime.now(),
                action_type="read",
                decision="allow",
                trust_score=0.5,
                risk_score=0.2
            )
            
            facts = db.load_facts("test_agent")
            assert len(facts) >= 1
            assert facts[0]["action_type"] == "read"
            print("  ✓ Fact save/load works")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Fact save/load failed: {e}")
        
        # Test 4: Batch facts
        tests_total += 1
        try:
            batch = [
                {"action_type": "write", "decision": "allow", "trust_score": 0.5}
                for _ in range(10)
            ]
            count = db.save_facts_batch("test_agent", batch)
            assert count == 10
            
            facts = db.load_facts("test_agent")
            assert len(facts) >= 10
            print("  ✓ Batch facts works")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Batch facts failed: {e}")
        
        # Test 5: Memory operations
        tests_total += 1
        try:
            mem_id = db.save_memory(
                agent_id="test_agent",
                memory_type="episodic",
                content={"action": "test", "result": "success"},
                importance=0.8,
                topics=["test", "memory"]
            )
            
            memories = db.load_memories("test_agent")
            assert len(memories) >= 1
            assert memories[0]["content"]["action"] == "test"
            print("  ✓ Memory operations work")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Memory operations failed: {e}")
        
        # Test 6: TKG operations
        tests_total += 1
        try:
            db.save_tkg_node("test_agent", "node1", "entity", "Test Node")
            db.save_tkg_node("test_agent", "node2", "entity", "Test Node 2")
            db.save_tkg_edge("test_agent", "node1", "connected_to", "node2")
            
            nodes, edges = db.load_tkg("test_agent")
            assert len(nodes) >= 2
            assert len(edges) >= 1
            print("  ✓ TKG operations work")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ TKG operations failed: {e}")
        
        # Test 7: Trust history
        tests_total += 1
        try:
            db.save_trust_snapshot("test_agent", 0.5, 0.01, "read")
            db.save_trust_snapshot("test_agent", 0.51, 0.01, "write")
            
            history = db.get_trust_history("test_agent")
            assert len(history) >= 2
            print("  ✓ Trust history works")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Trust history failed: {e}")
        
        # Test 8: Constitutional rules
        tests_total += 1
        try:
            db.save_rule(
                agent_id="test_agent",
                rule_id="rule_1",
                category="safety",
                rule_text="Always prioritize safety",
                keywords=["safety", "priority"],
                priority=5
            )
            
            rules = db.load_rules("test_agent")
            assert len(rules) >= 1
            assert rules[0]["rule_id"] == "rule_1"
            print("  ✓ Constitutional rules work")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Constitutional rules failed: {e}")
        
        # Test 9: Export/import
        tests_total += 1
        try:
            data = db.export_agent_data("test_agent")
            assert "agent" in data
            assert "facts" in data
            assert "memories" in data
            print("  ✓ Export works")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Export failed: {e}")
        
        # Test 10: Stats
        tests_total += 1
        try:
            stats = db.get_stats()
            assert "agents" in stats
            assert stats["agents"] >= 1
            print(f"  ✓ Stats work (agents={stats['agents']}, facts={stats['facts']})")
            tests_passed += 1
        except Exception as e:
            print(f"  ✗ Stats failed: {e}")
        
    finally:
        # Cleanup
        if os.path.exists(db_path):
            os.remove(db_path)
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
