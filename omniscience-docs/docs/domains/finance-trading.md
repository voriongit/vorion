---
sidebar_position: 4
title: Finance & Trading Agents
description: Autonomous agents for markets, analysis, and financial services
tags: [domains, finance, trading, analysis, compliance]
---

# Finance & Trading Agents

## Autonomous Systems in Financial Markets

Finance represents one of the highest-stakes domains for autonomous AI agents. Trading bots, robo-advisors, fraud detection systems, and financial analysts operate under strict regulatory requirements while managing significant economic risk.

## Landscape

### Agent Categories

| Category | Examples | Key Challenges |
|----------|----------|----------------|
| **Trading Bots** | Algo trading, HFT | Latency, market manipulation |
| **Robo-Advisors** | Betterment, Wealthfront | Fiduciary duty, suitability |
| **Research Analysts** | BloombergGPT, FinGPT | Hallucination, bias |
| **Risk Management** | Credit scoring, VaR models | Explainability, fairness |
| **Fraud Detection** | Transaction monitoring | False positives, adversarial |
| **Compliance** | RegTech, AML screening | Completeness, updates |

### Regulatory Landscape

```
                    Financial Agent Regulations
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  United States                    Europe                                 │
│  ┌──────────────────────┐        ┌──────────────────────┐              │
│  │ SEC - Securities     │        │ MiFID II - Markets   │              │
│  │ FINRA - Broker rules │        │ GDPR - Data privacy  │              │
│  │ CFTC - Commodities   │        │ AI Act - AI systems  │              │
│  │ OCC - Banking        │        │ DORA - Resilience    │              │
│  └──────────────────────┘        └──────────────────────┘              │
│                                                                          │
│  Key Requirements:                                                       │
│  • Explainability of decisions                                          │
│  • Audit trails for all trades                                          │
│  • Human oversight for significant decisions                            │
│  • Fair treatment and non-discrimination                                │
│  • Market manipulation prevention                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Trading Agent Architecture

### High-Frequency Trading (HFT) Agent

```python
class HFTAgent:
    """Ultra-low latency trading agent."""

    def __init__(self, config: HFTConfig):
        # Market data feed (sub-millisecond)
        self.market_data = MarketDataFeed(config.exchange)

        # Order management system
        self.oms = OrderManagementSystem(config.broker)

        # Strategy engine
        self.strategy = TradingStrategy(config.strategy_params)

        # Risk limits
        self.risk_manager = RiskManager(
            max_position=config.max_position,
            max_loss_per_day=config.max_daily_loss,
            max_order_size=config.max_order_size
        )

    async def run(self):
        """Main trading loop."""
        async for tick in self.market_data.stream():
            # 1. Update market view
            self.strategy.update(tick)

            # 2. Generate signals
            signal = self.strategy.generate_signal()

            if signal:
                # 3. Risk check
                if not self.risk_manager.approve(signal):
                    self._log_rejected(signal, "Risk limit")
                    continue

                # 4. Execute
                order = self._signal_to_order(signal)
                result = await self.oms.submit(order)

                # 5. Update state
                self.risk_manager.update_position(result)
                self._log_execution(result)


class TradingStrategy:
    """Example market-making strategy."""

    def generate_signal(self) -> Optional[Signal]:
        """Generate trading signal based on market state."""

        # Market making: profit from bid-ask spread
        spread = self.best_ask - self.best_bid

        if spread > self.min_profitable_spread:
            # Place orders on both sides
            return Signal(
                bid_price=self.best_bid + self.tick_size,
                bid_size=self.order_size,
                ask_price=self.best_ask - self.tick_size,
                ask_size=self.order_size
            )

        return None
