"""
ATSF v3.0 - Python SDK
======================

Official Python SDK for the Agentic Trust Scoring Framework.

Installation:
    pip install atsf-sdk

Usage:
    from atsf import ATSFClient
    
    client = ATSFClient(api_key="your-api-key")
    
    # Register an agent
    agent = client.agents.create("agent_001", transparency_tier="gray_box")
    
    # Update trust
    trust = client.trust.update("agent_001", delta=0.1, event_type="task_success")
    
    # Get assessment
    assessment = client.assessments.get("agent_001")

Author: ATSF Development Team
Version: 3.0.0
"""

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import requests
import json
import logging

__version__ = "3.0.0"
__author__ = "ATSF Development Team"

logger = logging.getLogger("atsf-sdk")


# =============================================================================
# ENUMS
# =============================================================================

class TransparencyTier(str, Enum):
    BLACK_BOX = "black_box"
    GRAY_BOX = "gray_box"
    WHITE_BOX = "white_box"
    ATTESTED = "attested"
    TRANSPARENT = "transparent"


class AgentStatus(str, Enum):
    REGISTERED = "registered"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    QUARANTINED = "quarantined"
    TERMINATED = "terminated"


class ThreatLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"
    CATASTROPHIC = "catastrophic"


class ImpactLevel(str, Enum):
    NEGLIGIBLE = "negligible"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    CATASTROPHIC = "catastrophic"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Agent:
    """Agent representation."""
    agent_id: str
    status: AgentStatus
    trust_score: float
    trust_ceiling: float
    containment_level: str
    transparency_tier: str
    capabilities: List[str]
    flags: List[str]
    registered_at: str
    last_activity: str
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Agent":
        return cls(
            agent_id=data["agent_id"],
            status=AgentStatus(data["status"]),
            trust_score=data["trust_score"],
            trust_ceiling=data["trust_ceiling"],
            containment_level=data["containment_level"],
            transparency_tier=data["transparency_tier"],
            capabilities=data.get("capabilities", []),
            flags=data.get("flags", []),
            registered_at=data.get("registered_at", ""),
            last_activity=data.get("last_activity", "")
        )


@dataclass
class TrustInfo:
    """Trust score information."""
    agent_id: str
    trust_score: float
    trust_ceiling: float
    was_capped: bool
    velocity: float
    
    @classmethod
    def from_dict(cls, data: Dict) -> "TrustInfo":
        return cls(
            agent_id=data["agent_id"],
            trust_score=data["trust_score"],
            trust_ceiling=data["trust_ceiling"],
            was_capped=data.get("was_capped", False),
            velocity=data.get("velocity", 0.0)
        )


@dataclass
class ActionDecision:
    """Action decision result."""
    request_id: str
    allowed: bool
    reason: str
    risk_score: float
    required_approval: Optional[str]
    signals: List[str]
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ActionDecision":
        return cls(
            request_id=data["request_id"],
            allowed=data["allowed"],
            reason=data["reason"],
            risk_score=data["risk_score"],
            required_approval=data.get("required_approval"),
            signals=data.get("signals", [])
        )


@dataclass
class Assessment:
    """Threat assessment result."""
    agent_id: str
    timestamp: str
    trust_score: float
    trust_velocity: float
    trust_ceiling: float
    threat_level: ThreatLevel
    risk_score: float
    total_signals: int
    recommended_action: str
    findings: List[str]
    signals_by_category: Dict[str, List[str]]
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Assessment":
        return cls(
            agent_id=data["agent_id"],
            timestamp=data["timestamp"],
            trust_score=data["trust_score"],
            trust_velocity=data["trust_velocity"],
            trust_ceiling=data["trust_ceiling"],
            threat_level=ThreatLevel(data["threat_level"]),
            risk_score=data["risk_score"],
            total_signals=data["total_signals"],
            recommended_action=data["recommended_action"],
            findings=data.get("findings", []),
            signals_by_category=data.get("signals_by_category", {})
        )


@dataclass
class Stats:
    """System statistics."""
    agents_registered: int
    active_agents: int
    quarantined_agents: int
    assessments_performed: int
    actions_processed: int
    actions_blocked: int
    threats_detected: int
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Stats":
        return cls(
            agents_registered=data["agents_registered"],
            active_agents=data["active_agents"],
            quarantined_agents=data["quarantined_agents"],
            assessments_performed=data["assessments_performed"],
            actions_processed=data["actions_processed"],
            actions_blocked=data["actions_blocked"],
            threats_detected=data["threats_detected"]
        )


# =============================================================================
# EXCEPTIONS
# =============================================================================

class ATSFError(Exception):
    """Base exception for ATSF SDK."""
    pass


class AuthenticationError(ATSFError):
    """Authentication failed."""
    pass


class NotFoundError(ATSFError):
    """Resource not found."""
    pass


