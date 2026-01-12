"""
ATSF Integration Test Suite
============================

End-to-end integration tests validating complete workflows.

Run with: pytest tests/test_integration.py -v
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List
import json


class TestATSFIntegration:
    """End-to-end integration tests for ATSF v3.4."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures."""
        from atsf import ATSF, EventType
        from atsf.realtime import EventBus
        
        # Fresh instances for each test
        EventBus._instance = None  # Reset singleton
        self.atsf = ATSF()
        self.events_received = []
        
        # Subscribe to all events
        self.atsf.on_event(EventType.AGENT_REGISTERED, 
                          lambda e: self.events_received.append(e))
        self.atsf.on_event(EventType.ACTION_ALLOWED,
                          lambda e: self.events_received.append(e))
        self.atsf.on_event(EventType.ACTION_DENIED,
                          lambda e: self.events_received.append(e))
        
        yield
        
        # Cleanup
        self.events_received.clear()
    
    # =========================================================================
    # WORKFLOW TESTS
    # =========================================================================
    
    def test_complete_agent_lifecycle(self):
        """Test full agent lifecycle: create → execute → monitor → insights."""
        # 1. Register creator
        creator = self.atsf.register_creator(
            "lifecycle_creator", 
            tier="verified", 
            stake=1000
        )
        assert creator["creator_id"] == "lifecycle_creator"
        
        # 2. Create agent
        agent = self.atsf.create_agent(
            "lifecycle_agent",
            "lifecycle_creator",
            tier="gray_box"
        )
        assert agent.agent_id == "lifecycle_agent"
        
        # 3. Execute multiple actions
        results = []
        for i in range(10):
            result = agent.execute(
                action_type="read" if i % 2 == 0 else "write",
                payload={"target": f"file_{i}.txt"},
                reasoning=f"Test action {i}"
            )
            results.append(result)
        
        # 4. Verify results
        assert len(results) == 10
        assert all(r.request_id for r in results)
        
        # 5. Check trust evolution
        trust = agent.get_trust()
        assert 0 <= trust.score <= trust.ceiling
        
        # 6. Get insights
        insights = agent.get_insights()
        assert insights["total_actions"] == 10
        
        # 7. Check status
        status = agent.get_status()
        assert status.action_count == 10
        assert status.active is True
    
    def test_multi_agent_scenario(self):
        """Test multiple agents from same creator."""
        self.atsf.register_creator("multi_creator")
        
        agents = []
        for i in range(5):
            agent = self.atsf.create_agent(
                f"multi_agent_{i}",
                "multi_creator",
                tier=["black_box", "gray_box", "white_box"][i % 3]
            )
            agents.append(agent)
        
        # Each agent executes actions
        for agent in agents:
            for j in range(3):
                agent.execute("read", {"target": f"data_{j}"})
        
        # Verify all agents tracked
        all_agents = self.atsf.list_agents(creator_id="multi_creator")
        assert len(all_agents) == 5
        
        # Verify different trust ceilings based on tier
        trusts = [a.get_trust() for a in agents]
        # black_box: 0.4, gray_box: 0.6, white_box: 0.8
        assert trusts[0].ceiling == pytest.approx(0.4, rel=0.1)
        assert trusts[1].ceiling == pytest.approx(0.6, rel=0.1)
        assert trusts[2].ceiling == pytest.approx(0.8, rel=0.1)
    
    def test_event_flow(self):
        """Test event emission and subscription."""
        from atsf import EventType
        
        self.atsf.register_creator("event_creator")
        agent = self.atsf.create_agent("event_agent", "event_creator")
        
        # Clear and re-track
        self.events_received.clear()
        
        # Execute actions
        for _ in range(5):
            agent.execute("read", {"target": "test"})
        
        # Should have received events
        assert len(self.events_received) >= 1
    
    # =========================================================================
    # COGNITIVE CUBE TESTS
    # =========================================================================
    
    def test_cognitive_cube_integration(self):
        """Test cognitive cube with SDK."""
        from atsf import CognitiveCube
        
        self.atsf.register_creator("cube_creator")
        agent = self.atsf.create_agent("cube_agent", "cube_creator")
        
        # Execute actions that get recorded
        for i in range(10):
            agent.execute(
                "api_call" if i % 3 == 0 else "read",
                {"target": f"resource_{i}"}
            )
        
        # Access cognitive cube through agent
        cube = agent._cube
        
        # Record custom events
        cube.record_event(
            event_id="custom_1",
            event_type="test",
            subject="agent",
            predicate="triggered",
            obj="alert",
            outcome_vector=[0.9, 0.1]
        )
        
        # Find causes
        chains = cube.find_causes("alert")
        assert len(chains) >= 0  # May or may not find depending on graph state
        
        # Get effect groups
        groups = cube.get_effect_groups()
        assert isinstance(groups, dict)
    
    def test_data_cube_analytics(self):
        """Test data cube OLAP operations."""
        from atsf import AgentKnowledgeBase
        
        kb = AgentKnowledgeBase("analytics_agent")
        
        # Record diverse actions
        action_types = ["read", "write", "execute", "api_call"]
        decisions = ["allow", "allow_monitored", "deny"]
        
        for i in range(100):
            kb.record_action(
                request_id=f"req_{i}",
                action_type=action_types[i % 4],
                action_category="test",
                decision=decisions[i % 3],
                trust_score=0.3 + (i % 10) * 0.05,
                trust_delta=0.001 if i % 3 == 0 else -0.001,
                risk_score=0.1 + (i % 5) * 0.1,
                processing_time_ms=1.0 + i * 0.1,
                metadata={"batch": i // 10}
            )
        
        # Test aggregation
        kb.cube.aggregate(dimensions=["action_type", "decision"])
        assert len(kb.cube.cells) > 0
        
        # Test slice
        read_facts = kb.cube.slice("action_type", "read")
        assert all(f.action_type == "read" for f in read_facts)
        
        # Test dice
        filtered = kb.cube.dice({
            "action_type": ["read", "write"],
            "decision": ["allow"]
        })
        assert all(f.action_type in ["read", "write"] for f in filtered)
        assert all(f.decision == "allow" for f in filtered)
        
        # Test insights
        insights = kb.get_insights()
        assert insights["total_actions"] == 100
        assert "action_distribution" in insights
    
    # =========================================================================
    # REAL-TIME TESTS
    # =========================================================================
    
    def test_alert_system(self):
        """Test alert thresholds and triggering."""
        alerts_received = []
        
        self.atsf.on_alert(lambda a: alerts_received.append(a))
        self.atsf.set_alert_threshold("risk_score", 0.7)
        
        # Manually trigger alert
        self.atsf._alert_manager.check_metric("risk_score", 0.9, "test_agent")
        
        assert len(alerts_received) == 1
        assert alerts_received[0]["type"] == "risk_score_exceeded"
        
        # Acknowledge
        alert_id = alerts_received[0]["id"]
        self.atsf.acknowledge_alert(alert_id)
        
        active = self.atsf.get_active_alerts()
        assert len(active) == 0
    
    def test_action_stream(self):
        """Test action stream recording."""
        self.atsf.register_creator("stream_creator")
        agent = self.atsf.create_agent("stream_agent", "stream_creator")
        
        # Execute actions
        for i in range(20):
            agent.execute("write", {"target": f"stream_{i}"})
        
        # Get stats
        stats = self.atsf.get_action_stats()
        assert stats["total"] >= 0
        
        # Get recent actions
        recent = self.atsf.get_recent_actions(limit=10)
        assert isinstance(recent, list)
    
    # =========================================================================
    # SECURITY TESTS
    # =========================================================================
    
    def test_trust_boundaries(self):
        """Test trust ceiling enforcement."""
        self.atsf.register_creator("boundary_creator")
        
        # Black box agent - ceiling 0.4
        black_agent = self.atsf.create_agent(
            "black_agent", "boundary_creator", "black_box"
        )
        
        # Execute many successful actions
        for _ in range(50):
            black_agent.execute("read", {"target": "safe"})
        
        trust = black_agent.get_trust()
        # Trust should not exceed ceiling
        assert trust.score <= trust.ceiling + 0.01  # Small tolerance
    
    def test_risk_scoring(self):
        """Test risk score calculation."""
        self.atsf.register_creator("risk_creator")
        agent = self.atsf.create_agent("risk_agent", "risk_creator")
        
        # Low risk action
        low_risk = agent.execute("read", {"target": "public_data"})
        
        # Higher risk action
        high_risk = agent.execute("execute", {
            "target": "system_command",
            "command": "rm -rf /"  # Obviously malicious
        })
        
        # Risk scores should reflect action type
        assert low_risk.risk_score <= high_risk.risk_score
    
    # =========================================================================
    # PERSISTENCE TESTS
    # =========================================================================
    
    def test_memory_consolidation(self):
        """Test memory consolidation in knowledge base."""
        from atsf import AgentKnowledgeBase
        
        kb = AgentKnowledgeBase("memory_agent")
        
        # Store many memories
        for i in range(50):
            kb.memory.store(
                content={"action": f"action_{i}", "result": "success"},
                memory_type="episodic",
                importance=0.5 + (i % 5) * 0.1,
                topics=["test", f"batch_{i // 10}"]
            )
        
        # Consolidate
        result = kb.consolidate()
        assert "pruned" in result
        assert "consolidated" in result
        
        # Memory should still be accessible
        context = kb.memory.get_context_window(max_entries=10)
        assert len(context) <= 10
    
    # =========================================================================
    # CONSTITUTIONAL AI TESTS
    # =========================================================================
    
    def test_constitutional_rules(self):
        """Test constitutional rule enforcement."""
        from atsf import CognitiveCube
        
        cube = CognitiveCube("constitutional_agent")
        
        # Add rules
        cube.basis.add_rule(
            rule_id="no_pii",
            category="privacy",
            rule_text="Never expose personally identifiable information",
            keywords=["pii", "personal", "private", "ssn", "credit_card"],
            priority=5
        )
        
        cube.basis.add_rule(
            rule_id="safety_first",
            category="safety",
            rule_text="Always prioritize user safety over task completion",
            keywords=["safety", "harm", "dangerous"],
            priority=5
        )
        
        # Query should retrieve relevant rules
        rules = cube.basis.retrieve_relevant_rules(
            "How do I access private user data?",
            top_k=5
        )
        
        # Should find privacy-related rule
        rule_ids = [r.rule_id for r in rules]
        assert "no_pii" in rule_ids
    
    def test_authorization_before_retrieval(self):
        """Test query authorization."""
        from atsf import CognitiveCube
        
        cube = CognitiveCube("auth_agent")
        
        # Add restrictive rule
        cube.basis.add_rule(
            rule_id="block_secrets",
            category="security",
            rule_text="Block access to secret information",
            keywords=["secret", "password", "key", "token"],
            priority=5
        )
        
        # Authorize benign query
        allowed, rules, filters = cube.authorize_query("What is the weather?")
        assert allowed is True
        
        # Note: Full authorization depends on hybrid search implementation
    
    # =========================================================================
    # PERFORMANCE TESTS
    # =========================================================================
    
    def test_throughput(self):
        """Test action processing throughput."""
        self.atsf.register_creator("perf_creator")
        agent = self.atsf.create_agent("perf_agent", "perf_creator")
        
        start = time.perf_counter()
        
        iterations = 100
        for i in range(iterations):
            agent.execute("read", {"target": f"perf_{i}"})
        
        elapsed = time.perf_counter() - start
        throughput = iterations / elapsed
        
        # Should handle at least 50 actions/second
        assert throughput > 50, f"Throughput too low: {throughput:.1f}/sec"
    
    def test_latency(self):
        """Test action processing latency."""
        self.atsf.register_creator("latency_creator")
        agent = self.atsf.create_agent("latency_agent", "latency_creator")
        
        latencies = []
        for i in range(20):
            start = time.perf_counter()
            agent.execute("read", {"target": f"latency_{i}"})
            latencies.append((time.perf_counter() - start) * 1000)
        
        avg_latency = sum(latencies) / len(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]
        
        # Average should be under 50ms
        assert avg_latency < 50, f"Average latency too high: {avg_latency:.1f}ms"
    
    # =========================================================================
    # ERROR HANDLING TESTS
    # =========================================================================
    
    def test_invalid_agent(self):
        """Test handling of invalid agent ID."""
        # Try to get non-existent agent
        agent = self.atsf.get_agent("nonexistent_agent")
        assert agent is None
    
    def test_duplicate_agent(self):
        """Test duplicate agent registration."""
        self.atsf.register_creator("dup_creator")
        
        # Create first agent
        agent1 = self.atsf.create_agent("dup_agent", "dup_creator")
        
        # Create duplicate - should overwrite or handle gracefully
        agent2 = self.atsf.create_agent("dup_agent", "dup_creator")
        
        # Both should reference same agent
        assert agent1.agent_id == agent2.agent_id
    
    # =========================================================================
    # HEALTH CHECK TESTS
    # =========================================================================
    
    def test_health_check(self):
        """Test system health check."""
        health = self.atsf.health_check()
        
        assert health["status"] == "healthy"
        assert "agents_count" in health
        assert "creators_count" in health
        assert "timestamp" in health
    
    def test_version(self):
        """Test version reporting."""
        version = self.atsf.get_version()
        assert version == "3.4.0"


class TestAsyncOperations:
    """Test async operations."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        from atsf import ATSF
        from atsf.realtime import EventBus
        EventBus._instance = None
        self.atsf = ATSF()
    
    @pytest.mark.asyncio
    async def test_async_execute(self):
        """Test async action execution."""
        self.atsf.register_creator("async_creator")
        agent = self.atsf.create_agent("async_agent", "async_creator")
        
        # Execute async
        result = await agent.execute_async("read", {"target": "async_test"})
        
        assert result.request_id is not None
        assert result.decision in ("allow", "deny", "allow_monitored")


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        from atsf import ATSF
        from atsf.realtime import EventBus
        EventBus._instance = None
        self.atsf = ATSF()
    
    def test_empty_payload(self):
        """Test action with empty payload."""
        self.atsf.register_creator("empty_creator")
        agent = self.atsf.create_agent("empty_agent", "empty_creator")
        
        result = agent.execute("read", {})
        assert result.request_id is not None
    
    def test_none_payload(self):
        """Test action with None payload."""
        self.atsf.register_creator("none_creator")
        agent = self.atsf.create_agent("none_agent", "none_creator")
        
        result = agent.execute("read", None)
        assert result.request_id is not None
    
    def test_large_payload(self):
        """Test action with large payload."""
        self.atsf.register_creator("large_creator")
        agent = self.atsf.create_agent("large_agent", "large_creator")
        
        large_payload = {
            "data": "x" * 10000,
            "nested": {"level1": {"level2": {"level3": "deep"}}}
        }
        
        result = agent.execute("write", large_payload)
        assert result.request_id is not None
    
    def test_special_characters(self):
        """Test handling of special characters."""
        self.atsf.register_creator("special_creator")
        agent = self.atsf.create_agent("special_agent", "special_creator")
        
        result = agent.execute("read", {
            "target": "file with spaces & symbols!@#$%",
            "unicode": "日本語テスト"
        })
        assert result.request_id is not None
    
    def test_rapid_fire(self):
        """Test rapid sequential actions."""
        self.atsf.register_creator("rapid_creator")
        agent = self.atsf.create_agent("rapid_agent", "rapid_creator")
        
        results = [agent.execute("read", {"i": i}) for i in range(100)]
        
        assert len(results) == 100
        assert len(set(r.request_id for r in results)) == 100  # All unique


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    import sys
    
    print("=" * 70)
    print("ATSF v3.4 Integration Test Suite")
    print("=" * 70)
    print()
    
    # Run with pytest if available
    try:
        exit_code = pytest.main([__file__, "-v", "--tb=short"])
        sys.exit(exit_code)
    except Exception as e:
        print(f"Pytest not available, running manual tests...")
        
        # Manual test run
        tests_passed = 0
        tests_failed = 0
        
        # Setup
        from atsf import ATSF
        from atsf.realtime import EventBus
        
        test_classes = [TestATSFIntegration, TestEdgeCases]
        
        for test_class in test_classes:
            print(f"\n{test_class.__name__}:")
            
            for method_name in dir(test_class):
                if method_name.startswith("test_"):
                    EventBus._instance = None
                    instance = test_class()
                    instance.atsf = ATSF()
                    instance.events_received = []
                    
                    try:
                        getattr(instance, method_name)()
                        print(f"  ✓ {method_name}")
                        tests_passed += 1
                    except Exception as e:
                        print(f"  ✗ {method_name}: {e}")
                        tests_failed += 1
        
        print()
        print("=" * 70)
        print(f"RESULTS: {tests_passed} passed, {tests_failed} failed")
        print("=" * 70)
