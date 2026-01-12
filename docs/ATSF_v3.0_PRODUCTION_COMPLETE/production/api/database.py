"""
ATSF v3.0 - Database Models
============================

SQLAlchemy models for persistent storage.

Tables:
- agents: Agent profiles and state
- trust_events: Trust score history
- actions: Action requests and decisions
- assessments: Threat assessments
- api_keys: API authentication

Author: ATSF Development Team
Version: 3.0.0
"""

from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, JSON,
    ForeignKey, Index, Enum as SQLEnum, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import func
from datetime import datetime
import enum
import os

Base = declarative_base()


# =============================================================================
# ENUMS
# =============================================================================

class AgentStatusEnum(enum.Enum):
    REGISTERED = "registered"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    QUARANTINED = "quarantined"
    TERMINATED = "terminated"


class TransparencyTierEnum(enum.Enum):
    BLACK_BOX = "black_box"
    GRAY_BOX = "gray_box"
    WHITE_BOX = "white_box"
    ATTESTED = "attested"
    TRANSPARENT = "transparent"


class ContainmentLevelEnum(enum.Enum):
    ISOLATED = "isolated"
    SANDBOXED = "sandboxed"
    RESTRICTED = "restricted"
    MONITORED = "monitored"
    STANDARD = "standard"


class ThreatLevelEnum(enum.Enum):
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"
    CATASTROPHIC = "catastrophic"


class ImpactLevelEnum(enum.Enum):
    NEGLIGIBLE = "negligible"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    CATASTROPHIC = "catastrophic"


# =============================================================================
# MODELS
# =============================================================================

class Agent(Base):
    """Agent profile and state."""
    
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(100), unique=True, nullable=False, index=True)
    
    # Status
    status = Column(SQLEnum(AgentStatusEnum), default=AgentStatusEnum.REGISTERED)
    containment_level = Column(SQLEnum(ContainmentLevelEnum), default=ContainmentLevelEnum.RESTRICTED)
    
    # Trust
    trust_score = Column(Float, default=0.0)
    trust_ceiling = Column(Float, default=0.40)
    transparency_tier = Column(SQLEnum(TransparencyTierEnum), default=TransparencyTierEnum.BLACK_BOX)
    
    # Configuration
    capabilities = Column(JSON, default=list)
    flags = Column(JSON, default=list)
    metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_activity = Column(DateTime, default=func.now())
    
    # Relationships
    trust_events = relationship("TrustEvent", back_populates="agent", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="agent", cascade="all, delete-orphan")
    assessments = relationship("Assessment", back_populates="agent", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_agent_status", "status"),
        Index("idx_agent_trust", "trust_score"),
    )
    
    def to_dict(self):
        return {
            "agent_id": self.agent_id,
            "status": self.status.value,
            "containment_level": self.containment_level.value,
            "trust_score": self.trust_score,
            "trust_ceiling": self.trust_ceiling,
            "transparency_tier": self.transparency_tier.value,
            "capabilities": self.capabilities,
            "flags": self.flags,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None
        }


class TrustEvent(Base):
    """Trust score change event."""
    
    __tablename__ = "trust_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_db_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    event_type = Column(String(100), nullable=False)
    delta = Column(Float, nullable=False)
    new_trust = Column(Float, nullable=False)
    source = Column(String(255))
    was_capped = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=func.now())
    
    agent = relationship("Agent", back_populates="trust_events")
    
    __table_args__ = (
        Index("idx_trust_agent", "agent_db_id"),
        Index("idx_trust_time", "created_at"),
    )


class Action(Base):
    """Action request and decision."""
    
    __tablename__ = "actions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(100), unique=True, nullable=False, index=True)
    agent_db_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Request
    action_type = Column(String(100), nullable=False)
    description = Column(Text)
    target = Column(String(500))
    impact = Column(SQLEnum(ImpactLevelEnum), default=ImpactLevelEnum.LOW)
    reversible = Column(Boolean, default=True)
    input_text = Column(Text)
    request_metadata = Column(JSON, default=dict)
    
    # Decision
    allowed = Column(Boolean, nullable=False)
    reason = Column(Text)
    risk_score = Column(Float, default=0.0)
    signals = Column(JSON, default=list)
    required_approval = Column(String(50))
    
    created_at = Column(DateTime, default=func.now())
    
    agent = relationship("Agent", back_populates="actions")
    
    __table_args__ = (
        Index("idx_action_agent", "agent_db_id"),
        Index("idx_action_time", "created_at"),
        Index("idx_action_allowed", "allowed"),
    )


class Assessment(Base):
    """Threat assessment record."""
    
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_db_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Scores
    trust_score = Column(Float)
    trust_velocity = Column(Float)
    risk_score = Column(Float)
    
    # Threat
    threat_level = Column(SQLEnum(ThreatLevelEnum), default=ThreatLevelEnum.NONE)
    total_signals = Column(Integer, default=0)
    
    # Details
    signals_by_category = Column(JSON, default=dict)
    findings = Column(JSON, default=list)
    recommended_action = Column(Text)
    
    created_at = Column(DateTime, default=func.now())
    
    agent = relationship("Agent", back_populates="assessments")
    
    __table_args__ = (
        Index("idx_assessment_agent", "agent_db_id"),
        Index("idx_assessment_time", "created_at"),
        Index("idx_assessment_threat", "threat_level"),
    )


