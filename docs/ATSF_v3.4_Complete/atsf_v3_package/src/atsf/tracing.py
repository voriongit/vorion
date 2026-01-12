"""
ATSF OpenTelemetry Tracing
==========================

Distributed tracing and observability for ATSF.

Features:
- Automatic span creation for actions
- Trust score attributes on spans
- Trace context propagation
- Integration with Jaeger, Zipkin, etc.
- Custom metrics export

Usage:
    from atsf.tracing import ATSFTracer, setup_tracing
    
    # Setup tracing
    setup_tracing(service_name="atsf", endpoint="http://jaeger:4317")
    
    # Use tracer
    tracer = ATSFTracer()
    with tracer.action_span("read", agent_id="agent_001"):
        # Action execution
        pass

Author: ATSF Development Team
Version: 3.4.0
"""

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable
from contextlib import contextmanager
from dataclasses import dataclass
from functools import wraps
import threading

logger = logging.getLogger("atsf.tracing")


# =============================================================================
# MOCK OPENTELEMETRY (for when OTel is not installed)
# =============================================================================

class MockSpan:
    """Mock span for when OpenTelemetry is not available."""
    
    def __init__(self, name: str, attributes: Dict = None):
        self.name = name
        self.attributes = attributes or {}
        self.events: List[Dict] = []
        self.status = "OK"
        self.start_time = time.time()
        self.end_time = None
    
    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value
    
    def set_attributes(self, attributes: Dict) -> None:
        self.attributes.update(attributes)
    
    def add_event(self, name: str, attributes: Dict = None) -> None:
        self.events.append({
            "name": name,
            "timestamp": time.time(),
            "attributes": attributes or {}
        })
    
    def set_status(self, status: str, description: str = None) -> None:
        self.status = status
    
    def record_exception(self, exception: Exception) -> None:
        self.add_event("exception", {
            "exception.type": type(exception).__name__,
            "exception.message": str(exception)
        })
        self.status = "ERROR"
    
    def end(self) -> None:
        self.end_time = time.time()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.record_exception(exc_val)
        self.end()
        return False


class MockTracer:
    """Mock tracer for when OpenTelemetry is not available."""
    
    def __init__(self, name: str = "atsf"):
        self.name = name
        self._spans: List[MockSpan] = []
    
    def start_span(self, name: str, attributes: Dict = None) -> MockSpan:
        span = MockSpan(name, attributes)
        self._spans.append(span)
        return span
    
    @contextmanager
    def start_as_current_span(self, name: str, attributes: Dict = None):
        span = self.start_span(name, attributes)
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            raise
        finally:
            span.end()
    
    def get_spans(self) -> List[MockSpan]:
        return self._spans.copy()
    
    def clear_spans(self) -> None:
        self._spans.clear()


class MockMeter:
    """Mock meter for metrics when OpenTelemetry is not available."""
    
    def __init__(self, name: str = "atsf"):
        self.name = name
        self._counters: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = {}
        self._gauges: Dict[str, float] = {}
    
    def create_counter(self, name: str, description: str = "", unit: str = ""):
        return MockCounter(name, self._counters)
    
    def create_histogram(self, name: str, description: str = "", unit: str = ""):
        return MockHistogram(name, self._histograms)
    
    def create_up_down_counter(self, name: str, description: str = "", unit: str = ""):
        return MockCounter(name, self._counters)
    
    def create_observable_gauge(self, name: str, callback: Callable, description: str = "", unit: str = ""):
        return MockObservableGauge(name, callback, self._gauges)


class MockCounter:
    def __init__(self, name: str, storage: Dict):
        self.name = name
        self._storage = storage
        self._storage[name] = 0
    
    def add(self, amount: float, attributes: Dict = None) -> None:
        self._storage[self.name] += amount


class MockHistogram:
    def __init__(self, name: str, storage: Dict):
        self.name = name
        self._storage = storage
        self._storage[name] = []
    
    def record(self, value: float, attributes: Dict = None) -> None:
        self._storage[self.name].append(value)


class MockObservableGauge:
    def __init__(self, name: str, callback: Callable, storage: Dict):
        self.name = name
        self.callback = callback
        self._storage = storage


