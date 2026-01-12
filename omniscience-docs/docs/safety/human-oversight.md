---
sidebar_position: 5
title: Human Oversight
description: Maintaining meaningful human control over autonomous agents
tags: [safety, oversight, control, human-in-loop, governance]
---

# Human Oversight

## Maintaining Human Control Over Autonomous Agents

As AI agents become more capable and autonomous, maintaining meaningful human oversight becomes both more important and more challenging. This section covers patterns for keeping humans in control without undermining the efficiency benefits of automation.

## The Oversight Spectrum

```
                    Human Oversight Levels
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Full Human        Approval        Monitoring       Exception           │
│  Control           Required        Only             Only                │
│  ──────────────────────────────────────────────────────────────────────▶│
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Human does   │ │ Human must   │ │ Agent acts,  │ │ Agent acts   │   │
│  │ everything   │ │ approve      │ │ human watches│ │ freely,      │   │
│  │              │ │ each action  │ │ & can stop   │ │ human handles│   │
│  │              │ │              │ │              │ │ exceptions   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
│  No autonomy       Low autonomy    High autonomy    Near-full autonomy  │
│  No scaling        Some scaling    Good scaling     Best scaling        │
│  Maximum safety    High safety     Medium safety    Lower safety        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Approval Workflows

### Human-in-the-Loop System

```python
class HumanApprovalSystem:
    """Manage human approvals for agent actions."""

    def __init__(self, config: ApprovalConfig):
        self.approval_queue = ApprovalQueue(config.queue_config)
        self.notification_service = NotificationService(config.notifications)
        self.escalation_manager = EscalationManager(config.escalation)
        self.delegation_rules = DelegationRules(config.delegation)

    async def request_approval(
        self,
        agent_did: str,
        action: Action,
        context: Context,
        urgency: str = "normal"
    ) -> ApprovalResult:
        """Request human approval for an action."""

        # Create approval request
        request = ApprovalRequest(
            id=str(uuid.uuid4()),
            agent_did=agent_did,
            action=action,
            context=context,
            urgency=urgency,
            created_at=datetime.utcnow(),
            expires_at=self._calculate_expiration(urgency)
        )

        # Find appropriate approvers
        approvers = await self._find_approvers(action, context)

        if not approvers:
            return ApprovalResult(
                granted=False,
                reason="No approvers available",
                request=request
            )

        # Queue for approval
        await self.approval_queue.add(request, approvers)

        # Notify approvers
        await self.notification_service.notify_approvers(request, approvers)

        # Wait for approval (with timeout)
        result = await self._wait_for_approval(request, urgency)

        return result

    async def _find_approvers(
        self,
        action: Action,
        context: Context
    ) -> List[Approver]:
        """Find appropriate approvers for this action."""

        approvers = []

        # Check delegation rules
        delegated_approver = await self.delegation_rules.get_delegated_approver(action)
        if delegated_approver:
            approvers.append(delegated_approver)

        # Check role-based rules
        required_role = self._get_required_approver_role(action)
        role_approvers = await self._get_approvers_by_role(required_role)
        approvers.extend(role_approvers)

        # Filter by availability
        available = [a for a in approvers if await a.is_available()]

        return available

    async def _wait_for_approval(
        self,
        request: ApprovalRequest,
        urgency: str
    ) -> ApprovalResult:
        """Wait for approval with timeout and escalation."""

        timeout = self._get_timeout(urgency)
        escalation_time = timeout * 0.5  # Escalate at 50% of timeout

        start_time = time.time()

        while time.time() - start_time < timeout:
            # Check for response
            response = await self.approval_queue.get_response(request.id)

            if response:
                return ApprovalResult(
                    granted=response.approved,
                    approver=response.approver,
                    reason=response.reason,
                    request=request
                )

            # Escalate if needed
            if time.time() - start_time > escalation_time:
                await self.escalation_manager.escalate(request)

            await asyncio.sleep(1)

        # Timeout - apply default policy
        return await self._apply_timeout_policy(request)

    async def _apply_timeout_policy(
        self,
        request: ApprovalRequest
    ) -> ApprovalResult:
        """Apply policy when approval times out."""

        policy = self._get_timeout_policy(request.action)

        if policy == "deny":
            return ApprovalResult(granted=False, reason="Approval timeout")
        elif policy == "allow_low_risk":
            if await self._is_low_risk(request.action):
                return ApprovalResult(granted=True, reason="Auto-approved (low risk)")
            return ApprovalResult(granted=False, reason="Approval timeout (not low risk)")
        elif policy == "escalate":
            await self.escalation_manager.emergency_escalate(request)
            return await self._wait_for_approval(request, "emergency")

        return ApprovalResult(granted=False, reason="Approval timeout")
