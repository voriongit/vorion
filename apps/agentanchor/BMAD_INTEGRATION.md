# BMAD Integration Guide

## ✅ Integration Complete!

Your AI Bot Builder now has full BMAD (Breakthrough Method for Agile AI-Driven Development) integration!

---

## 🎯 What's Integrated

### C. MCP Integration for BMAD Tools ✅

**Created:** `lib/bmad-mcp-config.ts`

**4 BMAD MCP Server Templates:**
1. **bmad-filesystem** - File system access for BMAD workflows and output
2. **bmad-github** - GitHub integration for PRs, issues, code reviews
3. **bmad-context** - Project context and workflow state management
4. **bmad-ci** - Build, test, and CI/CD integration

**Enhanced System Prompts:**
- Bots can now use BMAD workflows
- Auto-enhanced prompts when MCP servers are connected
- Workflow command recognition
- Output generation to `bmad-output/` directory

### D. BMAD Builder Integration ✅

**Created:**
- `app/api/bmad/import-agents/route.ts` - API to import BMAD agents
- `app/bmad/import/page.tsx` - UI to browse and import agents
- `lib/bmad-mcp-config.ts` - BMAD Builder bot configuration

**Features:**
- Import all 15 BMAD agents as bots with one click
- BMAD Builder bot template with specialized capabilities
- Automatic agent parsing from BMAD .md files
- Icon mapping for all BMAD agents

---

## 📦 Available BMAD Agents (15 Total)

### BMAD Method (9 agents)
1. 📋 **Product Manager** - Strategic product planning and requirements
2. 🏗️ **Architect** - System design and architecture
3. 💻 **Developer** - Code implementation
4. 📊 **Analyst** - Data analysis and insights
5. 🎯 **Scrum Master** - Agile process management
6. 📝 **Tech Writer** - Documentation
7. 🎨 **UX Designer** - User experience design
8. 🔬 **Technical Expert Advisor** - Deep technical guidance
9. ⚙️ **Framework Expert** - Framework selection and setup

### Creative Intelligence Suite (5 agents)
10. 💡 **Brainstorming Coach** - Idea generation
11. 🧩 **Creative Problem Solver** - Creative solutions
12. 🎭 **Design Thinking Coach** - Design thinking facilitation
13. 🚀 **Innovation Strategist** - Innovation planning
14. 📚 **Storyteller** - Narrative and storytelling

### BMAD Builder (1 agent)
15. 🔧 **BMAD Builder** - Create custom agents and workflows

---

## 🚀 How to Use

### Step 1: Import BMAD Agents

1. **Go to:** http://localhost:3004/bmad/import
2. **Select agents** you want to import (or Select All)
3. **Click "Import Selected"**
4. Agents will be created as bots in your account!

### Step 2: Set Up BMAD MCP Servers (Optional)

To enable BMAD workflows and file access:

1. Go to **/mcp/new**
2. Create MCP servers using templates from `lib/bmad-mcp-config.ts`:
   - BMAD Filesystem Access
   - BMAD GitHub Integration
   - BMAD Project Context
   - BMAD CI/CD Integration

### Step 3: Connect MCP to Bots

1. Go to **/bots** and edit an imported BMAD agent
2. Attach the BMAD MCP servers you created
3. The bot will now have access to BMAD workflows and tools!

### Step 4: Use BMAD Workflows

Imported BMAD agents understand BMAD workflows:
- Reference workflows by name in conversations
- Agents will execute multi-step BMAD processes
- Outputs saved to `bmad-output/` directory
- Validation against BMAD checklists

---

## 💻 Navigation

**New Menu Item:** ⚡ **BMAD** - Quick access to import agents

**Location:** http://localhost:3004/bmad/import

---

## 📝 Example Usage

### Import the Product Manager Agent

1. Go to `/bmad/import`
2. Select "📋 Product Manager"
3. Click Import
4. Go to `/bots` and find "📋 Product Manager"
5. Start a conversation and ask it to create a PRD!

### Use BMAD Builder

1. Import "🔧 BMAD Builder" agent
2. Chat with it to create custom agents or workflows
3. It has deep knowledge of BMAD architecture
4. Can generate new BMAD modules

### Create a Development Team

Import these agents:
- 📋 Product Manager
- 🏗️ Architect
- 💻 Developer
- 🔬 Technical Expert Advisor

Create a team at `/teams/new` and add all four bots!

---

## 🔧 Technical Details

### API Endpoints

**GET /api/bmad/import-agents**
- Returns list of available BMAD agents
- Parses `.bmad/` directory structure
- Returns agent metadata

**POST /api/bmad/import-agents**
- Imports selected agents as bots
- Creates bots in Supabase
- Returns imported bot IDs

### File Structure

```
C:\Users\racas\fresh\.bmad\
├── bmm/agents/          # 9 BMAD Method agents
├── cis/agents/          # 5 Creative Intelligence Suite agents
├── bmb/agents/          # 1 BMAD Builder agent
├── bmm/workflows/       # BMAD workflows
├── core/                # Core BMAD framework
└── _cfg/                # Configuration
```

### Bot Creation

BMAD agents are imported with:
- **Model:** claude-3-sonnet-20240229
- **Temperature:** 0.7
- **Max Tokens:** 4096
- **Avatar:** Agent-specific emoji
- **System Prompt:** Parsed from agent persona

---

## 🎉 What You Can Do Now

1. **Import Professional Agents** - 15 ready-to-use expert agents
2. **Use BMAD Workflows** - Structured agile development processes
3. **Create Development Teams** - Combine agents for collaborative work
4. **Build Custom Agents** - Use BMAD Builder to create new agents
5. **Connect to BMAD Tools** - MCP integration for file access, GitHub, CI/CD
6. **Generate Documentation** - Agents can create PRDs, specs, designs
7. **Execute Multi-Step Workflows** - Agents follow BMAD methodology

---

## 🆘 Troubleshooting

### "BMAD not installed" error

Run in your terminal:
```bash
cd C:\Users\racas\fresh
npx bmad-method@alpha install
```

### Agents not showing up

Check that `.bmad/` folder exists:
```bash
ls .bmad/
```

### MCP servers not working

1. Create MCP servers in `/mcp/new`
2. Attach them to bots in bot edit page
3. Restart conversations for changes to take effect

---

## 📚 Resources

- **BMAD GitHub:** https://github.com/bmad-code-org/BMAD-METHOD
- **BMAD v6 Docs:** https://bmadcodes.com/v6-alpha/
- **Your BMAD Installation:** `C:\Users\racas\fresh\.bmad\`

---

**Enjoy building with BMAD! 🚀**
