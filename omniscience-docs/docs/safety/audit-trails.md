---
sidebar_position: 4
title: Audit Trails
description: Recording agent actions for accountability and compliance
tags: [safety, audit, logging, compliance, accountability]
---

# Audit Trails

## Comprehensive Recording for Agent Accountability

Audit trails provide an immutable record of all agent actions, enabling accountability, debugging, compliance verification, and forensic analysis. In regulated industries, comprehensive audit trails are not optional—they're required.

## Why Audit Trails Matter

```
              Audit Trail Use Cases
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Accountability           Compliance              Debugging             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │ Who did what?   │     │ Did we follow   │     │ What went wrong?│   │
│  │ When did it     │     │ regulations?    │     │ How do we       │   │
│  │ happen?         │     │ Can we prove it?│     │ reproduce it?   │   │
│  │ Why was it done?│     │                 │     │                 │   │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘   │
│                                                                         │
│  Security                 Forensics               Trust Building        │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │ Detect anomalies│     │ Investigate     │     │ Demonstrate     │   │
│  │ Identify threats│     │ incidents       │     │ transparency    │   │
│  │ Track access    │     │ Legal evidence  │     │ Build confidence│   │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Audit Record Structure

### Comprehensive Audit Entry

```python
@dataclass
class AuditEntry:
    """A single audit trail entry."""

    # Identity
    id: str                          # Unique entry ID
    agent_did: str                   # Acting agent
    session_id: str                  # Session/conversation ID

    # Timing
    timestamp: datetime              # When action occurred
    duration_ms: int                 # How long it took

    # Action
    action_type: str                 # Category of action
    action_name: str                 # Specific action
    action_params: dict              # Parameters used

    # Context
    context: AuditContext            # Surrounding context
    trigger: str                     # What triggered this action

    # Result
    outcome: str                     # success, failure, partial
    result_summary: str              # Brief result description
    error: Optional[str]             # Error if failed

    # Inputs/Outputs
    inputs: dict                     # Sanitized inputs
    outputs: dict                    # Sanitized outputs
    tokens_used: Optional[int]       # LLM tokens if applicable

    # Authorization
    capabilities_used: List[str]     # Capabilities exercised
    authorization: AuthorizationInfo # How action was authorized

    # Cryptographic
    hash: str                        # SHA-256 of entry
    previous_hash: str               # Hash of previous entry (chain)
    signature: str                   # Agent's signature


@dataclass
class AuditContext:
    """Context surrounding an audit entry."""

    user_id: Optional[str]           # Human user if any
    task_id: Optional[str]           # Task being performed
    conversation_id: Optional[str]   # Conversation context
    parent_action_id: Optional[str]  # Parent action (for hierarchy)
    environment: str                 # prod, staging, dev
    client_info: dict                # Client application info


@dataclass
class AuthorizationInfo:
    """How an action was authorized."""

    method: str                      # capability, delegation, approval
    authorizer: str                  # Who/what authorized
    trust_score_at_time: float       # Agent's trust when authorized
    approval_id: Optional[str]       # Human approval ID if any
