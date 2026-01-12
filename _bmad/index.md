# _bmad Directory Index

BMad Method v6.0.0-alpha.22 - AI-driven software development methodology platform.

## Configuration

### _config/

- **[manifest.yaml](./_config/manifest.yaml)** - Installation manifest with modules and IDE configurations
- **[ides/codex.yaml](./_config/ides/codex.yaml)** - Codex IDE integration configuration

#### agents/ (Customization Files)

- **[bmb-agent-builder.customize.yaml](./_config/agents/bmb-agent-builder.customize.yaml)** - Agent Builder customization
- **[bmb-module-builder.customize.yaml](./_config/agents/bmb-module-builder.customize.yaml)** - Module Builder customization
- **[bmb-workflow-builder.customize.yaml](./_config/agents/bmb-workflow-builder.customize.yaml)** - Workflow Builder customization
- **[bmm-analyst.customize.yaml](./_config/agents/bmm-analyst.customize.yaml)** - Business Analyst customization
- **[bmm-architect.customize.yaml](./_config/agents/bmm-architect.customize.yaml)** - Architect customization
- **[bmm-dev.customize.yaml](./_config/agents/bmm-dev.customize.yaml)** - Developer Agent customization
- **[bmm-pm.customize.yaml](./_config/agents/bmm-pm.customize.yaml)** - Product Manager customization
- **[bmm-quick-flow-solo-dev.customize.yaml](./_config/agents/bmm-quick-flow-solo-dev.customize.yaml)** - Quick Flow Solo Dev customization
- **[bmm-sm.customize.yaml](./_config/agents/bmm-sm.customize.yaml)** - Scrum Master customization
- **[bmm-tea.customize.yaml](./_config/agents/bmm-tea.customize.yaml)** - Test Architect customization
- **[bmm-tech-writer.customize.yaml](./_config/agents/bmm-tech-writer.customize.yaml)** - Technical Writer customization
- **[bmm-ux-designer.customize.yaml](./_config/agents/bmm-ux-designer.customize.yaml)** - UX Designer customization
- **[cis-brainstorming-coach.customize.yaml](./_config/agents/cis-brainstorming-coach.customize.yaml)** - Brainstorming Coach customization
- **[cis-creative-problem-solver.customize.yaml](./_config/agents/cis-creative-problem-solver.customize.yaml)** - Creative Problem Solver customization
- **[cis-design-thinking-coach.customize.yaml](./_config/agents/cis-design-thinking-coach.customize.yaml)** - Design Thinking Coach customization
- **[cis-innovation-strategist.customize.yaml](./_config/agents/cis-innovation-strategist.customize.yaml)** - Innovation Strategist customization
- **[cis-presentation-master.customize.yaml](./_config/agents/cis-presentation-master.customize.yaml)** - Presentation Master customization
- **[cis-storyteller.customize.yaml](./_config/agents/cis-storyteller.customize.yaml)** - Storyteller customization
- **[core-bmad-master.customize.yaml](./_config/agents/core-bmad-master.customize.yaml)** - BMad Master customization

### _memory/

- **[config.yaml](./_memory/config.yaml)** - Memory system configuration

#### storyteller-sidecar/

- **[stories-told.md](./_memory/storyteller-sidecar/stories-told.md)** - History of stories created
- **[story-preferences.md](./_memory/storyteller-sidecar/story-preferences.md)** - User story preferences

---

## Modules

### core/ - Core Platform Module

Foundation module providing essential BMAD infrastructure.

- **[config.yaml](./core/config.yaml)** - Core module configuration

#### agents/

- **[bmad-master.md](./core/agents/bmad-master.md)** - Master orchestrator for tasks and workflows

#### tasks/

- **[index-docs.xml](./core/tasks/index-docs.xml)** - Generate directory index documentation
- **[review-adversarial-general.xml](./core/tasks/review-adversarial-general.xml)** - Adversarial review task
- **[shard-doc.xml](./core/tasks/shard-doc.xml)** - Document sharding task
- **[validate-workflow.xml](./core/tasks/validate-workflow.xml)** - Workflow validation task
- **[workflow.xml](./core/tasks/workflow.xml)** - Core workflow execution engine

#### workflows/

