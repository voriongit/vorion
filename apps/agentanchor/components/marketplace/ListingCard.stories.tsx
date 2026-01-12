import type { Meta, StoryObj } from '@storybook/react'
import ListingCard from './ListingCard'
import { ListingWithAgent } from '@/lib/marketplace/types'

/**
 * ListingCard displays a marketplace agent listing in a compact card format.
 *
 * Shows key information including:
 * - Agent name and title
 * - Trust badge with tier
 * - Rating and acquisition count
 * - Category and pricing
 */
const meta: Meta<typeof ListingCard> = {
  title: 'Marketplace/ListingCard',
  component: ListingCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-neutral-950 p-8 max-w-sm">
        <Story />
      </div>
    ),
  ],
  parameters: {
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        component: 'Card component for displaying marketplace agent listings with trust score, ratings, and pricing.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ListingCard>

// Mock listing data
const baseListing: ListingWithAgent = {
  id: 'listing-123',
  agent_id: 'agent-123',
  trainer_id: 'trainer-123',
  title: 'AI Finance Assistant',
  description: 'Expert financial analysis and reporting agent with deep knowledge of accounting standards and investment strategies.',
  short_description: 'Expert financial analysis and reporting agent',
  category: 'finance',
  tags: ['finance', 'analysis', 'reporting'],
  commission_rate: 0.0015,
  complexity_multiplier: 1.0,
  platform_fee_percent: 15,
  status: 'active',
  featured: false,
  total_acquisitions: 42,
  total_tasks_completed: 1250,
  total_earnings: 2500,
  average_rating: 4.8,
  rating_count: 28,
  published_at: '2025-01-15T00:00:00Z',
  created_at: '2025-01-10T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
  agent: {
    id: 'agent-123',
    name: 'FinanceBot Pro',
    description: 'Expert financial analysis agent',
    trust_score: 650,
    trust_tier: 'trusted',
    status: 'active',
    capabilities: [],
  },
}

// Basic Examples
export const Default: Story = {
  args: {
    listing: baseListing,
  },
}

export const HighlyRated: Story = {
  args: {
    listing: {
      ...baseListing,
      id: 'listing-rated',
      title: 'Customer Support Champion',
      category: 'customer-support',
      average_rating: 5.0,
      rating_count: 156,
      total_acquisitions: 234,
      agent: {
        ...baseListing.agent,
        name: 'SupportBot Elite',
        trust_score: 850,
        trust_tier: 'elite',
      },
    },
  },
}

export const NoReviews: Story = {
  args: {
    listing: {
      ...baseListing,
      id: 'listing-new',
      title: 'New AI Research Assistant',
      category: 'research',
      average_rating: undefined,
      rating_count: 0,
      total_acquisitions: 2,
      agent: {
        ...baseListing.agent,
        name: 'ResearchBot Alpha',
        trust_score: 350,
        trust_tier: 'novice',
      },
    },
  },
}

export const LegendaryAgent: Story = {
  args: {
    listing: {
      ...baseListing,
      id: 'listing-legendary',
      title: 'Master Strategist AI',
      category: 'general',
      average_rating: 4.9,
      rating_count: 500,
      total_acquisitions: 1500,
      commission_rate: 0.005,
      featured: true,
      agent: {
        ...baseListing.agent,
        name: 'StrategistBot Genesis',
        trust_score: 950,
        trust_tier: 'legendary',
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'A legendary tier agent with high ratings and acquisitions.',
      },
    },
  },
}

export const LowTrustAgent: Story = {
  args: {
    listing: {
      ...baseListing,
      id: 'listing-low-trust',
      title: 'Budget Task Helper',
      category: 'general',
      average_rating: 3.2,
      rating_count: 5,
      total_acquisitions: 8,
      commission_rate: 0.0005,
      agent: {
        ...baseListing.agent,
        name: 'BudgetBot',
        trust_score: 150,
        trust_tier: 'untrusted',
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'An untrusted tier agent with minimal reviews.',
      },
    },
  },
}

// Grid of multiple cards
export const ListingGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ListingCard
        listing={{
          ...baseListing,
          title: 'AI Finance Assistant',
          category: 'finance',
        }}
      />
      <ListingCard
        listing={{
          ...baseListing,
          id: 'listing-2',
          title: 'Customer Support Pro',
          category: 'customer-support',
          agent: {
            ...baseListing.agent,
            trust_score: 750,
            trust_tier: 'trusted',
          },
        }}
      />
      <ListingCard
        listing={{
          ...baseListing,
          id: 'listing-3',
          title: 'Marketing Genius AI',
          category: 'marketing',
          average_rating: 4.5,
          agent: {
            ...baseListing.agent,
            trust_score: 500,
            trust_tier: 'proven',
          },
        }}
      />
      <ListingCard
        listing={{
          ...baseListing,
          id: 'listing-4',
          title: 'Legal Document Analyzer',
          category: 'legal',
          agent: {
            ...baseListing.agent,
            trust_score: 900,
            trust_tier: 'legendary',
          },
        }}
      />
    </div>
  ),
  decorators: [
    (Story) => (
      <div className="bg-neutral-950 p-8 max-w-4xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Multiple listing cards arranged in a responsive grid layout.',
      },
    },
  },
}

// Category showcase
export const AllCategories: Story = {
  render: () => {
    const categories = ['finance', 'customer-support', 'marketing', 'legal', 'hr', 'research']
    return (
      <div className="space-y-4">
        {categories.map((category) => (
          <ListingCard
            key={category}
            listing={{
              ...baseListing,
              id: `listing-${category}`,
              title: `${category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')} Agent`,
              category,
            }}
          />
        ))}
      </div>
    )
  },
  decorators: [
    (Story) => (
      <div className="bg-neutral-950 p-8 max-w-sm">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Listings across different categories.',
      },
    },
  },
}
