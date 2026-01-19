import { useState, useEffect, useCallback } from 'react';
// [Deleted MCP Import]
type ToolDefinition = any; // Fallback
import { api } from '../api';

// AI Provider API base
const AI_API_BASE = 'http://127.0.0.1:3003';

// ============================================================================
// Integration Data
// ============================================================================

interface Integration {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    search?: string;
    guide?: string;
    helpUrl?: string;
    fields: { key: string; label: string; type: string; required: boolean }[];
}

const CATEGORIES = ['ALL', 'AI', 'WEB', 'SOCIAL', 'BUSINESS', 'CRM', 'ANALYTICS'];

const INTEGRATIONS: Integration[] = [
    // AI - Core Providers (connected to backend)
    { id: 'anthropic', name: 'Anthropic (Claude)', description: 'Claude AI models - Sonnet, Opus, Haiku', category: 'AI', icon: '🧠', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], guide: 'Get your API key from the Anthropic Console.', helpUrl: 'https://console.anthropic.com/' },
    { id: 'xai', name: 'xAI (Grok)', description: 'Grok AI models', category: 'AI', icon: '🚀', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], guide: 'Get your API key from the xAI Developer Console.', helpUrl: 'https://console.x.ai/' },
    { id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-4o, DALL-E APIs', category: 'AI', icon: '🤖', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], guide: 'Get your API Key from platform.openai.com. You must have billing set up.', helpUrl: 'https://platform.openai.com/api-keys' },
    { id: 'google-ai', name: 'Google AI (Gemini)', description: 'Gemini Pro, Flash models', category: 'AI', icon: '✨', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], guide: 'Get your API key from Google AI Studio.', helpUrl: 'https://aistudio.google.com/app/apikey' },
    // AI - Additional Providers
    { id: 'mistral', name: 'Mistral AI', description: 'Open weights models', category: 'AI', icon: '🌪️', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'cohere', name: 'Cohere', description: 'Enterprise LLMs', category: 'AI', icon: '🖇️', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'huggingface', name: 'Hugging Face', description: 'Open source hub', category: 'AI', icon: '🤗', status: 'DISCONNECTED', fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }] },
    { id: 'perplexity', name: 'Perplexity', description: 'Online LLM API', category: 'AI', icon: '🔮', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },

    // Web Search
    { id: 'serper', name: 'Serper.dev', description: 'Google Search API', category: 'WEB', icon: '🔍', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], guide: 'Sign up for a free account at serper.dev to get 2,500 free queries.', helpUrl: 'https://serper.dev' },
    { id: 'brave', name: 'Brave Search', description: 'Privacy search API', category: 'WEB', icon: '🦁', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'tavily', name: 'Tavily', description: 'Search for Agents', category: 'WEB', icon: '🕵️', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },

    // Social
    { id: 'twitter', name: 'Twitter/X', description: 'Read and post tweets', category: 'SOCIAL', icon: '🐦', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }, { key: 'apiSecret', label: 'API Secret', type: 'password', required: true }], guide: 'Requires a Developer Account with Elevated access for v2 API', helpUrl: 'https://developer.twitter.com/en/portal/dashboard' },
    { id: 'linkedin', name: 'LinkedIn', description: 'Professional network', category: 'SOCIAL', icon: '💼', status: 'DISCONNECTED', fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }] },
    { id: 'discord', name: 'Discord', description: 'Bot and webhooks', category: 'SOCIAL', icon: '🎮', status: 'DISCONNECTED', fields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }], guide: 'Create an Application in Discord Developer Portal, add a Bot user, and copy the Token.', helpUrl: 'https://discord.com/developers/applications' },
    { id: 'reddit', name: 'Reddit', description: 'Community discussions', category: 'SOCIAL', icon: '👽', status: 'DISCONNECTED', fields: [{ key: 'clientId', label: 'Client ID', type: 'string', required: true }, { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true }] },
    { id: 'telegram', name: 'Telegram', description: 'Messaging bot', category: 'SOCIAL', icon: '✈️', status: 'DISCONNECTED', fields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }], guide: 'Talk to @BotFather on Telegram to create a new bot and get the HTTP API Token.' },
    { id: 'youtube', name: 'YouTube', description: 'Video platform', category: 'SOCIAL', icon: '📺', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'instagram', name: 'Instagram', description: 'Visual media', category: 'SOCIAL', icon: '📸', status: 'DISCONNECTED', fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }] },

    // Business
    { id: 'slack', name: 'Slack', description: 'Team messaging', category: 'BUSINESS', icon: '💬', status: 'DISCONNECTED', fields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }], guide: 'Create an App, enable Socket Mode, and add Bot Token Scopes.' },
    { id: 'gmail', name: 'Gmail', description: 'Email access', category: 'BUSINESS', icon: '📧', status: 'DISCONNECTED', fields: [{ key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true }] },
    { id: 'google-calendar', name: 'Google Calendar', description: 'Calendar management', category: 'BUSINESS', icon: '📅', status: 'DISCONNECTED', fields: [{ key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true }] },
    { id: 'notion', name: 'Notion', description: 'Workspace docs', category: 'BUSINESS', icon: '📝', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'Integration Token', type: 'password', required: true }], guide: 'Create an Internal Integration in Notion Settings > Connections.' },
    { id: 'teams', name: 'Microsoft Teams', description: 'Enterprise chat', category: 'BUSINESS', icon: '👥', status: 'DISCONNECTED', fields: [{ key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true }] },
    { id: 'zoom', name: 'Zoom', description: 'Video conferencing', category: 'BUSINESS', icon: '📹', status: 'DISCONNECTED', fields: [{ key: 'jwtToken', label: 'JWT Token', type: 'password', required: true }] },
    { id: 'trello', name: 'Trello', description: 'Project boards', category: 'BUSINESS', icon: '🗂️', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }, { key: 'token', label: 'Token', type: 'password', required: true }] },
    { id: 'asana', name: 'Asana', description: 'Task management', category: 'BUSINESS', icon: '⚪', status: 'DISCONNECTED', fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }] },
    { id: 'stripe', name: 'Stripe', description: 'Payments platform', category: 'BUSINESS', icon: '💳', status: 'DISCONNECTED', fields: [{ key: 'secretKey', label: 'Secret Key', type: 'password', required: true }], guide: 'Use a Test Mode Secret Key (sk_test_...) for development.' },
    { id: 'airtable', name: 'Airtable', description: 'Spreadsheet db', category: 'BUSINESS', icon: '📊', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },

    // CRM
    { id: 'hubspot', name: 'HubSpot', description: 'CRM and marketing', category: 'CRM', icon: '🔶', status: 'DISCONNECTED', fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'salesforce', name: 'Salesforce', description: 'Enterprise CRM', category: 'CRM', icon: '☁️', status: 'DISCONNECTED', fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }, { key: 'instanceUrl', label: 'Instance URL', type: 'text', required: true }] },
    { id: 'zoho', name: 'Zoho CRM', description: 'Business suite', category: 'CRM', icon: '🇿', status: 'DISCONNECTED', fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }] },
];

