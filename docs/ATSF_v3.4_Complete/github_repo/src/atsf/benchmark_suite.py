"""
ATSF Benchmark Suite
====================

Comprehensive performance and accuracy benchmarks for ATSF v3.4.

Benchmarks:
- Throughput: Actions per second
- Latency: P50/P95/P99 response times
- Accuracy: Causal detection, clustering stability
- Scalability: Performance under load
- Memory: Resource utilization

Author: ATSF Development Team
Version: 3.4.0
"""

import asyncio
import time
import random
import statistics
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Any, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

# Import ATSF components
from atsf_v33_fixes import ATSFv33System, SafetyConfig, TrustConfig
from data_cube import DataCube, AgentKnowledgeBase, Fact, TimeDimension
from cognitive_cube import (
    CognitiveCube, TemporalKnowledgeGraph, ARTCluster,
    GrangerCausalityAnalyzer, BasisReminderSystem
)
from ai_trism_integration import AITRiSMManager
from creator_accountability import CreatorReputationEngine


@dataclass
class BenchmarkResult:
    """Result of a single benchmark run."""
    name: str
    iterations: int
    total_time_ms: float
    avg_time_ms: float
    min_time_ms: float
    max_time_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    throughput_per_sec: float
    success_rate: float
    memory_mb: Optional[float] = None
    extra_metrics: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "iterations": self.iterations,
            "total_time_ms": round(self.total_time_ms, 2),
            "avg_time_ms": round(self.avg_time_ms, 4),
            "min_time_ms": round(self.min_time_ms, 4),
            "max_time_ms": round(self.max_time_ms, 4),
            "p50_ms": round(self.p50_ms, 4),
            "p95_ms": round(self.p95_ms, 4),
            "p99_ms": round(self.p99_ms, 4),
            "throughput_per_sec": round(self.throughput_per_sec, 2),
            "success_rate": round(self.success_rate, 4),
            "memory_mb": round(self.memory_mb, 2) if self.memory_mb else None,
            "extra_metrics": self.extra_metrics
        }
    
    def __str__(self) -> str:
        return (
            f"{self.name}:\n"
            f"  Iterations: {self.iterations}\n"
            f"  Throughput: {self.throughput_per_sec:.2f}/sec\n"
            f"  Latency: avg={self.avg_time_ms:.3f}ms, p50={self.p50_ms:.3f}ms, "
            f"p95={self.p95_ms:.3f}ms, p99={self.p99_ms:.3f}ms\n"
            f"  Success Rate: {self.success_rate*100:.2f}%"
        )


