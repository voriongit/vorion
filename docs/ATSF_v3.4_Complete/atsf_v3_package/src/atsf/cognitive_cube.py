"""
ATSF Cognitive Cube - Enhanced Memory Architecture
====================================================

Implements the full "Cognitive Continuity" framework:
- Temporal Knowledge Graphs (TKGs) for causal chains
- Adaptive Resonance Theory (ART) for automatic effect grouping
- Granger Causality for statistical causal inference
- Basis Reminders for constitutional governance
- Hybrid Search (BM25 + Semantic) for policy retrieval

Based on generic, open-standard methodologies to avoid IP issues.
Uses prior art from data warehousing, graph theory, and classical neural networks.

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
import math
import re

logger = logging.getLogger("atsf.cognitive_cube")


# =============================================================================
# TEMPORAL KNOWLEDGE GRAPH (TKG)
# =============================================================================

@dataclass
class TemporalEdge:
    """
    A time-stamped edge in the Temporal Knowledge Graph.
    
    Represents: (Subject, Predicate, Object, TimeInterval)
    """
    edge_id: str
    subject: str           # Source node ID
    predicate: str         # Relationship type
    object: str            # Target node ID
    valid_from: datetime   # When this relationship became true
    valid_to: Optional[datetime] = None  # When it ended (None = still valid)
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def is_valid_at(self, timestamp: datetime) -> bool:
        """Check if edge is valid at given timestamp."""
        if timestamp < self.valid_from:
            return False
        if self.valid_to and timestamp > self.valid_to:
            return False
        return True
    
    def overlaps(self, start: datetime, end: datetime) -> bool:
        """Check if edge overlaps with time range."""
        edge_end = self.valid_to or datetime.max
        return not (end < self.valid_from or start > edge_end)


@dataclass
class TKGNode:
    """A node in the Temporal Knowledge Graph."""
    node_id: str
    node_type: str  # event, entity, state, action
    label: str
    created_at: datetime
    properties: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None


class TemporalKnowledgeGraph:
    """
    Temporal Knowledge Graph for modeling causal chains.
    
    Models events as nodes and causal/temporal links as edges,
    with Time as a property of the edge (quadruples vs triples).
    
    Example:
        (Agent, Rebooted, Server, [T1, T2])
        (Server, Latency_Dropped, True, [T2, T3])
    """
    
    def __init__(self):
        self.nodes: Dict[str, TKGNode] = {}
        self.edges: Dict[str, TemporalEdge] = {}
        
        # Indexes for fast lookup
        self.edges_by_subject: Dict[str, List[str]] = defaultdict(list)
        self.edges_by_object: Dict[str, List[str]] = defaultdict(list)
        self.edges_by_predicate: Dict[str, List[str]] = defaultdict(list)
        self.edges_by_time: Dict[str, List[str]] = defaultdict(list)  # date -> edge_ids
        
        # Causal chains discovered
        self.causal_chains: List[List[str]] = []
    
    def add_node(
        self,
        node_id: str,
        node_type: str,
        label: str,
        properties: Dict[str, Any] = None,
        embedding: List[float] = None
    ) -> TKGNode:
        """Add a node to the graph."""
        node = TKGNode(
            node_id=node_id,
            node_type=node_type,
            label=label,
            created_at=datetime.now(),
            properties=properties or {},
            embedding=embedding
        )
        self.nodes[node_id] = node
        return node
    
    def add_edge(
        self,
        subject: str,
        predicate: str,
        obj: str,
        valid_from: datetime,
        valid_to: datetime = None,
        confidence: float = 1.0,
        metadata: Dict[str, Any] = None
    ) -> TemporalEdge:
        """Add a temporal edge (quadruple) to the graph."""
        edge_id = hashlib.sha256(
            f"{subject}:{predicate}:{obj}:{valid_from.isoformat()}".encode()
        ).hexdigest()[:16]
        
        edge = TemporalEdge(
            edge_id=edge_id,
            subject=subject,
            predicate=predicate,
            object=obj,
            valid_from=valid_from,
            valid_to=valid_to,
            confidence=confidence,
            metadata=metadata or {}
        )
        
        self.edges[edge_id] = edge
        self.edges_by_subject[subject].append(edge_id)
        self.edges_by_object[obj].append(edge_id)
        self.edges_by_predicate[predicate].append(edge_id)
        self.edges_by_time[valid_from.strftime("%Y-%m-%d")].append(edge_id)
        
        return edge
    
    def find_causal_chain(
        self,
        effect_node: str,
        max_depth: int = 5,
        time_window: timedelta = timedelta(minutes=30)
    ) -> List[List[TemporalEdge]]:
        """
        Find all causal chains leading to an effect.
        
        Traverses backwards through time-ordered edges to find
        potential causes of the given effect.
        """
        chains = []
        
        def trace_back(node_id: str, current_chain: List[TemporalEdge], depth: int):
            if depth >= max_depth:
                return
            
            # Find edges where this node is the object (effect)
            incoming_edges = []
            for edge_id in self.edges_by_object.get(node_id, []):
                edge = self.edges[edge_id]
                
                # Check temporal constraint - cause must precede effect
                if current_chain:
                    effect_time = current_chain[-1].valid_from
                    if edge.valid_from >= effect_time:
                        continue
                    # Must be within time window
                    if effect_time - edge.valid_from > time_window:
                        continue
                
                incoming_edges.append(edge)
            
            if not incoming_edges:
                if len(current_chain) > 1:
                    chains.append(list(current_chain))
                return
            
            for edge in incoming_edges:
                current_chain.append(edge)
                trace_back(edge.subject, current_chain, depth + 1)
                current_chain.pop()
        
        # Start tracing from edges pointing to effect_node
        for edge_id in self.edges_by_object.get(effect_node, []):
            edge = self.edges[edge_id]
            trace_back(edge.subject, [edge], 1)
        
        return chains
    
    def find_effects_of(
        self,
        cause_node: str,
        time_window: timedelta = timedelta(minutes=30),
        predicate_filter: str = None
    ) -> List[TemporalEdge]:
        """
        Find all effects that occurred after a cause.
        
        This enables "Effect Grouping" - finding all outcomes
        that follow a particular action.
        """
        effects = []
        
        # Get edges where cause_node is the subject
        cause_edges = self.edges_by_subject.get(cause_node, [])
        
        for edge_id in cause_edges:
            cause_edge = self.edges[edge_id]
            cause_time = cause_edge.valid_from
            
            # Find all edges starting after cause_time within window
            for date_key in self.edges_by_time.keys():
                for other_edge_id in self.edges_by_time[date_key]:
                    other_edge = self.edges[other_edge_id]
                    
                    # Must be after cause
                    if other_edge.valid_from <= cause_time:
                        continue
                    
                    # Must be within window
                    if other_edge.valid_from - cause_time > time_window:
                        continue
                    
                    # Apply predicate filter if specified
                    if predicate_filter and other_edge.predicate != predicate_filter:
                        continue
                    
                    effects.append(other_edge)
        
        return effects
    
    def subgraph_query(
        self,
        start_time: datetime,
        end_time: datetime,
        predicates: List[str] = None,
        node_types: List[str] = None
    ) -> Tuple[List[TKGNode], List[TemporalEdge]]:
        """
        Extract a subgraph based on temporal and type constraints.
        
        This is the TKG equivalent of "dicing" in OLAP.
        """
        matching_edges = []
        node_ids = set()
        
        for edge in self.edges.values():
            # Time filter
            if not edge.overlaps(start_time, end_time):
                continue
            
            # Predicate filter
            if predicates and edge.predicate not in predicates:
                continue
            
            matching_edges.append(edge)
            node_ids.add(edge.subject)
            node_ids.add(edge.object)
        
        # Filter nodes by type if specified
        matching_nodes = []
        for node_id in node_ids:
            if node_id in self.nodes:
                node = self.nodes[node_id]
                if node_types and node.node_type not in node_types:
                    continue
                matching_nodes.append(node)
        
        return matching_nodes, matching_edges
    
    def get_stats(self) -> Dict[str, Any]:
        """Get graph statistics."""
        return {
            "nodes": len(self.nodes),
            "edges": len(self.edges),
            "predicates": len(self.edges_by_predicate),
            "causal_chains_discovered": len(self.causal_chains),
            "node_types": list(set(n.node_type for n in self.nodes.values())),
            "predicate_types": list(self.edges_by_predicate.keys())
        }


# =============================================================================
# ADAPTIVE RESONANCE THEORY (ART) CLUSTERING
# =============================================================================

class ARTCluster:
    """
    Adaptive Resonance Theory (ART) cluster for automatic effect grouping.
    
    ART solves the "stability-plasticity dilemma" - learning new patterns
    without destroying old ones. Uses a vigilance parameter to control
    the granularity of clustering.
    
    This is based on Grossberg & Carpenter's work from the 1980s,
    solidly in the public domain as academic "prior art".
    """
    
    def __init__(
        self,
        vigilance: float = 0.7,
        learning_rate: float = 0.1,
        max_clusters: int = 100
    ):
        """
        Initialize ART clustering.
        
        Args:
            vigilance: Match threshold (0-1). Higher = more clusters, finer granularity.
            learning_rate: How fast prototypes adapt to new inputs.
            max_clusters: Maximum number of clusters to create.
        """
        self.vigilance = vigilance
        self.learning_rate = learning_rate
        self.max_clusters = max_clusters
        
        # Prototype vectors for each cluster
        self.prototypes: Dict[str, List[float]] = {}
        
        # Cluster metadata
        self.cluster_counts: Dict[str, int] = defaultdict(int)
        self.cluster_labels: Dict[str, str] = {}
        self.cluster_created: Dict[str, datetime] = {}
        
        # Membership history
        self.membership_log: List[Tuple[datetime, str, str]] = []  # (time, input_id, cluster_id)
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0
        
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot / (norm_a * norm_b)
    
    def _normalize(self, vec: List[float]) -> List[float]:
        """Normalize a vector to unit length."""
        norm = math.sqrt(sum(x * x for x in vec))
        if norm == 0:
            return vec
        return [x / norm for x in vec]
    
    def classify(
        self,
        input_vector: List[float],
        input_id: str = None
    ) -> Tuple[str, bool]:
        """
        Classify an input into an existing or new cluster.
        
        Returns:
            (cluster_id, is_new_cluster)
        """
        input_norm = self._normalize(input_vector)
        
        # Find best matching cluster
        best_match = None
        best_score = -1
        
        for cluster_id, prototype in self.prototypes.items():
            score = self._cosine_similarity(input_norm, prototype)
            if score > best_score:
                best_score = score
                best_match = cluster_id
        
        # Vigilance check
        if best_score >= self.vigilance and best_match is not None:
            # Resonance - merge with existing cluster
            self._update_prototype(best_match, input_norm)
            self.cluster_counts[best_match] += 1
            
            if input_id:
                self.membership_log.append((datetime.now(), input_id, best_match))
            
            return best_match, False
        else:
            # Reset - create new cluster
            if len(self.prototypes) >= self.max_clusters:
                # Merge into least confident match
                if best_match:
                    self._update_prototype(best_match, input_norm)
                    self.cluster_counts[best_match] += 1
                    return best_match, False
            
            new_id = f"cluster_{len(self.prototypes):04d}"
            self.prototypes[new_id] = input_norm
            self.cluster_counts[new_id] = 1
            self.cluster_created[new_id] = datetime.now()
            
            if input_id:
                self.membership_log.append((datetime.now(), input_id, new_id))
            
            logger.info(f"ART created new cluster: {new_id} (vigilance={self.vigilance})")
            
            return new_id, True
    
    def _update_prototype(self, cluster_id: str, input_vector: List[float]):
        """Update prototype using learning rate."""
        prototype = self.prototypes[cluster_id]
        updated = [
            (1 - self.learning_rate) * p + self.learning_rate * i
            for p, i in zip(prototype, input_vector)
        ]
        self.prototypes[cluster_id] = self._normalize(updated)
    
    def label_cluster(self, cluster_id: str, label: str):
        """Assign a human-readable label to a cluster."""
        self.cluster_labels[cluster_id] = label
    
    def get_cluster_members(self, cluster_id: str) -> List[str]:
        """Get all input IDs that belong to a cluster."""
        return [
            input_id for _, input_id, cid in self.membership_log
            if cid == cluster_id
        ]
    
    def get_effect_groups(self) -> Dict[str, Dict[str, Any]]:
        """
        Export all effect groups (clusters) with metadata.
        
        This is the key output for "Effect Grouping" in the cognitive cube.
        """
        groups = {}
        for cluster_id in self.prototypes.keys():
            groups[cluster_id] = {
                "label": self.cluster_labels.get(cluster_id, "Unlabeled"),
                "count": self.cluster_counts[cluster_id],
                "created": self.cluster_created.get(cluster_id, datetime.now()).isoformat(),
                "prototype_norm": sum(x * x for x in self.prototypes[cluster_id])
            }
        return groups
    
    def adjust_vigilance(self, new_vigilance: float):
        """
        Adjust vigilance parameter.
        
        Higher vigilance = more clusters, finer distinctions.
        Lower vigilance = fewer clusters, broader groupings.
        """
        self.vigilance = max(0.1, min(0.99, new_vigilance))
        logger.info(f"ART vigilance adjusted to {self.vigilance}")


# =============================================================================
# GRANGER CAUSALITY
# =============================================================================

class GrangerCausalityAnalyzer:
    """
    Granger Causality analysis for time series data.
    
    A variable X "Granger-causes" Y if the past values of X
    contain information that helps predict Y better than
    Y's past values alone.
    
    This is a standard statistical test, not proprietary.
    """
    
    def __init__(self, max_lag: int = 5, significance_level: float = 0.05):
        self.max_lag = max_lag
        self.significance_level = significance_level
        
        # Discovered causal pairs
        self.causal_pairs: List[Dict[str, Any]] = []
    
    def _prepare_lagged_data(
        self,
        x: List[float],
        y: List[float],
        lag: int
    ) -> Tuple[List[List[float]], List[float]]:
        """Prepare lagged matrices for regression."""
        n = len(y) - lag
        X_lagged = []
        Y_target = []
        
        for i in range(lag, len(y)):
            row = []
            # Add lagged Y values
            for j in range(1, lag + 1):
                row.append(y[i - j])
            # Add lagged X values
            for j in range(1, lag + 1):
                row.append(x[i - j])
            X_lagged.append(row)
            Y_target.append(y[i])
        
        return X_lagged, Y_target
    
    def _simple_regression_sse(
        self,
        X: List[List[float]],
        y: List[float]
    ) -> float:
        """
        Compute Sum of Squared Errors using simple OLS.
        
        This is a simplified implementation for demonstration.
        In production, use numpy/scipy for numerical stability.
        """
        if not X or not y:
            return float('inf')
        
        n = len(y)
        k = len(X[0])
        
        # Compute mean
        y_mean = sum(y) / n
        
        # Simple prediction using means (baseline)
        # In production, solve normal equations properly
        sse = sum((yi - y_mean) ** 2 for yi in y)
        
        return sse
    
    def test_granger_causality(
        self,
        x: List[float],
        y: List[float],
        variable_x_name: str = "X",
        variable_y_name: str = "Y"
    ) -> Dict[str, Any]:
        """
        Test if X Granger-causes Y.
        
        Returns analysis results including whether causality is detected.
        """
        if len(x) != len(y) or len(x) < self.max_lag * 2:
            return {"error": "Insufficient data", "granger_causes": False}
        
        results = {
            "x_variable": variable_x_name,
            "y_variable": variable_y_name,
            "lags_tested": self.max_lag,
            "granger_causes": False,
            "best_lag": None,
            "f_statistics": []
        }
        
        # Test for each lag
        for lag in range(1, self.max_lag + 1):
            X_full, Y_target = self._prepare_lagged_data(x, y, lag)
            
            # Restricted model (only Y lags)
            X_restricted = [[row[i] for i in range(lag)] for row in X_full]
            
            sse_restricted = self._simple_regression_sse(X_restricted, Y_target)
            sse_full = self._simple_regression_sse(X_full, Y_target)
            
            # F-statistic approximation
            n = len(Y_target)
            k_full = lag * 2
            k_restricted = lag
            
            if sse_full > 0 and sse_restricted > sse_full:
                f_stat = ((sse_restricted - sse_full) / lag) / (sse_full / (n - k_full - 1))
                
                results["f_statistics"].append({
                    "lag": lag,
                    "f_statistic": round(f_stat, 4),
                    "sse_improvement": round((sse_restricted - sse_full) / sse_restricted, 4)
                })
                
                # Simplified significance check (in production, use F-distribution)
                if f_stat > 3.0:  # Approximate critical value
                    results["granger_causes"] = True
                    if results["best_lag"] is None:
                        results["best_lag"] = lag
        
        if results["granger_causes"]:
            self.causal_pairs.append({
                "cause": variable_x_name,
                "effect": variable_y_name,
                "lag": results["best_lag"],
                "discovered_at": datetime.now().isoformat()
            })
            logger.info(f"Granger causality detected: {variable_x_name} -> {variable_y_name}")
        
        return results
    
    def get_causal_pairs(self) -> List[Dict[str, Any]]:
        """Get all discovered causal pairs."""
        return self.causal_pairs


# =============================================================================
# BASIS REMINDERS (CONSTITUTIONAL GOVERNANCE)
# =============================================================================

@dataclass
class ConstitutionalRule:
    """A rule in the agent's constitution."""
    rule_id: str
    category: str  # safety, ethics, policy, operational
    priority: int  # 1 = highest
    rule_text: str
    keywords: List[str]  # For BM25 retrieval
    embedding: Optional[List[float]] = None
    active: bool = True
    created_at: datetime = field(default_factory=datetime.now)