class ValidationError(ATSFError):
    """Validation error."""
    pass


class RateLimitError(ATSFError):
    """Rate limit exceeded."""
    pass


# =============================================================================
# API RESOURCES
# =============================================================================

class AgentsResource:
    """Agents API resource."""
    
    def __init__(self, client: "ATSFClient"):
        self._client = client
    
    def create(
        self,
        agent_id: str,
        transparency_tier: Union[TransparencyTier, str] = TransparencyTier.BLACK_BOX,
        capabilities: List[str] = None,
        metadata: Dict = None
    ) -> Agent:
        """Create a new agent."""
        if isinstance(transparency_tier, TransparencyTier):
            transparency_tier = transparency_tier.value
            
        data = {
            "agent_id": agent_id,
            "transparency_tier": transparency_tier,
            "capabilities": capabilities or [],
            "metadata": metadata or {}
        }
        
        response = self._client._request("POST", "/agents", json=data)
        return Agent.from_dict(response)
    
    def list(
        self,
        status: Union[AgentStatus, str] = None,
        limit: int = 100
    ) -> List[Agent]:
        """List all agents."""
        params = {"limit": limit}
        if status:
            if isinstance(status, AgentStatus):
                status = status.value
            params["status"] = status
            
        response = self._client._request("GET", "/agents", params=params)
        return [Agent.from_dict(a) for a in response]
    
    def get(self, agent_id: str) -> Agent:
        """Get agent by ID."""
        response = self._client._request("GET", f"/agents/{agent_id}")
        return Agent.from_dict(response)
    
    def update(
        self,
        agent_id: str,
        transparency_tier: Union[TransparencyTier, str] = None,
        capabilities: List[str] = None,
        metadata: Dict = None
    ) -> Agent:
        """Update agent configuration."""
        data = {}
        if transparency_tier:
            if isinstance(transparency_tier, TransparencyTier):
                transparency_tier = transparency_tier.value
            data["transparency_tier"] = transparency_tier
        if capabilities is not None:
            data["capabilities"] = capabilities
        if metadata is not None:
            data["metadata"] = metadata
            
        response = self._client._request("PATCH", f"/agents/{agent_id}", json=data)
        return Agent.from_dict(response)
    
    def activate(self, agent_id: str) -> Agent:
        """Activate an agent."""
        response = self._client._request("POST", f"/agents/{agent_id}/activate")
        return Agent.from_dict(response)
    
    def suspend(self, agent_id: str, reason: str) -> Agent:
        """Suspend an agent."""
        response = self._client._request(
            "POST", 
            f"/agents/{agent_id}/suspend",
            json={"reason": reason}
        )
        return Agent.from_dict(response)
    
    def quarantine(self, agent_id: str, reason: str) -> Agent:
        """Quarantine an agent (requires admin)."""
        response = self._client._request(
            "POST",
            f"/agents/{agent_id}/quarantine",
            json={"reason": reason}
        )
        return Agent.from_dict(response)
    
    def terminate(self, agent_id: str) -> Dict:
        """Terminate an agent (requires admin)."""
        return self._client._request("DELETE", f"/agents/{agent_id}")


class TrustResource:
    """Trust API resource."""
    
    def __init__(self, client: "ATSFClient"):
        self._client = client
    
    def get(self, agent_id: str) -> TrustInfo:
        """Get current trust score."""
        response = self._client._request("GET", f"/agents/{agent_id}/trust")
        return TrustInfo.from_dict(response)
    
    def update(
        self,
        agent_id: str,
        delta: float,
        event_type: str,
        source: str = "sdk"
    ) -> TrustInfo:
        """Update trust score."""
        data = {
            "event_type": event_type,
            "delta": delta,
            "source": source
        }
        response = self._client._request("POST", f"/agents/{agent_id}/trust", json=data)
        return TrustInfo.from_dict(response)
    
    def history(self, agent_id: str, limit: int = 100) -> Dict:
        """Get trust history."""
        return self._client._request(
            "GET", 
            f"/agents/{agent_id}/trust/history",
            params={"limit": limit}
        )


class ActionsResource:
    """Actions API resource."""
    
    def __init__(self, client: "ATSFClient"):
        self._client = client
    
    def process(
        self,
        agent_id: str,
        action_type: str,
        description: str,
        target: str,
        impact: Union[ImpactLevel, str] = ImpactLevel.LOW,
        reversible: bool = True,
        input_text: str = None,
        metadata: Dict = None
    ) -> ActionDecision:
        """Process an action request."""
        if isinstance(impact, ImpactLevel):
            impact = impact.value
            
        data = {
            "action_type": action_type,
            "description": description,
            "target": target,
            "impact": impact,
            "reversible": reversible,
            "metadata": metadata or {}
        }
        
        if input_text:
            data["input_text"] = input_text
            
        response = self._client._request("POST", f"/agents/{agent_id}/actions", json=data)
        return ActionDecision.from_dict(response)