##### advanced-elicitation/

- **[workflow.xml](./core/workflows/advanced-elicitation/workflow.xml)** - Deep elicitation conversation workflow

##### brainstorming/

- **[workflow.md](./core/workflows/brainstorming/workflow.md)** - Multi-technique brainstorming workflow
- **[template.md](./core/workflows/brainstorming/template.md)** - Brainstorming output template
- **[steps/step-01-session-setup.md](./core/workflows/brainstorming/steps/step-01-session-setup.md)** - Session initialization
- **[steps/step-01b-continue.md](./core/workflows/brainstorming/steps/step-01b-continue.md)** - Session continuation handling
- **[steps/step-02a-user-selected.md](./core/workflows/brainstorming/steps/step-02a-user-selected.md)** - User-selected technique
- **[steps/step-02b-ai-recommended.md](./core/workflows/brainstorming/steps/step-02b-ai-recommended.md)** - AI-recommended technique
- **[steps/step-02c-random-selection.md](./core/workflows/brainstorming/steps/step-02c-random-selection.md)** - Random technique selection
- **[steps/step-02d-progressive-flow.md](./core/workflows/brainstorming/steps/step-02d-progressive-flow.md)** - Progressive technique flow
- **[steps/step-03-technique-execution.md](./core/workflows/brainstorming/steps/step-03-technique-execution.md)** - Execute selected technique
- **[steps/step-04-idea-organization.md](./core/workflows/brainstorming/steps/step-04-idea-organization.md)** - Organize generated ideas

##### party-mode/

- **[workflow.md](./core/workflows/party-mode/workflow.md)** - Multi-agent collaborative discussion
- **[steps/step-01-agent-loading.md](./core/workflows/party-mode/steps/step-01-agent-loading.md)** - Load participating agents
- **[steps/step-02-discussion-orchestration.md](./core/workflows/party-mode/steps/step-02-discussion-orchestration.md)** - Orchestrate agent discussion
- **[steps/step-03-graceful-exit.md](./core/workflows/party-mode/steps/step-03-graceful-exit.md)** - Exit party mode gracefully

#### resources/excalidraw/

- **[README.md](./core/resources/excalidraw/README.md)** - Excalidraw integration overview
- **[excalidraw-helpers.md](./core/resources/excalidraw/excalidraw-helpers.md)** - Excalidraw helper functions
- **[library-loader.md](./core/resources/excalidraw/library-loader.md)** - Excalidraw library loading
- **[validate-json-instructions.md](./core/resources/excalidraw/validate-json-instructions.md)** - JSON validation for Excalidraw

---

### bmb/ - BMad Builder Module

Tools for creating and extending BMad agents, workflows, and modules.

- **[README.md](./bmb/README.md)** - BMB module overview and documentation
- **[config.yaml](./bmb/config.yaml)** - BMB module configuration

#### agents/

- **[agent-builder.md](./bmb/agents/agent-builder.md)** - Expert for creating BMAD agents
- **[module-builder.md](./bmb/agents/module-builder.md)** - Expert for creating complete modules
- **[workflow-builder.md](./bmb/agents/workflow-builder.md)** - Expert for creating workflows

#### docs/workflows/

- **[architecture.md](./bmb/docs/workflows/architecture.md)** - Workflow architecture documentation
- **[csv-data-file-standards.md](./bmb/docs/workflows/csv-data-file-standards.md)** - CSV data file standards
- **[intent-vs-prescriptive-spectrum.md](./bmb/docs/workflows/intent-vs-prescriptive-spectrum.md)** - Intent vs prescriptive design
- **[step-file-rules.md](./bmb/docs/workflows/step-file-rules.md)** - Rules for step files
- **[terms.md](./bmb/docs/workflows/terms.md)** - Workflow terminology definitions

##### templates/

- **[step-01-init-continuable-template.md](./bmb/docs/workflows/templates/step-01-init-continuable-template.md)** - Continuable init step template
- **[step-1b-template.md](./bmb/docs/workflows/templates/step-1b-template.md)** - Step 1b template
- **[step-file.md](./bmb/docs/workflows/templates/step-file.md)** - Step file template
- **[step-template.md](./bmb/docs/workflows/templates/step-template.md)** - Generic step template
- **[workflow.md](./bmb/docs/workflows/templates/workflow.md)** - Workflow file template
- **[workflow-template.md](./bmb/docs/workflows/templates/workflow-template.md)** - Workflow template guide

