import {
  Crown, Gavel, Sparkles, Eye, GraduationCap,
  Shield, Store, Wrench, Building2, LucideIcon
} from 'lucide-react'

// Floor theme details for rich visual experiences
export interface FloorThemeDetails {
  mood: string
  materials: string[]
  lighting: string
  soundscape: string
  doorTrim: string
  floorIndicator: string
}

export interface FloorTheme {
  name: string
  icon: LucideIcon
  bgGradient: string
  accentColor: string
  doorStyle: string
  ambientElements: readonly string[]
  arrivalMessage: string
  subtitle: string
  particles: string
  theme: string
  themeDetails: FloorThemeDetails
}

// Comprehensive floor themes for "The Anchor" building
export const FLOOR_THEMES: Record<number, FloorTheme> = {
  10: {
    name: 'Council Chambers',
    icon: Crown,
    bgGradient: 'from-amber-950 via-purple-950 to-slate-950',
    accentColor: 'amber',
    doorStyle: 'ornate',
    ambientElements: ['marble pillars', 'council seal', 'golden trim'],
    arrivalMessage: 'Entering the Council Chambers...',
    subtitle: 'Where governance decisions shape the future',
    particles: 'gold-dust',
    // Luxury Executive Theme
    theme: 'luxury',
    themeDetails: {
      mood: 'Prestigious and powerful',
      materials: ['Marble floors', 'Mahogany paneling', 'Gold leaf accents', 'Crystal chandeliers'],
      lighting: 'Warm amber, soft spotlights',
      soundscape: 'Hushed reverence, distant grandfather clock',
      doorTrim: 'border-amber-500/50 shadow-amber-500/20',
      floorIndicator: 'bg-amber-900/80 border-amber-400 text-amber-300',
    }
  },
  9: {
    name: 'Tribunal',
    icon: Gavel,
    bgGradient: 'from-stone-950 via-red-950 to-stone-950',
    accentColor: 'red',
    doorStyle: 'judicial',
    ambientElements: ['scales of justice', 'judicial bench', 'case files'],
    arrivalMessage: 'Approaching the Tribunal...',
    subtitle: 'Justice through fair deliberation',
    particles: 'paper-flutter',
    // Judicial Solemnity Theme
    theme: 'judicial',
    themeDetails: {
      mood: 'Solemn and authoritative',
      materials: ['Dark oak wood', 'Leather-bound tomes', 'Bronze scales', 'Burgundy velvet'],
      lighting: 'Courtroom tungsten, dramatic shadows',
      soundscape: 'Gavel echoes, rustling papers',
      doorTrim: 'border-red-800/50 shadow-red-900/30',
      floorIndicator: 'bg-stone-900/80 border-red-700 text-red-400',
    }
  },
  8: {
    name: 'Arena',
    icon: Sparkles,
    bgGradient: 'from-slate-950 via-orange-950 to-slate-950',
    accentColor: 'orange',
    doorStyle: 'arena-gates',
    ambientElements: ['sparring mats', 'scoreboards', 'training dummies'],
    arrivalMessage: 'Welcome to the Arena!',
    subtitle: 'Where agents prove their worth',
    particles: 'sparks',
    // Combat/Competition Theme
    theme: 'arena',
    themeDetails: {
      mood: 'Electric and competitive',
      materials: ['Stadium metal', 'LED panels', 'Rubber mats', 'Neon accents'],
      lighting: 'Stadium spotlights, scoreboard glow, neon edges',
      soundscape: 'Crowd roar, buzzer, dramatic music',
      doorTrim: 'border-orange-500/60 shadow-orange-500/40',
      floorIndicator: 'bg-slate-900/90 border-orange-400 text-orange-300',
    }
  },
  7: {
    name: 'Observer Deck',
    icon: Eye,
    bgGradient: 'from-slate-950 via-cyan-950 to-slate-950',
    accentColor: 'cyan',
    doorStyle: 'glass',
    ambientElements: ['panoramic windows', 'monitoring screens', 'audit trails'],
    arrivalMessage: 'Entering Observer Deck...',
    subtitle: 'Transparency through vigilance',
    particles: 'scan-lines',
    // NASA Control Room Theme
    theme: 'control-room',
    themeDetails: {
      mood: 'Vigilant and technical',
      materials: ['Glass panels', 'Brushed steel', 'Blue LED strips', 'Holographic displays'],
      lighting: 'Cool blue glow, monitor light, radar sweep',
      soundscape: 'Soft beeps, data streams, keyboard clicks',
      doorTrim: 'border-cyan-500/50 shadow-cyan-500/30',
      floorIndicator: 'bg-slate-900/90 border-cyan-400 text-cyan-300',
    }
  },
  6: {
    name: 'Academy',
    icon: GraduationCap,
    bgGradient: 'from-stone-950 via-emerald-950 to-stone-950',
    accentColor: 'emerald',
    doorStyle: 'academic',
    ambientElements: ['bookshelves', 'graduation caps', 'certificates'],
    arrivalMessage: 'Welcome to the Academy',
    subtitle: 'Knowledge builds trust',
    particles: 'page-turn',
    // University Library Theme
    theme: 'academic',
    themeDetails: {
      mood: 'Scholarly and inspiring',
      materials: ['Warm oak shelves', 'Leather chairs', 'Green banker lamps', 'Ivy accents'],
      lighting: 'Warm reading lamps, window light, diploma spotlights',
      soundscape: 'Page turns, whispered study, graduation march distant',
      doorTrim: 'border-emerald-600/50 shadow-emerald-600/20',
      floorIndicator: 'bg-stone-900/80 border-emerald-500 text-emerald-400',
    }
  },
  5: {
    name: 'Trust Vault',
    icon: Shield,
    bgGradient: 'from-slate-950 via-blue-950 to-slate-950',
    accentColor: 'blue',
    doorStyle: 'vault',
    ambientElements: ['safety deposit boxes', 'credential displays', 'trust meters'],
    arrivalMessage: 'Accessing Trust Vault...',
    subtitle: 'Where credentials are earned and stored',
    particles: 'shield-shimmer',
    // Bank Vault Theme
    theme: 'vault',
    themeDetails: {
      mood: 'Secure and prestigious',
      materials: ['Brushed steel', 'Safety deposit hexagons', 'Security lasers', 'Vault door'],
      lighting: 'Security blue, badge spotlights, laser grid',
      soundscape: 'Vault door mechanics, soft hum, credential dings',
      doorTrim: 'border-blue-500/50 shadow-blue-500/30',
      floorIndicator: 'bg-slate-900/90 border-blue-400 text-blue-300',
    }
  },
  4: {
    name: 'Marketplace',
    icon: Store,
    bgGradient: 'from-purple-950 via-pink-950 to-purple-950',
    accentColor: 'pink',
    doorStyle: 'bazaar',
    ambientElements: ['agent storefronts', 'price tickers', 'busy crowds'],
    arrivalMessage: 'Welcome to the Marketplace!',
    subtitle: 'Discover agents you can anchor to',
    particles: 'confetti',
    // Vibrant Bazaar Theme
    theme: 'bazaar',
    themeDetails: {
      mood: 'Bustling and exciting',
      materials: ['Colorful awnings', 'Merchant stalls', 'Price tags', 'Neon signs'],
      lighting: 'Warm market lights, neon storefront glow, ticker LEDs',
      soundscape: 'Crowd chatter, transaction dings, vendor calls',
      doorTrim: 'border-pink-500/50 shadow-pink-500/30',
      floorIndicator: 'bg-purple-900/80 border-pink-400 text-pink-300',
    }
  },
  3: {
    name: 'Workshop',
    icon: Wrench,
    bgGradient: 'from-stone-950 via-amber-950 to-stone-950',
    accentColor: 'amber',
    doorStyle: 'industrial',
    ambientElements: ['workbenches', 'tools', 'agents under construction'],
    arrivalMessage: 'Entering the Workshop...',
    subtitle: 'Build something amazing',
    particles: 'welding-sparks',
    // Maker Lab Theme
    theme: 'workshop',
    themeDetails: {
      mood: 'Creative and industrious',
      materials: ['Exposed brick', 'Steel workbenches', 'Tool pegboards', 'Blueprint paper'],
      lighting: 'Warm workshop bulbs, task lamps, welding flashes',
      soundscape: 'Power tools, hammering, collaborative chatter',
      doorTrim: 'border-amber-600/50 shadow-amber-600/30',
      floorIndicator: 'bg-stone-900/80 border-amber-500 text-amber-400',
    }
  },
  2: {
    name: 'Compliance Vault',
    icon: Shield,
    bgGradient: 'from-slate-950 via-zinc-900 to-slate-950',
    accentColor: 'slate',
    doorStyle: 'secure',
    ambientElements: ['filing cabinets', 'audit logs', 'compliance badges'],
    arrivalMessage: 'Accessing Compliance Vault...',
    subtitle: 'Security. Privacy. Trust.',
    particles: 'lock-click',
    // Archive/Filing Room Theme
    theme: 'archive',
    themeDetails: {
      mood: 'Orderly and secure',
      materials: ['Gray steel cabinets', 'Manila folders', 'Stamp marks', 'Lock boxes'],
      lighting: 'Fluorescent office, document scanner glow',
      soundscape: 'Filing drawer slides, stamp thuds, paper shuffles',
      doorTrim: 'border-zinc-500/50 shadow-zinc-500/20',
      floorIndicator: 'bg-slate-800/90 border-zinc-400 text-zinc-300',
    }
  },
  1: {
    name: 'Lobby',
    icon: Building2,
    bgGradient: 'from-slate-900 via-slate-800 to-slate-900',
    accentColor: 'slate',
    doorStyle: 'grand',
    ambientElements: ['concierge desk', 'directory board', 'welcome mat'],
    arrivalMessage: 'Welcome to The Anchor',
    subtitle: 'Your AI Governance Headquarters',
    particles: 'gentle-glow',
    // Grand Hotel Lobby Theme
    theme: 'lobby',
    themeDetails: {
      mood: 'Welcoming and impressive',
      materials: ['Polished marble', 'Brass fixtures', 'Potted palms', 'Reception desk'],
      lighting: 'Warm chandelier, welcoming glow, directory backlight',
      soundscape: 'Soft jazz, concierge bell, footsteps on marble',
      doorTrim: 'border-slate-400/50 shadow-slate-400/20',
      floorIndicator: 'bg-slate-800/80 border-slate-400 text-slate-300',
    }
  }
}

// Helper to get theme for a floor
export function getFloorTheme(floor: number): FloorTheme {
  return FLOOR_THEMES[floor] || FLOOR_THEMES[1]
}

// Get background classes for a floor's landing page
export function getFloorLandingClasses(floor: number): string {
  const theme = getFloorTheme(floor)
  return `bg-gradient-to-b ${theme.bgGradient}`
}

// Get door styling for elevator animation
export function getDoorStyling(floor: number): { trim: string; indicator: string } {
  const theme = getFloorTheme(floor)
  return {
    trim: theme.themeDetails.doorTrim,
    indicator: theme.themeDetails.floorIndicator,
  }
}