```

## Audit Logger Implementation

### Core Logging System

```python
class AuditLogger:
    """Comprehensive audit logging system."""

    def __init__(self, config: AuditConfig):
        self.store = AuditStore(config.store_config)
        self.encryptor = AuditEncryptor(config.encryption_key)
        self.signer = AuditSigner(config.signing_key)
        self.buffer = AuditBuffer(config.buffer_size)
        self.last_hash = None

    async def log(
        self,
        agent_did: str,
        action_type: str,
        action_name: str,
        **kwargs
    ) -> AuditEntry:
        """Log an action to the audit trail."""

        # Create entry
        entry = AuditEntry(
            id=str(uuid.uuid4()),
            agent_did=agent_did,
            session_id=kwargs.get("session_id", ""),
            timestamp=datetime.utcnow(),
            duration_ms=kwargs.get("duration_ms", 0),
            action_type=action_type,
            action_name=action_name,
            action_params=self._sanitize_params(kwargs.get("params", {})),
            context=kwargs.get("context", AuditContext()),
            trigger=kwargs.get("trigger", "unknown"),
            outcome=kwargs.get("outcome", "unknown"),
            result_summary=kwargs.get("result_summary", ""),
            error=kwargs.get("error"),
            inputs=self._sanitize_data(kwargs.get("inputs", {})),
            outputs=self._sanitize_data(kwargs.get("outputs", {})),
            tokens_used=kwargs.get("tokens_used"),
            capabilities_used=kwargs.get("capabilities_used", []),
            authorization=kwargs.get("authorization", AuthorizationInfo()),
            hash="",
            previous_hash=self.last_hash or "",
            signature=""
        )

        # Compute hash (creates chain)
        entry.hash = self._compute_hash(entry)
        self.last_hash = entry.hash

        # Sign entry
        entry.signature = await self.signer.sign(entry)

        # Encrypt sensitive fields
        encrypted_entry = self.encryptor.encrypt(entry)

        # Buffer and store
        await self.buffer.add(encrypted_entry)

        # Flush if buffer is full
        if self.buffer.should_flush():
            await self._flush_buffer()

        return entry

    def _sanitize_data(self, data: dict) -> dict:
        """Remove or mask sensitive data."""
        sanitized = {}
        for key, value in data.items():
            if key in SENSITIVE_FIELDS:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str) and len(value) > MAX_FIELD_LENGTH:
                sanitized[key] = value[:MAX_FIELD_LENGTH] + "...[truncated]"
            else:
                sanitized[key] = value
        return sanitized

    def _compute_hash(self, entry: AuditEntry) -> str:
        """Compute hash for entry (includes previous hash for chain)."""
        hashable = {
            "id": entry.id,
            "agent_did": entry.agent_did,
            "timestamp": entry.timestamp.isoformat(),
            "action_type": entry.action_type,
            "action_name": entry.action_name,
            "action_params": entry.action_params,
            "outcome": entry.outcome,
            "previous_hash": entry.previous_hash
        }
        return hashlib.sha256(
            json.dumps(hashable, sort_keys=True).encode()
        ).hexdigest()

    async def _flush_buffer(self):
        """Flush buffer to persistent storage."""
        entries = await self.buffer.drain()
        await self.store.batch_insert(entries)


# Sensitive fields that should be redacted
SENSITIVE_FIELDS = {
    "password", "api_key", "secret", "token", "credit_card",
    "ssn", "social_security", "private_key"
}
MAX_FIELD_LENGTH = 10000
```

### Decorator for Automatic Logging

```python
def audited(
    action_type: str,
    log_inputs: bool = True,
    log_outputs: bool = True
):
    """Decorator to automatically audit function calls."""

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(self, *args, **kwargs):
            start_time = time.time()

            # Prepare audit context
            audit_kwargs = {
                "action_type": action_type,
                "action_name": func.__name__,
                "params": kwargs if log_inputs else {},
                "trigger": "function_call",
                "context": getattr(self, "audit_context", AuditContext())
            }

            try:
                result = await func(self, *args, **kwargs)

                # Log success
                audit_kwargs.update({
                    "outcome": "success",
                    "outputs": result if log_outputs else {},
                    "duration_ms": int((time.time() - start_time) * 1000)
                })
                await self.audit_logger.log(self.agent_did, **audit_kwargs)

                return result

            except Exception as e:
                # Log failure
                audit_kwargs.update({
                    "outcome": "failure",
                    "error": str(e),
                    "duration_ms": int((time.time() - start_time) * 1000)
                })
                await self.audit_logger.log(self.agent_did, **audit_kwargs)
                raise

        return wrapper
    return decorator


# Usage
class TradingAgent:
    @audited(action_type="financial", log_inputs=True, log_outputs=True)
    async def execute_trade(self, order: Order) -> TradeResult:
        # All calls automatically logged
        pass