class BenchmarkSuite:
    """
    ATSF Benchmark Suite for performance and accuracy testing.
    """
    
    def __init__(self):
        self.results: List[BenchmarkResult] = []
        
    def _compute_percentile(self, data: List[float], percentile: float) -> float:
        """Compute percentile of sorted data."""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        idx = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(idx, len(sorted_data) - 1)]
    
    def _run_timed_iterations(
        self,
        func,
        iterations: int,
        warmup: int = 10
    ) -> Tuple[List[float], int]:
        """Run function multiple times and collect timing data."""
        # Warmup
        for _ in range(warmup):
            try:
                func()
            except:
                pass
        
        # Actual benchmark
        times = []
        successes = 0
        
        for _ in range(iterations):
            start = time.perf_counter()
            try:
                func()
                successes += 1
            except Exception as e:
                pass  # Count as failure
            end = time.perf_counter()
            times.append((end - start) * 1000)  # Convert to ms
        
        return times, successes
    
    def _create_result(
        self,
        name: str,
        times: List[float],
        successes: int,
        iterations: int,
        extra_metrics: Dict[str, Any] = None
    ) -> BenchmarkResult:
        """Create benchmark result from timing data."""
        total_time = sum(times)
        
        return BenchmarkResult(
            name=name,
            iterations=iterations,
            total_time_ms=total_time,
            avg_time_ms=statistics.mean(times) if times else 0,
            min_time_ms=min(times) if times else 0,
            max_time_ms=max(times) if times else 0,
            p50_ms=self._compute_percentile(times, 50),
            p95_ms=self._compute_percentile(times, 95),
            p99_ms=self._compute_percentile(times, 99),
            throughput_per_sec=(iterations / (total_time / 1000)) if total_time > 0 else 0,
            success_rate=successes / iterations if iterations > 0 else 0,
            extra_metrics=extra_metrics or {}
        )
    
    # =========================================================================
    # TRUST SCORING BENCHMARKS
    # =========================================================================
    
    def benchmark_trust_scoring(self, iterations: int = 1000) -> BenchmarkResult:
        """Benchmark trust score computation."""
        system = ATSFv33System()
        system.register_creator("bench_creator", "verified", stake=1000)
        system.register_agent("bench_agent", "bench_creator", "gray_box")
        
        action_types = ["read", "write", "execute", "api_call"]
        
        def run_action():
            action = {
                "request_id": f"req_{random.randint(0, 100000)}",
                "agent_id": "bench_agent",
                "action_type": random.choice(action_types),
                "payload": {"target": "test"},
                "reasoning_trace": "Benchmark test action"
            }
            asyncio.get_event_loop().run_until_complete(
                system.process_action(action)
            )
        
        times, successes = self._run_timed_iterations(run_action, iterations)
        
        result = self._create_result(
            "Trust Scoring",
            times, successes, iterations,
            {"action_types": action_types}
        )
        self.results.append(result)
        return result
    
    # =========================================================================
    # DATA CUBE BENCHMARKS
    # =========================================================================
    
    def benchmark_cube_aggregation(self, iterations: int = 500) -> BenchmarkResult:
        """Benchmark OLAP cube aggregation."""
        kb = AgentKnowledgeBase("bench_agent")
        
        # Populate with data
        action_types = ["read", "write", "execute", "api_call"]
        decisions = ["allow", "allow_monitored", "deny"]
        
        for i in range(1000):
            kb.record_action(
                request_id=f"req_{i}",
                action_type=random.choice(action_types),
                action_category="general",
                decision=random.choice(decisions),
                trust_score=random.uniform(0.3, 0.7),
                trust_delta=random.uniform(-0.01, 0.02),
                risk_score=random.uniform(0, 1),
                processing_time_ms=random.uniform(0.5, 5),
                metadata={"creator_id": "test", "tier": "gray_box"}
            )
        
        dimensions_list = [
            ["action_type", "decision"],
            ["time", "action_type"],
            ["risk_band", "decision"],
            ["action_type", "decision", "risk_band"]
        ]
        
        def run_aggregation():
            dims = random.choice(dimensions_list)
            kb.cube.aggregate(dimensions=dims)
        
        times, successes = self._run_timed_iterations(run_aggregation, iterations)
        
        result = self._create_result(
            "Cube Aggregation",
            times, successes, iterations,
            {"facts_count": len(kb.cube.facts)}
        )
        self.results.append(result)
        return result
    
    def benchmark_cube_slice_dice(self, iterations: int = 1000) -> BenchmarkResult:
        """Benchmark cube slicing and dicing operations."""
        cube = DataCube()
        
        # Populate
        for i in range(500):
            fact = Fact(
                timestamp=datetime.now() - timedelta(hours=random.randint(0, 100)),
                agent_id=f"agent_{random.randint(0, 5)}",
                creator_id="creator_001",
                tier=random.choice(["black_box", "gray_box", "white_box"]),
                action_type=random.choice(["read", "write", "execute"]),
                action_category="general",
                decision=random.choice(["allow", "deny"]),
                trust_score=random.uniform(0.3, 0.7),
                trust_delta=random.uniform(-0.01, 0.02),
                risk_score=random.uniform(0, 1),
                processing_time_ms=random.uniform(0.5, 5),
                tool_outputs_count=random.randint(0, 5),
                reasoning_quality=random.uniform(0.5, 1)
            )
            cube.add_fact(fact)
        
        cube.aggregate(dimensions=["action_type", "decision", "tier"])
        
        def run_slice_dice():
            op = random.choice(["slice", "dice"])
            if op == "slice":
                cube.slice("action_type", random.choice(["read", "write", "execute"]))
            else:
                cube.dice({
                    "action_type": ["read", "write"],
                    "decision": ["allow"]
                })
        
        times, successes = self._run_timed_iterations(run_slice_dice, iterations)
        
        result = self._create_result(
            "Cube Slice/Dice",
            times, successes, iterations,
            {"cells_count": len(cube.cells)}
        )
        self.results.append(result)
        return result
    
    # =========================================================================
    # COGNITIVE CUBE BENCHMARKS
    # =========================================================================
    
    def benchmark_tkg_traversal(self, iterations: int = 500) -> BenchmarkResult:
        """Benchmark Temporal Knowledge Graph causal chain discovery."""
        tkg = TemporalKnowledgeGraph()
        
        # Build a graph
        entities = [f"entity_{i}" for i in range(50)]
        predicates = ["caused", "triggered", "led_to", "resulted_in"]
        
        for i in range(200):
            subj = random.choice(entities)
            obj = random.choice(entities)
            if subj != obj:
                tkg.add_node(subj, "entity", subj)
                tkg.add_node(obj, "entity", obj)
                tkg.add_edge(
                    subject=subj,
                    predicate=random.choice(predicates),
                    obj=obj,
                    valid_from=datetime.now() - timedelta(minutes=random.randint(0, 100))
                )
        
        def run_traversal():
            effect = random.choice(entities)
            tkg.find_causal_chain(effect, max_depth=4)
        
        times, successes = self._run_timed_iterations(run_traversal, iterations)
        
        result = self._create_result(
            "TKG Causal Traversal",
            times, successes, iterations,
            {"nodes": len(tkg.nodes), "edges": len(tkg.edges)}
        )
        self.results.append(result)
        return result
    
    def benchmark_art_clustering(self, iterations: int = 1000) -> BenchmarkResult:
        """Benchmark ART clustering for effect grouping."""
        art = ARTCluster(vigilance=0.7)
        
        # Pre-populate some clusters
        for i in range(50):
            vec = [random.uniform(0, 1) for _ in range(10)]
            art.classify(vec, f"init_{i}")
        
        def run_clustering():
            vec = [random.uniform(0, 1) for _ in range(10)]
            art.classify(vec, f"bench_{random.randint(0, 100000)}")
        
        times, successes = self._run_timed_iterations(run_clustering, iterations)
        
        result = self._create_result(
            "ART Clustering",
            times, successes, iterations,
            {"clusters": len(art.prototypes)}
        )
        self.results.append(result)
        return result
    
    def benchmark_granger_causality(self, iterations: int = 100) -> BenchmarkResult:
        """Benchmark Granger causality testing."""
        granger = GrangerCausalityAnalyzer(max_lag=5)
        
        # Generate correlated time series
        def generate_series(n: int = 100):
            x = [random.gauss(50, 10) for _ in range(n)]
            y = [0] * n
            for i in range(3, n):
                y[i] = 0.5 * x[i-2] + 0.3 * y[i-1] + random.gauss(0, 5)
            return x, y
        
        def run_granger():
            x, y = generate_series(100)
            granger.test_granger_causality(x, y, "X", "Y")
        
        times, successes = self._run_timed_iterations(run_granger, iterations)
        
        result = self._create_result(
            "Granger Causality",
            times, successes, iterations
        )
        self.results.append(result)
        return result
    
    def benchmark_constitutional_retrieval(self, iterations: int = 500) -> BenchmarkResult:
        """Benchmark constitutional rule retrieval (BM25 + Vector)."""
        basis = BasisReminderSystem()
        
        # Add rules
        categories = ["safety", "ethics", "policy", "operational"]
        for i in range(50):
            basis.add_rule(
                rule_id=f"rule_{i}",
                category=random.choice(categories),
                rule_text=f"This is rule {i} about {random.choice(['security', 'privacy', 'access', 'data'])}",
                keywords=[f"keyword_{j}" for j in range(random.randint(2, 5))],
                priority=random.randint(1, 5)
            )
        
        queries = [
            "How should I handle sensitive data?",
            "What are the security requirements?",
            "Can I access user information?",
            "What are the privacy rules?",
            "How do I handle errors safely?"
        ]
        
        def run_retrieval():
            query = random.choice(queries)
            basis.retrieve_relevant_rules(query, top_k=5)
        
        times, successes = self._run_timed_iterations(run_retrieval, iterations)
        
        result = self._create_result(
            "Constitutional Retrieval",
            times, successes, iterations,
            {"rules_count": len(basis.constitution)}
        )
        self.results.append(result)
        return result
    
    # =========================================================================
    # ACCURACY BENCHMARKS
    # =========================================================================
    
    def benchmark_causal_detection_accuracy(self, iterations: int = 100) -> BenchmarkResult:
        """Benchmark accuracy of causal chain detection."""
        correct = 0
        total = 0
        times = []
        
        for _ in range(iterations):
            tkg = TemporalKnowledgeGraph()
            
            # Create known causal chain: A -> B -> C -> D
            tkg.add_node("A", "event", "Event A")
            tkg.add_node("B", "event", "Event B")
            tkg.add_node("C", "event", "Event C")
            tkg.add_node("D", "event", "Event D")
            
            base_time = datetime.now()
            tkg.add_edge("A", "causes", "B", base_time)
            tkg.add_edge("B", "causes", "C", base_time + timedelta(minutes=5))
            tkg.add_edge("C", "causes", "D", base_time + timedelta(minutes=10))
            
            # Add some noise
            for i in range(10):
                tkg.add_node(f"noise_{i}", "event", f"Noise {i}")
                tkg.add_edge(f"noise_{i}", "unrelated", random.choice(["A", "B", "C", "D"]),
                           base_time + timedelta(minutes=random.randint(-100, 100)))
            
            start = time.perf_counter()
            chains = tkg.find_causal_chain("D", max_depth=5, time_window=timedelta(minutes=30))
            end = time.perf_counter()
            times.append((end - start) * 1000)
            
            # Check if we found the correct chain
            total += 1
            for chain in chains:
                subjects = [e.subject for e in chain]
                if "A" in subjects or "B" in subjects:
                    correct += 1
                    break
        
        accuracy = correct / total if total > 0 else 0
        
        result = self._create_result(
            "Causal Detection Accuracy",
            times, total, iterations,
            {"accuracy": accuracy, "correct": correct, "total": total}
        )
        self.results.append(result)
        return result
    
    def benchmark_art_stability(self, iterations: int = 100) -> BenchmarkResult:
        """Benchmark ART cluster stability."""
        stable_count = 0
        total = 0
        times = []
        
        for _ in range(iterations):
            art = ARTCluster(vigilance=0.7)
            
            # Create 5 distinct clusters
            cluster_centers = [
                [1.0, 0.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 0.0, 1.0],
            ]
            
            start = time.perf_counter()
            
            # Add points near each center
            for i, center in enumerate(cluster_centers):
                for j in range(20):
                    vec = [c + random.gauss(0, 0.1) for c in center]
                    art.classify(vec, f"point_{i}_{j}")
            
            end = time.perf_counter()
            times.append((end - start) * 1000)
            
            # Check if we got ~5 clusters
            total += 1
            if 4 <= len(art.prototypes) <= 7:  # Allow some tolerance
                stable_count += 1
        
        stability = stable_count / total if total > 0 else 0
        
        result = self._create_result(
            "ART Cluster Stability",
            times, total, iterations,
            {"stability": stability, "stable_runs": stable_count}
        )
        self.results.append(result)
        return result
    
    # =========================================================================
    # SCALABILITY BENCHMARKS
    # =========================================================================
    
    def benchmark_scaling_facts(self, fact_counts: List[int] = None) -> List[BenchmarkResult]:
        """Benchmark performance scaling with number of facts."""
        if fact_counts is None:
            fact_counts = [100, 500, 1000, 5000, 10000]
        
        results = []
        
        for count in fact_counts:
            kb = AgentKnowledgeBase("scale_agent")
            
            # Populate
            for i in range(count):
                kb.record_action(
                    request_id=f"req_{i}",
                    action_type=random.choice(["read", "write", "execute"]),
                    action_category="general",
                    decision=random.choice(["allow", "deny"]),
                    trust_score=random.uniform(0.3, 0.7),
                    trust_delta=random.uniform(-0.01, 0.02),
                    risk_score=random.uniform(0, 1),
                    processing_time_ms=random.uniform(0.5, 5),
                    metadata={"creator_id": "test", "tier": "gray_box"}
                )
            
            # Benchmark aggregation
            times = []
            for _ in range(50):
                start = time.perf_counter()
                kb.cube.aggregate(dimensions=["action_type", "decision"])
                end = time.perf_counter()
                times.append((end - start) * 1000)
            
            result = self._create_result(
                f"Scaling ({count} facts)",
                times, 50, 50,
                {"fact_count": count}
            )
            results.append(result)
            self.results.append(result)
        
        return results
    
    # =========================================================================
    # CONCURRENT BENCHMARKS
    # =========================================================================
    
    def benchmark_concurrent_processing(
        self,
        workers: int = 4,
        iterations_per_worker: int = 100
    ) -> BenchmarkResult:
        """Benchmark concurrent action processing."""
        system = ATSFv33System()
        system.register_creator("conc_creator", "verified", stake=1000)
        
        for i in range(workers):
            system.register_agent(f"conc_agent_{i}", "conc_creator", "gray_box")
        
        all_times = []
        successes = 0
        
        def worker_task(worker_id: int):
            local_times = []
            local_success = 0
            
            for i in range(iterations_per_worker):
                action = {
                    "request_id": f"req_{worker_id}_{i}",
                    "agent_id": f"conc_agent_{worker_id % workers}",
                    "action_type": random.choice(["read", "write"]),
                    "payload": {"target": "test"},
                    "reasoning_trace": "Concurrent test"
                }
                
                start = time.perf_counter()
                try:
                    asyncio.get_event_loop().run_until_complete(
                        system.process_action(action)
                    )
                    local_success += 1
                except:
                    pass
                end = time.perf_counter()
                local_times.append((end - start) * 1000)
            
            return local_times, local_success
        
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(worker_task, i) for i in range(workers)]
            for future in as_completed(futures):
                times, success = future.result()
                all_times.extend(times)
                successes += success
        
        total_iterations = workers * iterations_per_worker
        
        result = self._create_result(
            f"Concurrent Processing ({workers} workers)",
            all_times, successes, total_iterations,
            {"workers": workers, "iterations_per_worker": iterations_per_worker}
        )
        self.results.append(result)
        return result
    
    # =========================================================================
    # RUN ALL BENCHMARKS
    # =========================================================================
    
    def run_all(self, quick: bool = False) -> Dict[str, Any]:
        """Run all benchmarks."""
        scale = 0.1 if quick else 1.0
        
        print("=" * 70)
        print("ATSF v3.4 Benchmark Suite")
        print("=" * 70)
        print()
        
        benchmarks = [
            ("Trust Scoring", lambda: self.benchmark_trust_scoring(int(1000 * scale))),
            ("Cube Aggregation", lambda: self.benchmark_cube_aggregation(int(500 * scale))),
            ("Cube Slice/Dice", lambda: self.benchmark_cube_slice_dice(int(1000 * scale))),
            ("TKG Traversal", lambda: self.benchmark_tkg_traversal(int(500 * scale))),
            ("ART Clustering", lambda: self.benchmark_art_clustering(int(1000 * scale))),
            ("Granger Causality", lambda: self.benchmark_granger_causality(int(100 * scale))),
            ("Constitutional Retrieval", lambda: self.benchmark_constitutional_retrieval(int(500 * scale))),
            ("Causal Detection Accuracy", lambda: self.benchmark_causal_detection_accuracy(int(100 * scale))),
            ("ART Stability", lambda: self.benchmark_art_stability(int(100 * scale))),
            ("Concurrent Processing", lambda: self.benchmark_concurrent_processing(4, int(100 * scale))),
        ]
        
        for name, bench_func in benchmarks:
            print(f"Running: {name}...")
            try:
                result = bench_func()
                print(f"  ✓ {result.throughput_per_sec:.0f}/sec, p99={result.p99_ms:.3f}ms")
            except Exception as e:
                print(f"  ✗ Error: {e}")
        
        print()
        print("=" * 70)
        print("BENCHMARK SUMMARY")
        print("=" * 70)
        
        summary = {
            "timestamp": datetime.now().isoformat(),
            "quick_mode": quick,
            "results": [r.to_dict() for r in self.results]
        }
        
        for result in self.results:
            print(f"\n{result}")
        
        return summary
    
    def export_results(self, filepath: str = "benchmark_results.json"):
        """Export results to JSON file."""
        data = {
            "version": "3.4.0",
            "timestamp": datetime.now().isoformat(),
            "results": [r.to_dict() for r in self.results]
        }
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Results exported to {filepath}")


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import sys
    
    quick = "--quick" in sys.argv
    
    suite = BenchmarkSuite()
    summary = suite.run_all(quick=quick)
    
    print("\n" + "=" * 70)
    
    # Calculate aggregate metrics
    if suite.results:
        avg_throughput = statistics.mean(r.throughput_per_sec for r in suite.results)
        avg_p99 = statistics.mean(r.p99_ms for r in suite.results)
        avg_success = statistics.mean(r.success_rate for r in suite.results)
        
        print(f"\nAGGREGATE METRICS:")
        print(f"  Average Throughput: {avg_throughput:.0f}/sec")
        print(f"  Average P99 Latency: {avg_p99:.3f}ms")
        print(f"  Average Success Rate: {avg_success*100:.1f}%")
        
        # Check accuracy benchmarks
        for r in suite.results:
            if "accuracy" in r.extra_metrics:
                print(f"  {r.name}: {r.extra_metrics['accuracy']*100:.1f}%")
            if "stability" in r.extra_metrics:
                print(f"  {r.name}: {r.extra_metrics['stability']*100:.1f}%")
    
    print("\n" + "=" * 70)
    print("Benchmark suite complete!")
