#!/bin/bash
# ACI Spec - GitHub Push Script
# Run this after extracting aci-spec-v1.0.0.zip

set -e

echo "🚀 ACI Spec v1.0.0 - GitHub Push"
echo "================================"

# Navigate to bundle directory
cd aci-bundle

# Initialize git
git init
git add .
git commit -m "feat: ACI Specification v1.0.0

Agent Classification Identifier (ACI) - The certification standard for AI agents

Core Specs:
- ACI format: [Registry].[Org].[AgentClass]:[Domains]-L[Level]-T[Tier]@[Version]
- DID method: did:aci:
- OpenID Connect claims extension
- Registry API specification
- Extension Protocol (Layer 4)

Features:
- 10 capability domains (A-I, S)
- 6 autonomy levels (L0-L5)
- 6 trust tiers (T0-T5)
- TypeScript reference implementation
- JSON-LD vocabulary
- OWASP risk mitigation guidance

License: Apache 2.0"

# Add remote and push
git remote add origin git@github.com:voriongit/aci-spec.git
git branch -M main
git push -u origin main

echo ""
echo "✅ Pushed to GitHub!"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. npm run build"
echo "  3. npm publish --access public"
echo ""
echo "URLs:"
echo "  GitHub: https://github.com/voriongit/aci-spec"
echo "  npm:    https://www.npmjs.com/package/@agentanchor/aci-spec"
