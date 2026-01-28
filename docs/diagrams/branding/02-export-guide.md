# Diagram Export Guide
## For: Marketing, Documentation, Presentation Teams

### Export Options Overview

```mermaid
flowchart TB
    subgraph "Source Format"
        SRC[Mermaid Markdown]
    end

    subgraph "Export Targets"
        PNG[PNG<br/>Raster Image]
        SVG[SVG<br/>Vector Image]
        PDF[PDF<br/>Print Ready]
        PPT[PowerPoint<br/>Editable]
    end

    subgraph "Use Cases"
        UC1[Documentation]
        UC2[Presentations]
        UC3[Print Materials]
        UC4[Social Media]
        UC5[Whitepapers]
    end

    SRC --> PNG
    SRC --> SVG
    SRC --> PDF
    SRC --> PPT

    PNG --> UC1
    PNG --> UC4
    SVG --> UC1
    SVG --> UC2
    PDF --> UC3
    PDF --> UC5
    PPT --> UC2
```

### Method 1: Mermaid Live Editor

```mermaid
flowchart LR
    subgraph "Steps"
        S1["1. Go to mermaid.live"]
        S2["2. Paste diagram code"]
        S3["3. Click Actions menu"]
        S4["4. Export as PNG/SVG"]
    end

    S1 --> S2 --> S3 --> S4
```

**URL:** https://mermaid.live

**Features:**
- Real-time preview
- Multiple export formats (PNG, SVG)
- Adjustable resolution
- Theme selection
- Direct link sharing

### Method 2: Mermaid CLI

```bash
# Install
npm install -g @mermaid-js/mermaid-cli

# Export single file
mmdc -i diagram.mmd -o diagram.png
mmdc -i diagram.mmd -o diagram.svg
mmdc -i diagram.mmd -o diagram.pdf

# Export with custom config
mmdc -i diagram.mmd -o diagram.png -c mermaid.config.json

# Batch export
for file in *.mmd; do
  mmdc -i "$file" -o "${file%.mmd}.png"
done
```

### Method 3: VS Code Extension

```mermaid
flowchart TB
    subgraph "Setup"
        S1["Install 'Markdown Preview Mermaid Support'"]
        S2["Or 'Mermaid Markdown Syntax Highlighting'"]
    end

    subgraph "Export Steps"
        E1["Open markdown file"]
        E2["Right-click on diagram"]
        E3["Select 'Export to PNG/SVG'"]
    end

    S1 --> E1
    S2 --> E1
    E1 --> E2 --> E3
```

### Method 4: GitHub Native Rendering

```mermaid
flowchart LR
    subgraph "GitHub Features"
        G1["Renders in README"]
        G2["Renders in Issues"]
        G3["Renders in PRs"]
        G4["Renders in Wiki"]
    end

    subgraph "Limitations"
        L1["No direct export"]
        L2["Screenshot required"]
        L3["Or use external tool"]
    end
```

### Resolution Guidelines

| Use Case | Recommended Resolution | Format |
|----------|----------------------|--------|
| **Documentation** | 2x (retina) | PNG or SVG |
| **Presentations (1080p)** | 1920x1080 min | PNG |
| **Presentations (4K)** | 3840x2160 min | PNG or SVG |
| **Print (letter)** | 300 DPI, 2550x3300 | PDF or PNG |
| **Print (A4)** | 300 DPI, 2480x3508 | PDF or PNG |
| **Social Media** | Platform specific | PNG |
| **Email** | 600px width max | PNG |

### Mermaid CLI Configuration

```json
{
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#1565C0",
    "primaryTextColor": "#FFFFFF",
    "primaryBorderColor": "#0D47A1",
    "lineColor": "#757575",
    "secondaryColor": "#E3F2FD",
    "tertiaryColor": "#F5F5F5"
  },
  "flowchart": {
    "curve": "basis",
    "padding": 20
  },
  "sequence": {
    "mirrorActors": false,
    "messageMargin": 40
  },
  "fontSize": 16,
  "fontFamily": "Inter, system-ui, sans-serif"
}
```

### Batch Export Script