# =============================================================================
# TRACING SETUP
# =============================================================================

_tracer: Optional[Any] = None
_meter: Optional[Any] = None
_using_mock = True


def setup_tracing(
    service_name: str = "atsf",
    endpoint: str = None,
    use_console: bool = False,
    sample_rate: float = 1.0
) -> bool:
    """
    Setup OpenTelemetry tracing.
    
    Args:
        service_name: Name of the service for tracing
        endpoint: OTLP endpoint (e.g., "http://jaeger:4317")
        use_console: Export to console for debugging
        sample_rate: Sampling rate (0.0 to 1.0)
    
    Returns:
        True if real OTel was setup, False if using mock
    """
    global _tracer, _meter, _using_mock
    
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.semconv.resource import ResourceAttributes
        from opentelemetry import metrics
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import ConsoleMetricExporter, PeriodicExportingMetricReader
        
        # Setup resource
        resource = Resource.create({
            ResourceAttributes.SERVICE_NAME: service_name,
            ResourceAttributes.SERVICE_VERSION: "3.4.0"
        })
        
        # Setup tracer provider
        provider = TracerProvider(resource=resource)
        
        if endpoint:
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
                otlp_exporter = OTLPSpanExporter(endpoint=endpoint)
                provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            except ImportError:
                logger.warning("OTLP exporter not available")
        
        if use_console:
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        
        trace.set_tracer_provider(provider)
        _tracer = trace.get_tracer("atsf", "3.4.0")
        
        # Setup meter provider
        if use_console:
            reader = PeriodicExportingMetricReader(ConsoleMetricExporter())
            meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
        else:
            meter_provider = MeterProvider(resource=resource)
        
        metrics.set_meter_provider(meter_provider)
        _meter = metrics.get_meter("atsf", "3.4.0")
        
        _using_mock = False
        logger.info(f"OpenTelemetry tracing initialized for {service_name}")
        return True
        
    except ImportError:
        logger.warning("OpenTelemetry not installed, using mock tracer")
        _tracer = MockTracer("atsf")
        _meter = MockMeter("atsf")
        _using_mock = True
        return False


def get_tracer():
    """Get the configured tracer."""
    global _tracer
    if _tracer is None:
        _tracer = MockTracer("atsf")
    return _tracer


def get_meter():
    """Get the configured meter."""
    global _meter
    if _meter is None:
        _meter = MockMeter("atsf")
    return _meter


# =============================================================================
# ATSF TRACER
# =============================================================================