```

### AI-Enhanced Trading Agent

Modern agents combine ML models with traditional strategies:

```python
class AITradingAgent:
    """Trading agent with ML-based decision making."""

    def __init__(self, config: AITradingConfig):
        # Market prediction model
        self.price_model = PricePredictionModel.load(config.model_path)

        # Sentiment analysis
        self.sentiment_analyzer = FinancialSentimentModel()

        # Traditional technical analysis
        self.technical_analyzer = TechnicalAnalyzer()

        # Portfolio optimizer
        self.optimizer = PortfolioOptimizer(
            risk_aversion=config.risk_aversion
        )

        # LLM for research and reasoning
        self.llm = FinancialLLM(config.llm_config)

    async def analyze_and_trade(self, symbol: str) -> TradingDecision:
        """Full analysis pipeline."""

        # 1. Gather data
        price_data = await self._get_price_history(symbol)
        news = await self._get_recent_news(symbol)
        filings = await self._get_sec_filings(symbol)

        # 2. Run ML models
        price_forecast = self.price_model.predict(price_data)
        sentiment_score = self.sentiment_analyzer.analyze(news)
        technical_signals = self.technical_analyzer.analyze(price_data)

        # 3. LLM reasoning over qualitative data
        llm_analysis = await self.llm.analyze(
            f"""
            Analyze {symbol} for trading decision.

            Recent news summary: {self._summarize_news(news)}
            Recent filings: {self._summarize_filings(filings)}
            Technical signals: {technical_signals}
            Sentiment score: {sentiment_score}

            Provide:
            1. Key factors affecting the stock
            2. Potential risks not captured in quantitative data
            3. Recommended position sizing (conservative/moderate/aggressive)
            """
        )

        # 4. Combine signals
        combined_signal = self._combine_signals(
            price_forecast=price_forecast,
            sentiment=sentiment_score,
            technical=technical_signals,
            qualitative=llm_analysis
        )

        # 5. Optimize position
        optimal_position = self.optimizer.optimize(
            signal=combined_signal,
            current_portfolio=self.portfolio,
            constraints=self.risk_constraints
        )

        return TradingDecision(
            symbol=symbol,
            action=optimal_position.action,
            size=optimal_position.size,
            rationale=self._generate_rationale(combined_signal, llm_analysis)
        )
```

## Robo-Advisor Architecture

```python
class RoboAdvisor:
    """Automated investment advisor with fiduciary awareness."""

    def __init__(self, config: AdvisorConfig):
        self.portfolio_engine = PortfolioEngine()
        self.risk_profiler = RiskProfiler()
        self.tax_optimizer = TaxOptimizer()
        self.rebalancer = AutoRebalancer()
        self.llm = FinancialAdvisorLLM()

    async def onboard_client(self, client: Client) -> InvestmentPlan:
        """Create personalized investment plan."""

        # 1. Risk profiling
        risk_assessment = await self.risk_profiler.assess(
            questionnaire_responses=client.questionnaire,
            financial_situation=client.financial_data
        )

        # 2. Goal analysis
        goals = await self._analyze_goals(client.stated_goals)

        # 3. Generate suitable portfolios
        portfolio_options = self.portfolio_engine.generate_options(
            risk_profile=risk_assessment.risk_score,
            goals=goals,
            constraints=client.constraints
        )

        # 4. Suitability check (regulatory requirement)
        suitable_options = []
        for portfolio in portfolio_options:
            suitability = await self._check_suitability(
                portfolio=portfolio,
                client=client,
                risk_profile=risk_assessment
            )
            if suitability.is_suitable:
                suitable_options.append((portfolio, suitability))

        # 5. Present to client with explanations
        return InvestmentPlan(
            client_id=client.id,
            risk_profile=risk_assessment,
            recommended_portfolios=suitable_options,
            explanation=await self._generate_explanation(
                client, risk_assessment, suitable_options
            )
        )

    async def _check_suitability(
        self,
        portfolio: Portfolio,
        client: Client,
        risk_profile: RiskProfile
    ) -> SuitabilityAssessment:
        """Ensure portfolio is suitable for client (regulatory requirement)."""

        checks = []

        # Risk tolerance match
        if portfolio.volatility > risk_profile.max_acceptable_volatility:
            checks.append(SuitabilityCheck(
                passed=False,
                reason="Portfolio volatility exceeds client risk tolerance"
            ))

        # Liquidity needs
        if client.liquidity_needs.emergency_fund_months > 0:
            liquid_assets = portfolio.get_liquid_value()
            required = client.monthly_expenses * client.liquidity_needs.emergency_fund_months
            if liquid_assets < required:
                checks.append(SuitabilityCheck(
                    passed=False,
                    reason="Insufficient liquidity for emergency needs"
                ))

        # Time horizon
        if client.investment_horizon < 5 and portfolio.equity_allocation > 0.7:
            checks.append(SuitabilityCheck(
                passed=False,
                reason="High equity allocation not suitable for short time horizon"
            ))

        # Concentration limits
        for holding in portfolio.holdings:
            if holding.weight > 0.25:  # 25% concentration limit
                checks.append(SuitabilityCheck(
                    passed=False,
                    reason=f"Excessive concentration in {holding.symbol}"
                ))

        return SuitabilityAssessment(
            is_suitable=all(c.passed for c in checks),
            checks=checks
        )
