# Quick Start

Get up and running with ATSF in 5 minutes.

## Installation

```bash
pip install atsf
```

## Basic Usage

```python
from atsf import ATSF

# Initialize ATSF
atsf = ATSF()

# Register a creator (optional)
atsf.register_creator("my_company", tier="enterprise")

# Create an agent
agent = atsf.create_agent(
    "data_analyzer",
    "my_company",
    tier="gray_box"
)

# Execute actions with trust scoring
result = agent.execute(
    action_type="read",
    payload={"target": "sales_data.csv"},
    reasoning="Loading sales data for Q4 analysis"
)

# Check the result
print(f"Decision: {result.decision}")      # allow, deny, or allow_monitored
print(f"Trust Score: {result.trust_score:.3f}")
print(f"Risk Score: {result.risk_score:.3f}")

# Get agent insights
insights = agent.get_insights()
print(f"Total Actions: {insights['total_actions']}")
```

## Real-time Events

```python
from atsf import ATSF, EventType

atsf = ATSF()

# Subscribe to events
def on_action_denied(event):
    print(f"⚠️ Denied: {event.data}")

atsf.on_event(EventType.ACTION_DENIED, on_action_denied)
```

## Next Steps

- [Configuration Guide](configuration.md)
- [Trust Scoring](../concepts/trust-scoring.md)
- [Security Layers](../security/layer-reference.md)