```

## Audit Storage

### Immutable Storage Backend

```python
class ImmutableAuditStore:
    """Append-only audit storage."""

    def __init__(self, config: StoreConfig):
        self.primary = PrimaryStore(config.primary)
        self.backup = BackupStore(config.backup)
        self.blockchain = BlockchainAnchor(config.blockchain) if config.use_blockchain else None

    async def insert(self, entry: AuditEntry):
        """Insert audit entry (append-only)."""

        # Write to primary (append-only table/collection)
        await self.primary.append(entry)

        # Write to backup
        await self.backup.append(entry)

        # Anchor to blockchain for tamper evidence (batched)
        if self.blockchain:
            await self.blockchain.queue_for_anchoring(entry.hash)

    async def verify_integrity(self, start: datetime, end: datetime) -> IntegrityReport:
        """Verify audit trail integrity."""

        entries = await self.primary.get_range(start, end)

        issues = []
        previous_hash = None

        for entry in entries:
            # Verify hash chain
            if previous_hash and entry.previous_hash != previous_hash:
                issues.append(IntegrityIssue(
                    type="chain_break",
                    entry_id=entry.id,
                    details=f"Expected previous_hash {previous_hash}, got {entry.previous_hash}"
                ))

            # Verify entry hash
            computed_hash = self._compute_hash(entry)
            if computed_hash != entry.hash:
                issues.append(IntegrityIssue(
                    type="hash_mismatch",
                    entry_id=entry.id,
                    details=f"Computed hash doesn't match stored hash"
                ))

            # Verify signature
            if not await self._verify_signature(entry):
                issues.append(IntegrityIssue(
                    type="invalid_signature",
                    entry_id=entry.id,
                    details="Signature verification failed"
                ))

            previous_hash = entry.hash

        return IntegrityReport(
            verified_count=len(entries),
            issues=issues,
            integrity_score=1 - (len(issues) / len(entries)) if entries else 1
        )


class BlockchainAnchor:
    """Anchor audit hashes to blockchain for tamper evidence."""

    def __init__(self, config: BlockchainConfig):
        self.contract = AuditAnchorContract(config)
        self.pending_hashes = []
        self.batch_size = config.batch_size

    async def queue_for_anchoring(self, hash: str):
        """Queue hash for blockchain anchoring."""
        self.pending_hashes.append(hash)

        if len(self.pending_hashes) >= self.batch_size:
            await self._anchor_batch()

    async def _anchor_batch(self):
        """Anchor batch of hashes to blockchain."""
        # Create Merkle root of pending hashes
        merkle_root = self._compute_merkle_root(self.pending_hashes)

        # Write to blockchain
        tx_hash = await self.contract.anchor(merkle_root)

        # Store mapping
        await self._store_anchor_mapping(self.pending_hashes, merkle_root, tx_hash)

        self.pending_hashes = []