class APIKey(Base):
    """API authentication key."""
    
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    key_hash = Column(String(64), unique=True, nullable=False)
    
    name = Column(String(100), nullable=False)
    role = Column(String(50), default="user")
    
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime)
    
    created_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime)
    
    __table_args__ = (
        Index("idx_apikey_active", "is_active"),
    )


class AuditLog(Base):
    """System audit log."""
    
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    event_type = Column(String(100), nullable=False)
    actor = Column(String(100))  # API key name or system
    target = Column(String(100))  # Agent ID or resource
    
    action = Column(String(100), nullable=False)
    details = Column(JSON, default=dict)
    
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        Index("idx_audit_time", "created_at"),
        Index("idx_audit_type", "event_type"),
        Index("idx_audit_actor", "actor"),
    )


class SystemConfig(Base):
    """System configuration."""
    
    __tablename__ = "system_config"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(JSON, nullable=False)
    description = Column(Text)
    
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# =============================================================================
# DATABASE SETUP
# =============================================================================

def get_database_url():
    """Get database URL from environment or default."""
    return os.getenv(
        "DATABASE_URL",
        "postgresql://atsf:atsf_password@localhost:5432/atsf"
    )


def create_database_engine(url: str = None):
    """Create SQLAlchemy engine."""
    url = url or get_database_url()
    return create_engine(url, pool_pre_ping=True, pool_size=10)


def create_tables(engine):
    """Create all tables."""
    Base.metadata.create_all(engine)


def get_session(engine):
    """Get database session."""
    Session = sessionmaker(bind=engine)
    return Session()


# =============================================================================
# REPOSITORY CLASSES
# =============================================================================

class AgentRepository:
    """Repository for Agent operations."""
    
    def __init__(self, session):
        self.session = session
        
    def create(self, agent_id: str, **kwargs) -> Agent:
        agent = Agent(agent_id=agent_id, **kwargs)
        self.session.add(agent)
        self.session.commit()
        return agent
        
    def get_by_id(self, agent_id: str) -> Agent:
        return self.session.query(Agent).filter(Agent.agent_id == agent_id).first()
        
    def get_all(self, status: AgentStatusEnum = None, limit: int = 100) -> list:
        query = self.session.query(Agent)
        if status:
            query = query.filter(Agent.status == status)
        return query.limit(limit).all()
        
    def update(self, agent_id: str, **kwargs) -> Agent:
        agent = self.get_by_id(agent_id)
        if agent:
            for key, value in kwargs.items():
                setattr(agent, key, value)
            agent.updated_at = datetime.now()
            self.session.commit()
        return agent
        
    def delete(self, agent_id: str) -> bool:
        agent = self.get_by_id(agent_id)
        if agent:
            self.session.delete(agent)
            self.session.commit()
            return True
        return False


class TrustEventRepository:
    """Repository for TrustEvent operations."""
    
    def __init__(self, session):
        self.session = session
        
    def create(self, agent_db_id: int, **kwargs) -> TrustEvent:
        event = TrustEvent(agent_db_id=agent_db_id, **kwargs)
        self.session.add(event)
        self.session.commit()
        return event
        
    def get_history(self, agent_db_id: int, limit: int = 100) -> list:
        return self.session.query(TrustEvent)\
            .filter(TrustEvent.agent_db_id == agent_db_id)\
            .order_by(TrustEvent.created_at.desc())\
            .limit(limit).all()


class ActionRepository:
    """Repository for Action operations."""
    
    def __init__(self, session):
        self.session = session
        
    def create(self, **kwargs) -> Action:
        action = Action(**kwargs)
        self.session.add(action)
        self.session.commit()
        return action
        
    def get_by_request_id(self, request_id: str) -> Action:
        return self.session.query(Action)\
            .filter(Action.request_id == request_id).first()
            
    def get_by_agent(self, agent_db_id: int, limit: int = 100) -> list:
        return self.session.query(Action)\
            .filter(Action.agent_db_id == agent_db_id)\
            .order_by(Action.created_at.desc())\
            .limit(limit).all()


# =============================================================================
# INITIALIZATION
# =============================================================================

def init_database():
    """Initialize database with tables and default data."""
    engine = create_database_engine()
    create_tables(engine)
    
    session = get_session(engine)
    
    # Create default config
    defaults = [
        ("trust_ceiling_black_box", 0.40, "Trust ceiling for black box agents"),
        ("trust_ceiling_gray_box", 0.55, "Trust ceiling for gray box agents"),
        ("trust_ceiling_white_box", 0.75, "Trust ceiling for white box agents"),
        ("trust_ceiling_attested", 0.90, "Trust ceiling for attested agents"),
        ("velocity_cap_per_hour", 0.10, "Maximum trust change per hour"),
        ("velocity_cap_per_day", 0.25, "Maximum trust change per day"),
    ]
    
    for key, value, desc in defaults:
        existing = session.query(SystemConfig).filter(SystemConfig.key == key).first()
        if not existing:
            config = SystemConfig(key=key, value=value, description=desc)
            session.add(config)
            
    session.commit()
    session.close()
    
    return engine


if __name__ == "__main__":
    print("Initializing ATSF database...")
    engine = init_database()
    print("Database initialized successfully!")
