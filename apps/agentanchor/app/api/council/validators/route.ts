import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllValidators, RISK_LEVELS } from '@/lib/council'

export const dynamic = 'force-dynamic'

// GET /api/council/validators - Get all Council validators and their info
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const validators = getAllValidators().map(v => ({
      id: v.id,
      name: v.name,
      domain: v.domain,
      description: v.description,
      icon: v.icon,
    }))

    const riskLevels = Object.entries(RISK_LEVELS).map(([level, info]) => ({
      level: parseInt(level),
      ...info,
    }))

    return NextResponse.json({
      validators,
      riskLevels,
      votingRules: {
        level0: 'Auto-approved (logged)',
        level1: 'Auto-approved (logged)',
        level2: 'Single validator approval required',
        level3: 'Majority (3/4 validators) required',
        level4: 'Unanimous + Human confirmation required',
      },
    })
  } catch (error) {
    console.error('Council validators error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
