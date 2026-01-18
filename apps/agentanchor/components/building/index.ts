// Building Navigation - "The Anchor" Tower
// Spatial UX components for navigating the AgentAnchor platform

// Core navigation
export { BuildingNavigation, BUILDING_FLOORS, WINGS } from './BuildingNavigation'
export type { WingType } from './BuildingNavigation'

// Wing-based navigation
export { WingNavigator } from './WingNavigator'

// Signage and wayfinding
export { Signage, ComicBurst, FloorMarker, CorridorSign } from './Signage'

// Floor directory (full building map)
export { FloorDirectory } from './FloorDirectory'

// Breadcrumb navigation
export { BuildingBreadcrumb, FloorIndicator } from './BuildingBreadcrumb'

// Mini-map (persistent floor indicator)
export { MiniMap } from './MiniMap'

// Concierge (welcome/help assistant)
export { Concierge } from './Concierge'

// Floor arrival animations
export { FloorArrival, FLOOR_THEMES } from './FloorArrival'

// Floor memory (persistent position)
export {
  useFloorMemory,
  FloorMemoryProvider,
  getRecentFloors,
  getSmartFloorPath
} from './FloorMemory'

// Quick travel (keyboard shortcuts)
export {
  useQuickTravel,
  QuickTravelProvider,
  QuickTravelHint
} from './QuickTravel'

// Floor landing with themed decorations
export { FloorLanding } from './FloorLanding'

// Floor themes configuration
export { FLOOR_THEMES as FloorThemes, getFloorTheme, getFloorLandingClasses, getDoorStyling } from '@/lib/building/floor-themes'
export type { FloorTheme, FloorThemeDetails } from '@/lib/building/floor-themes'
