"""
ATSF v3.0 - Load & Stress Tests
================================

Comprehensive load testing suite for ATSF API.

Tools:
- locust for load testing
- pytest for integration tests
- asyncio for concurrent testing

Usage:
    # Run Locust
    locust -f tests/load_tests.py --host http://localhost:8000
    
    # Run stress tests
    pytest tests/load_tests.py -v

Author: ATSF Development Team
Version: 3.0.0
"""

import asyncio
import aiohttp
import time
import statistics
import random
import string
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor
import json

# Try to import locust (optional)
try:
    from locust import HttpUser, task, between, events
    LOCUST_AVAILABLE = True
except ImportError:
    LOCUST_AVAILABLE = False


# =============================================================================
# CONFIGURATION
# =============================================================================

DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_API_KEY = "demo-key-12345"

LOAD_TEST_CONFIG = {
    "concurrent_users": 100,
    "requests_per_user": 100,
    "ramp_up_time": 30,
    "test_duration": 300,
    "think_time_min": 0.5,
    "think_time_max": 2.0,
}

STRESS_TEST_CONFIG = {
    "max_concurrent": 500,
    "burst_size": 100,
    "burst_interval": 5,
    "duration": 60,
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class RequestResult:
    """Single request result."""
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    success: bool
    error: str = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class LoadTestResult:
    """Aggregated load test results."""
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    p50_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    requests_per_second: float
    error_rate: float
    duration_seconds: float
    errors_by_type: Dict[str, int]


# =============================================================================
# ASYNC HTTP CLIENT
# =============================================================================

class AsyncATSFClient:
    """Async HTTP client for load testing."""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={
                "X-API-Key": self.api_key,
                "Content-Type": "application/json"
            }
        )
        return self
        
    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()
            
    async def request(self, method: str, path: str, data: Dict = None) -> RequestResult:
        """Make an async request and track timing."""
        url = f"{self.base_url}{path}"
        start = time.perf_counter()
        
        try:
            async with self.session.request(method, url, json=data) as response:
                elapsed = (time.perf_counter() - start) * 1000
                await response.text()  # Consume response
                
                return RequestResult(
                    endpoint=path,
                    method=method,
                    status_code=response.status,
                    response_time_ms=elapsed,
                    success=200 <= response.status < 300
                )
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            return RequestResult(
                endpoint=path,
                method=method,
                status_code=0,
                response_time_ms=elapsed,
                success=False,
                error=str(e)
            )


# =============================================================================
# LOAD TEST SCENARIOS
# =============================================================================

def random_agent_id() -> str:
    """Generate random agent ID."""
    return f"agent_{''.join(random.choices(string.ascii_lowercase, k=8))}"


async def scenario_create_agent(client: AsyncATSFClient) -> RequestResult:
    """Scenario: Create a new agent."""
    return await client.request("POST", "/agents", {
        "agent_id": random_agent_id(),
        "transparency_tier": random.choice(["black_box", "gray_box", "white_box"]),
        "capabilities": ["file_system", "network"]
    })


async def scenario_get_agent(client: AsyncATSFClient, agent_id: str) -> RequestResult:
    """Scenario: Get agent details."""
    return await client.request("GET", f"/agents/{agent_id}")


async def scenario_update_trust(client: AsyncATSFClient, agent_id: str) -> RequestResult:
    """Scenario: Update trust score."""
    return await client.request("POST", f"/agents/{agent_id}/trust", {
        "event_type": "task_success",
        "delta": random.uniform(-0.1, 0.1),
        "source": "load_test"
    })


async def scenario_process_action(client: AsyncATSFClient, agent_id: str) -> RequestResult:
    """Scenario: Process an action."""
    return await client.request("POST", f"/agents/{agent_id}/actions", {
        "action_type": random.choice(["read", "write", "execute"]),
        "description": "Load test action",
        "target": "/test/path",
        "impact": random.choice(["low", "medium", "high"]),
        "reversible": random.choice([True, False])
    })


async def scenario_get_assessment(client: AsyncATSFClient, agent_id: str) -> RequestResult:
    """Scenario: Get threat assessment."""
    return await client.request("GET", f"/agents/{agent_id}/assessment")


async def scenario_health_check(client: AsyncATSFClient) -> RequestResult:
    """Scenario: Health check."""
    return await client.request("GET", "/health")


async def scenario_get_stats(client: AsyncATSFClient) -> RequestResult:
    """Scenario: Get statistics."""
    return await client.request("GET", "/stats")


# =============================================================================
# LOAD TEST RUNNER
# =============================================================================

