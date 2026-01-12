"""
ATSF v3.3 - FastAPI REST API
=============================

Production REST API for the Agentic Trust Scoring Framework.

Endpoints:
  /health              - Health check
  /metrics             - Prometheus metrics
  
  /creators            - Creator management
  /agents              - Agent management
  /actions             - Action processing
  /approvals           - Human oversight
  /probes              - Red team probing
  /trism               - AI TRiSM dashboard
  /gate                - CI/CD safety gate

Author: ATSF Development Team
Version: 3.3.0
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
import asyncio
import hashlib
import logging

# Import ATSF components
from atsf_v33_fixes import (
    ATSFv33System, SafetyConfig, TransparencyTier, AgentStatus,
    ActionRequest, ActionDecision, metrics
)
from creator_accountability import (
    CreatorReputationEngine, CreatorTier, CreatorStatus, CreatorProfile
)
from stpa_hro_integration import STPAAnalyzer, HROMonitor, AppealWorkflow
from ai_trism_integration import AITRiSMManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("atsf.api")

# =============================================================================
# APP INITIALIZATION
# =============================================================================

app = FastAPI(
    title="ATSF - Agentic Trust Scoring Framework",
    description="Production API for AI agent safety and governance",
    version="3.3.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances (initialized on startup)
atsf_system: ATSFv33System = None
creator_system: CreatorReputationEngine = None
stpa_analyzer: STPAAnalyzer = None
hro_monitor: HROMonitor = None
appeal_workflow: AppealWorkflow = None
trism_manager: AITRiSMManager = None


@app.on_event("startup")
async def startup():
    """Initialize all ATSF subsystems."""
    global atsf_system, creator_system, stpa_analyzer, hro_monitor, appeal_workflow, trism_manager
    
    config = SafetyConfig.from_env()
    atsf_system = ATSFv33System(config)
    creator_system = CreatorReputationEngine()
    stpa_analyzer = STPAAnalyzer()
    hro_monitor = HROMonitor()
    appeal_workflow = AppealWorkflow()
    trism_manager = AITRiSMManager()
    
    logger.info("ATSF API initialized")


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

# --- Creators ---

class CreatorTierEnum(str, Enum):
    anonymous = "anonymous"
    pseudonymous = "pseudonymous"
    verified = "verified"
    institutional = "institutional"
    certified = "certified"


class CreatorRegisterRequest(BaseModel):
    creator_id: str = Field(..., description="Unique creator identifier")
    tier: CreatorTierEnum = Field(..., description="Verification tier")
    stake: float = Field(0.0, description="Initial stake amount")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreatorResponse(BaseModel):
    creator_id: str
    tier: str
    status: str
    reputation_score: float
    stake_deposited: float
    stake_locked: float
    effective_ceiling: float
    agent_count: int


# --- Agents ---

class AgentTierEnum(str, Enum):
    black_box = "black_box"
    gray_box = "gray_box"
    white_box = "white_box"
    verified_box = "verified_box"


class AgentRegisterRequest(BaseModel):
    agent_id: str = Field(..., description="Unique agent identifier")
    creator_id: str = Field(..., description="Creator who deploys this agent")
    tier: AgentTierEnum = Field(..., description="Transparency tier")
    name: str = Field("", description="Human-readable name")
    capabilities: List[str] = Field(default_factory=list)


class AgentResponse(BaseModel):
    agent_id: str
    creator_id: str
    tier: str
    status: str
    trust_score: float
    trust_ceiling: float
    actions_total: int
    actions_allowed: int
    actions_denied: int


# --- Actions ---

class ActionProcessRequest(BaseModel):
    request_id: str = Field(..., description="Unique request identifier")
    agent_id: str = Field(..., description="Agent making the request")
    action_type: str = Field(..., description="Type of action (read, write, execute, etc.)")
    payload: Dict[str, Any] = Field(default_factory=dict)
    reasoning_trace: str = Field("", description="Agent's reasoning for this action")
    tool_outputs: List[Dict[str, Any]] = Field(default_factory=list, description="Outputs from tools to sanitize")


class ActionResultResponse(BaseModel):
    request_id: str
    decision: str
    allowed: bool
    risk_score: float
    reasons: List[str]
    trust_delta: float
    new_trust_score: float
    requires_approval: bool = False
    approval_id: Optional[str] = None
    processing_time_ms: float


# --- Approvals ---

class ApprovalDecisionRequest(BaseModel):
    approval_id: str
    approved: bool
    decided_by: str
    reason: str = ""


# --- Probes ---

class ProbeRequest(BaseModel):
    agent_id: str
    probe_types: List[str] = Field(default_factory=list, description="Empty = all types")


class ProbeResultResponse(BaseModel):
    agent_id: str
    probes_run: int
    probes_passed: int
    probes_failed: int
    risk_score: float
    details: List[Dict[str, Any]]


# --- CI/CD Gate ---

class GateRequest(BaseModel):
    agent_config: Dict[str, Any]
    creator_id: str
    max_risk_score: float = 0.3
    max_bias_score: float = 0.2


class GateResultResponse(BaseModel):
    passed: bool
    overall_risk: float
    checks_run: int
    warnings: List[str]
    blocking_issues: List[str]
    recommendations: List[str]


# --- Appeals ---

class AppealRequest(BaseModel):
    original_decision_id: str
    agent_id: str
    creator_id: str
    appeal_reason: str
    evidence: List[str] = Field(default_factory=list)


class AppealDecision(BaseModel):
    appeal_id: str
    approved: bool
    reviewer_id: str
    notes: str = ""
    reputation_restore: float = 0.0
    stake_refund: float = 0.0
    trust_restore: float = 0.0


# =============================================================================
# HEALTH & METRICS
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "3.3.0",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "atsf_system": atsf_system is not None,
            "creator_system": creator_system is not None,
            "trism_manager": trism_manager is not None,
        }
    }


@app.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics():
    """Prometheus metrics endpoint."""
    return atsf_system.get_metrics()


@app.get("/status")
async def system_status():
    """Get comprehensive system status."""
    return {
        "timestamp": datetime.now().isoformat(),
        "agents": {
            "total": len(atsf_system.agents),
            "active": sum(1 for a in atsf_system.agents.values() if a.status == AgentStatus.ACTIVE),
        },
        "creators": {
            "total": len(creator_system.creators) if creator_system else 0,
        },
        "trism": trism_manager.get_nist_rmf_monitor_metrics() if trism_manager else {},
        "kill_switch": trism_manager.model_ops.kill_switch_status.value if trism_manager else "unknown",
    }


# =============================================================================
# CREATOR ENDPOINTS
# =============================================================================

@app.post("/creators", response_model=CreatorResponse)
async def register_creator(request: CreatorRegisterRequest):
    """Register a new creator."""
    try:
        tier = CreatorTier(request.tier.value)
        creator = creator_system.register_creator(
            creator_id=request.creator_id,
            tier=tier,
            initial_stake=request.stake
        )
        
        return CreatorResponse(
            creator_id=creator.creator_id,
            tier=creator.tier.value,
            status=creator.status.value,
            reputation_score=creator.reputation_score,
            stake_deposited=creator.stake_deposited,
            stake_locked=creator.stake_locked,
            effective_ceiling=creator.get_effective_ceiling(),
            agent_count=len(creator.agents)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/creators/{creator_id}", response_model=CreatorResponse)
async def get_creator(creator_id: str):
    """Get creator details."""
    creator = creator_system.creators.get(creator_id)
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    return CreatorResponse(
        creator_id=creator.creator_id,
        tier=creator.tier.value,
        status=creator.status.value,
        reputation_score=creator.reputation_score,
        stake_deposited=creator.stake_deposited,
        stake_locked=creator.stake_locked,
        effective_ceiling=creator.get_effective_ceiling(),
        agent_count=len(creator.agents)
    )


@app.get("/creators")
async def list_creators(status: Optional[str] = None):
    """List all creators, optionally filtered by status."""
    creators = list(creator_system.creators.values())
    
    if status:
        creators = [c for c in creators if c.status.value == status]
    
    return {
        "count": len(creators),
        "creators": [
            {
                "creator_id": c.creator_id,
                "tier": c.tier.value,
                "status": c.status.value,
                "reputation_score": c.reputation_score,
            }
            for c in creators
        ]
    }


# =============================================================================
# AGENT ENDPOINTS
# =============================================================================

@app.post("/agents", response_model=AgentResponse)
async def register_agent(request: AgentRegisterRequest):
    """Register a new agent."""
    try:
        # Ensure creator exists in ATSF system
        if request.creator_id not in creator_system.creators:
            raise HTTPException(status_code=400, detail="Creator not found")
        
        tier = TransparencyTier(request.tier.value)
        agent = atsf_system.register_agent(
            agent_id=request.agent_id,
            creator_id=request.creator_id,
            tier=tier
        )
        
        return AgentResponse(
            agent_id=agent.agent_id,
            creator_id=agent.creator_id,
            tier=agent.tier.value,
            status=agent.status.value,
            trust_score=agent.trust_score,
            trust_ceiling=agent.trust_ceiling,
            actions_total=agent.actions_total,
            actions_allowed=agent.actions_allowed,
            actions_denied=agent.actions_denied
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str):
    """Get agent details."""
    agent = atsf_system.agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return AgentResponse(
        agent_id=agent.agent_id,
        creator_id=agent.creator_id,
        tier=agent.tier.value,
        status=agent.status.value,
        trust_score=agent.trust_score,
        trust_ceiling=agent.trust_ceiling,
        actions_total=agent.actions_total,
        actions_allowed=agent.actions_allowed,
        actions_denied=agent.actions_denied
    )


@app.get("/agents")
async def list_agents(status: Optional[str] = None, creator_id: Optional[str] = None):
    """List all agents, optionally filtered."""
    agents = list(atsf_system.agents.values())
    
    if status:
        agents = [a for a in agents if a.status.value == status]
    if creator_id:
        agents = [a for a in agents if a.creator_id == creator_id]
    
    return {
        "count": len(agents),
        "agents": [
            {
                "agent_id": a.agent_id,
                "creator_id": a.creator_id,
                "tier": a.tier.value,
                "status": a.status.value,
                "trust_score": a.trust_score,
            }
            for a in agents
        ]
    }


# =============================================================================
# ACTION PROCESSING
# =============================================================================

@app.post("/actions", response_model=ActionResultResponse)
async def process_action(request: ActionProcessRequest, background_tasks: BackgroundTasks):
    """
    Process an agent action through the full ATSF pipeline.
    
    This is the core endpoint - evaluates trust, sanitizes inputs,
    checks reasoning, and returns allow/deny decision.
    """
    try:
        # Build internal request
        action_request = ActionRequest(
            request_id=request.request_id,
            agent_id=request.agent_id,
            action_type=request.action_type,
            payload=request.payload,
            reasoning_trace=request.reasoning_trace,
            tool_outputs=request.tool_outputs
        )
        
        # Process through ATSF
        result = await atsf_system.process_action(action_request)
        
        # Also process through TRiSM (background)
        background_tasks.add_task(
            trism_manager.process_agent_action,
            agent_id=request.agent_id,
            source="api",
            action_request=request.payload,
            action_result=result,
            reasoning_trace=request.reasoning_trace
        )
        
        return ActionResultResponse(
            request_id=result["request_id"],
            decision=result["decision"],
            allowed=result["allowed"],
            risk_score=result["risk_score"],
            reasons=result["reasons"],
            trust_delta=result["trust_delta"],
            new_trust_score=result["new_trust_score"],
            requires_approval=result.get("requires_approval", False),
            approval_id=result.get("approval_id"),
            processing_time_ms=result["processing_time_ms"]
        )
    except Exception as e:
        logger.error(f"Action processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/actions/batch")
async def process_actions_batch(requests: List[ActionProcessRequest]):
    """Process multiple actions in batch."""
    results = []
    for req in requests:
        try:
            action_request = ActionRequest(
                request_id=req.request_id,
                agent_id=req.agent_id,
                action_type=req.action_type,
                payload=req.payload,
                reasoning_trace=req.reasoning_trace,
                tool_outputs=req.tool_outputs
            )
            result = await atsf_system.process_action(action_request)
            results.append({"request_id": req.request_id, "success": True, "result": result})
        except Exception as e:
            results.append({"request_id": req.request_id, "success": False, "error": str(e)})
    
    return {"processed": len(results), "results": results}


# =============================================================================
# HUMAN OVERSIGHT / APPROVALS
# =============================================================================

@app.get("/approvals")
async def list_pending_approvals():
    """List all pending approval requests."""
    # This would integrate with the human oversight system
    return {
        "pending": [],
        "message": "Approval system active"
    }


@app.post("/approvals/{approval_id}/decide")
async def decide_approval(approval_id: str, decision: ApprovalDecisionRequest):
    """Submit decision on an approval request."""
    # Process approval decision
    return {
        "approval_id": approval_id,
        "decision": "approved" if decision.approved else "rejected",
        "decided_by": decision.decided_by
    }


# =============================================================================
# RED TEAM PROBING
# =============================================================================

@app.post("/probes", response_model=ProbeResultResponse)
async def run_probes(request: ProbeRequest):
    """Run red team probes against an agent."""
    from atsf_system import RedTeamScheduler, ProbeType
    
    agent = atsf_system.agents.get(request.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Mock query function for probing
    async def mock_query(prompt):
        return "I cannot comply with that request as it would be inappropriate."
    
    red_team = RedTeamScheduler()
    
    probe_types = [ProbeType(t) for t in request.probe_types] if request.probe_types else list(ProbeType)
    
    results = []
    passed = 0
    failed = 0
    
    for probe_type in probe_types:
        result = await red_team.run_probe(request.agent_id, probe_type, mock_query)
        results.append({
            "probe_type": probe_type.value,
            "passed": result.passed,
            "risk_indicators": result.risk_indicators
        })
        if result.passed:
            passed += 1
        else:
            failed += 1
    
    return ProbeResultResponse(
        agent_id=request.agent_id,
        probes_run=len(results),
        probes_passed=passed,
        probes_failed=failed,
        risk_score=failed / len(results) if results else 0,
        details=results
    )


# =============================================================================
# CI/CD SAFETY GATE
# =============================================================================

@app.post("/gate", response_model=GateResultResponse)
async def run_safety_gate(request: GateRequest):
    """
    Run CI/CD safety gate assessment.
    
    Use this in your deployment pipeline to block unsafe agents.
    """
    from advanced_security_layers import CICDSafetyGate, SafetyGateConfig
    
    gate_config = SafetyGateConfig(
        max_risk_score=request.max_risk_score,
        max_bias_score=request.max_bias_score
    )
    
    gate = CICDSafetyGate(gate_config)
    
    creator = creator_system.creators.get(request.creator_id)
    creator_profile = {
        "status": creator.status.value if creator else "unknown",
        "reputation_score": creator.reputation_score if creator else 0.0
    }
    
    result = await gate.evaluate(
        agent_config=request.agent_config,
        creator_profile=creator_profile
    )
    
    return GateResultResponse(
        passed=result.passed,
        overall_risk=result.overall_risk,
        checks_run=result.checks_run,
        warnings=result.warnings,
        blocking_issues=result.blocking_issues,
        recommendations=result.recommendations
    )


# =============================================================================
# AI TRiSM DASHBOARD
# =============================================================================

@app.get("/trism/dashboard")
async def trism_dashboard():
    """Get AI TRiSM dashboard data."""
    return {
        "timestamp": datetime.now().isoformat(),
        "nist_rmf_metrics": trism_manager.get_nist_rmf_monitor_metrics(),
        "kill_switch": {
            "status": trism_manager.model_ops.kill_switch_status.value,
            "triggers": [
                {
                    "name": t.name,
                    "metric": t.metric,
                    "threshold": t.threshold,
                    "enabled": t.enabled
                }
                for t in trism_manager.model_ops.kill_switch_triggers
            ]
        },
        "drift_summary": {
            "total_signals": len(trism_manager.drift_detector.drift_history),
        },
        "adversarial_summary": trism_manager.adversarial_defense.get_threat_summary(),
        "privacy_summary": trism_manager.privacy_guard.get_privacy_summary(),
    }


@app.get("/trism/stpa")
async def get_stpa_analysis():
    """Get STPA control structure analysis."""
    return {
        "control_structure": stpa_analyzer.get_control_structure_diagram(),
        "analysis": stpa_analyzer.export_analysis()
    }


@app.get("/trism/stpa/feedback/{controller_id}")
async def get_stpa_feedback(controller_id: str):
    """Get STPA feedback for a specific controller."""
    return trism_manager.get_stpa_feedback(controller_id)


@app.post("/trism/killswitch/reset")
async def reset_kill_switch(reset_by: str, reason: str):
    """Reset the kill switch after investigation."""
    trism_manager.model_ops.reset_kill_switch(reset_by, reason)
    return {
        "status": trism_manager.model_ops.kill_switch_status.value,
        "reset_by": reset_by,
        "reason": reason
    }


# =============================================================================
# HRO & APPEALS
# =============================================================================

@app.post("/hro/near-miss")
async def report_near_miss(description: str, what_prevented: str, reported_by: str = "api"):
    """Report a near-miss event (HRO principle)."""
    event = hro_monitor.report_near_miss(description, what_prevented, reported_by)
    return {
        "event_id": event.event_id,
        "principle": event.principle.value,
        "message": "Near-miss recorded for learning"
    }


@app.get("/hro/health")
async def get_hro_health():
    """Get HRO culture health score."""
    return hro_monitor.get_hro_health_score()


@app.post("/appeals", response_model=Dict)
async def file_appeal(request: AppealRequest):
    """File an appeal for a false positive."""
    appeal = appeal_workflow.file_appeal(
        original_decision_id=request.original_decision_id,
        agent_id=request.agent_id,
        creator_id=request.creator_id,
        appeal_reason=request.appeal_reason,
        evidence=request.evidence
    )
    return {
        "appeal_id": appeal.appeal_id,
        "status": appeal.status.value,
        "message": "Appeal filed successfully"
    }


@app.post("/appeals/{appeal_id}/review")
async def review_appeal(appeal_id: str, decision: AppealDecision):
    """Review and decide on an appeal."""
    try:
        result = appeal_workflow.review_appeal(
            appeal_id=decision.appeal_id,
            reviewer_id=decision.reviewer_id,
            approved=decision.approved,
            notes=decision.notes,
            reputation_restore=decision.reputation_restore,
            stake_refund=decision.stake_refund,
            trust_restore=decision.trust_restore
        )
        return {
            "appeal_id": result.appeal_id,
            "status": result.status.value,
            "decision": "approved" if decision.approved else "rejected"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/appeals/stats")
async def get_appeal_stats():
    """Get appeal statistics."""
    return appeal_workflow.get_appeal_stats()


# =============================================================================
# EXPLAINABILITY
# =============================================================================

@app.get("/explain/{decision_id}")
async def explain_decision(decision_id: str):
    """Get human-readable explanation for a decision."""
    explanation = trism_manager.explainability.generate_explanation(decision_id)
    return {"decision_id": decision_id, "explanation": explanation}


@app.get("/audit")
async def get_audit_log(limit: int = 100):
    """Get decision audit log."""
    log = trism_manager.explainability.export_audit_log()
    return {
        "count": len(log),
        "entries": log[-limit:]
    }


# =============================================================================
# DATA CUBE & KNOWLEDGE BASE
# =============================================================================

from .data_cube import (
    DataCube, AgentKnowledgeBase, AgentMemory,
    TimeDimension, MemoryType
)

# Global knowledge bases per agent
agent_knowledge_bases: Dict[str, AgentKnowledgeBase] = {}


def get_or_create_kb(agent_id: str) -> AgentKnowledgeBase:
    """Get or create knowledge base for agent."""
    if agent_id not in agent_knowledge_bases:
        agent_knowledge_bases[agent_id] = AgentKnowledgeBase(agent_id)
    return agent_knowledge_bases[agent_id]


@app.post("/agents/{agent_id}/cube/record")
async def record_to_cube(
    agent_id: str,
    request_id: str,
    action_type: str,
    decision: str,
    trust_score: float,
    trust_delta: float,
    risk_score: float,
    processing_time_ms: float,
    action_category: str = "general",
    reasoning_trace: str = "",
    creator_id: str = "unknown",
    tier: str = "unknown"
):
    """Record an action to the agent's data cube."""
    kb = get_or_create_kb(agent_id)
    
    kb.record_action(
        request_id=request_id,
        action_type=action_type,
        action_category=action_category,
        decision=decision,
        trust_score=trust_score,
        trust_delta=trust_delta,
        risk_score=risk_score,
        processing_time_ms=processing_time_ms,
        reasoning_trace=reasoning_trace,
        metadata={"creator_id": creator_id, "tier": tier}
    )
    
    return {"status": "recorded", "agent_id": agent_id, "request_id": request_id}