// AI Provider types matching backend
interface AIProviderInfo {
    type: 'claude' | 'grok' | 'openai' | 'gemini';
    isDefault: boolean;
    model: string;
}

interface AIProviderStatus {
    providers: AIProviderInfo[];
    default: string;
    allProviderTypes: string[];
}

// Map frontend integration IDs to backend provider types (reserved for future use)
const _INTEGRATION_TO_PROVIDER: Record<string, 'claude' | 'grok' | 'openai' | 'gemini'> = {
    'anthropic': 'claude',
    'xai': 'grok',
    'openai': 'openai',
    'google-ai': 'gemini',
};
void _INTEGRATION_TO_PROVIDER;

const PROVIDER_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
    'claude': { name: 'Claude (Anthropic)', icon: '🧠', color: '#D97706' },
    'grok': { name: 'Grok (xAI)', icon: '🚀', color: '#3B82F6' },
    'openai': { name: 'GPT-4 (OpenAI)', icon: '🤖', color: '#10B981' },
    'gemini': { name: 'Gemini (Google)', icon: '✨', color: '#8B5CF6' },
};

// ============================================================================
// MCP Server Registry
// ============================================================================

interface MCPServer {
    id: string;
    name: string;
    description: string;
    category: 'official' | 'database' | 'productivity' | 'dev-tools' | 'search' | 'communication' | 'social' | 'cms' | 'deploy';
    icon: string;
    package: string;
    installCommand: string;
    configFields?: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
    docsUrl?: string;
    isNew?: boolean;
    isFeatured?: boolean;
}

