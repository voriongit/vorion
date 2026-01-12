"""
ATSF Multi-Dimensional Data Cubes
==================================

OLAP-style analytics for agent knowledge base, memory, and processing.

Features:
- Multi-dimensional analysis (time, agent, creator, action, risk, etc.)
- Slice, dice, roll-up, drill-down operations
- Real-time and batch aggregations
- Agent memory with temporal awareness
- Pattern detection across dimensions

Author: ATSF Development Team
Version: 3.4.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set, Callable, Union
from enum import Enum
from collections import defaultdict
import hashlib
import json
import logging
import statistics
import math

logger = logging.getLogger("atsf.datacube")


# =============================================================================
# DIMENSION DEFINITIONS
# =============================================================================

class TimeDimension(Enum):
    """Time granularity levels."""
    SECOND = "second"
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


class AgentDimension(Enum):
    """Agent hierarchy levels."""
    INSTANCE = "instance"      # Individual agent
    TIER = "tier"              # Transparency tier
    CREATOR = "creator"        # Parent creator
    ORGANIZATION = "org"       # Organization
    ALL = "all"                # All agents


class ActionDimension(Enum):
    """Action type hierarchy."""
    INSTANCE = "instance"      # Individual action
    TYPE = "type"              # read, write, execute, etc.
    CATEGORY = "category"      # data, network, system
    RISK_BAND = "risk_band"    # low, medium, high, critical
    ALL = "all"


class RiskDimension(Enum):
    """Risk level bands."""
    MINIMAL = "minimal"        # 0.0 - 0.2
    LOW = "low"                # 0.2 - 0.4
    MEDIUM = "medium"          # 0.4 - 0.6
    HIGH = "high"              # 0.6 - 0.8
    CRITICAL = "critical"      # 0.8 - 1.0


class DecisionDimension(Enum):
    """Decision outcomes."""
    ALLOW = "allow"
    ALLOW_MONITORED = "allow_monitored"
    ESCALATE = "escalate"
    DENY = "deny"


class MemoryType(Enum):
    """Types of agent memory."""
    EPISODIC = "episodic"      # Specific events
    SEMANTIC = "semantic"       # General knowledge
    PROCEDURAL = "procedural"   # How to do things
    WORKING = "working"         # Current context


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class Fact:
    """
    A single fact/measure in the data cube.
    
    Represents one data point with all dimension coordinates.
    """
    # Dimension coordinates
    timestamp: datetime
    agent_id: str
    creator_id: str
    tier: str
    action_type: str
    action_category: str
    decision: str
    
    # Measures
    trust_score: float
    trust_delta: float
    risk_score: float
    processing_time_ms: float
    tool_outputs_count: int
    reasoning_quality: float
    
    # Optional context
    request_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_risk_band(self) -> RiskDimension:
        """Get risk band from score."""
        if self.risk_score < 0.2:
            return RiskDimension.MINIMAL
        elif self.risk_score < 0.4:
            return RiskDimension.LOW
        elif self.risk_score < 0.6:
            return RiskDimension.MEDIUM
        elif self.risk_score < 0.8:
            return RiskDimension.HIGH
        else:
            return RiskDimension.CRITICAL
    
    def get_time_key(self, granularity: TimeDimension) -> str:
        """Get time key at specified granularity."""
        if granularity == TimeDimension.SECOND:
            return self.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        elif granularity == TimeDimension.MINUTE:
            return self.timestamp.strftime("%Y-%m-%d %H:%M")
        elif granularity == TimeDimension.HOUR:
            return self.timestamp.strftime("%Y-%m-%d %H:00")
        elif granularity == TimeDimension.DAY:
            return self.timestamp.strftime("%Y-%m-%d")
        elif granularity == TimeDimension.WEEK:
            return self.timestamp.strftime("%Y-W%W")
        elif granularity == TimeDimension.MONTH:
            return self.timestamp.strftime("%Y-%m")
        elif granularity == TimeDimension.QUARTER:
            quarter = (self.timestamp.month - 1) // 3 + 1
            return f"{self.timestamp.year}-Q{quarter}"
        elif granularity == TimeDimension.YEAR:
            return self.timestamp.strftime("%Y")
        return self.timestamp.isoformat()


@dataclass
class CubeCell:
    """
    Aggregated cell in the data cube.
    
    Contains pre-computed aggregations for a dimension intersection.
    """
    # Dimension keys
    dimension_keys: Dict[str, str]
    
    # Aggregated measures
    count: int = 0
    sum_trust_score: float = 0.0
    sum_trust_delta: float = 0.0
    sum_risk_score: float = 0.0
    sum_processing_time: float = 0.0
    
    # For calculating averages and std dev
    values_trust: List[float] = field(default_factory=list)
    values_risk: List[float] = field(default_factory=list)
    
    # Min/Max
    min_trust: float = 1.0
    max_trust: float = 0.0
    min_risk: float = 1.0
    max_risk: float = 0.0
    
    # Decision counts
    decision_counts: Dict[str, int] = field(default_factory=dict)
    
    # First/last timestamps
    first_timestamp: Optional[datetime] = None
    last_timestamp: Optional[datetime] = None
    
    def add_fact(self, fact: Fact):
        """Add a fact to this cell's aggregations."""
        self.count += 1
        self.sum_trust_score += fact.trust_score
        self.sum_trust_delta += fact.trust_delta
        self.sum_risk_score += fact.risk_score
        self.sum_processing_time += fact.processing_time_ms
        
        self.values_trust.append(fact.trust_score)
        self.values_risk.append(fact.risk_score)
        
        self.min_trust = min(self.min_trust, fact.trust_score)
        self.max_trust = max(self.max_trust, fact.trust_score)
        self.min_risk = min(self.min_risk, fact.risk_score)
        self.max_risk = max(self.max_risk, fact.risk_score)
        
        self.decision_counts[fact.decision] = self.decision_counts.get(fact.decision, 0) + 1
        
        if self.first_timestamp is None or fact.timestamp < self.first_timestamp:
            self.first_timestamp = fact.timestamp
        if self.last_timestamp is None or fact.timestamp > self.last_timestamp:
            self.last_timestamp = fact.timestamp
    
    @property
    def avg_trust(self) -> float:
        return self.sum_trust_score / self.count if self.count > 0 else 0.0
    
    @property
    def avg_risk(self) -> float:
        return self.sum_risk_score / self.count if self.count > 0 else 0.0
    
    @property
    def avg_processing_time(self) -> float:
        return self.sum_processing_time / self.count if self.count > 0 else 0.0
    
    @property
    def std_trust(self) -> float:
        return statistics.stdev(self.values_trust) if len(self.values_trust) > 1 else 0.0
    
    @property
    def std_risk(self) -> float:
        return statistics.stdev(self.values_risk) if len(self.values_risk) > 1 else 0.0
    
    @property
    def denial_rate(self) -> float:
        denials = self.decision_counts.get("deny", 0)
        return denials / self.count if self.count > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Export cell data."""
        return {
            "dimensions": self.dimension_keys,
            "count": self.count,
            "avg_trust": round(self.avg_trust, 4),
            "avg_risk": round(self.avg_risk, 4),
            "avg_processing_time_ms": round(self.avg_processing_time, 2),
            "std_trust": round(self.std_trust, 4),
            "std_risk": round(self.std_risk, 4),
            "min_trust": round(self.min_trust, 4),
            "max_trust": round(self.max_trust, 4),
            "min_risk": round(self.min_risk, 4),
            "max_risk": round(self.max_risk, 4),
            "denial_rate": round(self.denial_rate, 4),
            "decision_counts": self.decision_counts,
            "first_timestamp": self.first_timestamp.isoformat() if self.first_timestamp else None,
            "last_timestamp": self.last_timestamp.isoformat() if self.last_timestamp else None,
        }


# =============================================================================
# AGENT MEMORY SYSTEM
# =============================================================================

@dataclass
class MemoryEntry:
    """Single memory entry for an agent."""
    entry_id: str
    memory_type: MemoryType
    timestamp: datetime
    content: Dict[str, Any]
    embedding: Optional[List[float]] = None  # For semantic search
    importance: float = 0.5  # 0-1 importance score
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    decay_rate: float = 0.01  # How fast memory fades
    associations: List[str] = field(default_factory=list)  # Related memory IDs
    
    def get_current_strength(self) -> float:
        """Calculate current memory strength with decay."""
        if self.last_accessed is None:
            age = datetime.now() - self.timestamp
        else:
            age = datetime.now() - self.last_accessed
        
        hours_old = age.total_seconds() / 3600
        decay = math.exp(-self.decay_rate * hours_old)
        
        # Importance and access count boost retention
        boost = 1 + (self.importance * 0.5) + (min(self.access_count, 10) * 0.05)
        
        return min(1.0, decay * boost)


class AgentMemory:
    """
    Multi-dimensional memory system for an agent.
    
    Combines episodic, semantic, procedural, and working memory
    with temporal awareness and decay.
    """
    
    def __init__(self, agent_id: str, max_working_memory: int = 10):
        self.agent_id = agent_id
        self.max_working_memory = max_working_memory
        
        # Memory stores by type
        self.episodic: Dict[str, MemoryEntry] = {}
        self.semantic: Dict[str, MemoryEntry] = {}
        self.procedural: Dict[str, MemoryEntry] = {}
        self.working: List[MemoryEntry] = []
        
        # Indexes for fast lookup
        self.by_time: Dict[str, List[str]] = defaultdict(list)  # date -> entry_ids
        self.by_topic: Dict[str, Set[str]] = defaultdict(set)   # topic -> entry_ids
        self.by_importance: List[Tuple[float, str]] = []        # Sorted by importance
        
        # Statistics
        self.total_entries = 0
        self.total_accesses = 0
    
    def _get_store(self, memory_type: MemoryType) -> Dict[str, MemoryEntry]:
        """Get the appropriate memory store."""
        if memory_type == MemoryType.EPISODIC:
            return self.episodic
        elif memory_type == MemoryType.SEMANTIC:
            return self.semantic
        elif memory_type == MemoryType.PROCEDURAL:
            return self.procedural
        else:
            raise ValueError(f"Working memory uses list, not dict")
    
    def store(
        self,
        content: Dict[str, Any],
        memory_type: MemoryType,
        importance: float = 0.5,
        topics: List[str] = None,
        embedding: List[float] = None
    ) -> str:
        """
        Store a new memory entry.
        
        Returns the entry ID.
        """
        entry_id = hashlib.sha256(
            f"{self.agent_id}:{datetime.now().isoformat()}:{json.dumps(content, sort_keys=True)}".encode()
        ).hexdigest()[:16]
        
        entry = MemoryEntry(
            entry_id=entry_id,
            memory_type=memory_type,
            timestamp=datetime.now(),
            content=content,
            embedding=embedding,
            importance=importance,
            decay_rate=0.001 if memory_type == MemoryType.SEMANTIC else 0.01
        )
        
        if memory_type == MemoryType.WORKING:
            # Working memory is a bounded queue
            self.working.append(entry)
            if len(self.working) > self.max_working_memory:
                # Move oldest to episodic if important enough
                oldest = self.working.pop(0)
                if oldest.importance > 0.3:
                    oldest.memory_type = MemoryType.EPISODIC
                    self.episodic[oldest.entry_id] = oldest
        else:
            store = self._get_store(memory_type)
            store[entry_id] = entry
        
        # Index by time
        date_key = entry.timestamp.strftime("%Y-%m-%d")
        self.by_time[date_key].append(entry_id)
        
        # Index by topics
        if topics:
            for topic in topics:
                self.by_topic[topic.lower()].add(entry_id)
        
        # Track importance
        self.by_importance.append((importance, entry_id))
        self.by_importance.sort(reverse=True)
        
        self.total_entries += 1
        
        logger.debug(f"Agent {self.agent_id} stored {memory_type.value} memory: {entry_id}")
        
        return entry_id
    
    def recall(
        self,
        entry_id: str = None,
        memory_type: MemoryType = None,
        topic: str = None,
        time_range: Tuple[datetime, datetime] = None,
        min_importance: float = 0.0,
        limit: int = 10
    ) -> List[MemoryEntry]:
        """
        Recall memories matching criteria.
        
        Accessing memories increases their strength.
        """
        results = []
        
        # Collect candidate entries
        candidates: Set[str] = set()
        
        if entry_id:
            candidates.add(entry_id)
        elif topic:
            candidates = self.by_topic.get(topic.lower(), set())
        elif time_range:
            start, end = time_range
            current = start
            while current <= end:
                date_key = current.strftime("%Y-%m-%d")
                candidates.update(self.by_time.get(date_key, []))
                current += timedelta(days=1)
        else:
            # All entries
            for store in [self.episodic, self.semantic, self.procedural]:
                candidates.update(store.keys())
            candidates.update(e.entry_id for e in self.working)
        
        # Filter and collect
        for eid in candidates:
            entry = self._find_entry(eid)
            if entry is None:
                continue
            
            if memory_type and entry.memory_type != memory_type:
                continue
            
            if entry.importance < min_importance:
                continue
            
            # Check memory strength (decay)
            strength = entry.get_current_strength()
            if strength < 0.1:  # Memory has faded too much
                continue
            
            # Access the memory (strengthens it)
            entry.access_count += 1
            entry.last_accessed = datetime.now()
            self.total_accesses += 1
            
            results.append(entry)
        
        # Sort by importance * strength
        results.sort(key=lambda e: e.importance * e.get_current_strength(), reverse=True)
        
        return results[:limit]
    
    def _find_entry(self, entry_id: str) -> Optional[MemoryEntry]:
        """Find entry across all stores."""
        for store in [self.episodic, self.semantic, self.procedural]:
            if entry_id in store:
                return store[entry_id]
        for entry in self.working:
            if entry.entry_id == entry_id:
                return entry
        return None
    
    def associate(self, entry_id1: str, entry_id2: str):
        """Create an association between two memories."""
        e1 = self._find_entry(entry_id1)
        e2 = self._find_entry(entry_id2)
        
        if e1 and e2:
            if entry_id2 not in e1.associations:
                e1.associations.append(entry_id2)
            if entry_id1 not in e2.associations:
                e2.associations.append(entry_id1)
    
    def consolidate(self):
        """
        Consolidate memories - move important episodic to semantic,
        prune faded memories.
        """
        pruned = 0
        consolidated = 0
        
        # Check episodic memories
        to_remove = []
        to_consolidate = []
        
        for entry_id, entry in self.episodic.items():
            strength = entry.get_current_strength()
            
            if strength < 0.05:
                to_remove.append(entry_id)
            elif entry.access_count >= 5 and entry.importance > 0.6:
                # Frequently accessed important memories become semantic
                to_consolidate.append(entry_id)
        
        for entry_id in to_remove:
            del self.episodic[entry_id]
            pruned += 1
        
        for entry_id in to_consolidate:
            entry = self.episodic.pop(entry_id)
            entry.memory_type = MemoryType.SEMANTIC
            entry.decay_rate = 0.001  # Semantic decays slower
            self.semantic[entry_id] = entry
            consolidated += 1
        
        logger.info(f"Agent {self.agent_id} memory consolidation: "
                   f"pruned={pruned}, consolidated={consolidated}")
        
        return {"pruned": pruned, "consolidated": consolidated}
    
    def get_context_window(self, max_entries: int = 5) -> List[MemoryEntry]:
        """Get current working memory + recent important memories."""
        context = list(self.working)
        
        # Add recent important memories
        recent = self.recall(
            time_range=(datetime.now() - timedelta(hours=1), datetime.now()),
            min_importance=0.5,
            limit=max_entries - len(context)
        )
        
        context.extend(recent)
        return context[:max_entries]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics."""
        return {
            "agent_id": self.agent_id,
            "total_entries": self.total_entries,
            "total_accesses": self.total_accesses,
            "episodic_count": len(self.episodic),
            "semantic_count": len(self.semantic),
            "procedural_count": len(self.procedural),
            "working_count": len(self.working),
            "topics": list(self.by_topic.keys()),
            "date_range": {
                "earliest": min(self.by_time.keys()) if self.by_time else None,
                "latest": max(self.by_time.keys()) if self.by_time else None
            }
        }


