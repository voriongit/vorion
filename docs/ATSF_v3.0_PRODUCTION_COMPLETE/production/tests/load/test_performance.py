"""
ATSF v3.0 - Load & Stress Test Suite
=====================================

Performance testing for ATSF under load.

Run with:
    python tests/load/test_performance.py

Requires:
    pip install locust

Author: ATSF Development Team
Version: 3.0.0
"""

import os
import time
import random
import string
import json
import asyncio
import aiohttp
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
import statistics

# Configuration
API_URL = os.getenv("ATSF_API_URL", "http://localhost:8000")
API_KEY = os.getenv("ATSF_API_KEY", "demo-key-12345")


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class TestResult:
    """Single test result."""
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    success: bool
    error: str = None


@dataclass
class LoadTestReport:
    """Complete load test report."""
    total_requests: int
    successful_requests: int
    failed_requests: int
    duration_seconds: float
    requests_per_second: float
    avg_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    p50_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    errors: Dict[str, int]


# =============================================================================
# LOAD TEST CLIENT
# =============================================================================

class LoadTestClient:
    """Load testing client."""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        self.results: List[TestResult] = []
        
    def _random_agent_id(self) -> str:
        """Generate random agent ID."""
        return f"load-test-{''.join(random.choices(string.ascii_lowercase, k=8))}"
    
    def _make_request(self, method: str, endpoint: str, json_data: dict = None) -> TestResult:
        """Make a single request and record result."""
        import requests
        
        url = f"{self.base_url}{endpoint}"
        start = time.perf_counter()
        
        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=self.headers, json=json_data, timeout=30)
            elif method == "PATCH":
                response = requests.patch(url, headers=self.headers, json=json_data, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                raise ValueError(f"Unknown method: {method}")
                
            elapsed = (time.perf_counter() - start) * 1000
            
            result = TestResult(
                endpoint=endpoint,
                method=method,
                status_code=response.status_code,
                response_time_ms=elapsed,
                success=response.status_code < 400
            )
            
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            result = TestResult(
                endpoint=endpoint,
                method=method,
                status_code=0,
                response_time_ms=elapsed,
                success=False,
                error=str(e)
            )
            
        self.results.append(result)
        return result
    
    def generate_report(self, duration: float) -> LoadTestReport:
        """Generate test report from results."""
        successful = [r for r in self.results if r.success]
        failed = [r for r in self.results if not r.success]
        response_times = [r.response_time_ms for r in self.results]
        
        # Count errors by type
        errors = {}
        for r in failed:
            key = f"{r.status_code}:{r.error or 'unknown'}"
            errors[key] = errors.get(key, 0) + 1
            
        # Calculate percentiles
        sorted_times = sorted(response_times)
        
        def percentile(p: float) -> float:
            if not sorted_times:
                return 0.0
            idx = int(len(sorted_times) * p)
            return sorted_times[min(idx, len(sorted_times) - 1)]
        
        return LoadTestReport(
            total_requests=len(self.results),
            successful_requests=len(successful),
            failed_requests=len(failed),
            duration_seconds=duration,
            requests_per_second=len(self.results) / duration if duration > 0 else 0,
            avg_response_time_ms=statistics.mean(response_times) if response_times else 0,
            min_response_time_ms=min(response_times) if response_times else 0,
            max_response_time_ms=max(response_times) if response_times else 0,
            p50_response_time_ms=percentile(0.50),
            p95_response_time_ms=percentile(0.95),
            p99_response_time_ms=percentile(0.99),
            errors=errors
        )


# =============================================================================
# LOAD TEST SCENARIOS
# =============================================================================

class LoadTestScenarios:
    """Load test scenarios."""
    
    def __init__(self, client: LoadTestClient):
        self.client = client
        self.created_agents: List[str] = []
    
    def health_check(self):
        """Simple health check."""
        return self.client._make_request("GET", "/health")
    
    def create_agent(self):
        """Create a new agent."""
        agent_id = self.client._random_agent_id()
        result = self.client._make_request("POST", "/agents", {
            "agent_id": agent_id,
            "transparency_tier": random.choice(["black_box", "gray_box", "white_box"])
        })
        if result.success:
            self.created_agents.append(agent_id)
        return result
    
    def get_agent(self):
        """Get an existing agent."""
        if not self.created_agents:
            return None
        agent_id = random.choice(self.created_agents)
        return self.client._make_request("GET", f"/agents/{agent_id}")
    
    def update_trust(self):
        """Update trust for an agent."""
        if not self.created_agents:
            return None
        agent_id = random.choice(self.created_agents)
        return self.client._make_request("POST", f"/agents/{agent_id}/trust", {
            "event_type": random.choice(["success", "failure", "warning"]),
            "delta": random.uniform(-0.05, 0.05),
            "source": "load_test"
        })
    
    def process_action(self):
        """Process an action request."""
        if not self.created_agents:
            return None
        agent_id = random.choice(self.created_agents)
        return self.client._make_request("POST", f"/agents/{agent_id}/actions", {
            "action_type": random.choice(["read", "write", "execute"]),
            "description": "Load test action",
            "target": "/test/resource",
            "impact": random.choice(["low", "medium", "high"]),
            "reversible": random.choice([True, False])
        })
    
    def get_assessment(self):
        """Get agent assessment."""
        if not self.created_agents:
            return None
        agent_id = random.choice(self.created_agents)
        return self.client._make_request("GET", f"/agents/{agent_id}/assessment")
    
    def get_stats(self):
        """Get system stats."""
        return self.client._make_request("GET", "/stats")
    
    def cleanup(self):
        """Clean up created agents."""
        for agent_id in self.created_agents:
            try:
                self.client._make_request("DELETE", f"/agents/{agent_id}")
            except:
                pass


# =============================================================================
# LOAD TEST RUNNER
# =============================================================================

class LoadTestRunner:
    """Load test execution engine."""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
    
    def run_concurrent_test(
        self,
        num_users: int,
        duration_seconds: int,
        scenario_weights: Dict[str, float] = None
    ) -> LoadTestReport:
        """
        Run load test with concurrent users.
        
        Args:
            num_users: Number of concurrent users
            duration_seconds: Test duration
            scenario_weights: Weight for each scenario (default: balanced)
        """
        default_weights = {
            "health_check": 0.1,
            "create_agent": 0.15,
            "get_agent": 0.2,
            "update_trust": 0.25,
            "process_action": 0.2,
            "get_assessment": 0.1
        }
        weights = scenario_weights or default_weights
        
        # Normalize weights
        total = sum(weights.values())
        weights = {k: v/total for k, v in weights.items()}
        
        client = LoadTestClient(self.base_url, self.api_key)
        scenarios = LoadTestScenarios(client)
        
        # Pre-create some agents
        print(f"Pre-creating 50 agents...")
        for _ in range(50):
            scenarios.create_agent()
        
        print(f"Starting load test: {num_users} users for {duration_seconds}s")
        
        start_time = time.time()
        end_time = start_time + duration_seconds
        
        def run_scenario():
            """Run a random weighted scenario."""
            scenario = random.choices(
                list(weights.keys()),
                weights=list(weights.values())
            )[0]
            
            method = getattr(scenarios, scenario)
            return method()
        
        # Run test
        with ThreadPoolExecutor(max_workers=num_users) as executor:
            futures = []
            
            while time.time() < end_time:
                # Submit new tasks
                while len(futures) < num_users * 2:  # Keep pipeline full
                    futures.append(executor.submit(run_scenario))
                
                # Process completed futures
                done = [f for f in futures if f.done()]
                for f in done:
                    try:
                        f.result()
                    except:
                        pass
                    futures.remove(f)
                
                time.sleep(0.01)  # Small delay to prevent CPU spinning
        
        actual_duration = time.time() - start_time
        
        # Cleanup
        print("Cleaning up...")
        scenarios.cleanup()
        
        return client.generate_report(actual_duration)
    
    def run_ramp_up_test(
        self,
        max_users: int,
        ramp_duration_seconds: int,
        hold_duration_seconds: int
    ) -> List[LoadTestReport]:
        """
        Run ramp-up load test.
        
        Gradually increases load to find breaking point.
        """
        reports = []
        step_users = max(1, max_users // 10)
        step_duration = ramp_duration_seconds // 10
        
        for users in range(step_users, max_users + 1, step_users):
            print(f"\n=== Testing with {users} users ===")
            report = self.run_concurrent_test(users, step_duration)
            reports.append(report)
            
            # Print intermediate results
            print(f"RPS: {report.requests_per_second:.1f}, "
                  f"p95: {report.p95_response_time_ms:.1f}ms, "
                  f"Errors: {report.failed_requests}")
            
            # Stop if too many errors
            if report.failed_requests / max(report.total_requests, 1) > 0.1:
                print("Error rate too high, stopping ramp-up")
                break
        
        # Hold at last level
        if hold_duration_seconds > 0:
            print(f"\n=== Holding at {users} users for {hold_duration_seconds}s ===")
            report = self.run_concurrent_test(users, hold_duration_seconds)
            reports.append(report)
        
        return reports


# =============================================================================
# STRESS TEST
# =============================================================================

class StressTest:
    """Stress testing for edge cases."""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.client = LoadTestClient(base_url, api_key)
    
    def test_large_payload(self):
        """Test with large payload."""
        print("Testing large payload...")
        
        # 1MB of metadata
        large_metadata = {"data": "x" * (1024 * 1024)}
        
        result = self.client._make_request("POST", "/agents", {
            "agent_id": f"stress-large-{time.time()}",
            "metadata": large_metadata
        })
        
        print(f"  Status: {result.status_code}, Time: {result.response_time_ms:.1f}ms")
        return result
    
    def test_rapid_updates(self):
        """Test rapid sequential updates."""
        print("Testing rapid updates...")
        
        agent_id = f"stress-rapid-{time.time()}"
        self.client._make_request("POST", "/agents", {"agent_id": agent_id})
        
        start = time.time()
        count = 0
        
        while time.time() - start < 10:  # 10 seconds
            self.client._make_request("POST", f"/agents/{agent_id}/trust", {
                "event_type": "rapid_test",
                "delta": 0.001,
                "source": "stress"
            })
            count += 1
        
        print(f"  Completed {count} updates in 10s ({count/10:.1f}/s)")
        return count
    
    def test_concurrent_same_agent(self):
        """Test concurrent operations on same agent."""
        print("Testing concurrent same-agent operations...")
        
        agent_id = f"stress-concurrent-{time.time()}"
        self.client._make_request("POST", "/agents", {"agent_id": agent_id})
        
        results = []
        
        def update():
            return self.client._make_request("POST", f"/agents/{agent_id}/trust", {
                "event_type": "concurrent",
                "delta": 0.01,
                "source": "stress"
            })
        
        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(update) for _ in range(100)]
            for f in as_completed(futures):
                results.append(f.result())
        
        successful = sum(1 for r in results if r.success)
        print(f"  {successful}/100 successful")
        return results


# =============================================================================
# REPORT PRINTER
# =============================================================================

def print_report(report: LoadTestReport):
    """Print formatted test report."""
    print("\n" + "=" * 60)
    print("LOAD TEST REPORT")
    print("=" * 60)
    print(f"Duration:         {report.duration_seconds:.1f}s")
    print(f"Total Requests:   {report.total_requests}")
    print(f"Successful:       {report.successful_requests}")
    print(f"Failed:           {report.failed_requests}")
    print(f"Requests/sec:     {report.requests_per_second:.1f}")
    print()
    print("Response Times:")
    print(f"  Average:        {report.avg_response_time_ms:.1f}ms")
    print(f"  Min:            {report.min_response_time_ms:.1f}ms")
    print(f"  Max:            {report.max_response_time_ms:.1f}ms")
    print(f"  p50:            {report.p50_response_time_ms:.1f}ms")
    print(f"  p95:            {report.p95_response_time_ms:.1f}ms")
    print(f"  p99:            {report.p99_response_time_ms:.1f}ms")
    
    if report.errors:
        print()
        print("Errors:")
        for error, count in report.errors.items():
            print(f"  {error}: {count}")
    
    print("=" * 60)


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Run load tests."""
    import argparse
    
    parser = argparse.ArgumentParser(description="ATSF Load Test Suite")
    parser.add_argument("--url", default=API_URL, help="API URL")
    parser.add_argument("--key", default=API_KEY, help="API key")
    parser.add_argument("--users", type=int, default=10, help="Concurrent users")
    parser.add_argument("--duration", type=int, default=30, help="Duration in seconds")
    parser.add_argument("--stress", action="store_true", help="Run stress tests")
    parser.add_argument("--ramp", action="store_true", help="Run ramp-up test")
    
    args = parser.parse_args()
    
    runner = LoadTestRunner(args.url, args.key)
    
    if args.stress:
        print("Running stress tests...")
        stress = StressTest(args.url, args.key)
        stress.test_large_payload()
        stress.test_rapid_updates()
        stress.test_concurrent_same_agent()
    
    elif args.ramp:
        print("Running ramp-up test...")
        reports = runner.run_ramp_up_test(args.users, args.duration, 30)
        for i, report in enumerate(reports):
            print(f"\n--- Stage {i+1} ---")
            print_report(report)
    
    else:
        print("Running standard load test...")
        report = runner.run_concurrent_test(args.users, args.duration)
        print_report(report)


if __name__ == "__main__":
    main()