class ATSFTracer:
    """
    ATSF-specific tracer with pre-configured spans and attributes.
    
    Usage:
        tracer = ATSFTracer()
        
        # Trace an action
        with tracer.action_span("read", agent_id="agent_001") as span:
            result = process_action(...)
            span.set_attribute("atsf.decision", result.decision)
        
        # Trace trust calculation
        with tracer.trust_span("agent_001") as span:
            trust = calculate_trust(...)
            span.set_attribute("atsf.trust_score", trust)
    """
    
    # Standard ATSF attributes
    ATTR_AGENT_ID = "atsf.agent_id"
    ATTR_CREATOR_ID = "atsf.creator_id"
    ATTR_ACTION_TYPE = "atsf.action_type"
    ATTR_DECISION = "atsf.decision"
    ATTR_TRUST_SCORE = "atsf.trust_score"
    ATTR_TRUST_DELTA = "atsf.trust_delta"
    ATTR_RISK_SCORE = "atsf.risk_score"
    ATTR_PROCESSING_TIME = "atsf.processing_time_ms"
    ATTR_TIER = "atsf.tier"
    
    def __init__(self):
        self._tracer = get_tracer()
        self._meter = get_meter()
        
        # Create metrics
        self._action_counter = self._meter.create_counter(
            "atsf.actions.total",
            description="Total number of actions processed",
            unit="1"
        )
        
        self._action_latency = self._meter.create_histogram(
            "atsf.action.latency",
            description="Action processing latency",
            unit="ms"
        )
        
        self._trust_histogram = self._meter.create_histogram(
            "atsf.trust.distribution",
            description="Trust score distribution",
            unit="1"
        )
        
        self._denied_counter = self._meter.create_counter(
            "atsf.actions.denied",
            description="Number of denied actions",
            unit="1"
        )
    
    @contextmanager
    def action_span(
        self,
        action_type: str,
        agent_id: str,
        creator_id: str = None,
        attributes: Dict = None
    ):
        """
        Create a span for action processing.
        
        Args:
            action_type: Type of action being performed
            agent_id: ID of the agent
            creator_id: Optional creator ID
            attributes: Additional span attributes
        """
        span_attrs = {
            self.ATTR_AGENT_ID: agent_id,
            self.ATTR_ACTION_TYPE: action_type,
        }
        
        if creator_id:
            span_attrs[self.ATTR_CREATOR_ID] = creator_id
        
        if attributes:
            span_attrs.update(attributes)
        
        start_time = time.time()
        
        if _using_mock:
            with self._tracer.start_as_current_span(
                f"atsf.action.{action_type}",
                attributes=span_attrs
            ) as span:
                try:
                    yield span
                finally:
                    latency = (time.time() - start_time) * 1000
                    span.set_attribute(self.ATTR_PROCESSING_TIME, latency)
                    self._action_latency.record(latency, {"action_type": action_type})
                    self._action_counter.add(1, {"action_type": action_type})
        else:
            with self._tracer.start_as_current_span(
                f"atsf.action.{action_type}",
                attributes=span_attrs
            ) as span:
                try:
                    yield span
                finally:
                    latency = (time.time() - start_time) * 1000
                    span.set_attribute(self.ATTR_PROCESSING_TIME, latency)
                    self._action_latency.record(latency, {"action_type": action_type})
                    self._action_counter.add(1, {"action_type": action_type})
    
    @contextmanager
    def trust_span(self, agent_id: str, attributes: Dict = None):
        """Create a span for trust calculation."""
        span_attrs = {self.ATTR_AGENT_ID: agent_id}
        if attributes:
            span_attrs.update(attributes)
        
        if _using_mock:
            with self._tracer.start_as_current_span(
                "atsf.trust.calculate",
                attributes=span_attrs
            ) as span:
                yield span
        else:
            with self._tracer.start_as_current_span(
                "atsf.trust.calculate",
                attributes=span_attrs
            ) as span:
                yield span
    
    @contextmanager
    def security_span(self, layer: str, agent_id: str, attributes: Dict = None):
        """Create a span for security layer processing."""
        span_attrs = {
            self.ATTR_AGENT_ID: agent_id,
            "atsf.security_layer": layer
        }
        if attributes:
            span_attrs.update(attributes)
        
        if _using_mock:
            with self._tracer.start_as_current_span(
                f"atsf.security.{layer}",
                attributes=span_attrs
            ) as span:
                yield span
        else:
            with self._tracer.start_as_current_span(
                f"atsf.security.{layer}",
                attributes=span_attrs
            ) as span:
                yield span
    
    @contextmanager
    def cognitive_span(self, operation: str, agent_id: str, attributes: Dict = None):
        """Create a span for cognitive cube operations."""
        span_attrs = {
            self.ATTR_AGENT_ID: agent_id,
            "atsf.cognitive_op": operation
        }
        if attributes:
            span_attrs.update(attributes)
        
        if _using_mock:
            with self._tracer.start_as_current_span(
                f"atsf.cognitive.{operation}",
                attributes=span_attrs
            ) as span:
                yield span
        else:
            with self._tracer.start_as_current_span(
                f"atsf.cognitive.{operation}",
                attributes=span_attrs
            ) as span:
                yield span
    
    def record_decision(
        self,
        span: Any,
        decision: str,
        trust_score: float,
        trust_delta: float = 0.0,
        risk_score: float = 0.0
    ) -> None:
        """Record decision attributes on a span."""
        span.set_attributes({
            self.ATTR_DECISION: decision,
            self.ATTR_TRUST_SCORE: trust_score,
            self.ATTR_TRUST_DELTA: trust_delta,
            self.ATTR_RISK_SCORE: risk_score
        })
        
        self._trust_histogram.record(trust_score)
        
        if decision == "deny":
            self._denied_counter.add(1)
    
    def add_event(self, span: Any, name: str, attributes: Dict = None) -> None:
        """Add an event to a span."""
        span.add_event(name, attributes or {})


