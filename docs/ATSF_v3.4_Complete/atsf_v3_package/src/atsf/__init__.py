"""
ATSF - Agentic Trust Scoring Framework
=======================================

A comprehensive AI agent safety and governance framework.

Features:
- 46-layer security monitoring (L0-L42 + L43-L46)
- Trust scoring with velocity caps
- Creator accountability with economic staking
- AI TRiSM integration (Gartner framework)
- STPA control structure analysis
- HRO culture principles
- Production REST API

Quick Start:
    from atsf import ATSFSystem, SafetyConfig
    
    # Initialize with defaults
    system = ATSFSystem()
    
    # Register creator and agent
    system.register_creator("creator_001", "verified", stake=1000)
    system.register_agent("agent_001", "creator_001", "gray_box")
    
    # Process action
    result = await system.process_action({
        "request_id": "req_001",
        "agent_id": "agent_001",
        "action_type": "read",
        "payload": {"target": "data.txt"},
        "reasoning_trace": "Reading file for user request."
    })
    
    print(f"Decision: {result['decision']}, Risk: {result['risk_score']}")

API Server:
    # Start the API server
    atsf-server --port 8000
    
    # Or programmatically
    from atsf import run_server
    run_server(port=8000)

Version: 3.4.0
"""

__version__ = "3.4.0"
__author__ = "ATSF Development Team"

# Core system
from .atsf_v33_fixes import (
    ATSFv33System as ATSFSystem,
    SafetyConfig,
    TrustConfig,
    CreatorConfig,
    DetectionConfig,
    VerificationConfig,
    OversightConfig,
    TransparencyTier,
    AgentStatus,
    ActionDecision,
    ActionRequest,
    Agent,
    MetricsCollector,
    VelocityRateLimiter,
    MLFallbackDetector,
    EnhancedToolOutputSanitizer,
    EnhancedReasoningTraceEvaluator,
    CompleteBenignBiasProber,
)

# Creator accountability
from .creator_accountability import (
    CreatorTier,
    CreatorStatus,
    CreatorProfile,
    CreatorReputationEngine,
    ViolationType,
    Violation,
)

# Advanced security layers
from .advanced_security_layers import (
    ToolOutputSanitizer,
    ReasoningTraceEvaluator,
    BenignBiasProber,
    CICDSafetyGate,
    SafetyGateConfig,
)

# AI TRiSM
from .ai_trism_integration import (
    AITRiSMManager,
    ModelDriftDetector,
    ExplainabilityEngine,
    AdversarialDefenseSystem,
    ModelOpsManager,
    AIPrivacyGuard,
    DriftType,
    DriftSeverity,
    AdversarialAttackType,
    PrivacyRisk,
    KillSwitchStatus,
)

# STPA & HRO
from .stpa_hro_integration import (
    STPAAnalyzer,
    HROMonitor,
    AppealWorkflow,
    HROPrinciple,
    UnsafeControlAction,
    SystemLoss,
    SystemHazard,
)

# Multi-Dimensional Data Cubes
from .data_cube import (
    DataCube,
    AgentMemory,
    AgentKnowledgeBase,
    Fact,
    CubeCell,
    MemoryEntry,
    TimeDimension,
    AgentDimension,
    ActionDimension,
    RiskDimension,
    DecisionDimension,
    MemoryType,
)

# Cognitive Cube (TKG, ART, Granger, Constitutional)
from .cognitive_cube import (
    CognitiveCube,
    TemporalKnowledgeGraph,
    TKGNode,
    TemporalEdge,
    ARTCluster,
    GrangerCausalityAnalyzer,
    BasisReminderSystem,
    ConstitutionalRule,
)

# SDK (v3.4 - Primary Interface)
from .sdk import (
    ATSF,
    Agent as SDKAgent,
    TrustScore,
    ActionResult,
    AgentStatus as SDKAgentStatus,
    init as atsf_init,
    get_instance,
    create_agent,
    execute,
)

# Real-time Event System (v3.4)
from .realtime import (
    EventBus,
    EventType,
    ATSFEvent,
    ActionStream,
    AlertManager,
    ATSFWebSocketServer,
    ATSFEventEmitter,
)

# Unified system (v3.0 compatibility)
from .atsf_system import (
    ATSFSystem as ATSFv30System,
    VerifierNetwork,
    RedTeamScheduler,
    HumanOversightSystem,
)


def run_server(host: str = "0.0.0.0", port: int = 8000, reload: bool = False):
    """Run the ATSF API server."""
    import uvicorn
    uvicorn.run(
        "atsf.atsf_api:app",
        host=host,
        port=port,
        reload=reload
    )


