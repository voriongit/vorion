# Color Theming & Branding Guide
## For: Designers, Marketing, Documentation Teams

### Vorion Brand Colors

```mermaid
mindmap
  root((Vorion<br/>Brand))
    Primary
      Vorion Blue: #1565C0
      Vorion Dark: #0D47A1
      Vorion Light: #42A5F5
    Secondary
      Trust Green: #2E7D32
      Alert Amber: #F57F17
      Error Red: #C62828
    Neutral
      Dark Gray: #212121
      Medium Gray: #757575
      Light Gray: #E0E0E0
      White: #FFFFFF
    Accent
      Purple: #7B1FA2
      Teal: #00838F
```

### Product Brand Colors

```mermaid
flowchart LR
    subgraph "BASIS"
        B_PRIMARY["#1565C0<br/>Vorion Blue"]
        B_ACCENT["#7B1FA2<br/>Purple"]
    end

    subgraph "AgentAnchor"
        AA_PRIMARY["#00838F<br/>Teal"]
        AA_ACCENT["#F57F17<br/>Amber"]
    end

    subgraph "Kaizen"
        K_PRIMARY["#2E7D32<br/>Trust Green"]
        K_ACCENT["#1565C0<br/>Blue"]
    end

    subgraph "Cognigate"
        CG_PRIMARY["#7B1FA2<br/>Purple"]
        CG_ACCENT["#00838F<br/>Teal"]
    end

    subgraph "Aurais"
        A_PRIMARY["#1565C0<br/>Vorion Blue"]
        A_CORE["Core: Standard"]
        A_PRO["Pro: #7B1FA2"]
        A_EXEC["Exec: #0D47A1"]
    end
```

### Trust Tier Colors

```mermaid
flowchart TB
    subgraph "Trust Tier Color Palette"
        T0["T0 SANDBOX<br/>#FFCDD2<br/>Light Red"]
        T1["T1 PROVISIONAL<br/>#FFE0B2<br/>Light Orange"]
        T2["T2 STANDARD<br/>#FFF9C4<br/>Light Yellow"]
        T3["T3 TRUSTED<br/>#C8E6C9<br/>Light Green"]
        T4["T4 CERTIFIED<br/>#B2DFDB<br/>Light Teal"]
        T5["T5 AUTONOMOUS<br/>#BBDEFB<br/>Light Blue"]
    end

    style T0 fill:#FFCDD2,stroke:#B71C1C
    style T1 fill:#FFE0B2,stroke:#E65100
    style T2 fill:#FFF9C4,stroke:#F57F17
    style T3 fill:#C8E6C9,stroke:#2E7D32
    style T4 fill:#B2DFDB,stroke:#00838F
    style T5 fill:#BBDEFB,stroke:#1565C0
```

### Status Colors

```mermaid
flowchart LR
    subgraph "Status Indicators"
        SUCCESS["SUCCESS<br/>#C8E6C9 / #2E7D32"]
        WARNING["WARNING<br/>#FFF9C4 / #F57F17"]
        ERROR["ERROR<br/>#FFCDD2 / #C62828"]
        INFO["INFO<br/>#BBDEFB / #1565C0"]
        NEUTRAL["NEUTRAL<br/>#E0E0E0 / #757575"]
    end

    style SUCCESS fill:#C8E6C9,stroke:#2E7D32
    style WARNING fill:#FFF9C4,stroke:#F57F17
    style ERROR fill:#FFCDD2,stroke:#C62828
    style INFO fill:#BBDEFB,stroke:#1565C0
    style NEUTRAL fill:#E0E0E0,stroke:#757575
```

### Mermaid Theme Configuration

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#1565C0',
  'primaryTextColor': '#FFFFFF',
  'primaryBorderColor': '#0D47A1',
  'lineColor': '#757575',
  'secondaryColor': '#E3F2FD',
  'tertiaryColor': '#F5F5F5',
  'successColor': '#C8E6C9',
  'successBorderColor': '#2E7D32',
  'errorColor': '#FFCDD2',
  'errorBorderColor': '#C62828'
}}}%%

flowchart LR
    A[Themed Box] --> B[Styled Element]
    B --> C[Consistent Look]