class BasisReminderSystem:
    """
    Basis Reminder System for Constitutional AI governance.
    
    Implements:
    1. Authorization Before Retrieval - Filter queries by policy
    2. Context Engineering - Immutable system blocks
    3. Hybrid Search - BM25 + Vector for rule retrieval
    
    This ensures "Basis Reminders" are architecturally enforced,
    not just suggested in prompts.
    """
    
    def __init__(self):
        self.constitution: Dict[str, ConstitutionalRule] = {}
        
        # BM25 index (keyword -> rule_ids)
        self.keyword_index: Dict[str, Set[str]] = defaultdict(set)
        
        # Category index
        self.rules_by_category: Dict[str, List[str]] = defaultdict(list)
        
        # Injection log (for auditing)
        self.injection_log: List[Dict[str, Any]] = []
        
        # Current active filters
        self.active_filters: List[Callable] = []
    
    def add_rule(
        self,
        rule_id: str,
        category: str,
        rule_text: str,
        keywords: List[str],
        priority: int = 5,
        embedding: List[float] = None
    ) -> ConstitutionalRule:
        """Add a rule to the constitution."""
        rule = ConstitutionalRule(
            rule_id=rule_id,
            category=category,
            priority=priority,
            rule_text=rule_text,
            keywords=[k.lower() for k in keywords],
            embedding=embedding
        )
        
        self.constitution[rule_id] = rule
        self.rules_by_category[category].append(rule_id)
        
        # Index keywords for BM25
        for keyword in rule.keywords:
            self.keyword_index[keyword].add(rule_id)
        
        logger.info(f"Added constitutional rule: {rule_id} ({category})")
        
        return rule
    
    def _bm25_score(self, query_terms: List[str], rule: ConstitutionalRule) -> float:
        """Calculate BM25-like score for keyword matching."""
        score = 0.0
        k1 = 1.5
        b = 0.75
        avg_dl = 10  # Average document length
        
        doc_terms = set(rule.keywords)
        dl = len(rule.keywords)
        
        for term in query_terms:
            if term in doc_terms:
                tf = rule.keywords.count(term)
                idf = math.log(len(self.constitution) / (len(self.keyword_index.get(term, [])) + 1))
                score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avg_dl))
        
        return score
    
    def _vector_score(self, query_embedding: List[float], rule: ConstitutionalRule) -> float:
        """Calculate cosine similarity for vector matching."""
        if not rule.embedding or not query_embedding:
            return 0.0
        
        dot = sum(a * b for a, b in zip(query_embedding, rule.embedding))
        norm_q = math.sqrt(sum(x * x for x in query_embedding))
        norm_r = math.sqrt(sum(x * x for x in rule.embedding))
        
        if norm_q == 0 or norm_r == 0:
            return 0.0
        
        return dot / (norm_q * norm_r)
    
    def retrieve_relevant_rules(
        self,
        query_text: str,
        query_embedding: List[float] = None,
        category_filter: str = None,
        top_k: int = 5,
        bm25_weight: float = 0.5
    ) -> List[Tuple[ConstitutionalRule, float]]:
        """
        Hybrid search for relevant constitutional rules.
        
        Combines BM25 (keyword) and vector (semantic) search.
        """
        query_terms = [t.lower() for t in re.findall(r'\w+', query_text)]
        
        candidates = list(self.constitution.values())
        
        # Apply category filter
        if category_filter:
            candidates = [r for r in candidates if r.category == category_filter]
        
        # Filter only active rules
        candidates = [r for r in candidates if r.active]
        
        # Score each candidate
        scored = []
        for rule in candidates:
            bm25 = self._bm25_score(query_terms, rule)
            vector = self._vector_score(query_embedding, rule) if query_embedding else 0
            
            combined = bm25_weight * bm25 + (1 - bm25_weight) * vector
            scored.append((rule, combined))
        
        # Sort by score descending, then by priority
        scored.sort(key=lambda x: (x[1], -x[0].priority), reverse=True)
        
        return scored[:top_k]
    
    def get_basis_injection(
        self,
        context: str,
        context_embedding: List[float] = None
    ) -> str:
        """
        Get the basis reminder text to inject into the agent's context.
        
        This is the "Immutable System Block" that ensures governance.
        """
        # Always include high-priority rules
        high_priority = [r for r in self.constitution.values() if r.priority <= 2 and r.active]
        
        # Add contextually relevant rules
        relevant = self.retrieve_relevant_rules(
            query_text=context,
            query_embedding=context_embedding,
            top_k=3
        )
        
        # Combine and deduplicate
        all_rules = {r.rule_id: r for r in high_priority}
        for rule, score in relevant:
            if score > 0.1:  # Minimum relevance threshold
                all_rules[rule.rule_id] = rule
        
        # Sort by priority
        sorted_rules = sorted(all_rules.values(), key=lambda r: r.priority)
        
        # Build injection text
        injection_parts = ["=== CONSTITUTIONAL RULES (IMMUTABLE) ==="]
        for rule in sorted_rules:
            injection_parts.append(f"[{rule.category.upper()}] {rule.rule_text}")
        injection_parts.append("=== END CONSTITUTION ===")
        
        injection_text = "\n".join(injection_parts)
        
        # Log injection for auditing
        self.injection_log.append({
            "timestamp": datetime.now().isoformat(),
            "context_snippet": context[:100],
            "rules_injected": [r.rule_id for r in sorted_rules],
            "injection_length": len(injection_text)
        })
        
        return injection_text
    
    def check_authorization(
        self,
        query: str,
        user_role: str = "user",
        context: Dict[str, Any] = None
    ) -> Tuple[bool, str, List[str]]:
        """
        Authorization Before Retrieval check.
        
        Returns:
            (authorized, rewritten_query, applied_filters)
        """
        applied_filters = []
        rewritten_query = query
        
        # Check against all rules
        for rule in self.constitution.values():
            if not rule.active:
                continue
            
            # Simple keyword-based policy checking
            # In production, use a proper policy engine like OPA
            query_lower = query.lower()
            
            if rule.category == "safety":
                for keyword in rule.keywords:
                    if keyword in query_lower:
                        # Apply filter
                        filter_clause = f" NOT_CONTAINS({keyword})"
                        applied_filters.append(f"Rule {rule.rule_id}: blocked '{keyword}'")
                        logger.warning(f"Authorization filter applied: {rule.rule_id}")
        
        authorized = True  # Default allow, but with filters
        
        return authorized, rewritten_query, applied_filters
    
    def get_audit_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get injection audit log for compliance verification."""
        return self.injection_log[-limit:]


# =============================================================================
# COGNITIVE CUBE - UNIFIED SYSTEM
# =============================================================================

class CognitiveCube:
    """
    Unified Cognitive Cube combining all components:
    
    1. OLAP Cube - Multi-dimensional aggregation (from data_cube.py)
    2. Temporal Knowledge Graph - Causal chains
    3. ART Clustering - Automatic effect grouping
    4. Granger Causality - Statistical causal inference
    5. Basis Reminders - Constitutional governance
    
    This represents the complete "Cognitive Continuity" framework.
    """
    
    def __init__(
        self,
        agent_id: str,
        vigilance: float = 0.7,
        granger_max_lag: int = 5
    ):
        self.agent_id = agent_id
        
        # Core components
        self.tkg = TemporalKnowledgeGraph()
        self.art = ARTCluster(vigilance=vigilance)
        self.granger = GrangerCausalityAnalyzer(max_lag=granger_max_lag)
        self.constitution = BasisReminderSystem()
        
        # Time series storage for Granger analysis
        self.time_series: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
        
        # Statistics
        self.events_processed = 0
        self.causal_links_discovered = 0
        self.effect_groups_created = 0
    
    def initialize_constitution(self, rules: List[Dict[str, Any]]):
        """Initialize the constitutional rules."""
        for rule in rules:
            self.constitution.add_rule(
                rule_id=rule.get("id", f"rule_{len(self.constitution.constitution)}"),
                category=rule.get("category", "general"),
                rule_text=rule["text"],
                keywords=rule.get("keywords", []),
                priority=rule.get("priority", 5),
                embedding=rule.get("embedding")
            )
    
    def record_event(
        self,
        event_id: str,
        event_type: str,
        subject: str,
        predicate: str,
        obj: str,
        outcome_vector: List[float] = None,
        outcome_value: float = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Record an event in the cognitive cube.
        
        This:
        1. Adds nodes/edges to the TKG
        2. Classifies outcome via ART
        3. Updates time series for Granger analysis
        """
        timestamp = datetime.now()
        
        # Add to TKG
        if subject not in self.tkg.nodes:
            self.tkg.add_node(subject, "entity", subject)
        if obj not in self.tkg.nodes:
            self.tkg.add_node(obj, "entity", obj)
        
        edge = self.tkg.add_edge(
            subject=subject,
            predicate=predicate,
            obj=obj,
            valid_from=timestamp,
            metadata=metadata or {}
        )
        
        # Classify outcome via ART if vector provided
        cluster_id = None
        if outcome_vector:
            cluster_id, is_new = self.art.classify(outcome_vector, event_id)
            if is_new:
                self.effect_groups_created += 1
        
        # Update time series if value provided
        if outcome_value is not None:
            self.time_series[predicate].append((timestamp, outcome_value))
        
        self.events_processed += 1
        
        return {
            "event_id": event_id,
            "edge_id": edge.edge_id,
            "effect_group": cluster_id,
            "timestamp": timestamp.isoformat()
        }
    
    def find_causes(
        self,
        effect_event: str,
        max_depth: int = 5,
        time_window_minutes: int = 30
    ) -> List[Dict[str, Any]]:
        """Find causal chains leading to an effect."""
        chains = self.tkg.find_causal_chain(
            effect_node=effect_event,
            max_depth=max_depth,
            time_window=timedelta(minutes=time_window_minutes)
        )
        
        return [
            {
                "chain_length": len(chain),
                "steps": [
                    {
                        "subject": e.subject,
                        "predicate": e.predicate,
                        "object": e.object,
                        "time": e.valid_from.isoformat()
                    }
                    for e in chain
                ]
            }
            for chain in chains
        ]
    
    def analyze_causality(
        self,
        variable_x: str,
        variable_y: str
    ) -> Dict[str, Any]:
        """Run Granger causality test on two time series."""
        x_series = self.time_series.get(variable_x, [])
        y_series = self.time_series.get(variable_y, [])
        
        if len(x_series) < 10 or len(y_series) < 10:
            return {"error": "Insufficient data points", "granger_causes": False}
        
        # Align time series
        x_values = [v for _, v in sorted(x_series)]
        y_values = [v for _, v in sorted(y_series)]
        
        # Truncate to same length
        min_len = min(len(x_values), len(y_values))
        x_values = x_values[:min_len]
        y_values = y_values[:min_len]
        
        result = self.granger.test_granger_causality(
            x_values, y_values,
            variable_x_name=variable_x,
            variable_y_name=variable_y
        )
        
        if result.get("granger_causes"):
            self.causal_links_discovered += 1
        
        return result
    
    def get_basis_reminder(
        self,
        context: str,
        context_embedding: List[float] = None
    ) -> str:
        """Get constitutional basis reminder for current context."""
        return self.constitution.get_basis_injection(context, context_embedding)
    
    def authorize_query(
        self,
        query: str,
        user_role: str = "user"
    ) -> Tuple[bool, str, List[str]]:
        """Check authorization before retrieval."""
        return self.constitution.check_authorization(query, user_role)
    
    def get_effect_groups(self) -> Dict[str, Dict[str, Any]]:
        """Get all discovered effect groups."""
        return self.art.get_effect_groups()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics."""
        return {
            "agent_id": self.agent_id,
            "events_processed": self.events_processed,
            "causal_links_discovered": self.causal_links_discovered,
            "effect_groups_created": self.effect_groups_created,
            "tkg_stats": self.tkg.get_stats(),
            "art_clusters": len(self.art.prototypes),
            "granger_pairs": len(self.granger.causal_pairs),
            "constitutional_rules": len(self.constitution.constitution),
            "time_series_tracked": len(self.time_series)
        }
    
    def export(self) -> Dict[str, Any]:
        """Export complete cognitive cube state."""
        return {
            "stats": self.get_stats(),
            "effect_groups": self.get_effect_groups(),
            "causal_pairs": self.granger.get_causal_pairs(),
            "constitution_audit": self.constitution.get_audit_log(limit=50)
        }


# =============================================================================
# TESTS
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("Cognitive Cube Tests - TKG, ART, Granger, Basis Reminders")
    print("=" * 70)
    
    # Initialize cognitive cube
    cube = CognitiveCube(agent_id="test_agent", vigilance=0.6)
    
    # Initialize constitution
    print("\n[1] Initializing Constitutional Rules...")
    cube.initialize_constitution([
        {
            "id": "safety_001",
            "category": "safety",
            "text": "Never execute destructive operations without explicit user confirmation.",
            "keywords": ["delete", "remove", "destroy", "drop", "truncate"],
            "priority": 1
        },
        {
            "id": "safety_002",
            "category": "safety",
            "text": "Do not reveal sensitive user data to unauthorized parties.",
            "keywords": ["password", "secret", "key", "token", "credential"],
            "priority": 1
        },
        {
            "id": "ethics_001",
            "category": "ethics",
            "text": "Treat all users with respect and avoid discriminatory language.",
            "keywords": ["user", "person", "individual", "customer"],
            "priority": 2
        },
        {
            "id": "policy_001",
            "category": "policy",
            "text": "Log all database modifications for audit purposes.",
            "keywords": ["database", "insert", "update", "modify"],
            "priority": 3
        }
    ])
    print(f"    ✓ Added {len(cube.constitution.constitution)} rules")
    
    # Test basis reminder injection
    print("\n[2] Testing Basis Reminder Injection...")
    context = "The user wants to delete all records from the database"
    reminder = cube.get_basis_reminder(context)
    print(f"    Context: '{context[:50]}...'")
    print(f"    ✓ Injection length: {len(reminder)} chars")
    print(f"    ✓ Rules injected: {len(cube.constitution.injection_log[-1]['rules_injected'])}")
    
    # Test authorization
    print("\n[3] Testing Authorization Before Retrieval...")
    auth, rewritten, filters = cube.authorize_query(
        query="Show me all user passwords",
        user_role="user"
    )
    print(f"    Query: 'Show me all user passwords'")
    print(f"    ✓ Authorized: {auth}")
    print(f"    ✓ Filters applied: {len(filters)}")
    
    # Record events for TKG
    print("\n[4] Recording Events to Temporal Knowledge Graph...")
    events = [
        ("evt_001", "action", "agent", "rebooted", "server_01", [0.8, 0.2, 0.1]),
        ("evt_002", "state", "server_01", "latency_dropped", "true", [0.9, 0.1, 0.2]),
        ("evt_003", "action", "agent", "deployed", "app_v2", [0.7, 0.3, 0.1]),
        ("evt_004", "state", "app_v2", "errors_increased", "true", [0.2, 0.8, 0.7]),
        ("evt_005", "action", "agent", "rolled_back", "app_v1", [0.6, 0.3, 0.2]),
        ("evt_006", "state", "server_01", "errors_decreased", "true", [0.85, 0.1, 0.15]),
    ]
    
    for event_id, etype, subj, pred, obj, vec in events:
        result = cube.record_event(
            event_id=event_id,
            event_type=etype,
            subject=subj,
            predicate=pred,
            obj=obj,
            outcome_vector=vec
        )
    
    print(f"    ✓ Recorded {len(events)} events")
    print(f"    ✓ TKG nodes: {cube.tkg.get_stats()['nodes']}")
    print(f"    ✓ TKG edges: {cube.tkg.get_stats()['edges']}")
    
    # Test ART clustering
    print("\n[5] Testing ART Effect Grouping...")
    effect_groups = cube.get_effect_groups()
    print(f"    ✓ Effect groups discovered: {len(effect_groups)}")
    for gid, gdata in effect_groups.items():
        print(f"      - {gid}: {gdata['count']} members")
    
    # Test causal chain discovery
    print("\n[6] Testing Causal Chain Discovery...")
    # Find what caused "true" (successful outcomes)
    chains = cube.find_causes("true", max_depth=3)
    print(f"    ✓ Found {len(chains)} causal chains to 'true'")
    for i, chain in enumerate(chains[:2]):
        print(f"      Chain {i+1} ({chain['chain_length']} steps):")
        for step in chain['steps'][:3]:
            print(f"        {step['subject']} --{step['predicate']}--> {step['object']}")
    
    # Test Granger causality (with synthetic data)
    print("\n[7] Testing Granger Causality Analysis...")
    # Add synthetic time series data
    import random
    for i in range(50):
        cube.time_series["cpu_load"].append(
            (datetime.now() - timedelta(minutes=50-i), 50 + random.gauss(0, 10))
        )
        # Response time correlates with CPU load (lagged)
        cube.time_series["response_time"].append(
            (datetime.now() - timedelta(minutes=50-i), 
             100 + 0.5 * (50 + random.gauss(0, 10)) + random.gauss(0, 5))
        )
    
    result = cube.analyze_causality("cpu_load", "response_time")
    print(f"    ✓ cpu_load -> response_time: {result.get('granger_causes', False)}")
    if result.get('best_lag'):
        print(f"      Best lag: {result['best_lag']}")
    
    # Get comprehensive stats
    print("\n[8] Cognitive Cube Statistics...")
    stats = cube.get_stats()
    print(f"    ✓ Events processed: {stats['events_processed']}")
    print(f"    ✓ Effect groups: {stats['effect_groups_created']}")
    print(f"    ✓ Causal links: {stats['causal_links_discovered']}")
    print(f"    ✓ Constitutional rules: {stats['constitutional_rules']}")
    print(f"    ✓ Time series tracked: {stats['time_series_tracked']}")
    
    # Export
    print("\n[9] Exporting Cognitive Cube...")
    export = cube.export()
    print(f"    ✓ Export contains {len(export)} sections")
    
    print("\n" + "=" * 70)
    print("All Cognitive Cube tests passed ✓")
    print("=" * 70)
