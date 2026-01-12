import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  knowledgeSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Agent Taxonomy',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'taxonomy/index',
      },
      items: [
        'taxonomy/simple-reflex',
        'taxonomy/model-based',
        'taxonomy/goal-based',
        'taxonomy/utility-based',
        'taxonomy/bdi-agents',
        'taxonomy/learning-agents',
      ],
    },
    {
      type: 'category',
      label: 'Cognitive Architecture',
      link: {
        type: 'doc',
        id: 'architecture/index',
      },
      items: [
        'architecture/memory-systems',
        'architecture/react-pattern',
        'architecture/planning-engines',
        'architecture/neuro-symbolic',
        'architecture/tool-use',
      ],
    },
    {
      type: 'category',
      label: 'Orchestration',
      link: {
        type: 'doc',
        id: 'orchestration/index',
      },
      items: [
        'orchestration/hierarchical',
        'orchestration/swarm-intelligence',
        'orchestration/event-driven',
        'orchestration/multi-agent-debate',
        'orchestration/consensus-protocols',
      ],
    },
    {
      type: 'category',
      label: 'Protocols & Standards',
      link: {
        type: 'doc',
        id: 'protocols/index',
      },
      items: [
        'protocols/mcp',
        'protocols/a2a',
        'protocols/agent-identity',
        'protocols/basis-standard',
      ],
    },
    {
      type: 'category',
      label: 'Domain Applications',
      link: {
        type: 'doc',
        id: 'domains/index',
      },
      items: [
        'domains/software-engineering',
        'domains/scientific-research',
        'domains/finance-trading',
        'domains/enterprise-automation',
      ],
    },
    {
      type: 'category',
      label: 'Agent Evolution',
      link: {
        type: 'doc',
        id: 'evolution/index',
      },
      items: [
        'evolution/seeding-initialization',
        'evolution/evolutionary-optimization',
        'evolution/memetic-learning',
        'evolution/self-improvement',
      ],
    },
    {
      type: 'category',
      label: 'Safety & Governance',
      link: {
        type: 'doc',
        id: 'safety/index',
      },
      items: [
        'safety/trust-scoring',
        'safety/capability-gating',
        'safety/audit-trails',
        'safety/human-oversight',
      ],
    },
    {
      type: 'doc',
      id: 'contributing',
      label: 'Contribute',
    },
    {
      type: 'doc',
      id: 'glossary',
      label: 'Glossary',
    },
  ],
};

export default sidebars;