class LoadTestRunner:
    """Run load tests against ATSF API."""
    
    def __init__(
        self,
        base_url: str = DEFAULT_API_URL,
        api_key: str = DEFAULT_API_KEY
    ):
        self.base_url = base_url
        self.api_key = api_key
        self.results: List[RequestResult] = []
        
    async def run_user_session(self, user_id: int, num_requests: int):
        """Simulate a single user session."""
        async with AsyncATSFClient(self.base_url, self.api_key) as client:
            # Create agent for this user
            agent_id = f"loadtest_user{user_id}_{random_agent_id()}"
            
            create_result = await client.request("POST", "/agents", {
                "agent_id": agent_id,
                "transparency_tier": "gray_box"
            })
            self.results.append(create_result)
            
            if not create_result.success:
                return
                
            # Activate agent
            activate_result = await client.request("POST", f"/agents/{agent_id}/activate")
            self.results.append(activate_result)
            
            # Run random operations
            for _ in range(num_requests):
                scenario = random.choice([
                    lambda: scenario_update_trust(client, agent_id),
                    lambda: scenario_process_action(client, agent_id),
                    lambda: scenario_get_assessment(client, agent_id),
                    lambda: scenario_get_agent(client, agent_id),
                    lambda: scenario_health_check(client),
                ])
                
                result = await scenario()
                self.results.append(result)
                
                # Think time
                await asyncio.sleep(random.uniform(
                    LOAD_TEST_CONFIG["think_time_min"],
                    LOAD_TEST_CONFIG["think_time_max"]
                ))
                
    async def run_load_test(
        self,
        num_users: int = 10,
        requests_per_user: int = 50
    ) -> LoadTestResult:
        """Run load test with multiple concurrent users."""
        print(f"\n🚀 Starting load test: {num_users} users, {requests_per_user} requests each")
        
        self.results = []
        start_time = time.perf_counter()
        
        # Create tasks for all users
        tasks = [
            self.run_user_session(i, requests_per_user)
            for i in range(num_users)
        ]
        
        # Run all user sessions concurrently
        await asyncio.gather(*tasks, return_exceptions=True)
        
        duration = time.perf_counter() - start_time
        
        return self._calculate_results(duration)
        
    async def run_stress_test(
        self,
        max_concurrent: int = 100,
        duration_seconds: int = 60
    ) -> LoadTestResult:
        """Run stress test with increasing load."""
        print(f"\n💥 Starting stress test: max {max_concurrent} concurrent, {duration_seconds}s duration")
        
        self.results = []
        start_time = time.perf_counter()
        end_time = start_time + duration_seconds
        
        async with AsyncATSFClient(self.base_url, self.api_key) as client:
            active_tasks = set()
            request_count = 0
            
            while time.perf_counter() < end_time:
                # Clean up completed tasks
                done = {t for t in active_tasks if t.done()}
                active_tasks -= done
                
                # Add new requests if under limit
                while len(active_tasks) < max_concurrent:
                    task = asyncio.create_task(scenario_health_check(client))
                    active_tasks.add(task)
                    request_count += 1
                    
                # Small delay to prevent tight loop
                await asyncio.sleep(0.01)
                
            # Wait for remaining tasks
            if active_tasks:
                done_results = await asyncio.gather(*active_tasks, return_exceptions=True)
                for result in done_results:
                    if isinstance(result, RequestResult):
                        self.results.append(result)
                        
        duration = time.perf_counter() - start_time
        return self._calculate_results(duration)
        
    async def run_burst_test(
        self,
        burst_size: int = 100,
        num_bursts: int = 5,
        interval_seconds: int = 5
    ) -> LoadTestResult:
        """Run burst test with sudden spikes."""
        print(f"\n⚡ Starting burst test: {num_bursts} bursts of {burst_size} requests")
        
        self.results = []
        start_time = time.perf_counter()
        
        async with AsyncATSFClient(self.base_url, self.api_key) as client:
            for burst in range(num_bursts):
                print(f"  Burst {burst + 1}/{num_bursts}...")
                
                # Create all requests in burst
                tasks = [scenario_health_check(client) for _ in range(burst_size)]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, RequestResult):
                        self.results.append(result)
                        
                # Wait between bursts
                if burst < num_bursts - 1:
                    await asyncio.sleep(interval_seconds)
                    
        duration = time.perf_counter() - start_time
        return self._calculate_results(duration)
        
    def _calculate_results(self, duration: float) -> LoadTestResult:
        """Calculate aggregated results."""
        if not self.results:
            return LoadTestResult(
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                avg_response_time_ms=0,
                min_response_time_ms=0,
                max_response_time_ms=0,
                p50_response_time_ms=0,
                p95_response_time_ms=0,
                p99_response_time_ms=0,
                requests_per_second=0,
                error_rate=0,
                duration_seconds=duration,
                errors_by_type={}
            )
            
        successful = [r for r in self.results if r.success]
        failed = [r for r in self.results if not r.success]
        
        response_times = [r.response_time_ms for r in self.results]
        sorted_times = sorted(response_times)
        
        errors_by_type = {}
        for r in failed:
            error = r.error or f"HTTP {r.status_code}"
            errors_by_type[error] = errors_by_type.get(error, 0) + 1
            
        return LoadTestResult(
            total_requests=len(self.results),
            successful_requests=len(successful),
            failed_requests=len(failed),
            avg_response_time_ms=statistics.mean(response_times),
            min_response_time_ms=min(response_times),
            max_response_time_ms=max(response_times),
            p50_response_time_ms=sorted_times[len(sorted_times) // 2],
            p95_response_time_ms=sorted_times[int(len(sorted_times) * 0.95)],
            p99_response_time_ms=sorted_times[int(len(sorted_times) * 0.99)],
            requests_per_second=len(self.results) / duration,
            error_rate=len(failed) / len(self.results) * 100,
            duration_seconds=duration,
            errors_by_type=errors_by_type
        )


# =============================================================================
# LOCUST USER (for locust load testing)
# =============================================================================

if LOCUST_AVAILABLE:
    class ATSFUser(HttpUser):
        """Locust user for load testing."""
        
        wait_time = between(0.5, 2)
        
        def on_start(self):
            """Setup user session."""
            self.agent_id = f"locust_{random_agent_id()}"
            self.client.headers["X-API-Key"] = DEFAULT_API_KEY
            
            # Create and activate agent
            self.client.post("/agents", json={
                "agent_id": self.agent_id,
                "transparency_tier": "gray_box"
            })
            self.client.post(f"/agents/{self.agent_id}/activate")
            
        @task(3)
        def get_agent(self):
            """Get agent details."""
            self.client.get(f"/agents/{self.agent_id}")
            
        @task(5)
        def update_trust(self):
            """Update trust score."""
            self.client.post(f"/agents/{self.agent_id}/trust", json={
                "event_type": "task_success",
                "delta": random.uniform(-0.05, 0.1),
                "source": "locust"
            })
            
        @task(4)
        def process_action(self):
            """Process an action."""
            self.client.post(f"/agents/{self.agent_id}/actions", json={
                "action_type": "execute",
                "description": "Locust test action",
                "target": "/test",
                "impact": "low"
            })
            
        @task(2)
        def get_assessment(self):
            """Get assessment."""
            self.client.get(f"/agents/{self.agent_id}/assessment")
            
        @task(1)
        def health_check(self):
            """Health check."""
            self.client.get("/health")


# =============================================================================
# CLI & MAIN
# =============================================================================

def print_results(result: LoadTestResult):
    """Print load test results."""
    print("\n" + "=" * 60)
    print("LOAD TEST RESULTS")
    print("=" * 60)
    print(f"Duration:           {result.duration_seconds:.2f}s")
    print(f"Total Requests:     {result.total_requests}")
    print(f"Successful:         {result.successful_requests}")
    print(f"Failed:             {result.failed_requests}")
    print(f"Error Rate:         {result.error_rate:.2f}%")
    print(f"RPS:                {result.requests_per_second:.2f}")
    print("-" * 60)
    print("Response Times (ms):")
    print(f"  Average:          {result.avg_response_time_ms:.2f}")
    print(f"  Min:              {result.min_response_time_ms:.2f}")
    print(f"  Max:              {result.max_response_time_ms:.2f}")
    print(f"  P50:              {result.p50_response_time_ms:.2f}")
    print(f"  P95:              {result.p95_response_time_ms:.2f}")
    print(f"  P99:              {result.p99_response_time_ms:.2f}")
    
    if result.errors_by_type:
        print("-" * 60)
        print("Errors:")
        for error, count in result.errors_by_type.items():
            print(f"  {error}: {count}")
    print("=" * 60)


async def main():
    """Run all load tests."""
    runner = LoadTestRunner()
    
    # Load test
    print("\n" + "=" * 60)
    print("LOAD TEST")
    print("=" * 60)
    result = await runner.run_load_test(num_users=10, requests_per_user=20)
    print_results(result)
    
    # Stress test
    print("\n" + "=" * 60)
    print("STRESS TEST")
    print("=" * 60)
    result = await runner.run_stress_test(max_concurrent=50, duration_seconds=30)
    print_results(result)
    
    # Burst test
    print("\n" + "=" * 60)
    print("BURST TEST")
    print("=" * 60)
    result = await runner.run_burst_test(burst_size=50, num_bursts=3, interval_seconds=2)
    print_results(result)


if __name__ == "__main__":
    asyncio.run(main())