const MCP_SERVERS: MCPServer[] = [
    // Official Anthropic Reference Servers
    { id: 'filesystem', name: 'Filesystem', description: 'Secure file operations with configurable access controls', category: 'official', icon: '📁', package: '@modelcontextprotocol/server-filesystem', installCommand: 'npx -y @anthropic-ai/mcp add filesystem', docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem' },
    { id: 'git', name: 'Git', description: 'Read, search, and manipulate Git repositories', category: 'official', icon: '🔀', package: '@modelcontextprotocol/server-git', installCommand: 'npx -y @anthropic-ai/mcp add git', docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git' },
    { id: 'memory', name: 'Memory', description: 'Knowledge graph-based persistent memory system', category: 'official', icon: '🧠', package: '@modelcontextprotocol/server-memory', installCommand: 'npx -y @anthropic-ai/mcp add memory', docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory' },
    { id: 'fetch', name: 'Fetch', description: 'Web content fetching and conversion for LLM usage', category: 'official', icon: '🌐', package: '@modelcontextprotocol/server-fetch', installCommand: 'npx -y @anthropic-ai/mcp add fetch', docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch' },
    { id: 'sequential-thinking', name: 'Sequential Thinking', description: 'Dynamic problem-solving through thought sequences', category: 'official', icon: '💭', package: '@modelcontextprotocol/server-sequentialthinking', installCommand: 'npx -y @anthropic-ai/mcp add sequentialthinking', docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking', isNew: true },

    // Database Servers
    { id: 'supabase', name: 'Supabase', description: 'Connect Supabase to AI assistants - database, auth, storage', category: 'database', icon: '⚡', package: '@supabase/mcp-server-supabase', installCommand: 'npx -y @anthropic-ai/mcp add supabase', configFields: [{ key: 'supabaseUrl', label: 'Project URL', type: 'url', required: true, placeholder: 'https://xxx.supabase.co' }, { key: 'supabaseKey', label: 'Anon Key', type: 'password', required: true }], docsUrl: 'https://supabase.com/docs/guides/getting-started/mcp', isFeatured: true },
    { id: 'postgres', name: 'PostgreSQL', description: 'Direct PostgreSQL database access and queries', category: 'database', icon: '🐘', package: '@modelcontextprotocol/server-postgres', installCommand: 'npx -y @anthropic-ai/mcp add postgres', configFields: [{ key: 'connectionString', label: 'Connection String', type: 'password', required: true, placeholder: 'postgresql://user:pass@host:5432/db' }], docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres' },
    { id: 'sqlite', name: 'SQLite', description: 'Local SQLite database operations', category: 'database', icon: '🗄️', package: '@modelcontextprotocol/server-sqlite', installCommand: 'npx -y @anthropic-ai/mcp add sqlite', configFields: [{ key: 'dbPath', label: 'Database Path', type: 'text', required: true, placeholder: './data.db' }] },

    // Productivity & Cloud
    { id: 'google-drive', name: 'Google Drive', description: 'Access and manage Google Drive files', category: 'productivity', icon: '📂', package: '@anthropic-ai/mcp-server-gdrive', installCommand: 'npx -y @anthropic-ai/mcp add gdrive', docsUrl: 'https://github.com/anthropics/mcp-servers', isFeatured: true },
    { id: 'notion', name: 'Notion', description: 'Read and update Notion workspaces', category: 'productivity', icon: '📝', package: '@anthropic-ai/mcp-server-notion', installCommand: 'npx -y @anthropic-ai/mcp add notion', configFields: [{ key: 'notionToken', label: 'Integration Token', type: 'password', required: true }], docsUrl: 'https://github.com/anthropics/mcp-servers' },
    { id: 'linear', name: 'Linear', description: 'Issue tracking and project management', category: 'productivity', icon: '📐', package: '@anthropic-ai/mcp-server-linear', installCommand: 'npx -y @anthropic-ai/mcp add linear', configFields: [{ key: 'linearApiKey', label: 'API Key', type: 'password', required: true }], isNew: true },

    // Dev Tools
    { id: 'github', name: 'GitHub', description: 'Repo management, issues, PRs, and code search', category: 'dev-tools', icon: '🐙', package: '@anthropic-ai/mcp-server-github', installCommand: 'npx -y @anthropic-ai/mcp add github', configFields: [{ key: 'githubToken', label: 'Personal Access Token', type: 'password', required: true }], docsUrl: 'https://github.com/anthropics/mcp-servers', isFeatured: true },
    { id: 'gitlab', name: 'GitLab', description: 'GitLab repository and CI/CD access', category: 'dev-tools', icon: '🦊', package: '@anthropic-ai/mcp-server-gitlab', installCommand: 'npx -y @anthropic-ai/mcp add gitlab', configFields: [{ key: 'gitlabToken', label: 'Access Token', type: 'password', required: true }] },
    { id: 'puppeteer', name: 'Puppeteer', description: 'Browser automation and web scraping', category: 'dev-tools', icon: '🎭', package: '@modelcontextprotocol/server-puppeteer', installCommand: 'npx -y @anthropic-ai/mcp add puppeteer', docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer' },
    { id: 'docker', name: 'Docker', description: 'Container management and operations', category: 'dev-tools', icon: '🐳', package: '@mcp/docker-server', installCommand: 'npx -y @anthropic-ai/mcp add docker', isNew: true },

    // Search
    { id: 'brave-search', name: 'Brave Search', description: 'Privacy-focused web search API', category: 'search', icon: '🦁', package: '@anthropic-ai/mcp-server-brave-search', installCommand: 'npx -y @anthropic-ai/mcp add brave-search', configFields: [{ key: 'braveApiKey', label: 'API Key', type: 'password', required: true }], docsUrl: 'https://github.com/anthropics/mcp-servers' },
    { id: 'tavily', name: 'Tavily', description: 'AI-optimized search for agents', category: 'search', icon: '🔍', package: '@tavily/mcp-server', installCommand: 'npx -y @anthropic-ai/mcp add tavily', configFields: [{ key: 'tavilyApiKey', label: 'API Key', type: 'password', required: true }], isNew: true },
    { id: 'exa', name: 'Exa', description: 'Neural search engine for AI', category: 'search', icon: '🔮', package: '@exa-labs/mcp-server', installCommand: 'npx -y @anthropic-ai/mcp add exa', configFields: [{ key: 'exaApiKey', label: 'API Key', type: 'password', required: true }], isNew: true },

    // Communication
    { id: 'slack', name: 'Slack', description: 'Read and send Slack messages', category: 'communication', icon: '💬', package: '@anthropic-ai/mcp-server-slack', installCommand: 'npx -y @anthropic-ai/mcp add slack', configFields: [{ key: 'slackToken', label: 'Bot Token', type: 'password', required: true }], docsUrl: 'https://github.com/anthropics/mcp-servers' },
    { id: 'discord', name: 'Discord', description: 'Discord bot integration', category: 'communication', icon: '🎮', package: '@mcp/discord-server', installCommand: 'npx -y @anthropic-ai/mcp add discord', configFields: [{ key: 'discordToken', label: 'Bot Token', type: 'password', required: true }] },

    // Social Media - Full Automation
    { id: 'twitter', name: 'Twitter/X', description: 'Post tweets, reply, retweet, manage threads', category: 'social', icon: '🐦', package: '@mcp/twitter-server', installCommand: 'npx -y @anthropic-ai/mcp add twitter', configFields: [{ key: 'twitterApiKey', label: 'API Key', type: 'password', required: true }, { key: 'twitterApiSecret', label: 'API Secret', type: 'password', required: true }, { key: 'twitterAccessToken', label: 'Access Token', type: 'password', required: true }, { key: 'twitterAccessSecret', label: 'Access Secret', type: 'password', required: true }], docsUrl: 'https://developer.twitter.com/', isFeatured: true, isNew: true },
    { id: 'linkedin', name: 'LinkedIn', description: 'Post updates, articles, manage company pages', category: 'social', icon: '💼', package: '@mcp/linkedin-server', installCommand: 'npx -y @anthropic-ai/mcp add linkedin', configFields: [{ key: 'linkedinAccessToken', label: 'Access Token', type: 'password', required: true }], isNew: true },
    { id: 'instagram', name: 'Instagram', description: 'Post images, stories, reels via Graph API', category: 'social', icon: '📸', package: '@mcp/instagram-server', installCommand: 'npx -y @anthropic-ai/mcp add instagram', configFields: [{ key: 'instagramAccessToken', label: 'Access Token', type: 'password', required: true }, { key: 'instagramBusinessId', label: 'Business Account ID', type: 'text', required: true }], isNew: true },
    { id: 'facebook', name: 'Facebook Pages', description: 'Manage pages, post content, respond to comments', category: 'social', icon: '👤', package: '@mcp/facebook-server', installCommand: 'npx -y @anthropic-ai/mcp add facebook', configFields: [{ key: 'facebookAccessToken', label: 'Page Access Token', type: 'password', required: true }] },
    { id: 'tiktok', name: 'TikTok', description: 'Upload videos, manage content', category: 'social', icon: '🎵', package: '@mcp/tiktok-server', installCommand: 'npx -y @anthropic-ai/mcp add tiktok', configFields: [{ key: 'tiktokAccessToken', label: 'Access Token', type: 'password', required: true }], isNew: true },
    { id: 'youtube', name: 'YouTube', description: 'Upload videos, manage playlists, comments', category: 'social', icon: '📺', package: '@mcp/youtube-server', installCommand: 'npx -y @anthropic-ai/mcp add youtube', configFields: [{ key: 'youtubeRefreshToken', label: 'OAuth Refresh Token', type: 'password', required: true }] },
    { id: 'buffer', name: 'Buffer', description: 'Schedule posts across all social platforms', category: 'social', icon: '📅', package: '@mcp/buffer-server', installCommand: 'npx -y @anthropic-ai/mcp add buffer', configFields: [{ key: 'bufferAccessToken', label: 'Access Token', type: 'password', required: true }], isFeatured: true },
    { id: 'hootsuite', name: 'Hootsuite', description: 'Enterprise social media management', category: 'social', icon: '🦉', package: '@mcp/hootsuite-server', installCommand: 'npx -y @anthropic-ai/mcp add hootsuite', configFields: [{ key: 'hootsuiteApiKey', label: 'API Key', type: 'password', required: true }] },

    // CMS / Website Builders
    { id: 'wordpress', name: 'WordPress', description: 'Create/edit posts, pages, media, plugins', category: 'cms', icon: '📝', package: '@mcp/wordpress-server', installCommand: 'npx -y @anthropic-ai/mcp add wordpress', configFields: [{ key: 'wpSiteUrl', label: 'Site URL', type: 'url', required: true, placeholder: 'https://yoursite.com' }, { key: 'wpUsername', label: 'Username', type: 'text', required: true }, { key: 'wpAppPassword', label: 'Application Password', type: 'password', required: true }], docsUrl: 'https://developer.wordpress.org/rest-api/', isFeatured: true },
    { id: 'shopify', name: 'Shopify', description: 'Manage products, orders, customers, themes', category: 'cms', icon: '🛒', package: '@mcp/shopify-server', installCommand: 'npx -y @anthropic-ai/mcp add shopify', configFields: [{ key: 'shopifyStore', label: 'Store URL', type: 'url', required: true, placeholder: 'yourstore.myshopify.com' }, { key: 'shopifyAccessToken', label: 'Admin API Token', type: 'password', required: true }], docsUrl: 'https://shopify.dev/docs/api', isFeatured: true },
    { id: 'webflow', name: 'Webflow', description: 'Edit CMS content, publish sites', category: 'cms', icon: '🎨', package: '@mcp/webflow-server', installCommand: 'npx -y @anthropic-ai/mcp add webflow', configFields: [{ key: 'webflowApiToken', label: 'API Token', type: 'password', required: true }], docsUrl: 'https://developers.webflow.com/', isNew: true },
    { id: 'squarespace', name: 'Squarespace', description: 'Manage pages, blog posts, commerce', category: 'cms', icon: '⬛', package: '@mcp/squarespace-server', installCommand: 'npx -y @anthropic-ai/mcp add squarespace', configFields: [{ key: 'squarespaceApiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'wix', name: 'Wix', description: 'Edit site content via Velo API', category: 'cms', icon: '✨', package: '@mcp/wix-server', installCommand: 'npx -y @anthropic-ai/mcp add wix', configFields: [{ key: 'wixApiKey', label: 'API Key', type: 'password', required: true }] },
    { id: 'contentful', name: 'Contentful', description: 'Headless CMS content management', category: 'cms', icon: '📦', package: '@mcp/contentful-server', installCommand: 'npx -y @anthropic-ai/mcp add contentful', configFields: [{ key: 'contentfulSpaceId', label: 'Space ID', type: 'text', required: true }, { key: 'contentfulAccessToken', label: 'Management Token', type: 'password', required: true }] },
    { id: 'sanity', name: 'Sanity', description: 'Structured content platform', category: 'cms', icon: '🔴', package: '@mcp/sanity-server', installCommand: 'npx -y @anthropic-ai/mcp add sanity', configFields: [{ key: 'sanityProjectId', label: 'Project ID', type: 'text', required: true }, { key: 'sanityToken', label: 'API Token', type: 'password', required: true }], isNew: true },
    { id: 'strapi', name: 'Strapi', description: 'Open-source headless CMS', category: 'cms', icon: '🚀', package: '@mcp/strapi-server', installCommand: 'npx -y @anthropic-ai/mcp add strapi', configFields: [{ key: 'strapiUrl', label: 'API URL', type: 'url', required: true }, { key: 'strapiToken', label: 'API Token', type: 'password', required: true }] },

    // Deployment & CI/CD
    { id: 'vercel', name: 'Vercel', description: 'Deploy sites, manage domains, env vars', category: 'deploy', icon: '▲', package: '@mcp/vercel-server', installCommand: 'npx -y @anthropic-ai/mcp add vercel', configFields: [{ key: 'vercelToken', label: 'API Token', type: 'password', required: true }], docsUrl: 'https://vercel.com/docs/rest-api', isFeatured: true },
    { id: 'netlify', name: 'Netlify', description: 'Deploy, manage sites and serverless functions', category: 'deploy', icon: '🌐', package: '@mcp/netlify-server', installCommand: 'npx -y @anthropic-ai/mcp add netlify', configFields: [{ key: 'netlifyToken', label: 'Personal Access Token', type: 'password', required: true }], docsUrl: 'https://docs.netlify.com/api/', isFeatured: true },
    { id: 'github-actions', name: 'GitHub Actions', description: 'Trigger workflows, manage CI/CD pipelines', category: 'deploy', icon: '⚡', package: '@mcp/github-actions-server', installCommand: 'npx -y @anthropic-ai/mcp add github-actions', configFields: [{ key: 'githubToken', label: 'GitHub Token', type: 'password', required: true }], isNew: true },
    { id: 'cloudflare', name: 'Cloudflare', description: 'Manage DNS, Workers, Pages deployments', category: 'deploy', icon: '☁️', package: '@mcp/cloudflare-server', installCommand: 'npx -y @anthropic-ai/mcp add cloudflare', configFields: [{ key: 'cloudflareApiToken', label: 'API Token', type: 'password', required: true }] },
    { id: 'aws', name: 'AWS', description: 'S3, Lambda, EC2, CloudFront management', category: 'deploy', icon: '🔶', package: '@mcp/aws-server', installCommand: 'npx -y @anthropic-ai/mcp add aws', configFields: [{ key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true }, { key: 'awsSecretKey', label: 'Secret Access Key', type: 'password', required: true }, { key: 'awsRegion', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' }] },
    { id: 'digitalocean', name: 'DigitalOcean', description: 'Manage droplets, apps, databases', category: 'deploy', icon: '🌊', package: '@mcp/digitalocean-server', installCommand: 'npx -y @anthropic-ai/mcp add digitalocean', configFields: [{ key: 'doToken', label: 'API Token', type: 'password', required: true }] },
    { id: 'railway', name: 'Railway', description: 'Deploy and manage infrastructure', category: 'deploy', icon: '🚂', package: '@mcp/railway-server', installCommand: 'npx -y @anthropic-ai/mcp add railway', configFields: [{ key: 'railwayToken', label: 'API Token', type: 'password', required: true }], isNew: true },
    { id: 'render', name: 'Render', description: 'Deploy web services, databases, cron jobs', category: 'deploy', icon: '🎯', package: '@mcp/render-server', installCommand: 'npx -y @anthropic-ai/mcp add render', configFields: [{ key: 'renderApiKey', label: 'API Key', type: 'password', required: true }] },
];

const MCP_CATEGORIES = [
    { id: 'all', label: 'All', icon: '📦' },
    { id: 'official', label: 'Official', icon: '✅' },
    { id: 'social', label: 'Social Media', icon: '📱' },
    { id: 'cms', label: 'Websites/CMS', icon: '🌐' },
    { id: 'deploy', label: 'Deploy', icon: '🚀' },
    { id: 'database', label: 'Database', icon: '🗃️' },
    { id: 'dev-tools', label: 'Dev Tools', icon: '🛠️' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'communication', label: 'Comms', icon: '💬' },
];

export function IntegrationConfig({ onClose }: { onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'ai' | 'integrations' | 'mcp'>('ai');
    const [category, setCategory] = useState('ALL');
    const [integrations, setIntegrations] = useState(INTEGRATIONS);
    const [configuring, setConfiguring] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [connecting, setConnecting] = useState(false);

    // AI Provider State
    const [aiProviders, setAiProviders] = useState<AIProviderStatus | null>(null);
    const [aiLoading, setAiLoading] = useState(true);
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, { success: boolean; latencyMs?: number; error?: string }>>({});
    const [configuringAI, setConfiguringAI] = useState<string | null>(null);
    const [aiApiKey, setAiApiKey] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [aiConnecting, setAiConnecting] = useState(false);

    // MCP Settings State
    const [mcpEnabled, setMcpEnabled] = useState(true);
    const [mcpMinTier, setMcpMinTier] = useState(1);
    const [toolOverrides, setToolOverrides] = useState<Record<string, { enabled?: boolean; minTier?: number }>>({});
    const [availableTools, _setAvailableTools] = useState<ToolDefinition[]>([]);
    void availableTools;
    const [mcpSaving, setMcpSaving] = useState(false);
    void mcpSaving;

    // MCP Server State
    const [mcpCategory, setMcpCategory] = useState('all');
    const [installedMCPs, setInstalledMCPs] = useState<string[]>([]);
    const [installingMCP, setInstallingMCP] = useState<string | null>(null);
    const [configuringMCP, setConfiguringMCP] = useState<MCPServer | null>(null);
    const [mcpFormData, setMcpFormData] = useState<Record<string, string>>({});

    // Fetch AI provider status
    const fetchAIProviders = useCallback(async () => {
        try {
            const res = await fetch(`${AI_API_BASE}/ai/info`);
            if (res.ok) {
                const data = await res.json();
                setAiProviders(data);
            }
        } catch (e) {
            console.error('Failed to fetch AI providers:', e);
        } finally {
            setAiLoading(false);
        }
    }, []);

    // Test an AI provider connection
    const testAIProvider = async (provider: string) => {
        setTestingProvider(provider);
        try {
            const res = await fetch(`${AI_API_BASE}/ai/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });
            const result = await res.json();
            setTestResults(prev => ({ ...prev, [provider]: result }));
        } catch (e) {
            setTestResults(prev => ({ ...prev, [provider]: { success: false, error: (e as Error).message } }));
        } finally {
            setTestingProvider(null);
        }
    };

    // Configure an AI provider
    const configureAIProvider = async (provider: string) => {
        if (!aiApiKey.trim()) return;
        setAiConnecting(true);
        try {
            const res = await fetch(`${AI_API_BASE}/ai/configure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    apiKey: aiApiKey,
                    model: aiModel || undefined,
                    setAsDefault: !aiProviders?.providers.length,
                }),
            });
            if (res.ok) {
                await fetchAIProviders();
                setConfiguringAI(null);
                setAiApiKey('');
                setAiModel('');
            } else {
                const err = await res.json();
                alert(`Failed: ${err.error}`);
            }
        } catch (e) {
            alert(`Error: ${(e as Error).message}`);
        } finally {
            setAiConnecting(false);
        }
    };

    // Set default AI provider
    const setDefaultAIProvider = async (provider: string) => {
        try {
            const res = await fetch(`${AI_API_BASE}/ai/set-default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });
            if (res.ok) {
                await fetchAIProviders();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Disconnect an AI provider
    const disconnectAIProvider = async (provider: string) => {
        try {
            const res = await fetch(`${AI_API_BASE}/ai/provider/${provider}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchAIProviders();
                setTestResults(prev => {
                    const newResults = { ...prev };
                    delete newResults[provider];
                    return newResults;
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        const loadSettings = async () => {
            // 1. Integrations Local Storage
            try {
                const stored = localStorage.getItem('aurais_integrations');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setIntegrations(prev => prev.map(i =>
                        parsed[i.id] ? { ...i, status: 'CONNECTED' as const } : i
                    ));
                }
            } catch (e) { console.error(e); }

            // 2. Fetch Global Settings (Integrations + MCP)
            try {
                const settings = await api.getSettings();
                if (settings) {
                    // Sync Integrations
                    if (settings.integrations) {
                        setIntegrations(prev => prev.map(i =>
                            settings.integrations[i.id] ? { ...i, status: 'CONNECTED' as const } : i
                        ));
                    }
                    // Sync MCP
                    if (settings.mcp) {
                        if (typeof settings.mcp.enabled !== 'undefined') setMcpEnabled(settings.mcp.enabled);
                        if (typeof settings.mcp.minTier !== 'undefined') setMcpMinTier(settings.mcp.minTier);
                        if (settings.mcp.tools) setToolOverrides(settings.mcp.tools);
                    }
                }
            } catch (e) {
                console.warn('Settings load failed', e);
            }

            // 3. Fetch AI Provider Status
            await fetchAIProviders();
        };
        loadSettings();
    }, [fetchAIProviders]);

    const saveMcpSettings = async (enabled: boolean, minTier: number) => {
        setMcpSaving(true);
        try {
            await api.postSettings('mcp', 'config', { enabled, minTier, tools: toolOverrides });
        } catch (e) {
            console.error(e);
            alert('Failed to save MCP settings');
        }
        setMcpSaving(false);
    };

    const handleConnect = async (integration: Integration) => {
        setConnecting(true);
        // 1. Local Persistence
        try {
            const stored = localStorage.getItem('aurais_integrations');
            const parsed = stored ? JSON.parse(stored) : {};
            parsed[integration.id] = true;
            localStorage.setItem('aurais_integrations', JSON.stringify(parsed));
        } catch (e) { console.error(e); }

        // 2. Server Verification
        try {
            await api.postSettings('integration', integration.id, formData);
            setIntegrations(prev => prev.map(i =>
                i.id === integration.id ? { ...i, status: 'CONNECTED' as const } : i
            ));
        } catch (e) {
            console.error(e);
            alert(`Verification Failed: ${(e as Error).message}`);
        }
        setConnecting(false);
        setConfiguring(null);
    };

    const handleDisconnect = (id: string) => {
        const stored = localStorage.getItem('aurais_integrations');
        if (stored) {
            const parsed = JSON.parse(stored);
            delete parsed[id];
            localStorage.setItem('aurais_integrations', JSON.stringify(parsed));
        }
        setIntegrations(prev => prev.map(i =>
            i.id === id ? { ...i, status: 'DISCONNECTED' as const } : i
        ));
    };

    const filtered = integrations.filter(i => category === 'ALL' || i.category === category);
    const configuringIntegration = integrations.find(i => i.id === configuring);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal integration-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div>
                            <h2 style={{ marginBottom: 0 }}>⚙️ Settings</h2>
                        </div>

                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-lighter)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setActiveTab('ai')}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'ai' ? 'var(--accent-blue)' : 'transparent',
                                    color: activeTab === 'ai' ? 'white' : 'var(--text-muted)',
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                AI Providers
                            </button>
                            <button
                                onClick={() => setActiveTab('integrations')}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'integrations' ? 'var(--accent-blue)' : 'transparent',
                                    color: activeTab === 'integrations' ? 'white' : 'var(--text-muted)',
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Integrations
                            </button>
                            <button
                                onClick={() => setActiveTab('mcp')}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'mcp' ? 'var(--accent-blue)' : 'transparent',
                                    color: activeTab === 'mcp' ? 'white' : 'var(--text-muted)',
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                MCP System
                            </button>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-content" style={{ minHeight: '400px' }}>
                    {activeTab === 'ai' ? (
                        <div className="animate-fade-in">
                            {/* AI Provider Status Header */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
                                padding: '16px',
                                borderRadius: '12px',
                                marginBottom: '20px',
                                border: '1px solid rgba(59, 130, 246, 0.2)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>AI Provider Configuration</h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            Connect AI providers to enable agent reasoning and task execution.
                                        </p>
                                    </div>
                                    <div style={{
                                        background: aiProviders?.providers.length ? 'var(--accent-green)' : 'var(--text-muted)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                    }}>
                                        {aiLoading ? 'Loading...' : `${aiProviders?.providers.length || 0} Connected`}
                                    </div>
                                </div>
                            </div>

                            {/* Connected Providers */}
                            {aiProviders?.providers && aiProviders.providers.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Providers</h4>
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {aiProviders.providers.map(provider => {
                                            const display = PROVIDER_DISPLAY[provider.type];
                                            const testResult = testResults[provider.type];
                                            return (
                                                <div key={provider.type} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                                    background: 'var(--bg-card)', borderRadius: '10px',
                                                    border: provider.isDefault ? `2px solid ${display?.color || 'var(--accent-blue)'}` : '1px solid var(--border-color)'
                                                }}>
                                                    <span style={{ fontSize: '1.5rem' }}>{display?.icon || '🤖'}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {display?.name || provider.type}
                                                            {provider.isDefault && (
                                                                <span style={{
                                                                    background: display?.color || 'var(--accent-blue)',
                                                                    color: 'white',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '10px',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 600
                                                                }}>DEFAULT</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            Model: {provider.model}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {/* Test Result */}
                                                        {testResult && (
                                                            <span style={{
                                                                fontSize: '0.7rem',
                                                                color: testResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                                                                fontWeight: 600
                                                            }}>
                                                                {testResult.success ? `✓ ${testResult.latencyMs}ms` : `✗ Error`}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => testAIProvider(provider.type)}
                                                            disabled={testingProvider === provider.type}
                                                            className="btn btn-secondary"
                                                            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                                        >
                                                            {testingProvider === provider.type ? '...' : 'Test'}
                                                        </button>
                                                        {!provider.isDefault && (
                                                            <button
                                                                onClick={() => setDefaultAIProvider(provider.type)}
                                                                className="btn btn-secondary"
                                                                style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                                            >
                                                                Set Default
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => disconnectAIProvider(provider.type)}
                                                            className="btn btn-secondary"
                                                            style={{ fontSize: '0.7rem', padding: '4px 10px', color: 'var(--accent-red)' }}
                                                        >
                                                            Disconnect
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Available Providers to Connect */}
                            <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Available Providers</h4>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {(['claude', 'grok', 'openai', 'gemini'] as const).map(providerType => {
                                        const isConnected = aiProviders?.providers.some(p => p.type === providerType);
                                        if (isConnected) return null;
                                        const display = PROVIDER_DISPLAY[providerType];
                                        return (
                                            <div key={providerType} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                                background: 'var(--bg-card)', borderRadius: '10px',
                                                border: '1px solid var(--border-color)',
                                                opacity: 0.8
                                            }}>
                                                <span style={{ fontSize: '1.5rem' }}>{display.icon}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{display.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Not connected
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { setConfiguringAI(providerType); setAiApiKey(''); setAiModel(''); }}
                                                    className="btn btn-primary"
                                                    style={{ fontSize: '0.75rem', padding: '6px 16px' }}
                                                >
                                                    Connect
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Help Info */}
                            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--accent-blue)' }}>How it works</div>
                                        <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                                            AI providers power agent reasoning and task execution. When an agent needs to think
                                            through a problem or make a decision, it uses the default AI provider. You can connect
                                            multiple providers and switch between them.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Configure Provider Modal */}
                            {configuringAI && (
                                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setConfiguringAI(null)}>
                                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                                        <div className="modal-header">
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {PROVIDER_DISPLAY[configuringAI]?.icon} Connect {PROVIDER_DISPLAY[configuringAI]?.name}
                                            </h3>
                                            <button className="close-btn" onClick={() => setConfiguringAI(null)}>✕</button>
                                        </div>
                                        <div className="modal-content">
                                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-lighter)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                <strong>Guide:</strong> Get your API key from the provider's developer console.
                                                {configuringAI === 'claude' && <div style={{ marginTop: '8px' }}><a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>Anthropic Console →</a></div>}
                                                {configuringAI === 'grok' && <div style={{ marginTop: '8px' }}><a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>xAI Console →</a></div>}
                                                {configuringAI === 'openai' && <div style={{ marginTop: '8px' }}><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>OpenAI Platform →</a></div>}
                                                {configuringAI === 'gemini' && <div style={{ marginTop: '8px' }}><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>Google AI Studio →</a></div>}
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>API Key *</label>
                                                <input
                                                    type="password"
                                                    className="spawn-input"
                                                    placeholder="Enter API Key..."
                                                    value={aiApiKey}
                                                    onChange={e => setAiApiKey(e.target.value)}
                                                />
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>Model (optional)</label>
                                                <input
                                                    type="text"
                                                    className="spawn-input"
                                                    placeholder={configuringAI === 'claude' ? 'claude-sonnet-4-20250514' : configuringAI === 'grok' ? 'grok-beta' : configuringAI === 'openai' ? 'gpt-4-turbo-preview' : 'gemini-pro'}
                                                    value={aiModel}
                                                    onChange={e => setAiModel(e.target.value)}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfiguringAI(null)}>Cancel</button>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ flex: 1 }}
                                                    onClick={() => configureAIProvider(configuringAI)}
                                                    disabled={aiConnecting || !aiApiKey.trim()}
                                                >
                                                    {aiConnecting ? 'Connecting...' : 'Connect'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'integrations' ? (
                        <>
                            {/* CATEGORY TABS */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '16px',
                                            border: 'none',
                                            background: category === cat ? 'var(--accent-blue)' : 'var(--bg-card)',
                                            color: category === cat ? 'white' : 'var(--text-secondary)',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                                {filtered.map(integration => (
                                    <div key={integration.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                                        background: 'var(--bg-card)', borderRadius: '8px', marginBottom: '8px',
                                        border: `1px solid ${integration.status === 'CONNECTED' ? 'var(--accent-green)' : 'var(--border-color)'}`
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>{integration.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{integration.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{integration.description}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: integration.status === 'CONNECTED' ? 'var(--accent-green)' : 'var(--text-muted)' }} />
                                            {integration.status === 'CONNECTED' ? (
                                                <button onClick={() => handleDisconnect(integration.id)} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>Disconnect</button>
                                            ) : (
                                                <button onClick={() => { setConfiguring(integration.id); setFormData({}); }} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>Connect</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            {/* MCP Header */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))',
                                padding: '16px',
                                borderRadius: '12px',
                                marginBottom: '20px',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>MCP Server Registry</h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            Add MCP servers to extend agent capabilities with external tools.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            background: installedMCPs.length ? 'var(--accent-green)' : 'var(--text-muted)',
                                            color: 'white',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            {installedMCPs.length} Installed
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={mcpEnabled}
                                                onChange={e => {
                                                    setMcpEnabled(e.target.checked);
                                                    saveMcpSettings(e.target.checked, mcpMinTier);
                                                }}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Category Tabs */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                {MCP_CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setMcpCategory(cat.id)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '16px',
                                            border: 'none',
                                            background: mcpCategory === cat.id ? 'var(--accent-blue)' : 'var(--bg-card)',
                                            color: mcpCategory === cat.id ? 'white' : 'var(--text-secondary)',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span>{cat.icon}</span> {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Server List */}
                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                                {/* Featured Section */}
                                {mcpCategory === 'all' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Featured</h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            {MCP_SERVERS.filter(s => s.isFeatured).map(server => {
                                                const isInstalled = installedMCPs.includes(server.id);
                                                return (
                                                    <div key={server.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                                                        background: 'var(--bg-card)', borderRadius: '10px',
                                                        border: isInstalled ? '2px solid var(--accent-green)' : '1px solid var(--border-color)'
                                                    }}>
                                                        <span style={{ fontSize: '1.5rem' }}>{server.icon}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {server.name}
                                                                {server.isNew && <span style={{ background: 'var(--accent-purple)', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '0.6rem' }}>NEW</span>}
                                                                {isInstalled && <span style={{ color: 'var(--accent-green)', fontSize: '0.75rem' }}>✓ Installed</span>}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{server.description}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {server.docsUrl && (
                                                                <a href={server.docsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px', textDecoration: 'none' }}>Docs</a>
                                                            )}
                                                            {isInstalled ? (
                                                                <button onClick={() => setInstalledMCPs(prev => prev.filter(id => id !== server.id))} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px', color: 'var(--accent-red)' }}>Remove</button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        if (server.configFields?.length) {
                                                                            setConfiguringMCP(server);
                                                                            setMcpFormData({});
                                                                        } else {
                                                                            setInstallingMCP(server.id);
                                                                            setTimeout(() => {
                                                                                setInstalledMCPs(prev => [...prev, server.id]);
                                                                                setInstallingMCP(null);
                                                                            }, 1500);
                                                                        }
                                                                    }}
                                                                    disabled={installingMCP === server.id}
                                                                    className="btn btn-primary"
                                                                    style={{ fontSize: '0.7rem', padding: '4px 12px' }}
                                                                >
                                                                    {installingMCP === server.id ? 'Installing...' : 'Install'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* All Servers */}
                                <div>
                                    {mcpCategory !== 'all' && <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{MCP_CATEGORIES.find(c => c.id === mcpCategory)?.label}</h4>}
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {MCP_SERVERS
                                            .filter(s => mcpCategory === 'all' ? !s.isFeatured : s.category === mcpCategory)
                                            .map(server => {
                                                const isInstalled = installedMCPs.includes(server.id);
                                                return (
                                                    <div key={server.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                                                        background: 'var(--bg-card)', borderRadius: '10px',
                                                        border: isInstalled ? '2px solid var(--accent-green)' : '1px solid var(--border-color)'
                                                    }}>
                                                        <span style={{ fontSize: '1.3rem' }}>{server.icon}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {server.name}
                                                                {server.isNew && <span style={{ background: 'var(--accent-purple)', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '0.6rem' }}>NEW</span>}
                                                                {isInstalled && <span style={{ color: 'var(--accent-green)', fontSize: '0.75rem' }}>✓</span>}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{server.description}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {isInstalled ? (
                                                                <button onClick={() => setInstalledMCPs(prev => prev.filter(id => id !== server.id))} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px', color: 'var(--accent-red)' }}>Remove</button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        if (server.configFields?.length) {
                                                                            setConfiguringMCP(server);
                                                                            setMcpFormData({});
                                                                        } else {
                                                                            setInstallingMCP(server.id);
                                                                            setTimeout(() => {
                                                                                setInstalledMCPs(prev => [...prev, server.id]);
                                                                                setInstallingMCP(null);
                                                                            }, 1500);
                                                                        }
                                                                    }}
                                                                    disabled={installingMCP === server.id}
                                                                    className="btn btn-primary"
                                                                    style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                                                >
                                                                    {installingMCP === server.id ? '...' : 'Install'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>

                            {/* Info Footer */}
                            <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                                    <div style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                                        <strong>MCP (Model Context Protocol)</strong> is an open standard for connecting AI agents to external tools and data sources.
                                        Servers are installed locally and give agents access to databases, APIs, and more.
                                        <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', marginLeft: '4px' }}>Learn more →</a>
                                    </div>
                                </div>
                            </div>

                            {/* Configure MCP Modal */}
                            {configuringMCP && (
                                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setConfiguringMCP(null)}>
                                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                                        <div className="modal-header">
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {configuringMCP.icon} Install {configuringMCP.name}
                                            </h3>
                                            <button className="close-btn" onClick={() => setConfiguringMCP(null)}>✕</button>
                                        </div>
                                        <div className="modal-content">
                                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-lighter)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                <strong>Package:</strong> <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px' }}>{configuringMCP.package}</code>
                                                {configuringMCP.docsUrl && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <a href={configuringMCP.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>View Documentation →</a>
                                                    </div>
                                                )}
                                            </div>

                                            {configuringMCP.configFields?.map(field => (
                                                <div key={field.key} style={{ marginBottom: '16px' }}>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>
                                                        {field.label} {field.required && '*'}
                                                    </label>
                                                    <input
                                                        type={field.type === 'password' ? 'password' : 'text'}
                                                        className="spawn-input"
                                                        placeholder={field.placeholder || `Enter ${field.label}...`}
                                                        value={mcpFormData[field.key] || ''}
                                                        onChange={e => setMcpFormData({ ...mcpFormData, [field.key]: e.target.value })}
                                                    />
                                                </div>
                                            ))}

                                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfiguringMCP(null)}>Cancel</button>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ flex: 1 }}
                                                    onClick={() => {
                                                        setInstallingMCP(configuringMCP.id);
                                                        setTimeout(() => {
                                                            setInstalledMCPs(prev => [...prev, configuringMCP.id]);
                                                            setInstallingMCP(null);
                                                            setConfiguringMCP(null);
                                                        }, 1500);
                                                    }}
                                                    disabled={installingMCP === configuringMCP.id}
                                                >
                                                    {installingMCP === configuringMCP.id ? 'Installing...' : 'Install Server'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CONFIGURATION MODAL OVERLAY */}
            {
                configuring && configuringIntegration && (
                    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setConfiguring(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="modal-header">
                                <div>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {configuringIntegration.icon} Configure {configuringIntegration.name}
                                    </h3>
                                </div>
                                <button className="close-btn" onClick={() => setConfiguring(null)}>✕</button>
                            </div>
                            <div className="modal-content">
                                {configuringIntegration.guide && (
                                    <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-lighter)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                        <strong>Guide:</strong> {configuringIntegration.guide}
                                        {configuringIntegration.helpUrl && (
                                            <div style={{ marginTop: '8px' }}>
                                                <a href={configuringIntegration.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>View Official Docs →</a>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {configuringIntegration.fields.map(field => (
                                    <div key={field.key} style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>{field.label} {field.required && '*'}</label>
                                        <input
                                            type={field.type === 'password' ? 'password' : 'text'}
                                            className="spawn-input"
                                            placeholder={`Enter ${field.label}...`}
                                            value={formData[field.key] || ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                        />
                                    </div>
                                ))}

                                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfiguring(null)}>Cancel</button>
                                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleConnect(configuringIntegration)} disabled={connecting}>
                                        {connecting ? 'Verifying...' : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