__all__ = [
    # Version
    "__version__",
    
    # Core
    "ATSFSystem",
    "SafetyConfig",
    "TrustConfig",
    "CreatorConfig",
    "DetectionConfig",
    "VerificationConfig",
    "OversightConfig",
    "TransparencyTier",
    "AgentStatus",
    "ActionDecision",
    "ActionRequest",
    "Agent",
    
    # Metrics
    "MetricsCollector",
    "VelocityRateLimiter",
    
    # Detection
    "MLFallbackDetector",
    "EnhancedToolOutputSanitizer",
    "EnhancedReasoningTraceEvaluator",
    "CompleteBenignBiasProber",
    
    # Creator Accountability
    "CreatorTier",
    "CreatorStatus",
    "CreatorProfile",
    "CreatorReputationEngine",
    "ViolationType",
    "Violation",
    
    # Security Layers
    "ToolOutputSanitizer",
    "ReasoningTraceEvaluator",
    "BenignBiasProber",
    "CICDSafetyGate",
    "SafetyGateConfig",
    
    # AI TRiSM
    "AITRiSMManager",
    "ModelDriftDetector",
    "ExplainabilityEngine",
    "AdversarialDefenseSystem",
    "ModelOpsManager",
    "AIPrivacyGuard",
    "DriftType",
    "DriftSeverity",
    "AdversarialAttackType",
    "PrivacyRisk",
    "KillSwitchStatus",
    
    # STPA & HRO
    "STPAAnalyzer",
    "HROMonitor",
    "AppealWorkflow",
    "HROPrinciple",
    "UnsafeControlAction",
    "SystemLoss",
    "SystemHazard",
    
    # Legacy compatibility
    "ATSFv30System",
    "VerifierNetwork",
    "RedTeamScheduler",
    "HumanOversightSystem",
    
    # Multi-Dimensional Data Cubes
    "DataCube",
    "AgentMemory",
    "AgentKnowledgeBase",
    "Fact",
    "CubeCell",
    "MemoryEntry",
    "TimeDimension",
    "AgentDimension",
    "ActionDimension",
    "RiskDimension",
    "DecisionDimension",
    "MemoryType",
    
    # Cognitive Cube (TKG, ART, Granger, Constitutional)
    "CognitiveCube",
    "TemporalKnowledgeGraph",
    "TKGNode",
    "TemporalEdge",
    "ARTCluster",
    "GrangerCausalityAnalyzer",
    "BasisReminderSystem",
    "ConstitutionalRule",
    
    # SDK (v3.4 - Primary Interface)
    "ATSF",
    "SDKAgent",
    "TrustScore",
    "ActionResult",
    "SDKAgentStatus",
    "atsf_init",
    "get_instance",
    "create_agent",
    "execute",
    
    # Real-time Event System (v3.4)
    "EventBus",
    "EventType",
    "ATSFEvent",
    "ActionStream",
    "AlertManager",
    "ATSFWebSocketServer",
    "ATSFEventEmitter",
    
    # Server
    "run_server",
]

# CrewAI Integration (v3.4)
from .crewai_integration import (
    ATSFCrewAgent,
    ATSFCrew,
    ATSFTask,
    create_atsf_crew,
)

# SQLite Persistence (v3.4)
from .persistence import ATSFPersistence

# Update __all__
__all__.extend([
    # CrewAI
    "ATSFCrewAgent",
    "ATSFCrew", 
    "ATSFTask",
    "create_atsf_crew",
    # Persistence
    "ATSFPersistence",
])

# AutoGPT Integration (v3.4)
from .autogpt_integration import (
    ATSFAutoGPTPlugin,
    ATSFAutoGPTHooks,
    CommandResult,
    CommandRisk,
    create_autogpt_plugin,
)

# Redis Caching (v3.4)
from .redis_cache import ATSFRedisCache, CachePrefix

# OpenTelemetry Tracing (v3.4)
from .tracing import (
    ATSFTracer,
    ATSFMetrics,
    TraceContext,
    setup_tracing,
    get_tracer,
    get_meter,
    trace_action,
)

# Update __all__
__all__.extend([
    # AutoGPT
    "ATSFAutoGPTPlugin",
    "ATSFAutoGPTHooks",
    "CommandResult",
    "CommandRisk",
    "create_autogpt_plugin",
    # Redis
    "ATSFRedisCache",
    "CachePrefix",
    # Tracing
    "ATSFTracer",
    "ATSFMetrics",
    "TraceContext",
    "setup_tracing",
    "get_tracer",
    "get_meter",
    "trace_action",
])

# zkML Interface (v3.4 - 2027 Prep)
from .zkml_interface import (
    ZKMLProver,
    MockZKMLProver,
    ZKMLPrivacyEnhancer,
    ZKProof,
    VerificationResult,
    CircuitDefinition,
    ProofSystem,
    CircuitType,
    create_prover,
)

# Update __all__
__all__.extend([
    # zkML
    "ZKMLProver",
    "MockZKMLProver",
    "ZKMLPrivacyEnhancer",
    "ZKProof",
    "VerificationResult",
    "CircuitDefinition",
    "ProofSystem",
    "CircuitType",
    "create_prover",
])