```

### CSS Variables for Diagrams

```css
/* Vorion Diagram Theme Variables */
:root {
  /* Primary Brand */
  --vorion-blue: #1565C0;
  --vorion-dark: #0D47A1;
  --vorion-light: #42A5F5;

  /* Trust Tiers */
  --tier-0-bg: #FFCDD2;
  --tier-0-border: #B71C1C;
  --tier-1-bg: #FFE0B2;
  --tier-1-border: #E65100;
  --tier-2-bg: #FFF9C4;
  --tier-2-border: #F57F17;
  --tier-3-bg: #C8E6C9;
  --tier-3-border: #2E7D32;
  --tier-4-bg: #B2DFDB;
  --tier-4-border: #00838F;
  --tier-5-bg: #BBDEFB;
  --tier-5-border: #1565C0;

  /* Status */
  --success-bg: #C8E6C9;
  --success-text: #2E7D32;
  --warning-bg: #FFF9C4;
  --warning-text: #F57F17;
  --error-bg: #FFCDD2;
  --error-text: #C62828;
  --info-bg: #BBDEFB;
  --info-text: #1565C0;

  /* Neutral */
  --gray-900: #212121;
  --gray-600: #757575;
  --gray-200: #E0E0E0;
  --white: #FFFFFF;
}
```

### Applying Styles in Mermaid

```markdown
## Inline Styling Example

\`\`\`mermaid
flowchart TB
    A[Standard Node]
    B[Success Node]
    C[Error Node]
    D[Warning Node]

    A --> B
    A --> C
    A --> D

    style B fill:#C8E6C9,stroke:#2E7D32
    style C fill:#FFCDD2,stroke:#C62828
    style D fill:#FFF9C4,stroke:#F57F17
\`\`\`
```

### Layer Color Coding

```mermaid
flowchart TB
    subgraph "Kaizen Layers"
        L1["Layer 1: BASIS<br/>#E3F2FD (Light Blue)"]
        L2["Layer 2: INTENT<br/>#E8F5E9 (Light Green)"]
        L3["Layer 3: ENFORCE<br/>#FFF3E0 (Light Orange)"]
        L4["Layer 4: PROOF<br/>#F3E5F5 (Light Purple)"]
    end

    style L1 fill:#E3F2FD,stroke:#1565C0
    style L2 fill:#E8F5E9,stroke:#2E7D32
    style L3 fill:#FFF3E0,stroke:#E65100
    style L4 fill:#F3E5F5,stroke:#7B1FA2
```

### Icon Conventions

```mermaid
flowchart LR
    subgraph "Icon Usage"
        I1["✓ Success / Approved"]
        I2["✗ Failure / Denied"]
        I3["⚠ Warning / Attention"]
        I4["ℹ Information"]
        I5["● Certified"]
        I6["◐ Verified"]
        I7["○ Registered"]
        I8["★ Certified+"]
    end
```

### Typography in Diagrams

```mermaid
flowchart TB
    subgraph "Typography Guidelines"
        T1["UPPERCASE: Titles, Layer Names"]
        T2["Title Case: Node Labels, Statuses"]
        T3["lowercase: technical identifiers"]
        T4["Code: API endpoints, variables"]
    end
```

### Dark Mode Support

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
    subgraph "Dark Theme"
        A[Dark Background] --> B[Light Text]
        B --> C[High Contrast]
    end
```

### Color Accessibility

```mermaid
flowchart TB
    subgraph "Accessibility Guidelines"
        A1["Minimum contrast ratio: 4.5:1"]
        A2["Don't rely on color alone"]
        A3["Use patterns + colors"]
        A4["Test with color blindness simulators"]
    end

    subgraph "Color Blind Safe Palette"
        CB1["Blue: #1565C0 ✓"]
        CB2["Orange: #E65100 ✓"]
        CB3["Use shapes to distinguish"]
    end
```

### Gradient Usage (Presentations Only)

```mermaid
flowchart LR
    subgraph "Gradient Guidelines"
        G1["Web/Docs: Solid colors only"]
        G2["Presentations: Subtle gradients OK"]
        G3["Print: Check CMYK conversion"]
    end
```

### Complete Color Reference Table

| Purpose | Light Mode | Dark Mode | Hex |
|---------|-----------|-----------|-----|
| **Primary** | Vorion Blue | Vorion Light | #1565C0 / #42A5F5 |
| **Background** | White | Dark Gray | #FFFFFF / #212121 |
| **Text** | Dark Gray | Light Gray | #212121 / #E0E0E0 |
| **Border** | Medium Gray | Medium Gray | #757575 |
| **Link** | Vorion Blue | Vorion Light | #1565C0 / #42A5F5 |
| **Success** | Green | Light Green | #2E7D32 / #C8E6C9 |
| **Warning** | Amber | Light Amber | #F57F17 / #FFF9C4 |
| **Error** | Red | Light Red | #C62828 / #FFCDD2 |

### Brand Asset Locations

```mermaid
flowchart TB
    subgraph "Asset Repository"
        A1["Logo: /assets/logo/"]
        A2["Icons: /assets/icons/"]
        A3["Fonts: /assets/fonts/"]
        A4["Colors: /assets/colors.css"]
    end

    subgraph "File Formats"
        F1["SVG (preferred)"]
        F2["PNG (web)"]
        F3["PDF (print)"]
        F4["EPS (legacy)"]
    end

    A1 --> F1
    A1 --> F2
    A2 --> F1
    A3 --> F3
```