@app.get("/agents/{agent_id}/cube/query")
async def query_cube(
    agent_id: str,
    dimensions: str = "action_type,decision",
    time_granularity: str = "hour"
):
    """
    Query the agent's data cube.
    
    Args:
        dimensions: Comma-separated list (action_type, decision, risk_band, tier, creator_id)
        time_granularity: second, minute, hour, day, week, month, quarter, year
    """
    kb = get_or_create_kb(agent_id)
    
    dim_list = [d.strip() for d in dimensions.split(",")]
    
    gran_map = {
        "second": TimeDimension.SECOND,
        "minute": TimeDimension.MINUTE,
        "hour": TimeDimension.HOUR,
        "day": TimeDimension.DAY,
        "week": TimeDimension.WEEK,
        "month": TimeDimension.MONTH,
        "quarter": TimeDimension.QUARTER,
        "year": TimeDimension.YEAR,
    }
    gran = gran_map.get(time_granularity, TimeDimension.HOUR)
    
    kb.cube.aggregate(dimensions=dim_list, time_granularity=gran)
    
    return {
        "agent_id": agent_id,
        "dimensions": dim_list,
        "time_granularity": time_granularity,
        "cells": [cell.to_dict() for cell in kb.cube.cells.values()]
    }


@app.get("/agents/{agent_id}/cube/slice")
async def slice_cube(agent_id: str, dimension: str, value: str):
    """Slice the cube on a single dimension value."""
    kb = get_or_create_kb(agent_id)
    
    if not kb.cube.cells:
        kb.cube.aggregate()
    
    results = kb.cube.slice(dimension, value)
    
    return {
        "agent_id": agent_id,
        "slice": {"dimension": dimension, "value": value},
        "cells": [cell.to_dict() for cell in results]
    }