#### reference/

- **[readme.md](./bmb/reference/readme.md)** - Reference materials overview

##### agents/simple-examples/

- **[README.md](./bmb/reference/agents/simple-examples/README.md)** - Simple agent examples

##### workflows/meal-prep-nutrition/

Example workflow demonstrating complete workflow structure.

- **[workflow.md](./bmb/reference/workflows/meal-prep-nutrition/workflow.md)** - Meal prep workflow definition
- **[steps/](./bmb/reference/workflows/meal-prep-nutrition/steps/)** - 7 step files for meal prep
- **[templates/](./bmb/reference/workflows/meal-prep-nutrition/templates/)** - Output templates

#### workflows/

##### agent/ (Agent Building Workflow)

- **[workflow.md](./bmb/workflows/agent/workflow.md)** - Agent creation workflow
- **[steps-c/](./bmb/workflows/agent/steps-c/)** - Create agent steps (9 steps)
- **[steps-e/](./bmb/workflows/agent/steps-e/)** - Edit agent steps (10 steps)
- **[steps-v/](./bmb/workflows/agent/steps-v/)** - Validate agent steps (3 steps)
- **[data/](./bmb/workflows/agent/data/)** - Agent building reference data
- **[templates/](./bmb/workflows/agent/templates/)** - Agent templates

##### create-module/

- **[workflow.md](./bmb/workflows/create-module/workflow.md)** - Module creation workflow
- **[validation.md](./bmb/workflows/create-module/validation.md)** - Module validation rules
- **[steps/](./bmb/workflows/create-module/steps/)** - 11 step files
- **[templates/](./bmb/workflows/create-module/templates/)** - Module templates

##### create-workflow/

- **[workflow.md](./bmb/workflows/create-workflow/workflow.md)** - Workflow creation workflow
- **[steps/](./bmb/workflows/create-workflow/steps/)** - 9 step files
- **[data/examples/](./bmb/workflows/create-workflow/data/examples/)** - Example workflows

##### edit-workflow/

- **[workflow.md](./bmb/workflows/edit-workflow/workflow.md)** - Workflow editing workflow
- **[steps/](./bmb/workflows/edit-workflow/steps/)** - 5 step files
- **[templates/](./bmb/workflows/edit-workflow/templates/)** - Edit templates

##### workflow-compliance-check/

- **[workflow.md](./bmb/workflows/workflow-compliance-check/workflow.md)** - Workflow compliance validation
- **[steps/](./bmb/workflows/workflow-compliance-check/steps/)** - 8 step files
- **[templates/](./bmb/workflows/workflow-compliance-check/templates/)** - Compliance report template

#### workflows-legacy/

- **[edit-module/](./bmb/workflows-legacy/edit-module/)** - Legacy module editing
- **[module-brief/](./bmb/workflows-legacy/module-brief/)** - Legacy module briefing

---

### bmm/ - BMad Method Module

Full software development lifecycle agents and workflows.

- **[config.yaml](./bmm/config.yaml)** - BMM module configuration

#### agents/

- **[analyst.md](./bmm/agents/analyst.md)** - Business analyst for requirements and research
- **[architect.md](./bmm/agents/architect.md)** - System architect for technical design
- **[dev.md](./bmm/agents/dev.md)** - Developer agent for implementation
- **[pm.md](./bmm/agents/pm.md)** - Product manager for PRD and planning
- **[quick-flow-solo-dev.md](./bmm/agents/quick-flow-solo-dev.md)** - Rapid development specialist
- **[sm.md](./bmm/agents/sm.md)** - Scrum master for sprint management
- **[tea.md](./bmm/agents/tea.md)** - Test architect for quality assurance
- **[tech-writer.md](./bmm/agents/tech-writer.md)** - Technical documentation specialist
- **[ux-designer.md](./bmm/agents/ux-designer.md)** - UX/UI design specialist

#### teams/

- **[team-fullstack.yaml](./bmm/teams/team-fullstack.yaml)** - Full-stack development team definition