```bash
#!/bin/bash
# export-diagrams.sh

# Configuration
INPUT_DIR="./docs/diagrams"
OUTPUT_DIR="./exports"
CONFIG="./mermaid.config.json"

# Create output directories
mkdir -p "$OUTPUT_DIR/png"
mkdir -p "$OUTPUT_DIR/svg"
mkdir -p "$OUTPUT_DIR/pdf"

# Find all markdown files with mermaid diagrams
find "$INPUT_DIR" -name "*.md" | while read file; do
    # Extract mermaid blocks and export
    basename=$(basename "$file" .md)
    dirname=$(dirname "$file" | sed "s|$INPUT_DIR/||")

    mkdir -p "$OUTPUT_DIR/png/$dirname"
    mkdir -p "$OUTPUT_DIR/svg/$dirname"

    echo "Exporting: $file"

    # Use mermaid-cli for each format
    mmdc -i "$file" -o "$OUTPUT_DIR/png/$dirname/$basename.png" -c "$CONFIG" -s 2
    mmdc -i "$file" -o "$OUTPUT_DIR/svg/$dirname/$basename.svg" -c "$CONFIG"
done

echo "Export complete!"
```

### PowerPoint Integration

```mermaid
flowchart TB
    subgraph "Option 1: As Image"
        O1A["Export as PNG/SVG"]
        O1B["Insert > Pictures"]
        O1C["Not editable"]
    end

    subgraph "Option 2: As Shapes (Manual)"
        O2A["Recreate in PowerPoint"]
        O2B["Use SmartArt or shapes"]
        O2C["Fully editable"]
    end

    subgraph "Option 3: Link to Live"
        O3A["Insert web link"]
        O3B["Opens mermaid.live"]
        O3C["Always current"]
    end

    O1A --> O1B --> O1C
    O2A --> O2B --> O2C
    O3A --> O3B --> O3C
```

### Figma/Design Tool Integration

```mermaid
flowchart LR
    subgraph "Workflow"
        W1["Export as SVG"]
        W2["Import to Figma"]
        W3["Ungroup vectors"]
        W4["Apply brand styles"]
        W5["Export final"]
    end

    W1 --> W2 --> W3 --> W4 --> W5
```

### Print Considerations

```mermaid
flowchart TB
    subgraph "Print Checklist"
        P1["✓ Use vector (SVG/PDF)"]
        P2["✓ Minimum 300 DPI"]
        P3["✓ Check CMYK colors"]
        P4["✓ Include bleed area"]
        P5["✓ Test on paper"]
    end

    subgraph "Color Conversion"
        C1["Screen: RGB"]
        C2["Print: CMYK"]
        C3["Some blues shift!"]
    end

    P1 --> C1
    C1 --> C2
    C2 --> C3
```

### Social Media Sizing

| Platform | Recommended Size | Aspect Ratio |
|----------|-----------------|--------------|
| Twitter/X | 1200x675 | 16:9 |
| LinkedIn | 1200x627 | 1.91:1 |
| Facebook | 1200x630 | 1.91:1 |
| Instagram | 1080x1080 | 1:1 |
| Instagram Story | 1080x1920 | 9:16 |

### Dark Mode Exports

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
    subgraph "Dark Mode Export"
        D1["Use dark theme init"]
        D2["Export with dark bg"]
        D3["Good for dark slides"]
    end

    D1 --> D2 --> D3
```

### Automated CI/CD Export

```yaml
# .github/workflows/export-diagrams.yml
name: Export Diagrams

on:
  push:
    paths:
      - 'docs/diagrams/**/*.md'

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install mermaid-cli
        run: npm install -g @mermaid-js/mermaid-cli

      - name: Export diagrams
        run: |
          mkdir -p exports
          find docs/diagrams -name "*.md" -exec mmdc -i {} -o exports/{}.png \;

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: diagram-exports
          path: exports/
```

### Quality Checklist

```mermaid
flowchart TB
    subgraph "Before Export"
        B1["✓ Spell check labels"]
        B2["✓ Consistent styling"]
        B3["✓ Readable font size"]
        B4["✓ Proper contrast"]
    end

    subgraph "After Export"
        A1["✓ Check resolution"]
        A2["✓ Verify all elements"]
        A3["✓ Test on target medium"]
        A4["✓ Accessible alt text"]
    end

    B1 --> A1
    B2 --> A2
    B3 --> A3
    B4 --> A4
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| **Blurry export** | Increase scale factor (-s 2 or -s 3) |
| **Text cut off** | Add padding in config |
| **Colors wrong** | Check theme configuration |
| **Missing fonts** | Install fonts or use system fonts |
| **Large file size** | Use SVG instead of PNG |
| **CLI errors** | Update puppeteer: `npm update puppeteer` |

### Quick Reference Commands

```bash
# High-res PNG (2x scale)
mmdc -i input.md -o output.png -s 2

# SVG with custom background
mmdc -i input.md -o output.svg -b transparent

# PDF for print
mmdc -i input.md -o output.pdf -s 3

# With custom theme
mmdc -i input.md -o output.png -t dark

# With config file
mmdc -i input.md -o output.png -c config.json
```
