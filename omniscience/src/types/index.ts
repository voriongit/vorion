// Knowledge/Lexicon Types
export type KnowledgeLevel = 'novice' | 'intermediate' | 'expert' | 'theoretical';

export interface LexiconTerm {
  id?: string;
  term: string;
  definition: string;
  level: KnowledgeLevel;
  category?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
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