```

## Risk Management

### Position Sizing with AI

```python
class AIRiskManager:
    """Risk management with ML-enhanced predictions."""

    def calculate_position_size(
        self,
        signal: TradingSignal,
        portfolio: Portfolio,
        market_conditions: MarketConditions
    ) -> PositionSize:
        """Kelly-criterion based sizing with ML adjustments."""

        # Base Kelly calculation
        win_rate = signal.estimated_win_rate
        win_loss_ratio = signal.expected_profit / signal.expected_loss
        kelly_fraction = win_rate - ((1 - win_rate) / win_loss_ratio)

        # Adjust for model uncertainty
        model_confidence = signal.model_confidence
        adjusted_kelly = kelly_fraction * model_confidence

        # Adjust for market regime
        regime = self._classify_market_regime(market_conditions)
        regime_multiplier = {
            "low_volatility": 1.0,
            "normal": 0.8,
            "high_volatility": 0.5,
            "crisis": 0.2
        }[regime]

        # Apply limits
        final_fraction = min(
            adjusted_kelly * regime_multiplier,
            self.max_position_fraction,
            self._liquidity_limit(signal.symbol)
        )

        return PositionSize(
            fraction=final_fraction,
            dollar_amount=portfolio.equity * final_fraction,
            rationale={
                "base_kelly": kelly_fraction,
                "confidence_adjusted": adjusted_kelly,
                "regime": regime,
                "final": final_fraction
            }
        )


class ValueAtRiskCalculator:
    """Calculate VaR with AI enhancements."""

    async def calculate_var(
        self,
        portfolio: Portfolio,
        confidence: float = 0.99,
        horizon_days: int = 1
    ) -> VaRResult:
        """Calculate Value at Risk."""

        # Historical simulation
        historical_var = self._historical_var(portfolio, confidence, horizon_days)

        # Parametric VaR
        parametric_var = self._parametric_var(portfolio, confidence, horizon_days)

        # Monte Carlo VaR with AI-enhanced correlations
        mc_var = await self._monte_carlo_var(
            portfolio,
            confidence,
            horizon_days,
            correlation_model=self.ai_correlation_model
        )

        # Ensemble result
        return VaRResult(
            historical=historical_var,
            parametric=parametric_var,
            monte_carlo=mc_var,
            recommended=self._ensemble_var(historical_var, parametric_var, mc_var),
            confidence_level=confidence,
            horizon_days=horizon_days
        )
```

## Compliance and Audit

### Trade Surveillance Agent

```python
class TradeSurveillanceAgent:
    """Monitor for market manipulation and compliance violations."""

    PATTERNS = [
        "spoofing",        # Placing orders with intent to cancel
        "layering",        # Multiple orders to create false impression
        "wash_trading",    # Trading with oneself
        "front_running",   # Trading ahead of client orders
        "pump_and_dump",   # Coordinated price manipulation
    ]

    async def monitor_trading(self, orders: Stream[Order]) -> Stream[Alert]:
        """Real-time trade monitoring."""

        async for order in orders:
            # Update order book state
            self.order_tracker.update(order)

            # Check each pattern
            for pattern in self.PATTERNS:
                detection = await self._check_pattern(pattern, order)
                if detection.triggered:
                    yield Alert(
                        pattern=pattern,
                        severity=detection.severity,
                        order=order,
                        evidence=detection.evidence,
                        recommendation=await self._generate_recommendation(detection)
                    )

    async def _check_pattern(self, pattern: str, order: Order) -> Detection:
        """Check for specific manipulation pattern."""

        if pattern == "spoofing":
            return self._detect_spoofing(order)
        elif pattern == "wash_trading":
            return await self._detect_wash_trading(order)
        # ... other patterns

    def _detect_spoofing(self, order: Order) -> Detection:
        """Detect spoofing behavior."""

        # Get trader's recent order history
        recent_orders = self.order_tracker.get_trader_orders(
            order.trader_id,
            lookback_seconds=60
        )

        # Check for pattern: large orders quickly cancelled
        cancellation_rate = self._calculate_cancellation_rate(recent_orders)
        avg_order_lifetime = self._calculate_avg_lifetime(recent_orders)
        size_vs_typical = order.size / self._get_typical_size(order.trader_id)

        # Score the behavior
        spoof_score = (
            0.4 * (cancellation_rate > 0.9) +
            0.3 * (avg_order_lifetime < 1.0) +  # Less than 1 second
            0.3 * (size_vs_typical > 10)         # 10x typical size
        )

        return Detection(
            triggered=spoof_score > 0.7,
            severity="high" if spoof_score > 0.9 else "medium",
            evidence={
                "cancellation_rate": cancellation_rate,
                "avg_lifetime_seconds": avg_order_lifetime,
                "size_multiple": size_vs_typical,
                "spoof_score": spoof_score
            }
        )
