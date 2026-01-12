import {
  LayoutDashboard,
  Bot,
  Scale,
  Eye,
  Link2,
  BarChart3,
  Settings,
  HelpCircle,
  LucideIcon,
  Shield,
  FlaskConical,
  GitCompare,
  Globe,
  Swords,
} from 'lucide-react'

export type UserRole = 'trainer' | 'consumer' | 'both'

export interface MenuItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  roles?: UserRole[] // If undefined, shown to all roles
  badge?: string | number
  section: 'home' | 'discover' | 'create' | 'govern' | 'grow' | 'system'
}

export interface MenuSection {
  id: string
  label: string
  items: MenuItem[]
}

// User Journey Navigation (Trust-Focused):
// 1. HOME - Your command center
// 2. MONITOR - Agent oversight & testing
// 3. GOVERN - Trust verification & compliance
// 4. ANALYTICS - Usage & performance
// 5. SYSTEM - Settings & help

export const menuItems: MenuItem[] = [
  // === HOME ===
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    section: 'home',
  },

  // === MONITOR - Agent oversight ===
  {
    id: 'my-agents',
    label: 'Agents',
    href: '/agents',
    icon: Bot,
    section: 'discover',
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    href: '/sandbox',
    icon: FlaskConical,
    section: 'discover',
  },
  {
    id: 'shadow-training',
    label: 'Shadow Training',
    href: '/shadow-training',
    icon: GitCompare,
    section: 'discover',
  },

  // === GOVERN - Trust & verification ===
  {
    id: 'council',
    label: 'Council',
    href: '/council',
    icon: Scale,
    section: 'govern',
  },
  {
    id: 'observer',
    label: 'Observer',
    href: '/observer',
    icon: Eye,
    section: 'govern',
  },
  {
    id: 'truth-chain',
    label: 'Truth Chain',
    href: '/truth-chain',
    icon: Link2,
    section: 'govern',
  },
  {
    id: 'testing-studio',
    label: 'Testing Studio',
    href: '/testing-studio',
    icon: Swords,
    section: 'govern',
  },
  {
    id: 'trust-bridge',
    label: 'Trust Bridge',
    href: '/trust-bridge',
    icon: Globe,
    section: 'govern',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    href: '/compliance',
    icon: Shield,
    section: 'govern',
  },

  // === ANALYTICS - Usage & performance ===
  {
    id: 'usage',
    label: 'Usage',
    href: '/usage',
    icon: BarChart3,
    section: 'grow',
  },

  // === SYSTEM ===
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    section: 'system',
  },
  {
    id: 'help',
    label: 'Help',
    href: '/help',
    icon: HelpCircle,
    section: 'system',
  },
]

/**
 * Filter menu items based on user role
 */
export function getMenuItemsForRole(role: UserRole): MenuItem[] {
  return menuItems.filter((item) => {
    if (!item.roles) return true // No role restriction
    return item.roles.includes(role)
  })
}

/**
 * Group menu items by section - User Journey based
 */
export function getMenuSections(role: UserRole): MenuSection[] {
  const items = getMenuItemsForRole(role)

  const sections: MenuSection[] = []

  // Home - always first, no label needed
  const homeItems = items.filter((i) => i.section === 'home')
  if (homeItems.length > 0) {
    sections.push({
      id: 'home',
      label: '',
      items: homeItems,
    })
  }

  // Monitor (formerly Discover)
  const monitorItems = items.filter((i) => i.section === 'discover')
  if (monitorItems.length > 0) {
    sections.push({
      id: 'monitor',
      label: 'Monitor',
      items: monitorItems,
    })
  }

  // Govern
  const governItems = items.filter((i) => i.section === 'govern')
  if (governItems.length > 0) {
    sections.push({
      id: 'govern',
      label: 'Govern',
      items: governItems,
    })
  }

  // Analytics (formerly Grow)
  const analyticsItems = items.filter((i) => i.section === 'grow')
  if (analyticsItems.length > 0) {
    sections.push({
      id: 'analytics',
      label: 'Analytics',
      items: analyticsItems,
    })
  }

  // System - always last
  const systemItems = items.filter((i) => i.section === 'system')
  if (systemItems.length > 0) {
    sections.push({
      id: 'system',
      label: 'System',
      items: systemItems,
    })
  }

  return sections
}