```

### Approval UI Integration

```python
class ApprovalInterface:
    """Interface for human approvers."""

    async def present_for_approval(
        self,
        request: ApprovalRequest,
        approver: Approver
    ) -> ApprovalPresentation:
        """Present approval request with full context."""

        # Gather relevant information
        agent_info = await self._get_agent_info(request.agent_did)
        trust_score = await self._get_trust_score(request.agent_did)
        similar_past = await self._find_similar_approved(request.action)
        risk_assessment = await self._assess_risk(request.action)

        return ApprovalPresentation(
            request=request,
            agent_info=agent_info,
            trust_score=trust_score,
            risk_level=risk_assessment.level,
            risk_factors=risk_assessment.factors,
            similar_approved_actions=similar_past,
            recommended_decision=self._generate_recommendation(risk_assessment),
            quick_actions=[
                QuickAction("approve", "Approve this action"),
                QuickAction("deny", "Deny this action"),
                QuickAction("approve_with_limits", "Approve with constraints"),
                QuickAction("delegate", "Delegate to another approver"),
                QuickAction("request_info", "Request more information")
            ]
        )

    async def process_decision(
        self,
        request_id: str,
        decision: ApprovalDecision
    ) -> ProcessResult:
        """Process approver's decision."""

        request = await self.approval_queue.get(request_id)

        if decision.action == "approve":
            await self._record_approval(request, decision.approver)
            return ProcessResult(approved=True)

        elif decision.action == "deny":
            await self._record_denial(request, decision.approver, decision.reason)
            return ProcessResult(approved=False, reason=decision.reason)

        elif decision.action == "approve_with_limits":
            await self._record_conditional_approval(
                request,
                decision.approver,
                decision.constraints
            )
            return ProcessResult(approved=True, constraints=decision.constraints)

        elif decision.action == "delegate":
            await self._delegate_request(request, decision.delegatee)
            return ProcessResult(delegated=True, delegatee=decision.delegatee)

        elif decision.action == "request_info":
            await self._request_additional_info(request, decision.questions)
            return ProcessResult(pending=True, info_requested=True)
```

## Intervention Mechanisms

### Emergency Stop

```python
class EmergencyStopSystem:
    """Emergency stop capabilities for agents."""

    def __init__(self, config: EmergencyConfig):
        self.agents = AgentRegistry()
        self.notification_channels = config.notification_channels
        self.recovery_manager = RecoveryManager()

    async def emergency_stop(
        self,
        agent_did: str,
        reason: str,
        operator: str
    ) -> StopResult:
        """Immediately stop an agent."""

        agent = await self.agents.get(agent_did)
        if not agent:
            return StopResult(success=False, reason="Agent not found")

        # Record the stop
        stop_record = StopRecord(
            agent_did=agent_did,
            reason=reason,
            operator=operator,
            timestamp=datetime.utcnow()
        )

        try:
            # Stop the agent
            await agent.stop(force=True)

            # Terminate any active operations
            active_ops = await self._get_active_operations(agent_did)
            for op in active_ops:
                await op.abort(reason="Emergency stop")

            # Revoke all active capabilities
            await self._revoke_capabilities(agent_did)

            # Notify relevant parties
            await self._notify_stop(stop_record)

            return StopResult(
                success=True,
                stopped_operations=len(active_ops),
                record=stop_record
            )

        except Exception as e:
            # Force kill if graceful stop fails
            await agent.force_kill()
            return StopResult(success=True, forced=True, error=str(e))

    async def emergency_stop_all(
        self,
        reason: str,
        operator: str
    ) -> BatchStopResult:
        """Stop all agents in the system."""

        results = []
        all_agents = await self.agents.list_active()

        for agent_did in all_agents:
            result = await self.emergency_stop(agent_did, reason, operator)
            results.append(result)

        return BatchStopResult(
            total=len(all_agents),
            stopped=sum(1 for r in results if r.success),
            failed=[r for r in results if not r.success]
        )

    async def pause_agent(
        self,
        agent_did: str,
        reason: str,
        duration: Optional[timedelta] = None
    ) -> PauseResult:
        """Temporarily pause an agent."""

        agent = await self.agents.get(agent_did)

        # Pause (softer than stop)
        await agent.pause()

        # Set auto-resume if duration specified
        if duration:
            await self._schedule_resume(agent_did, duration)

        return PauseResult(
            success=True,
            resume_at=datetime.utcnow() + duration if duration else None
        )
```

### Rollback Capabilities

```python
class ActionRollbackManager:
    """Rollback agent actions when needed."""

    async def rollback_action(
        self,
        action_id: str,
        reason: str,
        operator: str
    ) -> RollbackResult:
        """Rollback a specific action."""

        # Get action from audit trail
        action_record = await self.audit_store.get(action_id)
        if not action_record:
            return RollbackResult(success=False, reason="Action not found")

        # Check if rollback is possible
        rollback_capability = await self._can_rollback(action_record)
        if not rollback_capability.possible:
            return RollbackResult(
                success=False,
                reason=rollback_capability.reason
            )

        # Generate rollback operations
        rollback_ops = await self._generate_rollback_operations(action_record)

        # Execute rollback
        rollback_results = []
        for op in rollback_ops:
            result = await self._execute_rollback_op(op)
            rollback_results.append(result)

            if not result.success:
                # Rollback of rollback attempt
                await self._handle_partial_rollback(rollback_results)
                return RollbackResult(
                    success=False,
                    partial=True,
                    completed_ops=rollback_results
                )

        # Log rollback
        await self._log_rollback(action_record, rollback_ops, operator, reason)

        return RollbackResult(
            success=True,
            rolled_back_ops=len(rollback_ops)
        )

    async def _can_rollback(self, action: AuditEntry) -> RollbackCapability:
        """Determine if action can be rolled back."""

        # Check action type
        if action.action_type in ["destructive", "irreversible"]:
            return RollbackCapability(
                possible=False,
                reason="Action type is irreversible"
            )

        # Check time elapsed
        if datetime.utcnow() - action.timestamp > timedelta(hours=24):
            return RollbackCapability(
                possible=False,
                reason="Rollback window expired (24 hours)"
            )

        # Check if state has changed
        if await self._state_has_changed(action):
            return RollbackCapability(
                possible=True,
                partial=True,
                reason="State has changed, partial rollback possible"
            )

        return RollbackCapability(possible=True)