class AssessmentsResource:
    """Assessments API resource."""
    
    def __init__(self, client: "ATSFClient"):
        self._client = client
    
    def get(self, agent_id: str) -> Assessment:
        """Get threat assessment."""
        response = self._client._request("GET", f"/agents/{agent_id}/assessment")
        return Assessment.from_dict(response)


class BehaviorResource:
    """Behavior recording API resource."""
    
    def __init__(self, client: "ATSFClient"):
        self._client = client
    
    def record(
        self,
        agent_id: str,
        action_category: str,
        description: str,
        outcome_value: float,
        topic_weights: Dict[str, float] = None
    ) -> Dict:
        """Record agent behavior."""
        data = {
            "action_category": action_category,
            "description": description,
            "outcome_value": outcome_value
        }
        
        if topic_weights:
            data["topic_weights"] = topic_weights
            
        return self._client._request("POST", f"/agents/{agent_id}/behavior", json=data)


# =============================================================================
# MAIN CLIENT
# =============================================================================

class ATSFClient:
    """
    ATSF API Client.
    
    Example:
        client = ATSFClient(api_key="your-api-key")
        
        # Create and activate an agent
        agent = client.agents.create("my-agent", transparency_tier="gray_box")
        agent = client.agents.activate("my-agent")
        
        # Update trust
        trust = client.trust.update("my-agent", delta=0.1, event_type="task_success")
        
        # Process an action
        decision = client.actions.process(
            "my-agent",
            action_type="execute",
            description="Run analysis",
            target="data/input.csv",
            impact="medium"
        )
        
        # Get threat assessment
        assessment = client.assessments.get("my-agent")
    """
    
    DEFAULT_BASE_URL = "http://localhost:8000"
    
    def __init__(
        self,
        api_key: str,
        base_url: str = None,
        timeout: int = 30,
        verify_ssl: bool = True
    ):
        """
        Initialize the ATSF client.
        
        Args:
            api_key: API key for authentication
            base_url: Base URL for the API (default: http://localhost:8000)
            timeout: Request timeout in seconds
            verify_ssl: Whether to verify SSL certificates
        """
        self.api_key = api_key
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        
        # Initialize resources
        self.agents = AgentsResource(self)
        self.trust = TrustResource(self)
        self.actions = ActionsResource(self)
        self.assessments = AssessmentsResource(self)
        self.behavior = BehaviorResource(self)
    
    def _request(
        self,
        method: str,
        path: str,
        params: Dict = None,
        json: Dict = None
    ) -> Any:
        """Make an API request."""
        url = f"{self.base_url}{path}"
        
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": f"atsf-sdk/{__version__}"
        }
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json,
                timeout=self.timeout,
                verify=self.verify_ssl
            )
            
            if response.status_code == 401:
                raise AuthenticationError("Invalid API key")
            elif response.status_code == 403:
                raise AuthenticationError("Access denied")
            elif response.status_code == 404:
                raise NotFoundError(f"Resource not found: {path}")
            elif response.status_code == 422:
                raise ValidationError(response.json().get("detail", "Validation error"))
            elif response.status_code == 429:
                raise RateLimitError("Rate limit exceeded")
            elif response.status_code >= 400:
                raise ATSFError(f"API error: {response.status_code} - {response.text}")
                
            return response.json()
            
        except requests.RequestException as e:
            raise ATSFError(f"Request failed: {e}")
    
    def health(self) -> Dict:
        """Check API health."""
        return self._request("GET", "/health")
    
    def stats(self) -> Stats:
        """Get system statistics."""
        response = self._request("GET", "/stats")
        return Stats.from_dict(response)


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_client(api_key: str, base_url: str = None) -> ATSFClient:
    """Create an ATSF client."""
    return ATSFClient(api_key=api_key, base_url=base_url)


# =============================================================================
# CLI
# =============================================================================

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="ATSF SDK CLI")
    parser.add_argument("--api-key", required=True, help="API key")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("command", choices=["health", "stats", "agents"], help="Command")
    
    args = parser.parse_args()
    
    client = ATSFClient(api_key=args.api_key, base_url=args.base_url)
    
    if args.command == "health":
        print(json.dumps(client.health(), indent=2))
    elif args.command == "stats":
        stats = client.stats()
        print(f"Agents: {stats.agents_registered}")
        print(f"Active: {stats.active_agents}")
        print(f"Threats: {stats.threats_detected}")
    elif args.command == "agents":
        agents = client.agents.list()
        for agent in agents:
            print(f"{agent.agent_id}: {agent.status.value} (trust: {agent.trust_score:.2f})")


if __name__ == "__main__":
    main()