#### data/

- **[documentation-standards.md](./bmm/data/documentation-standards.md)** - Documentation standards guide
- **[project-context-template.md](./bmm/data/project-context-template.md)** - Project context template
- **[README.md](./bmm/data/README.md)** - Data folder overview

#### testarch/knowledge/

Test architecture knowledge base with 35+ pattern files covering:

- Test framework setup and configuration
- Fixture architecture and composition
- Network testing patterns
- CI/CD integration
- Risk-based testing strategies
- Test quality and healing patterns

#### workflows/

##### 1-analysis/

- **create-product-brief/** - Product brief creation workflow
- **research/** - Market, domain, and technical research

##### 2-plan-workflows/

- **create-ux-design/** - UX design document creation (14 steps)
- **prd/** - PRD creation workflow (11 steps)

##### 3-solutioning/

- **check-implementation-readiness/** - Implementation readiness review
- **create-architecture/** - Architecture document creation
- **create-epics-and-stories/** - Epic and story generation

##### 4-implementation/

- **code-review/** - Code review workflow
- **correct-course/** - Course correction workflow
- **create-story/** - Story creation workflow
- **dev-story/** - Development story execution
- **retrospective/** - Team retrospective facilitation
- **sprint-planning/** - Sprint planning workflow
- **sprint-status/** - Sprint status tracking

##### bmad-quick-flow/

- **create-tech-spec/** - Technical spec creation
- **quick-dev/** - Rapid implementation workflow

##### document-project/

- **[workflow.yaml](./bmm/workflows/document-project/workflow.yaml)** - Project documentation workflow
- **templates/** - Documentation templates
- **workflows/** - Sub-workflows for scanning

##### excalidraw-diagrams/

- **create-dataflow/** - Data flow diagram creation
- **create-diagram/** - System diagram creation
- **create-flowchart/** - Flowchart creation
- **create-wireframe/** - Wireframe creation
- **_shared/** - Shared Excalidraw resources

##### generate-project-context/

- Context generation workflow for existing projects

##### testarch/

- **atdd/** - Acceptance test driven development
- **automate/** - Test automation generation
- **ci/** - CI/CD pipeline setup
- **framework/** - Test framework initialization
- **nfr-assess/** - Non-functional requirements assessment
- **test-design/** - Test scenario design
- **test-review/** - Test quality review
- **trace/** - Requirements traceability

---

### cis/ - Creative Innovation Suite

Creativity, innovation, and storytelling agents.

- **[config.yaml](./cis/config.yaml)** - CIS module configuration

#### agents/

- **[brainstorming-coach.md](./cis/agents/brainstorming-coach.md)** - Elite brainstorming facilitator
- **[creative-problem-solver.md](./cis/agents/creative-problem-solver.md)** - Systematic problem-solving expert
- **[design-thinking-coach.md](./cis/agents/design-thinking-coach.md)** - Human-centered design expert
- **[innovation-strategist.md](./cis/agents/innovation-strategist.md)** - Business model innovation expert
- **[presentation-master.md](./cis/agents/presentation-master.md)** - Visual presentation designer
- **[storyteller/storyteller.md](./cis/agents/storyteller/storyteller.md)** - Master narrative strategist

#### teams/

- **[creative-squad.yaml](./cis/teams/creative-squad.yaml)** - Creative team definition

#### workflows/

- **[README.md](./cis/workflows/README.md)** - CIS workflows overview
- **design-thinking/** - Design thinking process workflow
- **innovation-strategy/** - Innovation strategy workflow
- **problem-solving/** - Problem-solving methodology workflow
- **storytelling/** - Narrative crafting workflow

---

## Quick Reference

| Module | Purpose | Agents |
|--------|---------|--------|
| **core** | Platform foundation | BMad Master |
| **bmb** | Builder tools | Agent Builder, Module Builder, Workflow Builder |
| **bmm** | Development lifecycle | Analyst, Architect, Dev, PM, SM, TEA, Tech Writer, UX Designer, Quick Flow Solo Dev |
| **cis** | Creative innovation | Brainstorming Coach, Problem Solver, Design Thinking Coach, Innovation Strategist, Presentation Master, Storyteller |

---

*Generated by index-docs task*