# =============================================================================
# DECORATOR FOR TRACING
# =============================================================================

def trace_action(action_type: str = None, agent_id_param: str = "agent_id"):
    """
    Decorator to automatically trace function execution.
    
    Usage:
        @trace_action(action_type="read")
        def process_read(agent_id: str, target: str):
            ...
        
        @trace_action()  # Uses function name as action_type
        async def process_action(agent_id: str, action: dict):
            ...
    """
    def decorator(func: Callable):
        tracer = ATSFTracer()
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Get agent_id from kwargs or first arg
            aid = kwargs.get(agent_id_param) or (args[0] if args else "unknown")
            at = action_type or func.__name__
            
            with tracer.action_span(at, aid) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_attribute("atsf.success", True)
                    return result
                except Exception as e:
                    span.set_attribute("atsf.success", False)
                    span.record_exception(e)
                    raise
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            aid = kwargs.get(agent_id_param) or (args[0] if args else "unknown")
            at = action_type or func.__name__
            
            with tracer.action_span(at, aid) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_attribute("atsf.success", True)
                    return result
                except Exception as e:
                    span.set_attribute("atsf.success", False)
                    span.record_exception(e)
                    raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# =============================================================================
# CONTEXT PROPAGATION
# =============================================================================

class TraceContext:
    """
    Trace context for propagation across service boundaries.
    
    Usage:
        # Inject context into headers
        ctx = TraceContext.inject()
        headers["traceparent"] = ctx["traceparent"]
        
        # Extract context from headers
        TraceContext.extract(headers)
    """
    
    _current = threading.local()
    
    @classmethod
    def inject(cls) -> Dict[str, str]:
        """Inject current trace context into a dictionary."""
        if _using_mock:
            # Generate mock trace context
            import uuid
            trace_id = uuid.uuid4().hex
            span_id = uuid.uuid4().hex[:16]
            return {
                "traceparent": f"00-{trace_id}-{span_id}-01",
                "tracestate": "atsf=mock"
            }
        
        try:
            from opentelemetry import trace
            from opentelemetry.propagate import inject
            
            carrier = {}
            inject(carrier)
            return carrier
        except ImportError:
            return {}
    
    @classmethod
    def extract(cls, carrier: Dict[str, str]) -> None:
        """Extract trace context from a dictionary."""
        if _using_mock:
            return
        
        try:
            from opentelemetry.propagate import extract
            context = extract(carrier)
            # Context is automatically attached
        except ImportError:
            pass


# =============================================================================
# METRICS HELPERS
# =============================================================================

