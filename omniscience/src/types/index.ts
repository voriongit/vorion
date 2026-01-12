// Knowledge/Lexicon Types
export type KnowledgeLevel = 'novice' | 'intermediate' | 'expert' | 'theoretical';

export interface LexiconTerm {
  id?: string;
  term: string;
  definition: string;
  level: KnowledgeLevel;
  category?: string;
  tags?: string[];
  relatedTerms?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Learning Path Types
export type PathDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type PathDuration = 'short' | 'medium' | 'long'; // ~30min, ~1-2hr, ~3-4hr

export interface LearningPathModule {
  id: string;
  title: string;
  description: string;
  terms: string[]; // Term names to learn in order
  objectives: string[]; // What you'll learn
  estimatedMinutes: number;
}

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: PathDifficulty;
  duration: PathDuration;
  estimatedHours: number;
  icon: string; // Lucide icon name
  color: string; // Tailwind color
  prerequisites?: string[]; // Other path slugs
  modules: LearningPathModule[];
  outcomes: string[]; // What you can do after completing
  tags: string[];
}

export interface UserPathProgress {
  pathId: string;
  startedAt: Date;
  completedModules: string[];
  completedTerms: string[];
  lastAccessedAt: Date;
  completedAt?: Date;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  source?: 'local' | 'synthesis';
  perspectives?: SynthesisPerspective[];
}

export interface SynthesisPerspective {
  model: AIModel;
  content: string;
}

// AI Provider Types
export type AIModel = 'gemini' | 'claude' | 'grok';

export interface AIProviderConfig {
  model: AIModel;
  enabled: boolean;
  apiKey?: string;
}

export interface SynthesisRequest {
  query: string;
  context?: string;
  models?: AIModel[];
}

export interface SynthesisResponse {
  synthesis: string;
  perspectives: SynthesisPerspective[];
  localMatch?: LexiconTerm;
  processingTime: number;
}

// App State Types
export interface NexusState {
  lexicon: LexiconTerm[];
  isConnected: boolean;
  activeTab: 'hero' | 'lexicon' | 'neural' | 'cortex' | 'docs';
  chatOpen: boolean;
  processingStatus: ProcessingStatus | null;
}

export interface ProcessingStatus {
  stage: 'local' | 'external' | 'synthesis';
  message: string;
  activeNodes: AIModel[];
}

// Documentation Types
export interface DocMeta {
  title: string;
  description: string;
  sidebar_position?: number;
  tags?: string[];
}

export interface DocPage {
  slug: string;
  meta: DocMeta;
  content: string;
}

// Firebase Types
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
