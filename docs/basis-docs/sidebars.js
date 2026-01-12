/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  standardSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'What is BASIS?',
    },
    {
      type: 'category',
      label: 'The Four Layers',
      collapsed: false,
      items: [
        'layers/intent',
        'layers/enforce',
        'layers/proof',
        'layers/chain',
      ],
    },
    {
      type: 'category',
      label: 'Specification',
      items: [
        'spec/overview',
        'spec/capabilities',
        'spec/risk-classification',
        'spec/trust-scoring',
        'spec/policies',
        'spec/audit-logging',
      ],
    },
    {
      type: 'category',
      label: 'Implementation',
      items: [
        'implement/getting-started',
        'implement/compliance-tests',
        'implement/certification',
      ],
    },
    {
      type: 'doc',
      id: 'cognigate',
      label: 'Cognigate',
    },
    {
      type: 'doc',
      id: 'agentanchor',
      label: 'AgentAnchor',
    },
    {
      type: 'doc',
      id: 'community',
      label: 'Community',
    },
  ],
};

export default sidebars;