```

## Scalable Oversight

### Sampling-Based Review

```python
class SamplingReviewer:
    """Sample agent actions for human review."""

    def __init__(self, config: SamplingConfig):
        self.base_rate = config.base_sample_rate  # e.g., 0.05 (5%)
        self.risk_multipliers = config.risk_multipliers
        self.reviewer_pool = ReviewerPool(config.reviewers)

    async def should_sample(
        self,
        action: Action,
        agent_did: str
    ) -> bool:
        """Determine if action should be sampled for review."""

        # Calculate sample probability
        probability = self.base_rate

        # Adjust for risk level
        risk_level = await self._assess_risk_level(action)
        probability *= self.risk_multipliers.get(risk_level, 1.0)

        # Adjust for agent trust
        trust_score = await self._get_trust_score(agent_did)
        if trust_score < 0.7:
            probability *= 2  # Double sampling for lower trust agents

        # Adjust for action type
        if action.type in self.high_risk_types:
            probability = min(probability * 3, 1.0)

        # Random sample
        return random.random() < probability

    async def queue_for_review(
        self,
        action: Action,
        result: Result,
        agent_did: str
    ):
        """Queue action for human review."""

        review_item = ReviewItem(
            action=action,
            result=result,
            agent_did=agent_did,
            sampled_at=datetime.utcnow(),
            priority=await self._calculate_priority(action)
        )

        # Assign to reviewer
        reviewer = await self.reviewer_pool.get_available()
        await reviewer.assign(review_item)

    async def process_review_result(
        self,
        review: ReviewResult
    ):
        """Process completed review."""

        if review.issues_found:
            # Flag for follow-up
            await self._flag_issues(review)

            # Update trust score
            await self._update_trust_based_on_review(
                review.agent_did,
                review.severity
            )

            # Increase sampling rate for this agent
            await self._increase_sampling(review.agent_did)

        else:
            # Good review - may decrease sampling
            await self._record_good_review(review.agent_did)
```

### Anomaly-Based Alerts

```python
class AnomalyAlerter:
    """Alert humans to anomalous agent behavior."""

    def __init__(self, config: AnomalyConfig):
        self.detector = AnomalyDetector(config.detection)
        self.alert_channels = AlertChannels(config.channels)
        self.threshold = config.alert_threshold

    async def monitor_action(
        self,
        action: Action,
        result: Result,
        agent_did: str
    ):
        """Monitor action for anomalies."""

        # Get agent baseline
        baseline = await self._get_agent_baseline(agent_did)

        # Check for anomalies
        anomaly_score = await self.detector.score(action, result, baseline)

        if anomaly_score > self.threshold:
            await self._trigger_alert(
                agent_did=agent_did,
                action=action,
                anomaly_score=anomaly_score,
                anomaly_type=await self.detector.classify(action, baseline)
            )

    async def _trigger_alert(
        self,
        agent_did: str,
        action: Action,
        anomaly_score: float,
        anomaly_type: str
    ):
        """Trigger alert to human operators."""

        alert = Alert(
            severity=self._score_to_severity(anomaly_score),
            agent_did=agent_did,
            action=action,
            anomaly_type=anomaly_type,
            score=anomaly_score,
            timestamp=datetime.utcnow(),
            recommended_actions=self._get_recommended_actions(anomaly_type)
        )

        # Send through appropriate channels based on severity
        if alert.severity == "critical":
            await self.alert_channels.send_all(alert)
        elif alert.severity == "high":
            await self.alert_channels.send_on_call(alert)
        else:
            await self.alert_channels.send_queue(alert)
```

## Research Foundations

- **Scalable Oversight** (Christiano et al., 2018) - Overseeing superhuman AI
- **Human-in-the-Loop ML** (Wu et al., 2021) - Interactive machine learning
- **AI Safety via Debate** (Irving et al., 2018) - Adversarial oversight
- **Corrigibility** (Soares et al., 2015) - Maintaining control

---

## See Also

- [Capability Gating](./capability-gating.md) - Permission-based control
- [Audit Trails](./audit-trails.md) - Monitoring agent behavior
- [Trust Scoring](./trust-scoring.md) - Informing oversight decisions
