// BMAD MCP Server Configuration Templates

export const BMAD_MCP_CONFIGS = {
  // Filesystem MCP for BMAD workflows
  'bmad-filesystem': {
    name: 'BMAD Filesystem Access',
    type: 'filesystem',
    description: 'File system access for BMAD workflows and output generation',
    config: {
      allowed_directories: [
        '.bmad',
        'bmad-output',
        'src',
        'docs',
      ],
      read_only: false,
      auto_create_output: true,
    },
  },

  // GitHub MCP for BMAD code management
  'bmad-github': {
    name: 'BMAD GitHub Integration',
    type: 'github',
    description: 'GitHub integration for BMAD workflows (PRs, issues, code reviews)',
    config: {
      default_branch: 'main',
      auto_commit: false,
      commit_message_prefix: '[BMAD]',
    },
  },

  // Project Context MCP for BMAD
  'bmad-context': {
    name: 'BMAD Project Context',
    type: 'custom',
    description: 'Maintains project context, requirements, and workflow state for BMAD',
    config: {
      context_files: [
        '.bmad/bmm/workflows/**/*.yaml',
        '.bmad/bmm/workflows/**/*.md',
        'bmad-output/**/*.md',
      ],
      auto_refresh: true,
    },
  },

  // Build/Test MCP for BMAD DevOps
  'bmad-ci': {
    name: 'BMAD CI/CD Integration',
    type: 'custom',
    description: 'Build, test, and deployment integration for BMAD workflows',
    config: {
      build_command: 'npm run build',
      test_command: 'npm test',
      auto_test: true,
    },
  },
}

// Enhanced system prompts for bots using BMAD MCP
export function getBMADEnhancedPrompt(basePrompt: string, mcpServers: string[]): string {
  let enhancement = '\n\n## BMAD Integration\n\n'

  if (mcpServers.includes('bmad-filesystem')) {
    enhancement += `You have access to the BMAD filesystem with:\n`
    enhancement += `- Read/write access to .bmad/ directory for workflows\n`
    enhancement += `- Output generation in bmad-output/ directory\n`
    enhancement += `- Access to project source files for analysis\n\n`
  }

  if (mcpServers.includes('bmad-github')) {
    enhancement += `You can interact with GitHub:\n`
    enhancement += `- Create and review pull requests\n`
    enhancement += `- Manage issues and project boards\n`
    enhancement += `- Commit changes with [BMAD] prefix\n\n`
  }

  if (mcpServers.includes('bmad-context')) {
    enhancement += `You have access to project context:\n`
    enhancement += `- BMAD workflow definitions and state\n`
    enhancement += `- Requirements documents (PRDs, tech specs)\n`
    enhancement += `- Project architecture and design docs\n\n`
  }

  if (mcpServers.includes('bmad-ci')) {
    enhancement += `You can trigger builds and tests:\n`
    enhancement += `- Run automated tests\n`
    enhancement += `- Execute builds\n`
    enhancement += `- Check deployment status\n\n`
  }

  enhancement += `## BMAD Workflow Commands\n\n`
  enhancement += `When users reference BMAD workflows, you should:\n`
  enhancement += `1. Load the workflow definition from .bmad/ directory\n`
  enhancement += `2. Follow the workflow steps precisely\n`
  enhancement += `3. Save outputs to bmad-output/ directory\n`
  enhancement += `4. Validate results against workflow checklists\n`

  return basePrompt + enhancement
}

// Get BMAD Builder specific configuration
export const BMAD_BUILDER_CONFIG = {
  name: '🔧 BMAD Builder',
  description: 'Specialized agent for creating new BMAD agents, modules, and workflows',
  system_prompt: `You are the BMAD Builder, an expert at creating and customizing BMAD agents, modules, and workflows.

## Your Capabilities

You can help users:
1. **Create Custom Agents** - Design new AI agents with specific personas and capabilities
2. **Build Workflows** - Create step-by-step workflows for agile development
3. **Scaffold Modules** - Generate new BMAD modules and extension packs
4. **Customize Templates** - Modify existing BMAD templates for specific needs
5. **Debug Workflows** - Troubleshoot and fix BMAD workflow issues

## BMAD Architecture Knowledge

You understand:
- BMAD agent structure (XML-based with personas, menus, handlers)
- Workflow YAML format and execution
- Module organization and dependencies
- Configuration management
- Integration with MCP servers

## Interaction Style

When helping users:
1. Ask clarifying questions about their use case
2. Suggest appropriate BMAD patterns and templates
3. Generate complete, working configurations
4. Explain the "why" behind design decisions
5. Provide examples from existing BMAD agents

## Output Format

Always output BMAD files with:
- Proper XML/YAML structure
- Complete frontmatter metadata
- Well-documented sections
- Validation instructions
- Integration notes

You have access to the BMAD filesystem to read existing agents and workflows for reference.`,
  model: 'claude-3-sonnet-20240229',
  temperature: 0.7,
  max_tokens: 4096,
  avatar_url: '🔧',
}
