# ATSF - Agentic Trust Scoring Framework

[![Version](https://img.shields.io/badge/version-3.4.0-blue.svg)](https://github.com/agentanchor/atsf)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://python.org)

**Production-grade AI agent safety, governance, and cognitive architecture.**

## 🚀 Quick Start

```bash
pip install atsf
```

```python
from atsf import ATSF

# Initialize and create agent
atsf = ATSF()
agent = atsf.create_agent("my_agent", "my_creator", tier="gray_box")

# Execute with trust scoring
result = agent.execute("read", {"target": "data.txt"})
print(f"Decision: {result.decision}, Trust: {result.trust_score:.3f}")
```

## ✨ Features

- 🔒 **46 Security Layers** - Defense-in-depth protection
- 🧠 **Cognitive Cube** - TKG, ART clustering, Granger causality
- 📊 **OLAP Analytics** - Multi-dimensional data cubes
- 🎯 **AI TRiSM** - Gartner-aligned governance
- ⚡ **Real-time Events** - WebSocket & pub/sub
- 🔗 **Framework Integration** - LangChain, CrewAI
- 💾 **Persistence** - SQLite storage

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Lines of Code | 30,700+ |
| Python Modules | 31 |
| Tests | 360+ |
| Security Layers | 46 |
| API Endpoints | 45+ |

## 📚 Documentation

See the [full documentation](docs/) for:
- API Reference
- Security Layers Guide
- Integration Examples
- White Paper

## 📄 License

MIT License

---

**The constitution is no longer a suggestion. It is architecture.**
