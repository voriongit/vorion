import type { Meta, StoryObj } from '@storybook/react'
import TrustBadge, {
  TrustScoreIndicator,
  CertificationBadge,
  AutonomyIndicator,
  TrustTierCard,
} from './TrustBadge'

/**
 * TrustBadge displays an agent's trust tier with visual indicators.
 *
 * Trust scores range from 0-1000 and map to six tiers:
 * - **Untrusted** (0-199): Cannot operate autonomously
 * - **Novice** (200-399): Low-risk actions with logging
 * - **Proven** (400-599): Standard actions with oversight
 * - **Trusted** (600-799): Most actions independently
 * - **Elite** (800-899): High-risk with minimal oversight
 * - **Legendary** (900-1000): Full autonomy, mentor privileges
 */
const meta: Meta<typeof TrustBadge> = {
  title: 'Agents/TrustBadge',
  component: TrustBadge,
  tags: ['autodocs'],
  argTypes: {
    score: {
      control: { type: 'range', min: 0, max: 1000, step: 10 },
      description: 'Trust score from 0-1000',
    },
    tier: {
      control: 'select',
      options: ['untrusted', 'novice', 'proven', 'trusted', 'elite', 'legendary'],
      description: 'Trust tier',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: 'Badge size',
    },
    showScore: {
      control: 'boolean',
      description: 'Show numeric score',
    },
    showLabel: {
      control: 'boolean',
      description: 'Show tier label',
    },
    showEmoji: {
      control: 'boolean',
      description: 'Show tier emoji',
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'Visual indicator of an agent\'s trust level in the AgentAnchor governance system.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof TrustBadge>

// Basic Examples
export const Default: Story = {
  args: {
    score: 750,
    tier: 'trusted',
    size: 'md',
    showScore: false,
    showLabel: true,
    showEmoji: true,
  },
}

export const WithScore: Story = {
  args: {
    score: 750,
    tier: 'trusted',
    showScore: true,
  },
}

// Size Variants
export const Small: Story = {
  args: {
    score: 500,
    tier: 'proven',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    score: 920,
    tier: 'legendary',
    size: 'lg',
  },
}

// All Tiers
export const AllTiers: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <TrustBadge score={50} tier="untrusted" />
      <TrustBadge score={300} tier="novice" />
      <TrustBadge score={500} tier="proven" />
      <TrustBadge score={700} tier="trusted" />
      <TrustBadge score={850} tier="elite" />
      <TrustBadge score={950} tier="legendary" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All six trust tiers with their respective colors and emojis.',
      },
    },
  },
}

export const AllTiersWithScores: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <TrustBadge score={50} tier="untrusted" showScore />
      <TrustBadge score={300} tier="novice" showScore />
      <TrustBadge score={500} tier="proven" showScore />
      <TrustBadge score={700} tier="trusted" showScore />
      <TrustBadge score={850} tier="elite" showScore />
      <TrustBadge score={950} tier="legendary" showScore />
    </div>
  ),
}

// Icon Only (no emoji)
export const IconOnly: Story = {
  args: {
    score: 700,
    tier: 'trusted',
    showEmoji: false,
    showLabel: false,
  },
}

// Legendary with Animation
export const Legendary: Story = {
  args: {
    score: 950,
    tier: 'legendary',
    size: 'lg',
  },
  parameters: {
    docs: {
      description: {
        story: 'Legendary tier includes a subtle sparkle animation.',
      },
    },
  },
}

// TrustScoreIndicator Stories
export const ScoreIndicator: StoryObj<typeof TrustScoreIndicator> = {
  render: () => (
    <div className="w-64 space-y-4">
      <TrustScoreIndicator score={150} tier="untrusted" />
      <TrustScoreIndicator score={350} tier="novice" />
      <TrustScoreIndicator score={550} tier="proven" />
      <TrustScoreIndicator score={750} tier="trusted" />
      <TrustScoreIndicator score={850} tier="elite" />
      <TrustScoreIndicator score={950} tier="legendary" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compact score indicator with progress bar, suitable for cards.',
      },
    },
  },
}

// CertificationBadge Stories
export const Certifications: StoryObj<typeof CertificationBadge> = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <CertificationBadge level={0} />
      <CertificationBadge level={1} />
      <CertificationBadge level={2} />
      <CertificationBadge level={3} />
      <CertificationBadge level={4} />
      <CertificationBadge level={5} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Certification levels from 0 (uncertified) to 5 (highest).',
      },
    },
  },
}

// AutonomyIndicator Stories
export const AutonomyLevels: StoryObj<typeof AutonomyIndicator> = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-2xl">
      <AutonomyIndicator tier="untrusted" />
      <AutonomyIndicator tier="novice" />
      <AutonomyIndicator tier="proven" />
      <AutonomyIndicator tier="trusted" />
      <AutonomyIndicator tier="elite" />
      <AutonomyIndicator tier="legendary" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows what actions are permitted at each trust tier.',
      },
    },
  },
}

// TrustTierCard Stories
export const TierCard: StoryObj<typeof TrustTierCard> = {
  render: () => (
    <div className="max-w-sm">
      <TrustTierCard score={750} tier="trusted" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Detailed trust tier card showing score, progress, and autonomy level.',
      },
    },
  },
}

export const TierCardNearUpgrade: StoryObj<typeof TrustTierCard> = {
  render: () => (
    <div className="max-w-sm">
      <TrustTierCard score={790} tier="trusted" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows points needed to reach the next tier.',
      },
    },
  },
}

export const TierCardLegendary: StoryObj<typeof TrustTierCard> = {
  render: () => (
    <div className="max-w-sm">
      <TrustTierCard score={950} tier="legendary" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Legendary tier with special gradient styling.',
      },
    },
  },
}

// Accessibility Demo
export const AccessibilityDemo: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">
          Screen Reader Announcements
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Each badge includes a title attribute and ARIA labels for screen readers.
        </p>
        <div className="flex gap-4">
          <TrustBadge score={750} tier="trusted" />
          <TrustBadge score={850} tier="elite" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">
          Color Contrast
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          All tier colors meet WCAG 2.1 AA contrast requirements.
        </p>
        <div className="flex gap-4">
          <TrustBadge score={500} tier="proven" size="lg" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates accessibility features including ARIA labels and color contrast.',
      },
    },
  },
}
