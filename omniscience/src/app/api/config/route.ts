import { NextResponse } from 'next/server';

export async function GET() {
  // Check AI provider status (server-side env vars)
  const providerStatus = {
    gemini: { available: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY, simulated: false },
    claude: {
      available: !!process.env.ANTHROPIC_API_KEY,
      simulated: !process.env.ANTHROPIC_API_KEY
    },
    grok: {
      available: !!process.env.XAI_API_KEY,
      simulated: !process.env.XAI_API_KEY
    },
  };

  return NextResponse.json({
    firebase: {
      configured: !!(
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
        process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      ),
      apiKeyPresent: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      apiKeyLength: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.length || 0,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
    },
    providers: providerStatus,
  });
}
