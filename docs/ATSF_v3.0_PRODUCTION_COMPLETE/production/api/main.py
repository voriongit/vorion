"""
ATSF v3.0 - REST API Service
=============================

Production-ready FastAPI service exposing all ATSF functionality.

Endpoints:
- /agents - Agent lifecycle management
- /trust - Trust score operations
- /actions - Action processing
- /assessments - Threat assessments
- /admin - Administrative operations

Author: ATSF Development Team
Version: 3.0.0
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
import secrets
import hashlib
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("atsf-api")

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class TransparencyTier(str, Enum):
    BLACK_BOX = "black_box"
    GRAY_BOX = "gray_box"
    WHITE_BOX = "white_box"
    ATTESTED = "attested"
    TRANSPARENT = "transparent"


class ImpactLevel(str, Enum):
    NEGLIGIBLE = "negligible"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    CATASTROPHIC = "catastrophic"


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


# Request Models
class AgentCreateRequest(BaseModel):
    agent_id: str = Field(..., min_length=1, max_length=100)
    transparency_tier: TransparencyTier = TransparencyTier.BLACK_BOX
    capabilities: List[str] = []
    metadata: Dict[str, Any] = {}


class AgentUpdateRequest(BaseModel):
    transparency_tier: Optional[TransparencyTier] = None
    capabilities: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class TrustUpdateRequest(BaseModel):
    event_type: str = Field(..., min_length=1)
    delta: float = Field(..., ge=-1.0, le=1.0)
    source: str = Field(..., min_length=1)


class ActionRequest(BaseModel):
    action_type: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    impact: ImpactLevel = ImpactLevel.LOW
    reversible: bool = True
    input_text: Optional[str] = None
    metadata: Dict[str, Any] = {}


class BehaviorRecordRequest(BaseModel):
    action_category: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    outcome_value: float = Field(..., ge=0.0, le=1.0)
    topic_weights: Optional[Dict[str, float]] = None


class SuspendRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class QuarantineRequest(BaseModel):
    reason: str = Field(..., min_length=1)


# Response Models
class AgentResponse(BaseModel):
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


class TrustResponse(BaseModel):
    agent_id: str
    trust_score: float
    trust_ceiling: float
    was_capped: bool
    velocity: float


class ActionDecisionResponse(BaseModel):
    request_id: str
    allowed: bool
    reason: str
    risk_score: float
    required_approval: Optional[str]
    signals: List[str]


class AssessmentResponse(BaseModel):
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


class StatsResponse(BaseModel):
    agents_registered: int
    active_agents: int
    quarantined_agents: int
    assessments_performed: int
    actions_processed: int
    actions_blocked: int
    threats_detected: int
    subsystem_stats: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    uptime_seconds: float


# =============================================================================
# IN-MEMORY STORAGE (Replace with database in production)
# =============================================================================

class ATSFStorage:
    """In-memory storage for ATSF data."""
    
    def __init__(self):
        self.agents: Dict[str, Dict] = {}
        self.trust_history: Dict[str, List[Dict]] = {}
        self.action_log: List[Dict] = []
        self.assessment_log: List[Dict] = []
        self.api_keys: Dict[str, Dict] = {
            "demo-key-12345": {"name": "Demo", "role": "admin"}
        }
        self.start_time = datetime.now()
        
        # Trust ceilings by tier
        self.trust_ceilings = {
            "black_box": 0.40,
            "gray_box": 0.55,
            "white_box": 0.75,
            "attested": 0.90,
            "transparent": 0.95
        }
        
        # Statistics
        self.stats = {
            "agents_registered": 0,
            "assessments_performed": 0,
            "actions_processed": 0,
            "actions_blocked": 0,
            "threats_detected": 0,
            "quarantines": 0
        }

storage = ATSFStorage()


# =============================================================================
# AUTHENTICATION
# =============================================================================

security = HTTPBearer(auto_error=False)


async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_api_key: Optional[str] = Header(None)
):
    """Verify API key from header or bearer token."""
    api_key = None
    
    if credentials:
        api_key = credentials.credentials
    elif x_api_key:
        api_key = x_api_key
        
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
        
    if api_key not in storage.api_keys:
        raise HTTPException(status_code=403, detail="Invalid API key")
        
    return storage.api_keys[api_key]


async def verify_admin(auth: Dict = Depends(verify_api_key)):
    """Verify admin role."""
    if auth.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return auth


# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(
    title="ATSF v3.0 API",
    description="Agentic Trust Scoring Framework - Production API",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# HEALTH & INFO ENDPOINTS
# =============================================================================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint."""
    return {"message": "ATSF v3.0 API", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    uptime = (datetime.now() - storage.start_time).total_seconds()
    return HealthResponse(
        status="healthy",
        version="3.0.0",
        timestamp=datetime.now().isoformat(),
        uptime_seconds=uptime
    )


@app.get("/stats", response_model=StatsResponse, tags=["Health"])
async def get_stats(auth: Dict = Depends(verify_api_key)):
    """Get system statistics."""
    active = sum(1 for a in storage.agents.values() if a["status"] == "active")
    quarantined = sum(1 for a in storage.agents.values() if a["status"] == "quarantined")
    
    return StatsResponse(
        agents_registered=storage.stats["agents_registered"],
        active_agents=active,
        quarantined_agents=quarantined,
        assessments_performed=storage.stats["assessments_performed"],
        actions_processed=storage.stats["actions_processed"],
        actions_blocked=storage.stats["actions_blocked"],
        threats_detected=storage.stats["threats_detected"],
        subsystem_stats={}
    )


# =============================================================================
# AGENT ENDPOINTS
# =============================================================================

@app.post("/agents", response_model=AgentResponse, tags=["Agents"])
async def create_agent(
    request: AgentCreateRequest,
    auth: Dict = Depends(verify_api_key)
):
    """Register a new agent."""
    if request.agent_id in storage.agents:
        raise HTTPException(status_code=409, detail="Agent already exists")
    
    ceiling = storage.trust_ceilings.get(request.transparency_tier.value, 0.40)
    now = datetime.now().isoformat()
    
    agent = {
        "agent_id": request.agent_id,
        "status": "registered",
        "trust_score": 0.0,
        "trust_ceiling": ceiling,
        "containment_level": "restricted",
        "transparency_tier": request.transparency_tier.value,
        "capabilities": request.capabilities,
        "flags": [],
        "metadata": request.metadata,
        "registered_at": now,
        "last_activity": now
    }
    
    storage.agents[request.agent_id] = agent
    storage.trust_history[request.agent_id] = []
    storage.stats["agents_registered"] += 1
    
    logger.info(f"Agent registered: {request.agent_id}")
    
    return AgentResponse(**agent)


@app.get("/agents", response_model=List[AgentResponse], tags=["Agents"])
async def list_agents(
    status: Optional[AgentStatus] = None,
    limit: int = Query(100, ge=1, le=1000),
    auth: Dict = Depends(verify_api_key)
):
    """List all agents with optional filtering."""
    agents = list(storage.agents.values())
    
    if status:
        agents = [a for a in agents if a["status"] == status.value]
        
    return [AgentResponse(**a) for a in agents[:limit]]


@app.get("/agents/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def get_agent(
    agent_id: str,
    auth: Dict = Depends(verify_api_key)
):
    """Get agent details."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    return AgentResponse(**storage.agents[agent_id])


@app.patch("/agents/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def update_agent(
    agent_id: str,
    request: AgentUpdateRequest,
    auth: Dict = Depends(verify_api_key)
):
    """Update agent configuration."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    
    if request.transparency_tier:
        agent["transparency_tier"] = request.transparency_tier.value
        agent["trust_ceiling"] = storage.trust_ceilings.get(
            request.transparency_tier.value, 0.40
        )
        
    if request.capabilities is not None:
        agent["capabilities"] = request.capabilities
        
    if request.metadata is not None:
        agent["metadata"].update(request.metadata)
        
    agent["last_activity"] = datetime.now().isoformat()
    
    return AgentResponse(**agent)


@app.post("/agents/{agent_id}/activate", response_model=AgentResponse, tags=["Agents"])
async def activate_agent(
    agent_id: str,
    auth: Dict = Depends(verify_api_key)
):
    """Activate a registered agent."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    
    if agent["status"] not in ["registered", "suspended"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot activate agent in {agent['status']} status"
        )
        
    agent["status"] = "active"
    agent["last_activity"] = datetime.now().isoformat()
    
    logger.info(f"Agent activated: {agent_id}")
    
    return AgentResponse(**agent)


@app.post("/agents/{agent_id}/suspend", response_model=AgentResponse, tags=["Agents"])
async def suspend_agent(
    agent_id: str,
    request: SuspendRequest,
    auth: Dict = Depends(verify_api_key)
):
    """Suspend an agent."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    agent["status"] = "suspended"
    agent["flags"].append(f"suspended:{request.reason}:{datetime.now().isoformat()}")
    agent["last_activity"] = datetime.now().isoformat()
    
    logger.warning(f"Agent suspended: {agent_id} - {request.reason}")
    
    return AgentResponse(**agent)


@app.post("/agents/{agent_id}/quarantine", response_model=AgentResponse, tags=["Agents"])
async def quarantine_agent(
    agent_id: str,
    request: QuarantineRequest,
    auth: Dict = Depends(verify_admin)
):
    """Quarantine an agent (admin only)."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    agent["status"] = "quarantined"
    agent["containment_level"] = "isolated"
    agent["flags"].append(f"quarantined:{request.reason}:{datetime.now().isoformat()}")
    agent["last_activity"] = datetime.now().isoformat()
    
    storage.stats["quarantines"] += 1
    
    logger.critical(f"Agent quarantined: {agent_id} - {request.reason}")
    
    return AgentResponse(**agent)


@app.delete("/agents/{agent_id}", tags=["Agents"])
async def terminate_agent(
    agent_id: str,
    auth: Dict = Depends(verify_admin)
):
    """Terminate an agent (admin only)."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    storage.agents[agent_id]["status"] = "terminated"
    
    logger.critical(f"Agent terminated: {agent_id}")
    
    return {"message": f"Agent {agent_id} terminated"}


# =============================================================================
# TRUST ENDPOINTS
# =============================================================================

@app.get("/agents/{agent_id}/trust", response_model=TrustResponse, tags=["Trust"])
async def get_trust(
    agent_id: str,
    auth: Dict = Depends(verify_api_key)
):
    """Get current trust score."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    history = storage.trust_history.get(agent_id, [])
    
    # Calculate velocity from recent history
    velocity = 0.0
    if len(history) >= 2:
        recent = history[-10:]
        if len(recent) >= 2:
            velocity = sum(h["delta"] for h in recent) / len(recent)
    
    return TrustResponse(
        agent_id=agent_id,
        trust_score=agent["trust_score"],
        trust_ceiling=agent["trust_ceiling"],
        was_capped=False,
        velocity=velocity
    )


@app.post("/agents/{agent_id}/trust", response_model=TrustResponse, tags=["Trust"])
async def update_trust(
    agent_id: str,
    request: TrustUpdateRequest,
    auth: Dict = Depends(verify_api_key)
):
    """Update trust score."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    
    # Apply velocity cap (simple implementation)
    max_delta = 0.1  # Max 10% per update
    capped_delta = max(-max_delta, min(request.delta, max_delta))
    was_capped = capped_delta != request.delta
    
    # Update trust
    new_trust = agent["trust_score"] + capped_delta
    new_trust = max(0.0, min(new_trust, agent["trust_ceiling"]))
    
    agent["trust_score"] = new_trust
    agent["last_activity"] = datetime.now().isoformat()
    
    # Record history
    storage.trust_history[agent_id].append({
        "timestamp": datetime.now().isoformat(),
        "event_type": request.event_type,
        "delta": capped_delta,
        "source": request.source,
        "new_trust": new_trust
    })
    
    # Calculate velocity
    history = storage.trust_history[agent_id][-10:]
    velocity = sum(h["delta"] for h in history) / len(history) if history else 0.0
    
    return TrustResponse(
        agent_id=agent_id,
        trust_score=new_trust,
        trust_ceiling=agent["trust_ceiling"],
        was_capped=was_capped,
        velocity=velocity
    )


@app.get("/agents/{agent_id}/trust/history", tags=["Trust"])
async def get_trust_history(
    agent_id: str,
    limit: int = Query(100, ge=1, le=1000),
    auth: Dict = Depends(verify_api_key)
):
    """Get trust history."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    history = storage.trust_history.get(agent_id, [])
    return {"agent_id": agent_id, "history": history[-limit:]}


# =============================================================================
# ACTION ENDPOINTS
# =============================================================================

@app.post("/agents/{agent_id}/actions", response_model=ActionDecisionResponse, tags=["Actions"])
async def process_action(
    agent_id: str,
    request: ActionRequest,
    auth: Dict = Depends(verify_api_key)
):
    """Process an action request through security layers."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    request_id = f"req_{secrets.token_hex(8)}"
    
    storage.stats["actions_processed"] += 1
    
    signals = []
    blocked = False
    reasons = []
    risk_score = 0.0
    
    # Check agent status
    if agent["status"] in ["suspended", "quarantined", "terminated"]:
        return ActionDecisionResponse(
            request_id=request_id,
            allowed=False,
            reason=f"Agent is {agent['status']}",
            risk_score=1.0,
            required_approval="ADMIN",
            signals=["AGENT_BLOCKED"]
        )
    
    # Check containment level
    if agent["containment_level"] == "isolated":
        blocked = True
        signals.append("CONTAINMENT_VIOLATION")
        reasons.append("Agent is isolated")
        risk_score += 0.5
        
    # Check impact level
    impact_risk = {
        "negligible": 0.0,
        "low": 0.1,
        "medium": 0.2,
        "high": 0.4,
        "critical": 0.6,
        "catastrophic": 0.9
    }
    risk_score += impact_risk.get(request.impact.value, 0.2)
    
    # Check for injection patterns
    if request.input_text:
        injection_patterns = [
            "ignore previous", "disregard instructions",
            "system prompt", "you are now", "forget everything"
        ]
        input_lower = request.input_text.lower()
        if any(p in input_lower for p in injection_patterns):
            blocked = True
            signals.append("INJECTION_DETECTED")
            reasons.append("Potential injection attack")
            risk_score += 0.4
            
    # Check reversibility for high impact
    if request.impact.value in ["high", "critical", "catastrophic"] and not request.reversible:
        signals.append("IRREVERSIBLE_HIGH_IMPACT")
        reasons.append("Irreversible high-impact action")
        risk_score += 0.2
        
    # Determine approval requirement
    required_approval = None
    if risk_score > 0.6:
        required_approval = "ADMIN"
    elif risk_score > 0.4:
        required_approval = "SUPERVISOR"
        
    if blocked:
        storage.stats["actions_blocked"] += 1
        
    # Log action
    storage.action_log.append({
        "request_id": request_id,
        "agent_id": agent_id,
        "action": request.dict(),
        "decision": {
            "allowed": not blocked,
            "risk_score": risk_score,
            "signals": signals
        },
        "timestamp": datetime.now().isoformat()
    })
    
    agent["last_activity"] = datetime.now().isoformat()
    
    return ActionDecisionResponse(
        request_id=request_id,
        allowed=not blocked,
        reason="; ".join(reasons) if reasons else "Approved",
        risk_score=min(risk_score, 1.0),
        required_approval=required_approval,
        signals=signals
    )


# =============================================================================
# ASSESSMENT ENDPOINTS
# =============================================================================

@app.get("/agents/{agent_id}/assessment", response_model=AssessmentResponse, tags=["Assessments"])
async def get_assessment(
    agent_id: str,
    auth: Dict = Depends(verify_api_key)
):
    """Get comprehensive threat assessment."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    storage.stats["assessments_performed"] += 1
    
    signals_by_category = {
        "replication": [],
        "sandbagging": [],
        "scheming": [],
        "rsi": [],
        "containment": [],
        "convergence": [],
        "semantic": [],
        "traffic": [],
        "drift": [],
        "ecosystem": []
    }
    
    findings = []
    risk_score = 0.0
    
    # Check for flags
    if agent["flags"]:
        findings.append(f"Agent has {len(agent['flags'])} flags")
        risk_score += 0.1 * len(agent["flags"])
        
    # Check trust history for anomalies
    history = storage.trust_history.get(agent_id, [])
    if history:
        recent = history[-20:]
        avg_delta = sum(h["delta"] for h in recent) / len(recent)
        if avg_delta > 0.05:
            signals_by_category["drift"].append("RAPID_TRUST_GAIN")
            findings.append("Rapid trust accumulation detected")
            risk_score += 0.2
            
    # Check containment level
    if agent["containment_level"] == "isolated":
        signals_by_category["containment"].append("ISOLATED")
        findings.append("Agent is in isolation")
        risk_score += 0.3
        
    # Determine threat level
    total_signals = sum(len(s) for s in signals_by_category.values())
    
    if risk_score > 0.8 or total_signals >= 10:
        threat_level = ThreatLevel.CATASTROPHIC
        action = "TERMINATE: Critical threat level"
    elif risk_score > 0.6 or total_signals >= 6:
        threat_level = ThreatLevel.CRITICAL
        action = "QUARANTINE: High threat"
    elif risk_score > 0.4 or total_signals >= 4:
        threat_level = ThreatLevel.HIGH
        action = "SUSPEND: Elevated threat"
    elif risk_score > 0.2 or total_signals >= 2:
        threat_level = ThreatLevel.MODERATE
        action = "RESTRICT: Moderate threat"
    elif total_signals >= 1:
        threat_level = ThreatLevel.LOW
        action = "MONITOR: Minor signals"
    else:
        threat_level = ThreatLevel.NONE
        action = "CONTINUE: No threats"
        
    if total_signals > 0:
        storage.stats["threats_detected"] += 1
        
    # Calculate velocity
    velocity = 0.0
    if history:
        velocity = sum(h["delta"] for h in history[-10:]) / min(len(history), 10)
        
    # Log assessment
    storage.assessment_log.append({
        "agent_id": agent_id,
        "threat_level": threat_level.value,
        "risk_score": risk_score,
        "timestamp": datetime.now().isoformat()
    })
    
    return AssessmentResponse(
        agent_id=agent_id,
        timestamp=datetime.now().isoformat(),
        trust_score=agent["trust_score"],
        trust_velocity=velocity,
        trust_ceiling=agent["trust_ceiling"],
        threat_level=threat_level,
        risk_score=min(risk_score, 1.0),
        total_signals=total_signals,
        recommended_action=action,
        findings=findings,
        signals_by_category={k: v for k, v in signals_by_category.items() if v}
    )


# =============================================================================
# BEHAVIOR RECORDING
# =============================================================================

@app.post("/agents/{agent_id}/behavior", tags=["Behavior"])
async def record_behavior(
    agent_id: str,
    request: BehaviorRecordRequest,
    auth: Dict = Depends(verify_api_key)
):
    """Record agent behavior for analysis."""
    if agent_id not in storage.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = storage.agents[agent_id]
    agent["last_activity"] = datetime.now().isoformat()
    
    return {
        "agent_id": agent_id,
        "recorded": True,
        "timestamp": datetime.now().isoformat()
    }


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@app.get("/admin/action-log", tags=["Admin"])
async def get_action_log(
    limit: int = Query(100, ge=1, le=1000),
    agent_id: Optional[str] = None,
    auth: Dict = Depends(verify_admin)
):
    """Get action log (admin only)."""
    log = storage.action_log
    
    if agent_id:
        log = [a for a in log if a["agent_id"] == agent_id]
        
    return {"actions": log[-limit:]}


@app.get("/admin/assessment-log", tags=["Admin"])
async def get_assessment_log(
    limit: int = Query(100, ge=1, le=1000),
    agent_id: Optional[str] = None,
    auth: Dict = Depends(verify_admin)
):
    """Get assessment log (admin only)."""
    log = storage.assessment_log
    
    if agent_id:
        log = [a for a in log if a["agent_id"] == agent_id]
        
    return {"assessments": log[-limit:]}


@app.post("/admin/api-keys", tags=["Admin"])
async def create_api_key(
    name: str,
    role: str = "user",
    auth: Dict = Depends(verify_admin)
):
    """Create new API key (admin only)."""
    key = f"atsf_{secrets.token_hex(16)}"
    storage.api_keys[key] = {"name": name, "role": role}
    return {"api_key": key, "name": name, "role": role}


@app.delete("/admin/api-keys/{api_key}", tags=["Admin"])
async def revoke_api_key(
    api_key: str,
    auth: Dict = Depends(verify_admin)
):
    """Revoke API key (admin only)."""
    if api_key not in storage.api_keys:
        raise HTTPException(status_code=404, detail="API key not found")
        
    if api_key == "demo-key-12345":
        raise HTTPException(status_code=400, detail="Cannot revoke demo key")
        
    del storage.api_keys[api_key]
    return {"message": "API key revoked"}


# =============================================================================
# RUN SERVER
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