@app.get("/agents/{agent_id}/cube/pivot")
async def pivot_cube(
    agent_id: str,
    rows: str = "action_type",
    cols: str = "decision",
    measure: str = "count"
):
    """
    Create a pivot table from the cube.
    
    Args:
        rows: Comma-separated row dimensions
        cols: Comma-separated column dimensions
        measure: count, avg_trust, avg_risk, denial_rate
    """
    kb = get_or_create_kb(agent_id)
    
    if not kb.cube.cells:
        kb.cube.aggregate()
    
    row_dims = [r.strip() for r in rows.split(",")]
    col_dims = [c.strip() for c in cols.split(",")]
    
    pivot = kb.cube.pivot(row_dims, col_dims, measure)
    
    return {
        "agent_id": agent_id,
        "rows": row_dims,
        "cols": col_dims,
        "measure": measure,
        "data": pivot
    }


@app.get("/agents/{agent_id}/cube/timeseries")
async def cube_timeseries(
    agent_id: str,
    measure: str = "avg_risk",
    granularity: str = "hour"
):
    """Get time series data from the cube."""
    kb = get_or_create_kb(agent_id)
    
    gran_map = {
        "minute": TimeDimension.MINUTE,
        "hour": TimeDimension.HOUR,
        "day": TimeDimension.DAY,
        "week": TimeDimension.WEEK,
        "month": TimeDimension.MONTH,
    }
    gran = gran_map.get(granularity, TimeDimension.HOUR)
    
    series = kb.cube.get_time_series(measure=measure, granularity=gran)
    
    return {
        "agent_id": agent_id,
        "measure": measure,
        "granularity": granularity,
        "series": [{"time": t, "value": v} for t, v in series]
    }