```

### Audit Trail

```python
class FinancialAuditLogger:
    """Comprehensive audit logging for financial agents."""

    async def log_decision(self, decision: TradingDecision):
        """Log trading decision with full context."""

        audit_record = AuditRecord(
            timestamp=datetime.utcnow(),
            decision_id=decision.id,

            # The decision
            action=decision.action,
            symbol=decision.symbol,
            quantity=decision.quantity,
            price=decision.price,

            # Inputs that led to decision
            market_data_snapshot=self._capture_market_state(),
            model_inputs=decision.model_inputs,
            model_version=decision.model_version,

            # Reasoning
            signal_sources=decision.signal_sources,
            signal_weights=decision.signal_weights,
            llm_reasoning=decision.llm_analysis,

            # Risk checks
            risk_checks_passed=decision.risk_checks,
            position_sizing_rationale=decision.sizing_rationale,

            # Compliance
            suitability_check=decision.suitability,
            regulatory_flags=decision.compliance_flags,

            # Cryptographic proof
            hash=self._compute_hash(decision),
            signature=self._sign(decision)
        )

        # Store immutably
        await self.audit_store.append(audit_record)

        # Report to compliance if flagged
        if decision.compliance_flags:
            await self.compliance_reporter.report(audit_record)
```

## Integration with BASIS

Financial agents benefit significantly from the BASIS trust framework:

```python
class BASISFinancialAgent:
    """Financial agent with BASIS integration."""

    async def execute_trade(self, trade: Trade) -> TradeResult:
        """Execute trade with BASIS verification."""

        # 1. Verify counterparty trust
        if trade.counterparty:
            counterparty_score = await self.basis.get_trust_score(
                trade.counterparty.did
            )
            if counterparty_score.overall < self.min_counterparty_trust:
                return TradeResult(
                    success=False,
                    reason=f"Counterparty trust score {counterparty_score.overall} "
                           f"below threshold {self.min_counterparty_trust}"
                )

        # 2. Check capability authorization
        required_cap = self._get_required_capability(trade)
        if not await self.basis.verify_capability(self.did, required_cap):
            return TradeResult(
                success=False,
                reason=f"Missing capability: {required_cap}"
            )

        # 3. Log pre-trade attestation
        pre_trade_attestation = await self.basis.create_attestation({
            "type": "pre_trade",
            "trade": trade.to_dict(),
            "timestamp": datetime.utcnow().isoformat()
        })

        # 4. Execute trade
        result = await self._execute(trade)

        # 5. Log post-trade attestation
        await self.basis.create_attestation({
            "type": "post_trade",
            "trade": trade.to_dict(),
            "result": result.to_dict(),
            "pre_trade_ref": pre_trade_attestation.id
        })

        return result
```

## Research and Future Directions

- **Explainable AI for finance**: Regulatory-compliant decision explanations
- **Real-time risk assessment**: ML-enhanced stress testing
- **Decentralized finance (DeFi) agents**: Smart contract interactions
- **Cross-market intelligence**: Multi-market arbitrage detection
- **Regulatory AI**: Automated compliance checking

---

## See Also

- [Trust Scoring](../safety/trust-scoring.md) - Evaluating agent trustworthiness
- [Capability Gating](../safety/capability-gating.md) - Permission management
- [Audit Trails](../safety/audit-trails.md) - Compliance logging
- [BASIS Standard](../protocols/basis-standard.md) - Trust framework