class ATSFMetrics:
    """
    ATSF metrics collection helper.
    
    Usage:
        metrics = ATSFMetrics()
        metrics.record_action("read", "allow", 0.75, 5.2)
        metrics.record_trust_change("agent_001", 0.75, 0.01)
    """
    
    def __init__(self):
        self._meter = get_meter()
        
        # Counters
        self.actions_total = self._meter.create_counter(
            "atsf_actions_total",
            description="Total actions processed"
        )
        
        self.actions_denied = self._meter.create_counter(
            "atsf_actions_denied_total",
            description="Total actions denied"
        )
        
        # Histograms
        self.action_latency = self._meter.create_histogram(
            "atsf_action_latency_ms",
            description="Action processing latency in milliseconds"
        )
        
        self.trust_scores = self._meter.create_histogram(
            "atsf_trust_score",
            description="Trust score distribution"
        )
        
        self.risk_scores = self._meter.create_histogram(
            "atsf_risk_score",
            description="Risk score distribution"
        )
    
    def record_action(
        self,
        action_type: str,
        decision: str,
        trust_score: float,
        latency_ms: float,
        agent_id: str = None
    ) -> None:
        """Record action metrics."""
        labels = {"action_type": action_type, "decision": decision}
        if agent_id:
            labels["agent_id"] = agent_id
        
        self.actions_total.add(1, labels)
        self.action_latency.record(latency_ms, labels)
        self.trust_scores.record(trust_score, {"agent_id": agent_id or "unknown"})
        
        if decision == "deny":
            self.actions_denied.add(1, labels)
    
    def record_trust_change(
        self,
        agent_id: str,
        new_trust: float,
        delta: float
    ) -> None:
        """Record trust score change."""
        self.trust_scores.record(new_trust, {"agent_id": agent_id})
    
    def record_risk(self, agent_id: str, risk_score: float) -> None:
        """Record risk score."""
        self.risk_scores.record(risk_score, {"agent_id": agent_id})


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("ATSF OpenTelemetry Tracing Tests")
    print("=" * 70)
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Setup tracing
    tests_total += 1
    try:
        result = setup_tracing(service_name="atsf_test", use_console=False)
        # Will be False since OTel likely not installed
        print(f"  ✓ Tracing setup works (using_mock={_using_mock})")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Tracing setup failed: {e}")
    
    # Test 2: Action span
    tests_total += 1
    try:
        tracer = ATSFTracer()
        
        with tracer.action_span("read", "agent_001") as span:
            span.set_attribute("custom", "value")
            time.sleep(0.01)
        
        print("  ✓ Action span works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Action span failed: {e}")
    
    # Test 3: Trust span
    tests_total += 1
    try:
        tracer = ATSFTracer()
        
        with tracer.trust_span("agent_001") as span:
            span.set_attribute(ATSFTracer.ATTR_TRUST_SCORE, 0.75)
        
        print("  ✓ Trust span works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Trust span failed: {e}")
    
    # Test 4: Record decision
    tests_total += 1
    try:
        tracer = ATSFTracer()
        
        with tracer.action_span("write", "agent_002") as span:
            tracer.record_decision(span, "allow", 0.65, 0.01, 0.2)
        
        print("  ✓ Record decision works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Record decision failed: {e}")
    
    # Test 5: Decorator
    tests_total += 1
    try:
        @trace_action(action_type="test_action")
        def my_function(agent_id: str, data: str):
            return f"processed: {data}"
        
        result = my_function("agent_003", "test_data")
        assert result == "processed: test_data"
        print("  ✓ Trace decorator works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Trace decorator failed: {e}")
    
    # Test 6: Context propagation
    tests_total += 1
    try:
        ctx = TraceContext.inject()
        assert "traceparent" in ctx
        print(f"  ✓ Context propagation works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Context propagation failed: {e}")
    
    # Test 7: Metrics
    tests_total += 1
    try:
        metrics = ATSFMetrics()
        metrics.record_action("read", "allow", 0.75, 5.2, "agent_001")
        metrics.record_trust_change("agent_001", 0.76, 0.01)
        metrics.record_risk("agent_001", 0.15)
        print("  ✓ Metrics recording works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Metrics recording failed: {e}")
    
    # Test 8: Security span
    tests_total += 1
    try:
        tracer = ATSFTracer()
        
        with tracer.security_span("L43_sanitization", "agent_001") as span:
            span.add_event("sanitized", {"items_cleaned": 3})
        
        print("  ✓ Security span works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Security span failed: {e}")
    
    # Test 9: Cognitive span
    tests_total += 1
    try:
        tracer = ATSFTracer()
        
        with tracer.cognitive_span("tkg_traversal", "agent_001") as span:
            span.set_attribute("nodes_visited", 15)
        
        print("  ✓ Cognitive span works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Cognitive span failed: {e}")
    
    # Test 10: Mock span with exception
    tests_total += 1
    try:
        tracer = ATSFTracer()
        
        try:
            with tracer.action_span("error_test", "agent_001") as span:
                raise ValueError("Test error")
        except ValueError:
            pass  # Expected
        
        print("  ✓ Exception handling works")
        tests_passed += 1
    except Exception as e:
        print(f"  ✗ Exception handling failed: {e}")
    
    print()
    print("=" * 70)
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if tests_passed == tests_total:
        print("All tests passed! ✅")
    print("=" * 70)