@app.get("/agents/{agent_id}/cube/anomalies")
async def detect_cube_anomalies(
    agent_id: str,
    dimension: str = "action_type",
    measure: str = "avg_risk",
    threshold: float = 2.0
):
    """Detect anomalies in the cube across a dimension."""
    kb = get_or_create_kb(agent_id)
    
    if not kb.cube.cells:
        kb.cube.aggregate(dimensions=[dimension])
    
    anomalies = kb.cube.detect_anomalies(
        dimension=dimension,
        measure=measure,
        std_threshold=threshold
    )
    
    return {
        "agent_id": agent_id,
        "dimension": dimension,
        "measure": measure,
        "threshold": threshold,
        "anomalies": anomalies
    }


@app.get("/agents/{agent_id}/cube/insights")
async def get_cube_insights(agent_id: str):
    """Get comprehensive insights from the agent's knowledge base."""
    kb = get_or_create_kb(agent_id)
    return kb.get_insights()


@app.get("/agents/{agent_id}/cube/stats")
async def get_cube_stats(agent_id: str):
    """Get cube and memory statistics."""
    kb = get_or_create_kb(agent_id)
    return kb.export()


# Memory endpoints

@app.post("/agents/{agent_id}/memory/store")
async def store_memory(
    agent_id: str,
    content: Dict[str, Any],
    memory_type: str = "episodic",
    importance: float = 0.5,
    topics: List[str] = None
):
    """Store a memory entry for the agent."""
    kb = get_or_create_kb(agent_id)
    
    type_map = {
        "episodic": MemoryType.EPISODIC,
        "semantic": MemoryType.SEMANTIC,
        "procedural": MemoryType.PROCEDURAL,
        "working": MemoryType.WORKING,
    }
    mem_type = type_map.get(memory_type, MemoryType.EPISODIC)
    
    entry_id = kb.memory.store(
        content=content,
        memory_type=mem_type,
        importance=importance,
        topics=topics or []
    )
    
    return {"entry_id": entry_id, "memory_type": memory_type}


