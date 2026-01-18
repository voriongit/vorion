import {
  LayoutDashboard,
  Bot,
  Scale,
  Eye,
  FileCheck,
  BarChart3,
  Settings,
  HelpCircle,
  LucideIcon,
  Shield,
  FlaskConical,
  AlertTriangle,
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

// B2B Navigation (Enterprise Agent Governance):
// 1. HOME - Command center
// 2. MONITOR - Agent oversight & testing
// 3. GOVERN - Trust, policies, escalations, audit
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
    id: 'agents',
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

  // === GOVERN - Trust, policies, escalations, audit ===
  {
    id: 'governance',
    label: 'Governance',
    href: '/governance',
    icon: Scale,
    section: 'govern',
  },
  {
    id: 'escalations',
    label: 'Escalations',
    href: '/escalations',
    icon: AlertTriangle,
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
    id: 'audit',
    label: 'Audit',
    href: '/audit',
    icon: FileCheck,
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
