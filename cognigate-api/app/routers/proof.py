"""
PROOF endpoints - Immutable audit ledger.

PROOF = Persistent Record of Operational Facts

The PROOF layer creates and maintains cryptographically sealed records
of all governance decisions for audit and compliance.
"""

import hashlib
import time
import structlog
from typing import Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.models.proof import ProofRecord, ProofQuery, ProofVerification, ProofStats
from app.models.enforce import EnforceResponse

logger = structlog.get_logger()
router = APIRouter()

# Map enforcement actions to proof decisions (verb -> past participle)
ACTION_TO_DECISION = {
    "allow": "allowed",
    "deny": "denied",
    "escalate": "escalated",
    "modify": "modified",
}

# In-memory proof chain (in production, use a database)
PROOF_CHAIN: list[ProofRecord] = []
LAST_HASH = "0" * 64  # Genesis hash


def calculate_hash(data: dict) -> str:
    """Calculate SHA-256 hash of data."""
    import json

    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def create_proof_record(
    intent_id: str,
    verdict_id: str,
    entity_id: str,
    action_type: str,
    decision: str,
    inputs: dict,
    outputs: dict,
) -> ProofRecord:
    """
    Create a new proof record and add it to the chain.
    """
    global LAST_HASH

    inputs_hash = calculate_hash(inputs)
    outputs_hash = calculate_hash(outputs)

    record = ProofRecord(
        chain_position=len(PROOF_CHAIN),
        intent_id=intent_id,
        verdict_id=verdict_id,
        entity_id=entity_id,
        action_type=action_type,
        decision=decision,
        inputs_hash=inputs_hash,
        outputs_hash=outputs_hash,
        previous_hash=LAST_HASH,
        hash="",  # Calculated below
    )

    # Calculate record hash
    record_data = {
        "proof_id": record.proof_id,
        "chain_position": record.chain_position,
        "intent_id": record.intent_id,
        "verdict_id": record.verdict_id,
        "entity_id": record.entity_id,
        "action_type": record.action_type,
        "decision": record.decision,
        "inputs_hash": record.inputs_hash,
        "outputs_hash": record.outputs_hash,
        "previous_hash": record.previous_hash,
        "created_at": record.created_at.isoformat(),
    }
    record.hash = calculate_hash(record_data)
    LAST_HASH = record.hash

    PROOF_CHAIN.append(record)

    logger.info(
        "proof_created",
        proof_id=record.proof_id,
        chain_position=record.chain_position,
        decision=decision,
    )

    return record


@router.post("/proof", response_model=ProofRecord)
async def create_proof(verdict: EnforceResponse) -> ProofRecord:
    """
    Create an immutable proof record from an enforcement verdict.

    This endpoint:
    1. Receives a verdict from ENFORCE
    2. Creates a cryptographically linked proof record
    3. Adds it to the proof chain
    4. Returns the proof record

    The proof chain is append-only and tamper-evident.
    """
    record = create_proof_record(
        intent_id=verdict.intent_id,
        verdict_id=verdict.verdict_id,
        entity_id="system",  # Would come from context
        action_type="enforcement",
        decision=ACTION_TO_DECISION.get(verdict.action, verdict.action),
        inputs={"plan_id": verdict.plan_id, "policies": verdict.policies_evaluated},
        outputs={
            "allowed": verdict.allowed,
            "violations": len(verdict.violations),
            "trust_impact": verdict.trust_impact,
        },
    )

    return record


@router.get("/proof/stats", response_model=ProofStats)
async def get_proof_stats() -> ProofStats:
    """
    Get statistics about the proof ledger.
    """
    decisions = {}
    for record in PROOF_CHAIN:
        decisions[record.decision] = decisions.get(record.decision, 0) + 1

    # Verify chain integrity
    chain_valid = True
    for i, record in enumerate(PROOF_CHAIN):
        if i == 0:
            continue
        previous = PROOF_CHAIN[i - 1]
        if record.previous_hash != previous.hash:
            chain_valid = False
            break

    return ProofStats(
        total_records=len(PROOF_CHAIN),
        chain_length=len(PROOF_CHAIN),
        last_record_at=PROOF_CHAIN[-1].created_at if PROOF_CHAIN else None,
        records_by_decision=decisions,
        chain_integrity=chain_valid,
    )


@router.get("/proof/{proof_id}", response_model=ProofRecord)
async def get_proof(proof_id: str) -> ProofRecord:
    """
    Retrieve a proof record by ID.
    """
    for record in PROOF_CHAIN:
        if record.proof_id == proof_id:
            return record

    raise HTTPException(status_code=404, detail=f"Proof {proof_id} not found")


@router.post("/proof/query", response_model=list[ProofRecord])
async def query_proofs(query: ProofQuery) -> list[ProofRecord]:
    """
    Query proof records with filters.
    """
    results = PROOF_CHAIN.copy()

    if query.entity_id:
        results = [r for r in results if r.entity_id == query.entity_id]

    if query.intent_id:
        results = [r for r in results if r.intent_id == query.intent_id]

    if query.verdict_id:
        results = [r for r in results if r.verdict_id == query.verdict_id]

    if query.decision:
        results = [r for r in results if r.decision == query.decision]

    if query.start_date:
        results = [r for r in results if r.created_at >= query.start_date]

    if query.end_date:
        results = [r for r in results if r.created_at <= query.end_date]

    # Sort by chain position (oldest first)
    results.sort(key=lambda r: r.chain_position)

    # Apply pagination
    start = query.offset
    end = start + query.limit

    return results[start:end]


@router.get("/proof/{proof_id}/verify", response_model=ProofVerification)
async def verify_proof(proof_id: str) -> ProofVerification:
    """
    Verify the integrity of a proof record and its chain linkage.
    """
    record: Optional[ProofRecord] = None
    for r in PROOF_CHAIN:
        if r.proof_id == proof_id:
            record = r
            break

    if not record:
        raise HTTPException(status_code=404, detail=f"Proof {proof_id} not found")

    issues = []

    # Verify hash
    record_data = {
        "proof_id": record.proof_id,
        "chain_position": record.chain_position,
        "intent_id": record.intent_id,
        "verdict_id": record.verdict_id,
        "entity_id": record.entity_id,
        "action_type": record.action_type,
        "decision": record.decision,
        "inputs_hash": record.inputs_hash,
        "outputs_hash": record.outputs_hash,
        "previous_hash": record.previous_hash,
        "created_at": record.created_at.isoformat(),
    }
    expected_hash = calculate_hash(record_data)

    hash_valid = record.hash == expected_hash
    if not hash_valid:
        issues.append("Hash mismatch - record may be tampered")

    # Verify chain linkage
    chain_valid = True
    if record.chain_position > 0:
        previous = PROOF_CHAIN[record.chain_position - 1]
        if record.previous_hash != previous.hash:
            chain_valid = False
            issues.append("Chain linkage broken")

    return ProofVerification(
        proof_id=proof_id,
        valid=hash_valid and chain_valid,
        chain_valid=chain_valid,
        signature_valid=None,  # Not implemented yet
        issues=issues,
    )