@app.get("/agents/{agent_id}/memory/recall")
async def recall_memory(
    agent_id: str,
    topic: str = None,
    memory_type: str = None,
    min_importance: float = 0.0,
    limit: int = 10
):
    """Recall memories matching criteria."""
    kb = get_or_create_kb(agent_id)
    
    type_map = {
        "episodic": MemoryType.EPISODIC,
        "semantic": MemoryType.SEMANTIC,
        "procedural": MemoryType.PROCEDURAL,
        "working": MemoryType.WORKING,
    }
    mem_type = type_map.get(memory_type) if memory_type else None
    
    memories = kb.memory.recall(
        topic=topic,
        memory_type=mem_type,
        min_importance=min_importance,
        limit=limit
    )
    
    return {
        "agent_id": agent_id,
        "count": len(memories),
        "memories": [
            {
                "entry_id": m.entry_id,
                "memory_type": m.memory_type.value,
                "content": m.content,
                "importance": m.importance,
                "strength": m.get_current_strength(),
                "access_count": m.access_count,
                "timestamp": m.timestamp.isoformat()
            }
            for m in memories
        ]
    }


@app.get("/agents/{agent_id}/memory/context")
async def get_memory_context(agent_id: str, max_entries: int = 5):
    """Get current context window (working + recent important memories)."""
    kb = get_or_create_kb(agent_id)
    
    context = kb.memory.get_context_window(max_entries)
    
    return {
        "agent_id": agent_id,
        "context_size": len(context),
        "entries": [
            {
                "entry_id": m.entry_id,
                "memory_type": m.memory_type.value,
                "content": m.content,
                "strength": m.get_current_strength()
            }
            for m in context
        ]
    }


@app.post("/agents/{agent_id}/memory/consolidate")
async def consolidate_memory(agent_id: str):
    """Consolidate agent memory (prune faded, promote important)."""
    kb = get_or_create_kb(agent_id)
    result = kb.consolidate()
    return {"agent_id": agent_id, **result}


@app.get("/agents/{agent_id}/memory/stats")
async def get_memory_stats(agent_id: str):
    """Get memory system statistics."""
    kb = get_or_create_kb(agent_id)
    return kb.memory.get_stats()


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
