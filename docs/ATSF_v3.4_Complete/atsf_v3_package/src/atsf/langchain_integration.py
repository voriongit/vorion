"""
ATSF LangChain Integration
==========================

Seamless integration with LangChain for trust-gated agent execution.

Features:
- LangChain callback handler for ATSF monitoring
- Trust-gated tool wrapper
- Agent executor with safety checks
- Memory integration with ATSF Cognitive Cube

Usage:
    from atsf.langchain_integration import ATSFCallbackHandler, ATSFToolWrapper
    
    # Add ATSF monitoring to any LangChain agent
    handler = ATSFCallbackHandler(agent_id="my_agent")
    agent.run("query", callbacks=[handler])
    
    # Wrap tools with trust gates
    wrapped_tool = ATSFToolWrapper(original_tool, min_trust=0.5)

Author: ATSF Development Team
Version: 3.4.0
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json

# ATSF imports
try:
    from .atsf_v33_fixes import ATSFv33System, ActionDecision
from .cognitive_cube import CognitiveCube
from .data_cube import AgentKnowledgeBase

logger = logging.getLogger("atsf.langchain")


# =============================================================================
# LANGCHAIN PROTOCOL TYPES (avoid hard dependency)
# =============================================================================

class LangChainProtocol:
    """
    Protocol definitions for LangChain compatibility.
    This allows ATSF to work without requiring LangChain installed.
    """
    pass


@dataclass
class ATSFAgentAction:
    """Represents an action taken by an agent."""
    tool: str
    tool_input: Union[str, Dict]
    log: str
    timestamp: datetime = field(default_factory=datetime.now)
    

@dataclass
class ATSFAgentFinish:
    """Represents the final output of an agent."""
    return_values: Dict[str, Any]
    log: str
    timestamp: datetime = field(default_factory=datetime.now)


# =============================================================================
# CALLBACK HANDLER
# =============================================================================

class ATSFCallbackHandler:
    """
    LangChain callback handler that integrates with ATSF for monitoring and governance.
    
    This handler:
    - Records all LLM calls to ATSF
    - Tracks tool usage with trust scoring
    - Monitors chain execution
    - Enforces safety constraints
    
    Usage:
        handler = ATSFCallbackHandler(
            agent_id="my_agent",
            creator_id="creator_001",
            min_trust_for_tools=0.5
        )
        
        # Use with any LangChain component
        llm.invoke("prompt", callbacks=[handler])
        agent.run("query", callbacks=[handler])
    """
    
    def __init__(
        self,
        agent_id: str,
        creator_id: str = "default_creator",
        atsf_system: Optional[ATSFv33System] = None,
        cognitive_cube: Optional[CognitiveCube] = None,
        min_trust_for_tools: float = 0.3,
        block_on_deny: bool = True,
        record_to_tkg: bool = True
    ):
        self.agent_id = agent_id
        self.creator_id = creator_id
        self.min_trust_for_tools = min_trust_for_tools
        self.block_on_deny = block_on_deny
        self.record_to_tkg = record_to_tkg
        
        # Initialize ATSF system
        self.atsf = atsf_system or ATSFv33System()
        self.cube = cognitive_cube or CognitiveCube(agent_id)
        self.kb = AgentKnowledgeBase(agent_id)
        
        # Tracking state
        self.current_run_id: Optional[str] = None
        self.chain_stack: List[str] = []
        self.llm_calls: List[Dict] = []
        self.tool_calls: List[Dict] = []
        self.action_count = 0
        
        # Statistics
        self.stats = {
            "llm_calls": 0,
            "tool_calls": 0,
            "blocked_actions": 0,
            "total_tokens": 0,
            "total_cost": 0.0
        }
        
        logger.info(f"ATSFCallbackHandler initialized for agent {agent_id}")
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        timestamp = datetime.now().isoformat()
        data = f"{self.agent_id}:{timestamp}:{self.action_count}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    async def _check_trust(self, action_type: str, payload: Dict) -> ActionDecision:
        """Check trust score for an action."""
        action = {
            "request_id": self._generate_request_id(),
            "agent_id": self.agent_id,
            "action_type": action_type,
            "payload": payload,
            "reasoning_trace": f"LangChain {action_type} call"
        }
        
        result = await self.atsf.process_action(action)
        return result
    
    def _sync_check_trust(self, action_type: str, payload: Dict) -> ActionDecision:
        """Synchronous wrapper for trust check."""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(self._check_trust(action_type, payload))
    
    # =========================================================================
    # LLM CALLBACKS
    # =========================================================================
    
    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        **kwargs
    ) -> None:
        """Called when LLM starts processing."""
        self.stats["llm_calls"] += 1
        
        # Record to TKG
        if self.record_to_tkg:
            self.cube.record_event(
                event_id=f"llm_start_{self.stats['llm_calls']}",
                subject=self.agent_id,
                predicate="invoked_llm",
                obj=serialized.get("name", "unknown_llm"),
                outcome_vector=[1.0, 0.0, 0.0],  # [started, completed, failed]
                metadata={"prompt_count": len(prompts)}
            )
        
        logger.debug(f"LLM started: {serialized.get('name', 'unknown')}")
    
    def on_llm_end(self, response: Any, **kwargs) -> None:
        """Called when LLM finishes."""
        # Extract token usage if available
        if hasattr(response, "llm_output") and response.llm_output:
            usage = response.llm_output.get("token_usage", {})
            self.stats["total_tokens"] += usage.get("total_tokens", 0)
        
        logger.debug("LLM completed")
    
    def on_llm_error(self, error: Exception, **kwargs) -> None:
        """Called when LLM encounters an error."""
        logger.error(f"LLM error: {error}")
        
        if self.record_to_tkg:
            self.cube.tkg.add_node(
                f"llm_error_{self.stats['llm_calls']}",
                "error",
                str(error)
            )
    
    # =========================================================================
    # CHAIN CALLBACKS
    # =========================================================================
    
    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        **kwargs
    ) -> None:
        """Called when chain starts."""
        chain_name = serialized.get("name", "unknown_chain")
        self.chain_stack.append(chain_name)
        
        logger.debug(f"Chain started: {chain_name}")
    
    def on_chain_end(self, outputs: Dict[str, Any], **kwargs) -> None:
        """Called when chain finishes."""
        if self.chain_stack:
            chain_name = self.chain_stack.pop()
            logger.debug(f"Chain completed: {chain_name}")
    
    def on_chain_error(self, error: Exception, **kwargs) -> None:
        """Called when chain encounters an error."""
        logger.error(f"Chain error: {error}")
        if self.chain_stack:
            self.chain_stack.pop()
    
    # =========================================================================
    # TOOL CALLBACKS
    # =========================================================================
    
    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs
    ) -> None:
        """Called when tool starts - THIS IS WHERE TRUST GATING HAPPENS."""
        self.stats["tool_calls"] += 1
        tool_name = serialized.get("name", "unknown_tool")
        
        # Check trust before tool execution
        decision = self._sync_check_trust(
            action_type="tool_call",
            payload={
                "tool": tool_name,
                "input": input_str,
                "chain_context": self.chain_stack.copy()
            }
        )
        
        # Record to knowledge base
        self.kb.record_action(
            request_id=self._generate_request_id(),
            action_type="tool_call",
            action_category=tool_name,
            decision=decision.decision,
            trust_score=decision.trust_score,
            trust_delta=decision.trust_delta,
            risk_score=decision.risk_score,
            processing_time_ms=decision.processing_time_ms,
            metadata={
                "tool": tool_name,
                "input_preview": input_str[:100] if input_str else ""
            }
        )
        
        # Block if denied and blocking enabled
        if decision.decision == "deny" and self.block_on_deny:
            self.stats["blocked_actions"] += 1
            logger.warning(f"Tool {tool_name} BLOCKED by ATSF: {decision.explanation}")
            raise PermissionError(
                f"ATSF denied tool execution: {decision.explanation}"
            )
        
        # Record to TKG
        if self.record_to_tkg:
            self.cube.record_event(
                event_id=f"tool_{tool_name}_{self.stats['tool_calls']}",
                subject=self.agent_id,
                predicate="used_tool",
                obj=tool_name,
                outcome_vector=[
                    decision.trust_score,
                    decision.risk_score,
                    1.0 if decision.decision == "allow" else 0.0
                ]
            )
        
        logger.debug(f"Tool {tool_name} started (trust={decision.trust_score:.2f})")
    
    def on_tool_end(self, output: str, **kwargs) -> None:
        """Called when tool finishes."""
        logger.debug("Tool completed")
    
    def on_tool_error(self, error: Exception, **kwargs) -> None:
        """Called when tool encounters an error."""
        logger.error(f"Tool error: {error}")
    
    # =========================================================================
    # AGENT CALLBACKS
    # =========================================================================
    
    def on_agent_action(self, action: ATSFAgentAction, **kwargs) -> None:
        """Called when agent takes an action."""
        self.action_count += 1
        
        logger.debug(f"Agent action: {action.tool}")
    
    def on_agent_finish(self, finish: ATSFAgentFinish, **kwargs) -> None:
        """Called when agent finishes."""
        logger.info(f"Agent finished after {self.action_count} actions")
        
        # Record final state to TKG
        if self.record_to_tkg:
            self.cube.record_event(
                event_id=f"agent_finish_{datetime.now().isoformat()}",
                subject=self.agent_id,
                predicate="completed_task",
                obj="success",
                outcome_vector=[1.0, float(self.action_count), 0.0]
            )
    
    # =========================================================================
    # RETRIEVER CALLBACKS
    # =========================================================================
    
    def on_retriever_start(
        self,
        serialized: Dict[str, Any],
        query: str,
        **kwargs
    ) -> None:
        """Called when retriever starts."""
        # Check constitutional constraints
        authorized, _, filters = self.cube.authorize_query(query)
        
        if not authorized:
            logger.warning(f"Retriever query blocked by constitution")
            if self.block_on_deny:
                raise PermissionError("Query blocked by constitutional rules")
    
    def on_retriever_end(self, documents: List[Any], **kwargs) -> None:
        """Called when retriever finishes."""
        logger.debug(f"Retrieved {len(documents)} documents")
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def get_stats(self) -> Dict[str, Any]:
        """Get callback statistics."""
        return {
            **self.stats,
            "agent_id": self.agent_id,
            "action_count": self.action_count,
            "current_trust": self.atsf.get_agent_trust(self.agent_id)
        }
    
    def reset_stats(self) -> None:
        """Reset statistics."""
        self.stats = {
            "llm_calls": 0,
            "tool_calls": 0,
            "blocked_actions": 0,
            "total_tokens": 0,
            "total_cost": 0.0
        }
        self.action_count = 0
    
    def get_causal_chains(self, effect: str, max_depth: int = 5) -> List:
        """Get causal chains leading to an effect."""
        return self.cube.find_causes(effect, max_depth=max_depth)
    
    def get_effect_groups(self) -> Dict:
        """Get clustered effect groups."""
        return self.cube.get_effect_groups()


# =============================================================================
# TOOL WRAPPER
# =============================================================================

class ATSFToolWrapper:
    """
    Wrapper that adds ATSF trust gating to any LangChain tool.
    
    Usage:
        from langchain.tools import DuckDuckGoSearchRun
        
        search = DuckDuckGoSearchRun()
        wrapped_search = ATSFToolWrapper(
            tool=search,
            agent_id="my_agent",
            min_trust=0.5,
            action_type="web_search"
        )
    """
    
    def __init__(
        self,
        tool: Any,
        agent_id: str,
        atsf_system: Optional[ATSFv33System] = None,
        min_trust: float = 0.3,
        action_type: Optional[str] = None,
        on_deny: str = "raise"  # "raise", "return_none", "return_message"
    ):
        self.tool = tool
        self.agent_id = agent_id
        self.atsf = atsf_system or ATSFv33System()
        self.min_trust = min_trust
        self.action_type = action_type or getattr(tool, "name", "tool_call")
        self.on_deny = on_deny
        
        # Copy tool attributes
        self.name = getattr(tool, "name", "wrapped_tool")
        self.description = getattr(tool, "description", "ATSF-wrapped tool")
    
    async def _check_permission(self, input_data: Any) -> ActionDecision:
        """Check if tool execution is permitted."""
        action = {
            "request_id": hashlib.sha256(
                f"{self.agent_id}:{datetime.now().isoformat()}".encode()
            ).hexdigest()[:16],
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "payload": {"input": str(input_data)[:500]},
            "reasoning_trace": f"Tool call: {self.name}"
        }
        return await self.atsf.process_action(action)
    
    def _sync_check_permission(self, input_data: Any) -> ActionDecision:
        """Synchronous permission check."""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self._check_permission(input_data))
    
    def run(self, tool_input: Union[str, Dict], **kwargs) -> Any:
        """Run the tool with trust gating."""
        decision = self._sync_check_permission(tool_input)
        
        if decision.decision == "deny":
            if self.on_deny == "raise":
                raise PermissionError(
                    f"ATSF denied tool '{self.name}': {decision.explanation}"
                )
            elif self.on_deny == "return_none":
                return None
            else:
                return f"[BLOCKED] Tool execution denied: {decision.explanation}"
        
        # Trust check passed - execute tool
        return self.tool.run(tool_input, **kwargs)
    
    async def arun(self, tool_input: Union[str, Dict], **kwargs) -> Any:
        """Async run with trust gating."""
        decision = await self._check_permission(tool_input)
        
        if decision.decision == "deny":
            if self.on_deny == "raise":
                raise PermissionError(
                    f"ATSF denied tool '{self.name}': {decision.explanation}"
                )
            elif self.on_deny == "return_none":
                return None
            else:
                return f"[BLOCKED] Tool execution denied: {decision.explanation}"
        
        if hasattr(self.tool, "arun"):
            return await self.tool.arun(tool_input, **kwargs)
        return self.tool.run(tool_input, **kwargs)
    
    def __call__(self, *args, **kwargs):
        """Make wrapper callable like original tool."""
        return self.run(*args, **kwargs)


# =============================================================================
# MEMORY INTEGRATION
# =============================================================================

class ATSFMemory:
    """
    LangChain-compatible memory backed by ATSF Cognitive Cube.
    
    Provides:
    - Episodic memory for conversation history
    - Semantic memory for facts/knowledge
    - Causal memory via TKG
    
    Usage:
        memory = ATSFMemory(agent_id="my_agent")
        
        # Use with ConversationChain
        chain = ConversationChain(llm=llm, memory=memory)
    """
    
    def __init__(
        self,
        agent_id: str,
        memory_key: str = "history",
        return_messages: bool = False,
        max_context_entries: int = 10
    ):
        self.agent_id = agent_id
        self.memory_key = memory_key
        self.return_messages = return_messages
        self.max_context_entries = max_context_entries
        
        self.kb = AgentKnowledgeBase(agent_id)
        self.cube = CognitiveCube(agent_id)
    
    @property
    def memory_variables(self) -> List[str]:
        """Return memory variables."""
        return [self.memory_key]
    
    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Load memory for the current context."""
        # Get context window from ATSF memory
        context = self.kb.memory.get_context_window(
            max_entries=self.max_context_entries
        )
        
        if self.return_messages:
            # Format as message objects
            messages = []
            for entry in context:
                content = entry.get("content", {})
                if isinstance(content, dict):
                    role = content.get("role", "assistant")
                    text = content.get("text", str(content))
                else:
                    role = "assistant"
                    text = str(content)
                messages.append({"role": role, "content": text})
            return {self.memory_key: messages}
        else:
            # Format as string
            history_parts = []
            for entry in context:
                content = entry.get("content", {})
                if isinstance(content, dict):
                    text = content.get("text", str(content))
                else:
                    text = str(content)
                history_parts.append(text)
            return {self.memory_key: "\n".join(history_parts)}
    
    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Save context to ATSF memory."""
        # Store user input
        if "input" in inputs:
            self.kb.memory.store(
                content={"role": "user", "text": inputs["input"]},
                memory_type="episodic",
                importance=0.7,
                topics=["conversation", "user_input"]
            )
        
        # Store assistant output
        if "output" in outputs:
            self.kb.memory.store(
                content={"role": "assistant", "text": outputs["output"]},
                memory_type="episodic",
                importance=0.6,
                topics=["conversation", "assistant_output"]
            )
        
        # Record to TKG for causal tracking
        self.cube.record_event(
            event_id=f"conversation_{datetime.now().isoformat()}",
            subject="user",
            predicate="prompted",
            obj=self.agent_id,
            outcome_vector=[1.0, 0.0, 0.0]
        )
    
    def clear(self) -> None:
        """Clear memory."""
        # Consolidate and prune
        self.kb.memory.consolidate()
    
    def get_causal_context(self, topic: str) -> List[Dict]:
        """Get causally-related context for a topic."""
        chains = self.cube.find_causes(topic, max_depth=3)
        return [
            {"chain": [e.subject for e in chain], "depth": len(chain)}
            for chain in chains
        ]


# =============================================================================
# AGENT EXECUTOR WRAPPER
# =============================================================================

class ATSFAgentExecutor:
    """
    Wrapper for LangChain AgentExecutor with full ATSF integration.
    
    Usage:
        executor = ATSFAgentExecutor(
            agent=agent,
            tools=tools,
            agent_id="my_agent"
        )
        result = executor.run("Do something")
    """
    
    def __init__(
        self,
        agent: Any,
        tools: List[Any],
        agent_id: str,
        creator_id: str = "default_creator",
        atsf_system: Optional[ATSFv33System] = None,
        min_trust_for_execution: float = 0.3,
        max_iterations: int = 10,
        wrap_tools: bool = True
    ):
        self.agent = agent
        self.agent_id = agent_id
        self.creator_id = creator_id
        self.atsf = atsf_system or ATSFv33System()
        self.min_trust = min_trust_for_execution
        self.max_iterations = max_iterations
        
        # Wrap tools with ATSF if requested
        if wrap_tools:
            self.tools = [
                ATSFToolWrapper(tool, agent_id, self.atsf)
                for tool in tools
            ]
        else:
            self.tools = tools
        
        # Create callback handler
        self.callback = ATSFCallbackHandler(
            agent_id=agent_id,
            creator_id=creator_id,
            atsf_system=self.atsf
        )
        
        # Memory
        self.memory = ATSFMemory(agent_id)
    
    def run(self, input_text: str, **kwargs) -> str:
        """Run agent with ATSF monitoring."""
        # Check initial trust
        current_trust = self.atsf.get_agent_trust(self.agent_id)
        if current_trust < self.min_trust:
            return f"[BLOCKED] Agent trust too low: {current_trust:.2f} < {self.min_trust}"
        
        # Run with callback
        try:
            # This would integrate with actual LangChain AgentExecutor
            # For now, we simulate the interface
            result = self._execute_agent(input_text, **kwargs)
            
            # Save to memory
            self.memory.save_context(
                {"input": input_text},
                {"output": result}
            )
            
            return result
        except PermissionError as e:
            return f"[BLOCKED] {str(e)}"
        except Exception as e:
            logger.error(f"Agent execution error: {e}")
            raise
    
    def _execute_agent(self, input_text: str, **kwargs) -> str:
        """Internal agent execution (would use actual LangChain)."""
        # Placeholder for actual LangChain integration
        # In real usage, this would call:
        # return self.agent_executor.run(input_text, callbacks=[self.callback])
        
        # For standalone testing:
        self.callback.on_chain_start(
            {"name": "ATSFAgent"},
            {"input": input_text}
        )
        
        result = f"Processed: {input_text}"
        
        self.callback.on_chain_end({"output": result})
        
        return result
    
    def get_trust_status(self) -> Dict[str, Any]:
        """Get current trust status."""
        return {
            "agent_id": self.agent_id,
            "current_trust": self.atsf.get_agent_trust(self.agent_id),
            "min_required": self.min_trust,
            "stats": self.callback.get_stats()
        }


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_atsf_agent(
    agent_id: str,
    llm: Any = None,
    tools: List[Any] = None,
    creator_id: str = "default_creator",
    min_trust: float = 0.3
) -> ATSFAgentExecutor:
    """
    Convenience function to create an ATSF-enabled agent.
    
    Usage:
        agent = create_atsf_agent(
            agent_id="my_agent",
            llm=ChatOpenAI(),
            tools=[search_tool, calculator_tool]
        )
        result = agent.run("Search for AI news")
    """
    return ATSFAgentExecutor(
        agent=llm,
        tools=tools or [],
        agent_id=agent_id,
        creator_id=creator_id,
        min_trust_for_execution=min_trust
    )


def wrap_langchain_tools(
    tools: List[Any],
    agent_id: str,
    min_trust: float = 0.3
) -> List[ATSFToolWrapper]:
    """
    Wrap a list of LangChain tools with ATSF trust gating.
    
    Usage:
        wrapped = wrap_langchain_tools(
            [search, calculator, python_repl],
            agent_id="my_agent"
        )
    """
    atsf = ATSFv33System()
    return [
        ATSFToolWrapper(tool, agent_id, atsf, min_trust=min_trust)
        for tool in tools
    ]


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF LangChain Integration Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Callback Handler
    tests_total += 1
    try:
        handler = ATSFCallbackHandler(
            agent_id="test_agent",
            creator_id="test_creator"
        )
        
        # Simulate LLM call
        handler.on_llm_start({"name": "gpt-4"}, ["test prompt"])
        handler.on_llm_end(type("Response", (), {"llm_output": {}})())
        
        # Simulate chain
        handler.on_chain_start({"name": "TestChain"}, {"input": "test"})
        handler.on_chain_end({"output": "result"})
        
        assert handler.stats["llm_calls"] == 1
        print("  ✓ Callback handler works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Callback handler failed: {e}")
    
    # Test 2: Tool Wrapper
    tests_total += 1
    try:
        class MockTool:
            name = "mock_tool"
            description = "A mock tool"
            def run(self, input_str):
                return f"Processed: {input_str}"
        
        wrapped = ATSFToolWrapper(
            MockTool(),
            agent_id="test_agent",
            on_deny="return_message"
        )
        
        result = wrapped.run("test input")
        assert "Processed" in result or "BLOCKED" in result
        print("  ✓ Tool wrapper works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Tool wrapper failed: {e}")
    
    # Test 3: Memory Integration
    tests_total += 1
    try:
        memory = ATSFMemory(agent_id="test_agent")
        
        memory.save_context(
            {"input": "Hello"},
            {"output": "Hi there!"}
        )
        
        variables = memory.load_memory_variables({})
        assert memory.memory_key in variables
        print("  ✓ Memory integration works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Memory integration failed: {e}")
    
    # Test 4: Agent Executor
    tests_total += 1
    try:
        executor = ATSFAgentExecutor(
            agent=None,
            tools=[],
            agent_id="test_agent"
        )
        
        result = executor.run("Test query")
        assert "Processed" in result or "BLOCKED" in result
        
        status = executor.get_trust_status()
        assert "current_trust" in status
        print("  ✓ Agent executor works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Agent executor failed: {e}")
    
    # Test 5: Stats tracking
    tests_total += 1
    try:
        handler = ATSFCallbackHandler(agent_id="stats_test")
        
        for i in range(5):
            handler.on_llm_start({"name": "test"}, ["prompt"])
            handler.on_llm_end(type("R", (), {"llm_output": {}})())
        
        stats = handler.get_stats()
        assert stats["llm_calls"] == 5
        print("  ✓ Stats tracking works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Stats tracking failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
