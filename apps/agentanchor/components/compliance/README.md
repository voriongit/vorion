# Compliance Dashboard Components

React components for displaying compliance status across SOC 2, HIPAA, and ISO 27001 frameworks.

## Components

### ComplianceDashboard

Main dashboard component that aggregates all compliance widgets.

```tsx
import { ComplianceDashboard } from '@/components/compliance';

export default function CompliancePage() {
  return (
    <div className="container mx-auto p-6">
      <ComplianceDashboard />
    </div>
  );
}
```

**Features:**
- Overall compliance score
- Framework-specific scores (SOC 2, HIPAA, ISO 27001)
- Control status overview
- Risk statistics
- Key metrics
- Recent alerts

### ComplianceScoreCard

Individual score card for displaying compliance metrics.

```tsx
import { ComplianceScoreCard } from '@/components/compliance';

<ComplianceScoreCard
  title="SOC 2"
  score={85}
  trend="improving"
  icon="lock"
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Card title |
| `score` | number | Compliance score (0-100) |
| `trend` | 'improving' \| 'stable' \| 'declining' | Score trend |
| `icon` | 'shield' \| 'lock' \| 'heart' \| 'globe' | Icon type |
| `className` | string | Additional CSS classes |

### FrameworkStatus

Visualizes control status distribution.

```tsx
import { FrameworkStatus } from '@/components/compliance';

<FrameworkStatus
  controlStats={{
    total: 100,
    compliant: 75,
    nonCompliant: 5,
    partial: 15,
    notApplicable: 5,
  }}
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `controlStats` | object | Control statistics |
| `className` | string | Additional CSS classes |

### RiskOverview

Displays risk statistics by category and severity.

```tsx
import { RiskOverview } from '@/components/compliance';

<RiskOverview
  riskStats={{
    total: 25,
    byCategory: {
      security: 10,
      operational: 5,
      compliance: 4,
      reputational: 3,
      financial: 3,
    },
    highRisk: 3,
    criticalRisk: 1,
  }}
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `riskStats` | object | Risk statistics |
| `className` | string | Additional CSS classes |

### ComplianceMetrics

Grid of key compliance metrics with progress indicators.

```tsx
import { ComplianceMetrics } from '@/components/compliance';

<ComplianceMetrics
  metrics={[
    {
      id: 'metric_1',
      name: 'Access Review Completion',
      description: 'Quarterly access reviews completed',
      framework: 'soc2',
      controlId: 'CC6.4',
      currentValue: 95,
      target: 100,
      threshold: 90,
      unit: '%',
      frequency: 'monthly',
      lastUpdated: new Date(),
      trend: 'stable',
    },
  ]}
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `metrics` | ComplianceMetric[] | Array of metrics |
| `className` | string | Additional CSS classes |

### RecentAlerts

List of recent compliance alerts with severity indicators.

```tsx
import { RecentAlerts } from '@/components/compliance';

<RecentAlerts
  alerts={[
    {
      id: 'alert_1',
      timestamp: new Date(),
      framework: 'hipaa',
      controlId: '164.312(b)',
      severity: 'high',
      title: 'Audit Log Gap Detected',
      description: 'Missing audit logs for 2-hour period',
      acknowledged: false,
      resolved: false,
    },
  ]}
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `alerts` | ComplianceAlert[] | Array of alerts |
| `className` | string | Additional CSS classes |

## Styling

Components use Tailwind CSS and support dark mode via `dark:` variants.

### Color Scheme

| Score Range | Color |
|-------------|-------|
| 80-100 | Green |
| 60-79 | Yellow |
| 0-59 | Red |

### Severity Colors

| Severity | Color |
|----------|-------|
| Critical | Red |
| High | Orange |
| Medium | Yellow |
| Low | Blue |
| Informational | Gray |

## Data Fetching

The `ComplianceDashboard` component fetches data from `/api/compliance`:

```typescript
const response = await fetch('/api/compliance');
const { dashboard, metrics } = await response.json();
```

## Customization

### Custom Theme

Override Tailwind classes via `className` prop:

```tsx
<ComplianceScoreCard
  title="Custom"
  score={90}
  trend="stable"
  icon="shield"
  className="bg-blue-50 border-blue-200"
/>
```

### Custom Data Source

Create a wrapper component with custom data fetching:

```tsx
function CustomComplianceDashboard() {
  const { data, isLoading } = useCustomComplianceData();

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <ComplianceScoreCard {...data.score} />
      <FrameworkStatus {...data.controls} />
    </div>
  );
}
```

## Integration

### Next.js App Router

```tsx
// app/compliance/page.tsx
import { ComplianceDashboard } from '@/components/compliance';

export default function CompliancePage() {
  return <ComplianceDashboard />;
}
```

### With Authentication

```tsx
// app/compliance/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ComplianceDashboard } from '@/components/compliance';

export default async function CompliancePage() {
  const session = await auth();

  if (!session?.user?.role === 'compliance_officer') {
    redirect('/unauthorized');
  }

  return <ComplianceDashboard />;
}
```

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast meets WCAG 2.1 AA
- Screen reader compatible

## Performance

- Lazy loading for large alert lists
- Memoized calculations
- Optimistic UI updates
- 5-second auto-refresh (configurable)
