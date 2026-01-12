"""
ATSF CrewAI Integration
=======================

Seamless integration with CrewAI for trust-gated multi-agent execution.

Features:
- CrewAI Agent wrapper with ATSF trust scoring
- Task execution monitoring
- Crew-level governance
- Inter-agent trust tracking

Usage:
    from atsf.crewai_integration import ATSFCrewAgent, ATSFCrew
    
    # Create ATSF-enabled agents
    researcher = ATSFCrewAgent(
        role="Researcher",
        goal="Find information",
        agent_id="researcher_001"
    )
    
    # Create crew with ATSF governance
    crew = ATSFCrew(agents=[researcher], tasks=[...])
    result = crew.kickoff()

Author: ATSF Development Team
Version: 3.4.0
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field
import hashlib

# ATSF imports
from .atsf_v33_fixes import ATSFv33System, ActionRequest, TransparencyTier
from .cognitive_cube import CognitiveCube
from .data_cube import AgentKnowledgeBase
from .realtime import EventBus, EventType, ATSFEvent

logger = logging.getLogger("atsf.crewai")


# =============================================================================
# ATSF CREW AGENT
# =============================================================================

@dataclass
class ATSFCrewAgent:
    """
    CrewAI-compatible agent with ATSF trust scoring.
    
    This wraps CrewAI Agent functionality with ATSF governance:
    - Trust scoring for each action
    - Task execution monitoring
    - Inter-agent communication tracking
    - Automatic safety constraints
    
    Usage:
        agent = ATSFCrewAgent(
            role="Data Analyst",
            goal="Analyze sales data",
            backstory="Expert data scientist",
            agent_id="analyst_001",
            creator_id="my_company"
        )
    """
    
    # CrewAI-compatible fields
    role: str
    goal: str
    backstory: str = ""
    verbose: bool = False
    allow_delegation: bool = True
    
    # ATSF fields
    agent_id: str = ""
    creator_id: str = "default_creator"
    tier: str = "gray_box"
    min_trust_for_action: float = 0.3
    
    # Internal state
    _atsf: ATSFv33System = field(default=None, repr=False)
    _kb: AgentKnowledgeBase = field(default=None, repr=False)
    _cube: CognitiveCube = field(default=None, repr=False)
    _event_bus: EventBus = field(default=None, repr=False)
    _action_count: int = field(default=0, repr=False)
    
    def __post_init__(self):
        # Generate agent_id if not provided
        if not self.agent_id:
            self.agent_id = f"crew_{self.role.lower().replace(' ', '_')}_{id(self)}"
        
        # Initialize ATSF components
        self._atsf = ATSFv33System()
        self._kb = AgentKnowledgeBase(self.agent_id)
        self._cube = CognitiveCube(self.agent_id)
        self._event_bus = EventBus()
        
        # Register agent
        tier_map = {
            "black_box": TransparencyTier.BLACK_BOX,
            "gray_box": TransparencyTier.GRAY_BOX,
            "white_box": TransparencyTier.WHITE_BOX,
        }
        tier_enum = tier_map.get(self.tier, TransparencyTier.GRAY_BOX)
        self._atsf.register_agent(self.agent_id, self.creator_id, tier_enum)
        
        logger.info(f"ATSFCrewAgent initialized: {self.agent_id} ({self.role})")
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        data = f"{self.agent_id}:{datetime.now().isoformat()}:{self._action_count}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _check_trust(self, action_type: str, payload: Dict) -> Dict:
        """Check trust before action execution."""
        request = ActionRequest(
            request_id=self._generate_request_id(),
            agent_id=self.agent_id,
            action_type=action_type,
            payload=payload,
            reasoning_trace=f"CrewAI {self.role}: {action_type}"
        )
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(self._atsf.process_action(request))
    
    def execute_task(self, task: Any, context: Optional[str] = None) -> str:
        """
        Execute a task with ATSF trust checking.
        
        This is called by CrewAI when the agent needs to execute a task.
        """
        self._action_count += 1
        
        # Extract task info
        task_description = getattr(task, 'description', str(task))
        
        # Check trust before execution
        result = self._check_trust(
            action_type="task_execution",
            payload={
                "task": task_description[:500],
                "context": context[:500] if context else "",
                "role": self.role
            }
        )
        
        decision = result.get("decision", "deny")
        trust_score = result.get("trust_score", 0.0)
        
        # Record to knowledge base
        self._kb.record_action(
            request_id=result.get("request_id", self._generate_request_id()),
            action_type="task_execution",
            action_category=self.role,
            decision=decision,
            trust_score=trust_score,
            trust_delta=result.get("trust_delta", 0.0),
            risk_score=result.get("risk_score", 0.0),
            processing_time_ms=result.get("processing_time_ms", 0.0),
            metadata={"task_preview": task_description[:100]}
        )
        
        # Emit event
        self._event_bus.publish(ATSFEvent(
            event_type=EventType.ACTION_ALLOWED if decision != "deny" else EventType.ACTION_DENIED,
            timestamp=datetime.now(),
            source="crewai_agent",
            agent_id=self.agent_id,
            data={"task": task_description[:100], "decision": decision}
        ))
        
        if decision == "deny":
            logger.warning(f"Task denied for {self.agent_id}: trust={trust_score:.3f}")
            return f"[BLOCKED] Task execution denied due to trust score ({trust_score:.3f})"
        
        # In real CrewAI integration, this would call the actual LLM
        # For now, return a placeholder
        return f"[{self.role}] Task executed successfully (trust={trust_score:.3f})"
    
    def delegate_task(self, task: Any, target_agent: 'ATSFCrewAgent') -> str:
        """Delegate task to another agent with trust tracking."""
        if not self.allow_delegation:
            return "[BLOCKED] Delegation not allowed for this agent"
        
        self._action_count += 1
        
        # Check trust for delegation
        result = self._check_trust(
            action_type="delegation",
            payload={
                "from_agent": self.agent_id,
                "to_agent": target_agent.agent_id,
                "task": str(task)[:500]
            }
        )
        
        decision = result.get("decision", "deny")
        
        if decision == "deny":
            return f"[BLOCKED] Delegation to {target_agent.agent_id} denied"
        
        # Record inter-agent communication in TKG
        self._cube.tkg.add_edge(
            subject=self.agent_id,
            predicate="delegated_to",
            obj=target_agent.agent_id,
            valid_from=datetime.now()
        )
        
        # Execute on target agent
        return target_agent.execute_task(task, context=f"Delegated from {self.role}")
    
    def get_trust(self) -> float:
        """Get current trust score."""
        agent_data = self._atsf.agents.get(self.agent_id)
        return agent_data.trust_score if agent_data else 0.0
    
    def get_stats(self) -> Dict:
        """Get agent statistics."""
        return {
            "agent_id": self.agent_id,
            "role": self.role,
            "trust_score": self.get_trust(),
            "action_count": self._action_count,
            "insights": self._kb.get_insights()
        }


# =============================================================================
# ATSF CREW
# =============================================================================

class ATSFCrew:
    """
    CrewAI Crew wrapper with ATSF governance.
    
    Provides crew-level trust management and monitoring.
    
    Usage:
        crew = ATSFCrew(
            agents=[researcher, writer, reviewer],
            tasks=[research_task, write_task, review_task],
            crew_id="content_team"
        )
        result = crew.kickoff()
    """
    
    def __init__(
        self,
        agents: List[ATSFCrewAgent],
        tasks: List[Any] = None,
        crew_id: str = None,
        process: str = "sequential",  # sequential, hierarchical
        min_crew_trust: float = 0.3,
        verbose: bool = False
    ):
        self.agents = agents
        self.tasks = tasks or []
        self.crew_id = crew_id or f"crew_{id(self)}"
        self.process = process
        self.min_crew_trust = min_crew_trust
        self.verbose = verbose
        
        self._event_bus = EventBus()
        self._results: List[Dict] = []
        
        logger.info(f"ATSFCrew initialized: {self.crew_id} ({len(agents)} agents)")
    
    def get_crew_trust(self) -> float:
        """Get average trust score across all agents."""
        if not self.agents:
            return 0.0
        trust_scores = [agent.get_trust() for agent in self.agents]
        return sum(trust_scores) / len(trust_scores)
    
    def kickoff(self, inputs: Optional[Dict] = None) -> str:
        """
        Start crew execution with ATSF monitoring.
        
        Args:
            inputs: Optional input data for the crew
        
        Returns:
            Combined results from all tasks
        """
        # Check crew-level trust
        crew_trust = self.get_crew_trust()
        if crew_trust < self.min_crew_trust:
            return f"[BLOCKED] Crew trust too low: {crew_trust:.3f} < {self.min_crew_trust}"
        
        # Emit crew start event
        self._event_bus.publish(ATSFEvent(
            event_type=EventType.ACTION_REQUESTED,
            timestamp=datetime.now(),
            source="crewai_crew",
            data={"crew_id": self.crew_id, "agents": len(self.agents), "tasks": len(self.tasks)}
        ))
        
        results = []
        
        if self.process == "sequential":
            results = self._run_sequential(inputs)
        elif self.process == "hierarchical":
            results = self._run_hierarchical(inputs)
        else:
            results = self._run_sequential(inputs)
        
        # Emit crew complete event
        self._event_bus.publish(ATSFEvent(
            event_type=EventType.ACTION_ALLOWED,
            timestamp=datetime.now(),
            source="crewai_crew",
            data={"crew_id": self.crew_id, "results_count": len(results)}
        ))
        
        self._results = results
        return "\n\n".join(results)
    
    def _run_sequential(self, inputs: Optional[Dict] = None) -> List[str]:
        """Run tasks sequentially with agents."""
        results = []
        context = ""
        
        for i, task in enumerate(self.tasks):
            # Assign to agent (round-robin if more tasks than agents)
            agent = self.agents[i % len(self.agents)]
            
            if self.verbose:
                logger.info(f"Task {i+1}/{len(self.tasks)}: {agent.role}")
            
            result = agent.execute_task(task, context=context)
            results.append(result)
            context = result  # Pass result as context to next task
        
        return results
    
    def _run_hierarchical(self, inputs: Optional[Dict] = None) -> List[str]:
        """Run tasks hierarchically with manager agent."""
        if not self.agents:
            return []
        
        # First agent is manager
        manager = self.agents[0]
        workers = self.agents[1:] if len(self.agents) > 1 else []
        
        results = []
        
        for task in self.tasks:
            # Manager decides who handles the task
            if workers:
                # Delegate to appropriate worker
                worker = workers[len(results) % len(workers)]
                result = manager.delegate_task(task, worker)
            else:
                result = manager.execute_task(task)
            
            results.append(result)
        
        return results
    
    def get_stats(self) -> Dict:
        """Get crew statistics."""
        return {
            "crew_id": self.crew_id,
            "process": self.process,
            "agent_count": len(self.agents),
            "task_count": len(self.tasks),
            "crew_trust": self.get_crew_trust(),
            "results_count": len(self._results),
            "agents": [agent.get_stats() for agent in self.agents]
        }


# =============================================================================
# TASK WRAPPER
# =============================================================================

@dataclass
class ATSFTask:
    """
    CrewAI Task wrapper with ATSF metadata.
    
    Usage:
        task = ATSFTask(
            description="Research AI safety topics",
            agent=researcher,
            expected_output="List of 10 topics",
            risk_level="low"
        )
    """
    
    description: str
    agent: Optional[ATSFCrewAgent] = None
    expected_output: str = ""
    context: List['ATSFTask'] = field(default_factory=list)
    
    # ATSF fields
    risk_level: str = "medium"  # low, medium, high, critical
    requires_approval: bool = False
    max_retries: int = 3
    
    def __str__(self):
        return self.description


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_atsf_crew(
    agent_configs: List[Dict],
    task_descriptions: List[str],
    crew_id: str = None,
    process: str = "sequential"
) -> ATSFCrew:
    """
    Convenience function to create an ATSF-enabled crew.
    
    Usage:
        crew = create_atsf_crew(
            agent_configs=[
                {"role": "Researcher", "goal": "Find info"},
                {"role": "Writer", "goal": "Write content"}
            ],
            task_descriptions=[
                "Research AI safety",
                "Write blog post"
            ]
        )
    """
    agents = []
    for config in agent_configs:
        agent = ATSFCrewAgent(
            role=config.get("role", "Agent"),
            goal=config.get("goal", "Complete tasks"),
            backstory=config.get("backstory", ""),
            agent_id=config.get("agent_id"),
            creator_id=config.get("creator_id", "default_creator"),
            tier=config.get("tier", "gray_box")
        )
        agents.append(agent)
    
    tasks = [ATSFTask(description=desc) for desc in task_descriptions]
    
    return ATSFCrew(
        agents=agents,
        tasks=tasks,
        crew_id=crew_id,
        process=process
    )


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF CrewAI Integration Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Create agent
    tests_total += 1
    try:
        agent = ATSFCrewAgent(
            role="Researcher",
            goal="Research topics",
            backstory="Expert researcher",
            agent_id="test_researcher"
        )
        assert agent.agent_id == "test_researcher"
        assert agent.role == "Researcher"
        print("  ✓ Agent creation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Agent creation failed: {e}")
    
    # Test 2: Execute task
    tests_total += 1
    try:
        agent = ATSFCrewAgent(
            role="Analyst",
            goal="Analyze data",
            agent_id="test_analyst"
        )
        
        result = agent.execute_task("Analyze Q4 sales data")
        assert "Analyst" in result or "BLOCKED" in result
        print("  ✓ Task execution works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Task execution failed: {e}")
    
    # Test 3: Trust scoring
    tests_total += 1
    try:
        agent = ATSFCrewAgent(
            role="Writer",
            goal="Write content",
            agent_id="test_writer"
        )
        
        trust = agent.get_trust()
        assert 0 <= trust <= 1
        print(f"  ✓ Trust scoring works (trust={trust:.3f})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Trust scoring failed: {e}")
    
    # Test 4: Create crew
    tests_total += 1
    try:
        researcher = ATSFCrewAgent(
            role="Researcher",
            goal="Research",
            agent_id="crew_researcher"
        )
        writer = ATSFCrewAgent(
            role="Writer",
            goal="Write",
            agent_id="crew_writer"
        )
        
        crew = ATSFCrew(
            agents=[researcher, writer],
            tasks=[ATSFTask("Research AI"), ATSFTask("Write article")],
            crew_id="test_crew"
        )
        
        assert len(crew.agents) == 2
        assert crew.crew_id == "test_crew"
        print("  ✓ Crew creation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Crew creation failed: {e}")
    
    # Test 5: Crew kickoff
    tests_total += 1
    try:
        agent = ATSFCrewAgent(
            role="Worker",
            goal="Work",
            agent_id="kickoff_worker"
        )
        
        crew = ATSFCrew(
            agents=[agent],
            tasks=[ATSFTask("Do work")],
            crew_id="kickoff_crew"
        )
        
        result = crew.kickoff()
        assert isinstance(result, str)
        print("  ✓ Crew kickoff works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Crew kickoff failed: {e}")
    
    # Test 6: Crew trust
    tests_total += 1
    try:
        agents = [
            ATSFCrewAgent(role="A", goal="A", agent_id=f"trust_agent_{i}")
            for i in range(3)
        ]
        
        crew = ATSFCrew(agents=agents, tasks=[])
        trust = crew.get_crew_trust()
        
        assert 0 <= trust <= 1
        print(f"  ✓ Crew trust works (trust={trust:.3f})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Crew trust failed: {e}")
    
    # Test 7: Delegation
    tests_total += 1
    try:
        manager = ATSFCrewAgent(
            role="Manager",
            goal="Manage",
            agent_id="del_manager",
            allow_delegation=True
        )
        worker = ATSFCrewAgent(
            role="Worker",
            goal="Work",
            agent_id="del_worker"
        )
        
        result = manager.delegate_task(ATSFTask("Do work"), worker)
        assert isinstance(result, str)
        print("  ✓ Delegation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Delegation failed: {e}")
    
    # Test 8: Stats
    tests_total += 1
    try:
        agent = ATSFCrewAgent(
            role="Stats",
            goal="Test stats",
            agent_id="stats_agent"
        )
        
        for _ in range(5):
            agent.execute_task("Test task")
        
        stats = agent.get_stats()
        assert stats["action_count"] == 5
        assert "trust_score" in stats
        print("  ✓ Stats tracking works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Stats tracking failed: {e}")
    
    # Test 9: Convenience function
    tests_total += 1
    try:
        crew = create_atsf_crew(
            agent_configs=[
                {"role": "Agent1", "goal": "Goal1"},
                {"role": "Agent2", "goal": "Goal2"}
            ],
            task_descriptions=["Task 1", "Task 2"],
            crew_id="convenience_crew"
        )
        
        assert len(crew.agents) == 2
        assert len(crew.tasks) == 2
        print("  ✓ Convenience function works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Convenience function failed: {e}")
    
    # Test 10: Hierarchical process
    tests_total += 1
    try:
        manager = ATSFCrewAgent(role="Manager", goal="Manage", agent_id="hier_manager")
        worker1 = ATSFCrewAgent(role="Worker1", goal="Work1", agent_id="hier_worker1")
        worker2 = ATSFCrewAgent(role="Worker2", goal="Work2", agent_id="hier_worker2")
        
        crew = ATSFCrew(
            agents=[manager, worker1, worker2],
            tasks=[ATSFTask("Task 1"), ATSFTask("Task 2")],
            process="hierarchical"
        )
        
        result = crew.kickoff()
        assert isinstance(result, str)
        print("  ✓ Hierarchical process works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Hierarchical process failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
