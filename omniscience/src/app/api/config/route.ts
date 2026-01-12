import { NextResponse } from 'next/server';

export async function GET() {
  // Debug endpoint to check env vars (safe since these are NEXT_PUBLIC_ vars anyway)
  return NextResponse.json({
    configured: !!(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    ),
    apiKeyPresent: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    apiKeyLength: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.length || 0,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
  });
}