# =============================================================================
# DATA CUBE ENGINE
# =============================================================================

class DataCube:
    """
    Multi-dimensional data cube for agent analytics.
    
    Supports OLAP operations: slice, dice, roll-up, drill-down, pivot.
    """
    
    def __init__(self):
        # Raw fact storage
        self.facts: List[Fact] = []
        
        # Pre-aggregated cells by dimension combination
        self.cells: Dict[str, CubeCell] = {}
        
        # Dimension hierarchies
        self.time_granularity = TimeDimension.HOUR
        self.agent_granularity = AgentDimension.INSTANCE
        self.action_granularity = ActionDimension.TYPE
        
        # Indexes for fast lookup
        self.by_agent: Dict[str, List[int]] = defaultdict(list)
        self.by_creator: Dict[str, List[int]] = defaultdict(list)
        self.by_time: Dict[str, List[int]] = defaultdict(list)
        self.by_decision: Dict[str, List[int]] = defaultdict(list)
        
        # Statistics
        self.last_aggregation: Optional[datetime] = None
    
    def add_fact(self, fact: Fact):
        """Add a new fact to the cube."""
        idx = len(self.facts)
        self.facts.append(fact)
        
        # Update indexes
        self.by_agent[fact.agent_id].append(idx)
        self.by_creator[fact.creator_id].append(idx)
        self.by_time[fact.get_time_key(TimeDimension.HOUR)].append(idx)
        self.by_decision[fact.decision].append(idx)
        
        # Invalidate aggregations
        self.last_aggregation = None
    
    def _get_cell_key(self, dimensions: Dict[str, str]) -> str:
        """Generate a unique key for a dimension combination."""
        sorted_dims = sorted(dimensions.items())
        return "|".join(f"{k}={v}" for k, v in sorted_dims)
    
    def _get_or_create_cell(self, dimensions: Dict[str, str]) -> CubeCell:
        """Get or create a cell for dimension combination."""
        key = self._get_cell_key(dimensions)
        if key not in self.cells:
            self.cells[key] = CubeCell(dimension_keys=dimensions.copy())
        return self.cells[key]
    
    def aggregate(
        self,
        dimensions: List[str] = None,
        time_granularity: TimeDimension = None,
        filters: Dict[str, Any] = None
    ):
        """
        Aggregate facts into cells.
        
        Args:
            dimensions: Which dimensions to group by
            time_granularity: Time rollup level
            filters: Dimension filters to apply
        """
        if dimensions is None:
            dimensions = ["time", "agent_id", "action_type", "decision"]
        
        if time_granularity is None:
            time_granularity = self.time_granularity
        
        # Clear existing cells
        self.cells.clear()
        
        for fact in self.facts:
            # Apply filters
            if filters:
                skip = False
                for dim, value in filters.items():
                    if dim == "agent_id" and fact.agent_id != value:
                        skip = True
                    elif dim == "creator_id" and fact.creator_id != value:
                        skip = True
                    elif dim == "decision" and fact.decision != value:
                        skip = True
                    elif dim == "risk_band" and fact.get_risk_band().value != value:
                        skip = True
                    elif dim == "tier" and fact.tier != value:
                        skip = True
                if skip:
                    continue
            
            # Build dimension keys
            dim_keys = {}
            for dim in dimensions:
                if dim == "time":
                    dim_keys["time"] = fact.get_time_key(time_granularity)
                elif dim == "agent_id":
                    dim_keys["agent_id"] = fact.agent_id
                elif dim == "creator_id":
                    dim_keys["creator_id"] = fact.creator_id
                elif dim == "tier":
                    dim_keys["tier"] = fact.tier
                elif dim == "action_type":
                    dim_keys["action_type"] = fact.action_type
                elif dim == "action_category":
                    dim_keys["action_category"] = fact.action_category
                elif dim == "decision":
                    dim_keys["decision"] = fact.decision
                elif dim == "risk_band":
                    dim_keys["risk_band"] = fact.get_risk_band().value
            
            # Add to cell
            cell = self._get_or_create_cell(dim_keys)
            cell.add_fact(fact)
        
        self.last_aggregation = datetime.now()
        
        logger.info(f"Aggregated {len(self.facts)} facts into {len(self.cells)} cells")
    
    def slice(self, dimension: str, value: str) -> List[CubeCell]:
        """
        Slice: Fix one dimension to a specific value.
        
        Returns all cells where dimension == value.
        """
        results = []
        for cell in self.cells.values():
            if cell.dimension_keys.get(dimension) == value:
                results.append(cell)
        return results
    
    def dice(self, filters: Dict[str, List[str]]) -> List[CubeCell]:
        """
        Dice: Select a sub-cube by specifying ranges for multiple dimensions.
        
        Args:
            filters: {dimension: [allowed_values]}
        """
        results = []
        for cell in self.cells.values():
            match = True
            for dim, allowed in filters.items():
                if dim in cell.dimension_keys:
                    if cell.dimension_keys[dim] not in allowed:
                        match = False
                        break
            if match:
                results.append(cell)
        return results
    
    def roll_up(self, dimension: str) -> Dict[str, CubeCell]:
        """
        Roll-up: Aggregate to a higher level in a dimension hierarchy.
        
        For example, roll up from agent_id to creator_id.
        """
        rolled = {}
        
        for cell in self.cells.values():
            # Create new dimension keys without the rolled-up dimension
            new_keys = {k: v for k, v in cell.dimension_keys.items() if k != dimension}
            key = self._get_cell_key(new_keys)
            
            if key not in rolled:
                rolled[key] = CubeCell(dimension_keys=new_keys)
            
            # Merge cell data
            target = rolled[key]
            target.count += cell.count
            target.sum_trust_score += cell.sum_trust_score
            target.sum_trust_delta += cell.sum_trust_delta
            target.sum_risk_score += cell.sum_risk_score
            target.sum_processing_time += cell.sum_processing_time
            target.values_trust.extend(cell.values_trust)
            target.values_risk.extend(cell.values_risk)
            target.min_trust = min(target.min_trust, cell.min_trust)
            target.max_trust = max(target.max_trust, cell.max_trust)
            target.min_risk = min(target.min_risk, cell.min_risk)
            target.max_risk = max(target.max_risk, cell.max_risk)
            
            for decision, count in cell.decision_counts.items():
                target.decision_counts[decision] = target.decision_counts.get(decision, 0) + count
            
            if target.first_timestamp is None or (cell.first_timestamp and cell.first_timestamp < target.first_timestamp):
                target.first_timestamp = cell.first_timestamp
            if target.last_timestamp is None or (cell.last_timestamp and cell.last_timestamp > target.last_timestamp):
                target.last_timestamp = cell.last_timestamp
        
        return rolled
    
    def drill_down(
        self,
        cell: CubeCell,
        dimension: str,
        time_granularity: TimeDimension = None
    ) -> List[CubeCell]:
        """
        Drill-down: Get more detailed view by adding a dimension.
        
        Re-aggregates facts matching the cell's dimensions,
        but adds the new dimension for finer granularity.
        """
        # Find facts matching this cell
        matching_facts = []
        for fact in self.facts:
            match = True
            for dim, value in cell.dimension_keys.items():
                if dim == "time":
                    if fact.get_time_key(time_granularity or self.time_granularity) != value:
                        match = False
                elif dim == "agent_id" and fact.agent_id != value:
                    match = False
                elif dim == "creator_id" and fact.creator_id != value:
                    match = False
                elif dim == "tier" and fact.tier != value:
                    match = False
                elif dim == "action_type" and fact.action_type != value:
                    match = False
                elif dim == "decision" and fact.decision != value:
                    match = False
                elif dim == "risk_band" and fact.get_risk_band().value != value:
                    match = False
            
            if match:
                matching_facts.append(fact)
        
        # Re-aggregate with new dimension
        new_dims = list(cell.dimension_keys.keys()) + [dimension]
        
        sub_cells = {}
        for fact in matching_facts:
            dim_keys = dict(cell.dimension_keys)
            
            if dimension == "time":
                gran = time_granularity or TimeDimension.MINUTE
                dim_keys["time"] = fact.get_time_key(gran)
            elif dimension == "agent_id":
                dim_keys["agent_id"] = fact.agent_id
            elif dimension == "action_type":
                dim_keys["action_type"] = fact.action_type
            elif dimension == "risk_band":
                dim_keys["risk_band"] = fact.get_risk_band().value
            
            key = self._get_cell_key(dim_keys)
            if key not in sub_cells:
                sub_cells[key] = CubeCell(dimension_keys=dim_keys)
            sub_cells[key].add_fact(fact)
        
        return list(sub_cells.values())
    
    def pivot(
        self,
        row_dimensions: List[str],
        col_dimensions: List[str],
        measure: str = "count"
    ) -> Dict[str, Dict[str, float]]:
        """
        Pivot: Create a 2D cross-tabulation.
        
        Args:
            row_dimensions: Dimensions for rows
            col_dimensions: Dimensions for columns
            measure: What to show in cells (count, avg_trust, avg_risk, etc.)
        
        Returns:
            Nested dict: {row_key: {col_key: value}}
        """
        pivot_table = defaultdict(lambda: defaultdict(float))
        
        for cell in self.cells.values():
            # Build row key
            row_parts = [cell.dimension_keys.get(d, "ALL") for d in row_dimensions]
            row_key = "|".join(row_parts)
            
            # Build col key
            col_parts = [cell.dimension_keys.get(d, "ALL") for d in col_dimensions]
            col_key = "|".join(col_parts)
            
            # Get measure value
            if measure == "count":
                value = cell.count
            elif measure == "avg_trust":
                value = cell.avg_trust
            elif measure == "avg_risk":
                value = cell.avg_risk
            elif measure == "denial_rate":
                value = cell.denial_rate
            elif measure == "sum_trust_delta":
                value = cell.sum_trust_delta
            else:
                value = cell.count
            
            pivot_table[row_key][col_key] += value
        
        return dict(pivot_table)
    
    def get_time_series(
        self,
        measure: str = "avg_risk",
        granularity: TimeDimension = TimeDimension.HOUR,
        filters: Dict[str, str] = None
    ) -> List[Tuple[str, float]]:
        """Get time series data for a measure."""
        # Re-aggregate with time dimension
        self.aggregate(
            dimensions=["time"],
            time_granularity=granularity,
            filters=filters
        )
        
        series = []
        for cell in sorted(self.cells.values(), key=lambda c: c.dimension_keys.get("time", "")):
            time_key = cell.dimension_keys.get("time", "")
            
            if measure == "avg_risk":
                value = cell.avg_risk
            elif measure == "avg_trust":
                value = cell.avg_trust
            elif measure == "count":
                value = cell.count
            elif measure == "denial_rate":
                value = cell.denial_rate
            else:
                value = 0
            
            series.append((time_key, value))
        
        return series
    
    def detect_anomalies(
        self,
        dimension: str = "agent_id",
        measure: str = "avg_risk",
        std_threshold: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies across a dimension.
        
        Finds cells where measure is > std_threshold standard deviations from mean.
        """
        # Get values for the measure across the dimension
        values = []
        cells_by_dim = {}
        
        for cell in self.cells.values():
            dim_value = cell.dimension_keys.get(dimension)
            if dim_value:
                if measure == "avg_risk":
                    val = cell.avg_risk
                elif measure == "avg_trust":
                    val = cell.avg_trust
                elif measure == "denial_rate":
                    val = cell.denial_rate
                else:
                    val = cell.count
                
                values.append(val)
                cells_by_dim[dim_value] = (cell, val)
        
        if len(values) < 2:
            return []
        
        mean = statistics.mean(values)
        std = statistics.stdev(values)
        
        anomalies = []
        for dim_value, (cell, val) in cells_by_dim.items():
            if std > 0:
                z_score = (val - mean) / std
                if abs(z_score) > std_threshold:
                    anomalies.append({
                        "dimension": dimension,
                        "value": dim_value,
                        "measure": measure,
                        "actual": round(val, 4),
                        "mean": round(mean, 4),
                        "std": round(std, 4),
                        "z_score": round(z_score, 2),
                        "direction": "high" if z_score > 0 else "low"
                    })
        
        return sorted(anomalies, key=lambda x: abs(x["z_score"]), reverse=True)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cube statistics."""
        return {
            "total_facts": len(self.facts),
            "total_cells": len(self.cells),
            "last_aggregation": self.last_aggregation.isoformat() if self.last_aggregation else None,
            "agents": len(self.by_agent),
            "creators": len(self.by_creator),
            "time_periods": len(self.by_time),
            "decisions": dict(self.by_decision)
        }


# =============================================================================
# KNOWLEDGE BASE
# =============================================================================

class AgentKnowledgeBase:
    """
    Knowledge base for an agent combining:
    - Multi-dimensional data cube for analytics
    - Memory system for context and learning
    - Pattern detection and insights
    """
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.cube = DataCube()
        self.memory = AgentMemory(agent_id)
        
        # Learned patterns
        self.patterns: Dict[str, Any] = {}
        
        # Configuration
        self.auto_consolidate_interval = timedelta(hours=1)
        self.last_consolidation: Optional[datetime] = None
    
    def record_action(
        self,
        request_id: str,
        action_type: str,
        action_category: str,
        decision: str,
        trust_score: float,
        trust_delta: float,
        risk_score: float,
        processing_time_ms: float,
        reasoning_trace: str = "",
        tool_outputs: List[Dict] = None,
        metadata: Dict[str, Any] = None
    ):
        """Record an action in both cube and memory."""
        # Create fact for cube
        fact = Fact(
            timestamp=datetime.now(),
            agent_id=self.agent_id,
            creator_id=metadata.get("creator_id", "unknown") if metadata else "unknown",
            tier=metadata.get("tier", "unknown") if metadata else "unknown",
            action_type=action_type,
            action_category=action_category,
            decision=decision,
            trust_score=trust_score,
            trust_delta=trust_delta,
            risk_score=risk_score,
            processing_time_ms=processing_time_ms,
            tool_outputs_count=len(tool_outputs) if tool_outputs else 0,
            reasoning_quality=metadata.get("reasoning_quality", 0.5) if metadata else 0.5,
            request_id=request_id,
            metadata=metadata or {}
        )
        
        self.cube.add_fact(fact)
        
        # Store in episodic memory
        memory_content = {
            "request_id": request_id,
            "action_type": action_type,
            "decision": decision,
            "risk_score": risk_score,
            "reasoning": reasoning_trace[:200] if reasoning_trace else "",
            "outcome": "success" if decision in ["allow", "allow_monitored"] else "blocked"
        }
        
        importance = 0.3 + (risk_score * 0.4) + (0.3 if decision == "deny" else 0)
        
        self.memory.store(
            content=memory_content,
            memory_type=MemoryType.EPISODIC,
            importance=min(1.0, importance),
            topics=[action_type, decision, f"risk_{fact.get_risk_band().value}"]
        )
        
        # Add to working memory
        self.memory.store(
            content={"last_action": action_type, "last_decision": decision, "last_risk": risk_score},
            memory_type=MemoryType.WORKING,
            importance=0.5
        )
        
        # Check for auto-consolidation
        if self.last_consolidation is None or \
           datetime.now() - self.last_consolidation > self.auto_consolidate_interval:
            self.consolidate()
    
    def learn_pattern(self, pattern_name: str, conditions: Dict[str, Any], outcome: str):
        """Store a learned pattern."""
        self.patterns[pattern_name] = {
            "conditions": conditions,
            "outcome": outcome,
            "learned_at": datetime.now().isoformat(),
            "confidence": 0.5,
            "occurrences": 1
        }
        
        # Store in procedural memory
        self.memory.store(
            content={"pattern": pattern_name, **self.patterns[pattern_name]},
            memory_type=MemoryType.PROCEDURAL,
            importance=0.7,
            topics=["pattern", outcome]
        )
    
    def query(
        self,
        dimensions: List[str] = None,
        filters: Dict[str, str] = None,
        time_range: Tuple[datetime, datetime] = None,
        measure: str = "count"
    ) -> List[Dict[str, Any]]:
        """
        Query the knowledge base.
        
        Combines cube aggregation with memory context.
        """
        # Aggregate cube
        self.cube.aggregate(dimensions=dimensions, filters=filters)
        
        # Get results
        results = [cell.to_dict() for cell in self.cube.cells.values()]
        
        # Enrich with memory context
        if time_range:
            memories = self.memory.recall(time_range=time_range, limit=5)
            for result in results:
                result["related_memories"] = len(memories)
        
        return results
    
    def get_insights(self) -> Dict[str, Any]:
        """Get insights from the knowledge base."""
        self.cube.aggregate(dimensions=["agent_id", "decision", "risk_band"])
        
        insights = {
            "total_actions": len(self.cube.facts),
            "memory_stats": self.memory.get_stats(),
            "patterns_learned": len(self.patterns),
            "anomalies": self.cube.detect_anomalies(dimension="risk_band", measure="count"),
            "risk_trend": self.cube.get_time_series(measure="avg_risk", granularity=TimeDimension.HOUR)[-10:],
            "decision_distribution": {}
        }
        
        # Decision distribution
        for cell in self.cube.cells.values():
            decision = cell.dimension_keys.get("decision", "unknown")
            insights["decision_distribution"][decision] = \
                insights["decision_distribution"].get(decision, 0) + cell.count
        
        return insights
    
    def consolidate(self):
        """Consolidate memory and update patterns."""
        # Memory consolidation
        result = self.memory.consolidate()
        
        # Update pattern confidences based on recent data
        self.cube.aggregate(dimensions=["action_type", "decision"])
        
        for pattern_name, pattern in self.patterns.items():
            # Check if pattern holds in recent data
            matching_cells = self.cube.dice({
                k: [v] for k, v in pattern["conditions"].items() if k in ["action_type", "decision"]
            })
            
            if matching_cells:
                total = sum(c.count for c in matching_cells)
                pattern["occurrences"] = total
                pattern["confidence"] = min(1.0, pattern["confidence"] + 0.1)
        
        self.last_consolidation = datetime.now()
        
        logger.info(f"Agent {self.agent_id} consolidated: {result}")
        
        return result
    
    def export(self) -> Dict[str, Any]:
        """Export complete knowledge base state."""
        return {
            "agent_id": self.agent_id,
            "cube_stats": self.cube.get_stats(),
            "memory_stats": self.memory.get_stats(),
            "patterns": self.patterns,
            "insights": self.get_insights()
        }


# =============================================================================
# TESTS
# =============================================================================

if __name__ == "__main__":
    import random
    
    print("=" * 60)
    print("Multi-Dimensional Data Cube Tests")
    print("=" * 60)
    
    # Create knowledge base
    kb = AgentKnowledgeBase("test_agent")
    
    # Generate sample data
    action_types = ["read", "write", "execute", "api_call"]
    categories = ["data", "network", "system"]
    decisions = ["allow", "allow_monitored", "deny"]
    tiers = ["black_box", "gray_box", "white_box"]
    
    print("\n[1] Generating 100 sample actions...")
    
    for i in range(100):
        action_type = random.choice(action_types)
        decision = random.choices(decisions, weights=[0.6, 0.3, 0.1])[0]
        risk = random.random()
        
        kb.record_action(
            request_id=f"req_{i:03d}",
            action_type=action_type,
            action_category=random.choice(categories),
            decision=decision,
            trust_score=0.3 + random.random() * 0.3,
            trust_delta=random.uniform(-0.01, 0.02),
            risk_score=risk,
            processing_time_ms=random.uniform(0.5, 5.0),
            reasoning_trace=f"Test reasoning for action {i}",
            metadata={
                "creator_id": "test_creator",
                "tier": random.choice(tiers),
                "reasoning_quality": random.random()
            }
        )
    
    print(f"    ✓ Created {len(kb.cube.facts)} facts")
    print(f"    ✓ Memory entries: {kb.memory.total_entries}")
    
    # Test aggregation
    print("\n[2] Testing cube aggregation...")
    kb.cube.aggregate(dimensions=["action_type", "decision"])
    print(f"    ✓ Aggregated into {len(kb.cube.cells)} cells")
    
    # Test slice
    print("\n[3] Testing slice (action_type=read)...")
    slice_results = kb.cube.slice("action_type", "read")
    print(f"    ✓ Found {len(slice_results)} cells")
    for cell in slice_results[:3]:
        print(f"      - {cell.dimension_keys}: count={cell.count}, avg_risk={cell.avg_risk:.3f}")
    
    # Test dice
    print("\n[4] Testing dice (action_type in [read, write], decision in [allow])...")
    dice_results = kb.cube.dice({
        "action_type": ["read", "write"],
        "decision": ["allow", "allow_monitored"]
    })
    print(f"    ✓ Found {len(dice_results)} cells")
    
    # Test roll-up
    print("\n[5] Testing roll-up (remove decision dimension)...")
    rolled = kb.cube.roll_up("decision")
    print(f"    ✓ Rolled up to {len(rolled)} cells")
    for key, cell in list(rolled.items())[:3]:
        print(f"      - {cell.dimension_keys}: count={cell.count}")
    
    # Test pivot
    print("\n[6] Testing pivot (action_type x decision)...")
    pivot = kb.cube.pivot(
        row_dimensions=["action_type"],
        col_dimensions=["decision"],
        measure="count"
    )
    print("    ✓ Pivot table:")
    for row, cols in pivot.items():
        print(f"      {row}: {dict(cols)}")
    
    # Test time series
    print("\n[7] Testing time series (risk over time)...")
    series = kb.cube.get_time_series(measure="avg_risk", granularity=TimeDimension.MINUTE)
    print(f"    ✓ Got {len(series)} time points")
    
    # Test anomaly detection
    print("\n[8] Testing anomaly detection...")
    kb.cube.aggregate(dimensions=["action_type"])
    anomalies = kb.cube.detect_anomalies(dimension="action_type", measure="count")
    print(f"    ✓ Found {len(anomalies)} anomalies")
    for a in anomalies[:3]:
        print(f"      - {a['value']}: z={a['z_score']:.2f} ({a['direction']})")
    
    # Test memory
    print("\n[9] Testing memory system...")
    memories = kb.memory.recall(topic="read", limit=5)
    print(f"    ✓ Recalled {len(memories)} memories about 'read'")
    
    context = kb.memory.get_context_window()
    print(f"    ✓ Current context window: {len(context)} entries")
    
    # Test insights
    print("\n[10] Getting insights...")
    insights = kb.get_insights()
    print(f"    ✓ Total actions: {insights['total_actions']}")
    print(f"    ✓ Patterns learned: {insights['patterns_learned']}")
    print(f"    ✓ Decision distribution: {insights['decision_distribution']}")
    
    # Final stats
    print("\n[11] Final statistics...")
    stats = kb.export()
    print(f"    ✓ Cube facts: {stats['cube_stats']['total_facts']}")
    print(f"    ✓ Memory entries: {stats['memory_stats']['total_entries']}")
    print(f"    ✓ Topics tracked: {len(stats['memory_stats']['topics'])}")
    
    print("\n" + "=" * 60)
    print("All tests passed ✓")
    print("=" * 60)
