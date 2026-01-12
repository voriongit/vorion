import type { Meta, StoryObj } from '@storybook/react'
import ProbationIndicator, { ProbationCard } from './ProbationIndicator'

/**
 * ProbationIndicator displays when an agent is under probation due to
 * significant trust score decline (FR57).
 *
 * During probation:
 * - All actions require human approval
 * - Enhanced monitoring is enabled
 * - Agent cannot execute autonomous actions
 */
const meta: Meta<typeof ProbationIndicator> = {
  title: 'Agents/ProbationIndicator',
  component: ProbationIndicator,
  tags: ['autodocs'],
  argTypes: {
    daysRemaining: {
      control: { type: 'range', min: 1, max: 90, step: 1 },
      description: 'Number of days remaining in probation period',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: 'Indicator size',
    },
    showDetails: {
      control: 'boolean',
      description: 'Show remaining days',
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'Visual indicator for agents under probation status in the AgentAnchor governance system.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ProbationIndicator>

// Basic Examples
export const Default: Story = {
  args: {
    daysRemaining: 14,
    size: 'md',
    showDetails: false,
  },
}

export const WithDetails: Story = {
  args: {
    daysRemaining: 14,
    size: 'md',
    showDetails: true,
  },
}

// Size Variants
export const Small: Story = {
  args: {
    daysRemaining: 7,
    size: 'sm',
    showDetails: true,
  },
}

export const Medium: Story = {
  args: {
    daysRemaining: 30,
    size: 'md',
    showDetails: true,
  },
}

export const Large: Story = {
  args: {
    daysRemaining: 60,
    size: 'lg',
    showDetails: true,
  },
}

// Time-based scenarios
export const CriticalProbation: Story = {
  args: {
    daysRemaining: 1,
    size: 'md',
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Agent in final day of probation - critical status.',
      },
    },
  },
}

export const ExtendedProbation: Story = {
  args: {
    daysRemaining: 90,
    size: 'md',
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Agent with extended probation period due to severe violations.',
      },
    },
  },
}

// All sizes comparison
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 w-16">Small:</span>
        <ProbationIndicator daysRemaining={14} size="sm" showDetails />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 w-16">Medium:</span>
        <ProbationIndicator daysRemaining={14} size="md" showDetails />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 w-16">Large:</span>
        <ProbationIndicator daysRemaining={14} size="lg" showDetails />
      </div>
    </div>
  ),
}

// Without details (compact)
export const Compact: Story = {
  render: () => (
    <div className="flex gap-4">
      <ProbationIndicator daysRemaining={7} size="sm" />
      <ProbationIndicator daysRemaining={14} size="md" />
      <ProbationIndicator daysRemaining={30} size="lg" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compact indicators without day count, suitable for tight spaces.',
      },
    },
  },
}

// ProbationCard Stories
export const FullCard: StoryObj<typeof ProbationCard> = {
  render: () => (
    <div className="max-w-md">
      <ProbationCard daysRemaining={14} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Full probation card with detailed restrictions list, suitable for agent detail pages.',
      },
    },
  },
}

export const CardOneDay: StoryObj<typeof ProbationCard> = {
  render: () => (
    <div className="max-w-md">
      <ProbationCard daysRemaining={1} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Final day of probation - high urgency display.',
      },
    },
  },
}

export const CardLongTerm: StoryObj<typeof ProbationCard> = {
  render: () => (
    <div className="max-w-md">
      <ProbationCard daysRemaining={60} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Extended probation period for severe trust violations.',
      },
    },
  },
}

// Usage in Context
export const InAgentProfile: Story = {
  render: () => (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Agent Status</h3>
          <p className="text-sm text-gray-500">FinanceBot Pro</p>
        </div>
        <ProbationIndicator daysRemaining={14} size="sm" showDetails />
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This agent is currently under probation. All actions will require human approval
          until the probation period ends.
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of probation indicator in an agent profile context.',
      },
    },
  },
}

// Dark mode demo
export const DarkMode: Story = {
  render: () => (
    <div className="dark bg-gray-900 p-6 rounded-lg space-y-4">
      <ProbationIndicator daysRemaining={14} size="sm" showDetails />
      <ProbationIndicator daysRemaining={7} size="md" showDetails />
      <ProbationIndicator daysRemaining={3} size="lg" showDetails />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Probation indicators in dark mode.',
      },
    },
  },
}
