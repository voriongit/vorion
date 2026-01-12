/**
 * Breadcrumb utilities for generating navigation paths
 */

export interface BreadcrumbItem {
  label: string
  href: string
  isCurrentPage: boolean
}

// Custom labels for specific paths
const customLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'agents': 'Agents',
  'academy': 'Academy',
  'council': 'Council',
  'observer': 'Observer',
  'marketplace': 'Marketplace',
  'truth-chain': 'Truth Chain',
  'earnings': 'Earnings',
  'storefront': 'Storefront',
  'portfolio': 'Portfolio',
  'usage': 'Usage',
  'settings': 'Settings',
  'profile': 'Profile',
  'notifications': 'Notifications',
  'security': 'Security',
  'billing': 'Billing',
  'help': 'Help',
  'bots': 'Bots',
  'new': 'New',
  'edit': 'Edit',
  'trust': 'Trust Score',
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert URL segment to readable label
 */
function segmentToLabel(segment: string): string {
  // Check for custom label
  if (customLabels[segment.toLowerCase()]) {
    return customLabels[segment.toLowerCase()]
  }

  // Handle UUID-like segments (show as ID)
  if (/^[0-9a-f-]{36}$/i.test(segment)) {
    return `ID: ${segment.slice(0, 8)}...`
  }

  // Handle kebab-case
  if (segment.includes('-')) {
    return segment
      .split('-')
      .map(capitalize)
      .join(' ')
  }

  return capitalize(segment)
}

/**
 * Generate breadcrumb items from pathname
 */
export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Remove leading/trailing slashes and split
  const segments = pathname.replace(/^\/|\/$/g, '').split('/')

  // Filter out empty segments
  const filteredSegments = segments.filter(Boolean)

  // Generate breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = []
  let currentPath = ''

  for (let i = 0; i < filteredSegments.length; i++) {
    const segment = filteredSegments[i]
    currentPath += `/${segment}`

    breadcrumbs.push({
      label: segmentToLabel(segment),
      href: currentPath,
      isCurrentPage: i === filteredSegments.length - 1,
    })
  }

  return breadcrumbs
}

/**
 * Get the page title from pathname
 */
export function getPageTitle(pathname: string): string {
  const breadcrumbs = generateBreadcrumbs(pathname)
  return breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1].label
    : 'Dashboard'
}
