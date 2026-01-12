/**
 * Wallet API
 * GET - Get current user's wallet
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WalletService } from '@/lib/credits/wallet-service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wallet = await WalletService.getWallet(user.id)

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    return NextResponse.json({
      wallet: {
        balance: wallet.balance,
        lifetime_earned: wallet.lifetime_earned,
        lifetime_spent: wallet.lifetime_spent,
      }
    })
  } catch (error: any) {
    console.error('Wallet API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
