/**
 * Marketing Site URL Configuration
 *
 * Centralizes all URLs for easy environment-based configuration.
 */

export const urls = {
  // App URL - where the main platform is hosted
  app: process.env.NEXT_PUBLIC_APP_URL || 'https://app.agentanchorai.com',

  // API documentation
  docs: process.env.NEXT_PUBLIC_DOCS_URL || 'https://app.agentanchorai.com/docs/api',

  // Discord community
  discord: 'https://discord.gg/dUQSg8SG',
}