```

## Audit Queries

### Query Interface

```python
class AuditQueryEngine:
    """Query audit trails efficiently."""

    async def query(self, query: AuditQuery) -> AuditQueryResult:
        """Execute audit query."""

        # Build query
        filters = []

        if query.agent_did:
            filters.append(("agent_did", "=", query.agent_did))

        if query.action_type:
            filters.append(("action_type", "=", query.action_type))

        if query.time_range:
            filters.append(("timestamp", ">=", query.time_range.start))
            filters.append(("timestamp", "<=", query.time_range.end))

        if query.outcome:
            filters.append(("outcome", "=", query.outcome))

        if query.capability:
            filters.append(("capabilities_used", "contains", query.capability))

        # Execute query
        results = await self.store.query(
            filters=filters,
            order_by=query.order_by or "timestamp",
            limit=query.limit or 1000,
            offset=query.offset or 0
        )

        return AuditQueryResult(
            entries=results,
            total_count=await self.store.count(filters),
            query=query
        )

    async def get_agent_timeline(
        self,
        agent_did: str,
        time_range: TimeRange
    ) -> List[AuditEntry]:
        """Get chronological audit trail for an agent."""
        return await self.query(AuditQuery(
            agent_did=agent_did,
            time_range=time_range,
            order_by="timestamp"
        ))

    async def get_action_chain(self, action_id: str) -> List[AuditEntry]:
        """Get all related actions (parent/child hierarchy)."""
        entries = []

        # Get the starting action
        action = await self.store.get(action_id)
        if not action:
            return []

        entries.append(action)

        # Get parent chain
        current = action
        while current.context.parent_action_id:
            parent = await self.store.get(current.context.parent_action_id)
            if parent:
                entries.insert(0, parent)
                current = parent
            else:
                break

        # Get child actions
        children = await self.store.query(
            filters=[("context.parent_action_id", "=", action_id)],
            order_by="timestamp"
        )
        entries.extend(children)

        return entries

    async def analyze_patterns(
        self,
        agent_did: str,
        time_range: TimeRange
    ) -> PatternAnalysis:
        """Analyze patterns in agent behavior."""

        entries = await self.get_agent_timeline(agent_did, time_range)

        return PatternAnalysis(
            total_actions=len(entries),
            action_distribution=self._count_by_type(entries),
            success_rate=self._calculate_success_rate(entries),
            peak_activity_times=self._find_peak_times(entries),
            common_sequences=self._find_common_sequences(entries),
            anomalies=await self._detect_anomalies(entries)
        )
```

## Compliance Reporting

### Automated Reports

```python
class ComplianceReporter:
    """Generate compliance reports from audit trails."""

    async def generate_report(
        self,
        report_type: str,
        time_range: TimeRange,
        **kwargs
    ) -> ComplianceReport:
        """Generate compliance report."""

        if report_type == "sox":
            return await self._generate_sox_report(time_range, **kwargs)
        elif report_type == "gdpr":
            return await self._generate_gdpr_report(time_range, **kwargs)
        elif report_type == "financial":
            return await self._generate_financial_report(time_range, **kwargs)
        else:
            raise ValueError(f"Unknown report type: {report_type}")

    async def _generate_sox_report(
        self,
        time_range: TimeRange,
        **kwargs
    ) -> ComplianceReport:
        """Generate SOX compliance report."""

        # Query relevant audit entries
        entries = await self.query_engine.query(AuditQuery(
            time_range=time_range,
            action_type=["financial", "admin", "access_control"]
        ))

        sections = []

        # Access control changes
        access_changes = [e for e in entries if e.action_type == "access_control"]
        sections.append(ReportSection(
            title="Access Control Changes",
            entries=access_changes,
            summary=f"{len(access_changes)} access changes during period",
            compliance_status=self._assess_access_compliance(access_changes)
        ))

        # Financial transactions
        financial = [e for e in entries if e.action_type == "financial"]
        sections.append(ReportSection(
            title="Financial Transactions",
            entries=financial,
            summary=self._summarize_financial(financial),
            compliance_status=self._assess_financial_compliance(financial)
        ))

        # Segregation of duties
        sod_issues = await self._check_segregation_of_duties(entries)
        sections.append(ReportSection(
            title="Segregation of Duties",
            entries=[],
            summary=f"{len(sod_issues)} potential issues identified",
            compliance_status="compliant" if not sod_issues else "review_required",
            issues=sod_issues
        ))

        return ComplianceReport(
            report_type="sox",
            time_range=time_range,
            generated_at=datetime.utcnow(),
            sections=sections,
            overall_status=self._determine_overall_status(sections)
        )
```

## Research Foundations

- **Immutable Audit Logs** - Append-only storage patterns
- **Blockchain Anchoring** - Tamper-evident logging
- **SIEM Integration** - Security information and event management
- **Regulatory Compliance** - SOX, GDPR, HIPAA requirements

---

## See Also

- [Trust Scoring](./trust-scoring.md) - Using audit data for trust
- [Human Oversight](./human-oversight.md) - Audit-based oversight
- [Capability Gating](./capability-gating.md) - Logging capability usage
