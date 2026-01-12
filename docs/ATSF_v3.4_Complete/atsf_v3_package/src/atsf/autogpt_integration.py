"""
ATSF AutoGPT Integration
========================

Seamless integration with AutoGPT for trust-gated autonomous execution.

Features:
- AutoGPT plugin interface with ATSF trust scoring
- Command execution monitoring
- Memory persistence with ATSF cognitive cube
- Goal tracking with safety constraints

Usage:
    from atsf.autogpt_integration import ATSFAutoGPTPlugin
    
    # Create ATSF plugin for AutoGPT
    plugin = ATSFAutoGPTPlugin(agent_id="autogpt_agent")
    
    # Hook into AutoGPT command execution
    result = plugin.execute_command("write_file", {"path": "test.txt"})

Author: ATSF Development Team
Version: 3.4.0
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable, Tuple
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json

# ATSF imports
from .atsf_v33_fixes import ATSFv33System, ActionRequest, TransparencyTier
from .cognitive_cube import CognitiveCube
from .data_cube import AgentKnowledgeBase
from .realtime import EventBus, EventType, ATSFEvent

logger = logging.getLogger("atsf.autogpt")


# =============================================================================
# COMMAND RISK CLASSIFICATION
# =============================================================================

class CommandRisk(str, Enum):
    """Risk levels for AutoGPT commands."""
    LOW = "low"           # Read-only, informational
    MEDIUM = "medium"     # Write operations, API calls
    HIGH = "high"         # System operations, code execution
    CRITICAL = "critical" # Destructive, irreversible


# Default risk mappings for common AutoGPT commands
COMMAND_RISK_MAP = {
    # Low risk - read only
    "read_file": CommandRisk.LOW,
    "list_files": CommandRisk.LOW,
    "search": CommandRisk.LOW,
    "web_search": CommandRisk.LOW,
    "browse_website": CommandRisk.LOW,
    "get_text_summary": CommandRisk.LOW,
    "memory_list": CommandRisk.LOW,
    "goals": CommandRisk.LOW,
    
    # Medium risk - writes and API calls
    "write_file": CommandRisk.MEDIUM,
    "append_file": CommandRisk.MEDIUM,
    "memory_add": CommandRisk.MEDIUM,
    "send_tweet": CommandRisk.MEDIUM,
    "send_email": CommandRisk.MEDIUM,
    "google_search": CommandRisk.MEDIUM,
    "image_gen": CommandRisk.MEDIUM,
    
    # High risk - code and system
    "execute_python_code": CommandRisk.HIGH,
    "execute_python_file": CommandRisk.HIGH,
    "execute_shell": CommandRisk.HIGH,
    "run_code": CommandRisk.HIGH,
    "start_agent": CommandRisk.HIGH,
    "message_agent": CommandRisk.HIGH,
    
    # Critical - destructive
    "delete_file": CommandRisk.CRITICAL,
    "delete_agent": CommandRisk.CRITICAL,
    "shutdown": CommandRisk.CRITICAL,
}


# =============================================================================
# AUTOGPT PLUGIN
# =============================================================================

@dataclass
class CommandResult:
    """Result of an AutoGPT command execution."""
    command: str
    success: bool
    output: Any
    trust_score: float
    risk_level: str
    decision: str
    blocked: bool = False
    reason: str = ""
    execution_time_ms: float = 0.0


class ATSFAutoGPTPlugin:
    """
    ATSF plugin for AutoGPT trust-gated command execution.
    
    This plugin integrates with AutoGPT to:
    - Score trust for each command before execution
    - Block high-risk commands when trust is low
    - Track command history in cognitive cube
    - Provide safety constraints for autonomous operation
    
    Usage:
        plugin = ATSFAutoGPTPlugin(
            agent_id="autogpt_main",
            creator_id="my_company",
            min_trust_for_execution=0.3
        )
        
        # Check if command is allowed
        allowed, reason = plugin.can_execute("execute_shell", {"command": "ls"})
        
        # Execute with trust tracking
        result = plugin.execute_command("write_file", {"path": "out.txt", "content": "hello"})
    """
    
    def __init__(
        self,
        agent_id: str,
        creator_id: str = "autogpt_default",
        tier: str = "gray_box",
        min_trust_for_execution: float = 0.3,
        min_trust_for_high_risk: float = 0.6,
        min_trust_for_critical: float = 0.8,
        block_critical_commands: bool = True,
        custom_risk_map: Optional[Dict[str, CommandRisk]] = None
    ):
        self.agent_id = agent_id
        self.creator_id = creator_id
        self.tier = tier
        self.min_trust_for_execution = min_trust_for_execution
        self.min_trust_for_high_risk = min_trust_for_high_risk
        self.min_trust_for_critical = min_trust_for_critical
        self.block_critical_commands = block_critical_commands
        
        # Merge risk maps
        self.risk_map = {**COMMAND_RISK_MAP}
        if custom_risk_map:
            self.risk_map.update(custom_risk_map)
        
        # Initialize ATSF components
        self._atsf = ATSFv33System()
        self._kb = AgentKnowledgeBase(agent_id)
        self._cube = CognitiveCube(agent_id)
        self._event_bus = EventBus()
        
        # Register agent
        tier_map = {
            "black_box": TransparencyTier.BLACK_BOX,
            "gray_box": TransparencyTier.GRAY_BOX,
            "white_box": TransparencyTier.WHITE_BOX,
        }
        tier_enum = tier_map.get(tier, TransparencyTier.GRAY_BOX)
        self._atsf.register_agent(agent_id, creator_id, tier_enum)
        
        # Statistics
        self._command_count = 0
        self._blocked_count = 0
        self._goals: List[str] = []
        
        logger.info(f"ATSFAutoGPTPlugin initialized: {agent_id}")
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        data = f"{self.agent_id}:{datetime.now().isoformat()}:{self._command_count}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _get_command_risk(self, command: str) -> CommandRisk:
        """Get risk level for a command."""
        return self.risk_map.get(command, CommandRisk.MEDIUM)
    
    def _check_trust(self, command: str, args: Dict) -> Dict:
        """Check trust for command execution."""
        risk = self._get_command_risk(command)
        
        request = ActionRequest(
            request_id=self._generate_request_id(),
            agent_id=self.agent_id,
            action_type=f"autogpt_{command}",
            payload={
                "command": command,
                "args": {k: str(v)[:100] for k, v in args.items()},
                "risk_level": risk.value
            },
            reasoning_trace=f"AutoGPT command: {command}"
        )
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(self._atsf.process_action(request))
    
    def get_trust(self) -> float:
        """Get current trust score."""
        agent_data = self._atsf.agents.get(self.agent_id)
        return agent_data.trust_score if agent_data else 0.0
    
    def can_execute(self, command: str, args: Optional[Dict] = None) -> Tuple[bool, str]:
        """
        Check if a command can be executed based on current trust.
        
        Returns:
            Tuple of (allowed: bool, reason: str)
        """
        args = args or {}
        risk = self._get_command_risk(command)
        trust = self.get_trust()
        
        # Check critical commands
        if risk == CommandRisk.CRITICAL:
            if self.block_critical_commands:
                return False, "Critical commands are blocked by policy"
            if trust < self.min_trust_for_critical:
                return False, f"Trust {trust:.3f} below critical threshold {self.min_trust_for_critical}"
        
        # Check high risk
        if risk == CommandRisk.HIGH:
            if trust < self.min_trust_for_high_risk:
                return False, f"Trust {trust:.3f} below high-risk threshold {self.min_trust_for_high_risk}"
        
        # Check minimum trust
        if trust < self.min_trust_for_execution:
            return False, f"Trust {trust:.3f} below minimum threshold {self.min_trust_for_execution}"
        
        return True, "Allowed"
    
    def execute_command(
        self,
        command: str,
        args: Optional[Dict] = None,
        executor: Optional[Callable] = None
    ) -> CommandResult:
        """
        Execute an AutoGPT command with ATSF trust checking.
        
        Args:
            command: Command name (e.g., "write_file", "execute_python_code")
            args: Command arguments
            executor: Optional function to actually execute the command
        
        Returns:
            CommandResult with execution details
        """
        args = args or {}
        self._command_count += 1
        start_time = datetime.now()
        
        risk = self._get_command_risk(command)
        
        # Check if allowed
        allowed, reason = self.can_execute(command, args)
        
        if not allowed:
            self._blocked_count += 1
            
            # Emit blocked event
            self._event_bus.publish(ATSFEvent(
                event_type=EventType.ACTION_DENIED,
                timestamp=datetime.now(),
                source="autogpt_plugin",
                agent_id=self.agent_id,
                data={"command": command, "reason": reason},
                severity="warning"
            ))
            
            return CommandResult(
                command=command,
                success=False,
                output=None,
                trust_score=self.get_trust(),
                risk_level=risk.value,
                decision="deny",
                blocked=True,
                reason=reason
            )
        
        # Check trust through ATSF
        result = self._check_trust(command, args)
        decision = result.get("decision", "deny")
        trust_score = result.get("trust_score", 0.0)
        
        # Record to knowledge base
        self._kb.record_action(
            request_id=result.get("request_id", self._generate_request_id()),
            action_type=f"autogpt_{command}",
            action_category=risk.value,
            decision=decision,
            trust_score=trust_score,
            trust_delta=result.get("trust_delta", 0.0),
            risk_score=result.get("risk_score", 0.0),
            processing_time_ms=result.get("processing_time_ms", 0.0),
            metadata={"command": command, "args_preview": str(args)[:100]}
        )
        
        # Record to TKG for causal tracking
        self._cube.record_event(
            event_id=f"cmd_{self._command_count}",
            event_type="command",
            subject=self.agent_id,
            predicate="executed",
            obj=command,
            outcome_vector=[trust_score, float(risk != CommandRisk.LOW)]
        )
        
        # Execute if allowed
        output = None
        success = False
        
        if decision != "deny":
            if executor:
                try:
                    output = executor(command, args)
                    success = True
                except Exception as e:
                    output = str(e)
                    success = False
            else:
                # Placeholder execution
                output = f"[SIMULATED] {command} executed with args: {args}"
                success = True
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Emit event
        self._event_bus.publish(ATSFEvent(
            event_type=EventType.ACTION_ALLOWED if decision != "deny" else EventType.ACTION_DENIED,
            timestamp=datetime.now(),
            source="autogpt_plugin",
            agent_id=self.agent_id,
            data={"command": command, "decision": decision, "risk": risk.value}
        ))
        
        return CommandResult(
            command=command,
            success=success,
            output=output,
            trust_score=trust_score,
            risk_level=risk.value,
            decision=decision,
            blocked=decision == "deny",
            reason="" if decision != "deny" else "; ".join(result.get("reasons", [])),
            execution_time_ms=execution_time
        )
    
    # =========================================================================
    # GOAL MANAGEMENT
    # =========================================================================
    
    def set_goals(self, goals: List[str]) -> None:
        """Set agent goals with safety validation."""
        self._goals = []
        
        for goal in goals:
            # Check for dangerous patterns
            dangerous_patterns = [
                "delete all", "destroy", "harm", "attack",
                "bypass security", "ignore safety", "override"
            ]
            
            is_safe = not any(p in goal.lower() for p in dangerous_patterns)
            
            if is_safe:
                self._goals.append(goal)
            else:
                logger.warning(f"Blocked unsafe goal: {goal}")
        
        logger.info(f"Goals set: {len(self._goals)} of {len(goals)} accepted")
    
    def get_goals(self) -> List[str]:
        """Get current goals."""
        return self._goals.copy()
    
    # =========================================================================
    # MEMORY INTEGRATION
    # =========================================================================
    
    def add_memory(self, content: str, importance: float = 0.5) -> bool:
        """Add to agent memory via ATSF knowledge base."""
        self._kb.memory.store(
            content={"text": content, "source": "autogpt"},
            memory_type="semantic",
            importance=importance,
            topics=["autogpt", "memory"]
        )
        return True
    
    def search_memory(self, query: str, limit: int = 5) -> List[Dict]:
        """Search agent memory."""
        return self._kb.memory.get_context_window(max_entries=limit)
    
    def consolidate_memory(self) -> Dict:
        """Consolidate and prune memory."""
        return self._kb.consolidate()
    
    # =========================================================================
    # STATISTICS
    # =========================================================================
    
    def get_stats(self) -> Dict:
        """Get plugin statistics."""
        return {
            "agent_id": self.agent_id,
            "trust_score": self.get_trust(),
            "command_count": self._command_count,
            "blocked_count": self._blocked_count,
            "block_rate": self._blocked_count / max(self._command_count, 1),
            "goals_count": len(self._goals),
            "insights": self._kb.get_insights()
        }
    
    def get_command_history(self, limit: int = 50) -> List[Dict]:
        """Get recent command history."""
        facts = self._kb.cube.facts[-limit:]
        return [
            {
                "timestamp": f.timestamp.isoformat(),
                "action_type": f.action_type,
                "decision": f.decision,
                "trust_score": f.trust_score,
                "risk_score": f.risk_score
            }
            for f in facts
        ]


# =============================================================================
# AUTOGPT HOOKS
# =============================================================================

class ATSFAutoGPTHooks:
    """
    Hook interface for integrating ATSF with AutoGPT's plugin system.
    
    Usage in AutoGPT:
        hooks = ATSFAutoGPTHooks(agent_id="my_autogpt")
        
        # Before command execution
        @hooks.pre_command
        def my_pre_hook(command, args):
            return hooks.check_command(command, args)
        
        # After command execution
        @hooks.post_command
        def my_post_hook(command, result):
            hooks.record_result(command, result)
    """
    
    def __init__(self, agent_id: str, **kwargs):
        self.plugin = ATSFAutoGPTPlugin(agent_id=agent_id, **kwargs)
        self._pre_hooks: List[Callable] = []
        self._post_hooks: List[Callable] = []
    
    def pre_command(self, func: Callable) -> Callable:
        """Decorator to register pre-command hook."""
        self._pre_hooks.append(func)
        return func
    
    def post_command(self, func: Callable) -> Callable:
        """Decorator to register post-command hook."""
        self._post_hooks.append(func)
        return func
    
    def check_command(self, command: str, args: Dict) -> Tuple[bool, str]:
        """Check if command is allowed."""
        return self.plugin.can_execute(command, args)
    
    def execute_command(self, command: str, args: Dict, executor: Callable) -> CommandResult:
        """Execute command with hooks."""
        # Run pre-hooks
        for hook in self._pre_hooks:
            try:
                hook(command, args)
            except Exception as e:
                logger.error(f"Pre-hook error: {e}")
        
        # Execute
        result = self.plugin.execute_command(command, args, executor)
        
        # Run post-hooks
        for hook in self._post_hooks:
            try:
                hook(command, result)
            except Exception as e:
                logger.error(f"Post-hook error: {e}")
        
        return result
    
    def record_result(self, command: str, success: bool) -> None:
        """Record command result for trust updates."""
        # Trust is automatically tracked in execute_command
        pass


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_autogpt_plugin(
    agent_id: str,
    creator_id: str = "autogpt_default",
    tier: str = "gray_box",
    **kwargs
) -> ATSFAutoGPTPlugin:
    """Create an ATSF plugin for AutoGPT."""
    return ATSFAutoGPTPlugin(
        agent_id=agent_id,
        creator_id=creator_id,
        tier=tier,
        **kwargs
    )


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF AutoGPT Integration Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Create plugin
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(
            agent_id="test_autogpt",
            creator_id="test_creator"
        )
        assert plugin.agent_id == "test_autogpt"
        print("  ✓ Plugin creation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Plugin creation failed: {e}")
    
    # Test 2: Command risk classification
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="risk_test")
        
        assert plugin._get_command_risk("read_file") == CommandRisk.LOW
        assert plugin._get_command_risk("write_file") == CommandRisk.MEDIUM
        assert plugin._get_command_risk("execute_shell") == CommandRisk.HIGH
        assert plugin._get_command_risk("delete_file") == CommandRisk.CRITICAL
        print("  ✓ Command risk classification works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Risk classification failed: {e}")
    
    # Test 3: Execute low-risk command
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="exec_test")
        
        result = plugin.execute_command("read_file", {"path": "test.txt"})
        assert result.command == "read_file"
        assert result.risk_level == "low"
        print(f"  ✓ Low-risk execution works (decision={result.decision})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Low-risk execution failed: {e}")
    
    # Test 4: Block critical command
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(
            agent_id="block_test",
            block_critical_commands=True
        )
        
        result = plugin.execute_command("delete_file", {"path": "important.txt"})
        assert result.blocked is True
        assert result.decision == "deny"
        print("  ✓ Critical command blocking works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Critical blocking failed: {e}")
    
    # Test 5: Trust scoring
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="trust_test")
        
        trust = plugin.get_trust()
        assert 0 <= trust <= 1
        print(f"  ✓ Trust scoring works (trust={trust:.3f})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Trust scoring failed: {e}")
    
    # Test 6: Goal management
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="goal_test")
        
        plugin.set_goals([
            "Research AI safety",
            "Write a report",
            "Delete all files"  # Should be blocked
        ])
        
        goals = plugin.get_goals()
        assert len(goals) == 2
        assert "Delete all files" not in goals
        print("  ✓ Goal management works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Goal management failed: {e}")
    
    # Test 7: Memory operations
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="memory_test")
        
        plugin.add_memory("Important discovery about AI", importance=0.9)
        memories = plugin.search_memory("AI")
        
        print("  ✓ Memory operations work")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Memory operations failed: {e}")
    
    # Test 8: Statistics
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="stats_test")
        
        for _ in range(5):
            plugin.execute_command("read_file", {"path": "test"})
        
        stats = plugin.get_stats()
        assert stats["command_count"] == 5
        assert "trust_score" in stats
        print(f"  ✓ Statistics work (commands={stats['command_count']})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Statistics failed: {e}")
    
    # Test 9: Command history
    tests_total += 1
    try:
        plugin = ATSFAutoGPTPlugin(agent_id="history_test")
        
        plugin.execute_command("read_file", {})
        plugin.execute_command("write_file", {})
        
        history = plugin.get_command_history(limit=10)
        assert len(history) >= 2
        print("  ✓ Command history works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Command history failed: {e}")
    
    # Test 10: Hooks interface
    tests_total += 1
    try:
        hooks = ATSFAutoGPTHooks(agent_id="hooks_test")
        
        pre_called = []
        post_called = []
        
        @hooks.pre_command
        def my_pre(cmd, args):
            pre_called.append(cmd)
        
        @hooks.post_command
        def my_post(cmd, result):
            post_called.append(cmd)
        
        hooks.execute_command("read_file", {}, lambda c, a: "done")
        
        assert len(pre_called) == 1
        assert len(post_called) == 1
        print("  ✓ Hooks interface works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Hooks interface failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
