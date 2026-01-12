/**
 * Wallet Service
 * Manages Anchor Credits (AC) for users
 */

import { createClient } from '@/lib/supabase/server'
import type {
  UserWallet,
  CreditTransaction,
  TransactionType,
  AgentSubscription,
  REVENUE_SPLIT,
} from './types'

export class WalletService {
  /**
   * Get user's wallet (creates if doesn't exist)
   */
  static async getWallet(userId: string): Promise<UserWallet | null> {
    const supabase = await createClient()

    // Try to get existing wallet
    const { data: wallet, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (wallet) return wallet

    // Create wallet with signup bonus if doesn't exist
    if (error?.code === 'PGRST116') {
      const { data: newWallet, error: createError } = await supabase
        .from('user_wallets')
        .insert({
          user_id: userId,
          balance: 500,
          lifetime_earned: 500,
        })
        .select()
        .single()

      if (newWallet) {
        // Record signup bonus
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          amount: 500,
          balance_after: 500,
          type: 'signup_bonus',
          description: 'Welcome bonus - 500 Anchor Credits',
        })
        return newWallet
      }
    }

    return null
  }

  /**
   * Get user's balance
   */
  static async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId)
    return wallet?.balance ?? 0
  }

  /**
   * Debit credits from user wallet
   */
  static async debit(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceType?: 'acquisition' | 'listing' | 'subscription',
    referenceId?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const supabase = await createClient()

    // Use database function for atomic operation
    const { data, error } = await supabase.rpc('debit_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    })

    if (error) {
      console.error('Debit error:', error)
      return { success: false, error: error.message }
    }

    const result = data?.[0]
    if (!result?.success) {
      return { success: false, error: result?.error_message || 'Debit failed' }
    }

    return { success: true, newBalance: result.new_balance }
  }

  /**
   * Credit (add) credits to user wallet
   */
  static async credit(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceType?: 'acquisition' | 'listing' | 'subscription',
    referenceId?: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const supabase = await createClient()

    // Use database function for atomic operation
    const { data, error } = await supabase.rpc('credit_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    })

    if (error) {
      console.error('Credit error:', error)
      return { success: false, error: error.message }
    }

    const result = data?.[0]
    return { success: true, newBalance: result?.new_balance }
  }

  /**
   * Get transaction history
   */
  static async getTransactions(
    userId: string,
    limit = 50
  ): Promise<CreditTransaction[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Transaction fetch error:', error)
      return []
    }

    return data || []
  }

  /**
   * Check if user can afford a purchase
   */
  static async canAfford(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId)
    return balance >= amount
  }

  /**
   * Process revenue split for a sale
   * 70% trainer, 20% platform, 10% validators
   */
  static async processRevenueSplit(
    trainerId: string,
    saleAmount: number,
    type: 'clone_sale' | 'commission_earned' | 'enterprise_sale',
    referenceId?: string
  ): Promise<void> {
    const trainerShare = Math.floor(saleAmount * 0.70)
    const platformShare = Math.floor(saleAmount * 0.20)
    // Validator share (10%) stays in platform pool for now

    // Credit trainer
    await this.credit(
      trainerId,
      trainerShare,
      type,
      `Revenue share (70%) from agent ${type.replace('_', ' ')}`,
      'acquisition',
      referenceId
    )

    // Platform share would go to platform wallet
    // For now, just log it
    console.log(`Platform revenue: ${platformShare} AC from ${type}`)
  }
}

/**
 * Client-side wallet hook helper
 */
export async function fetchWalletClient(): Promise<UserWallet | null> {
  try {
    const res = await fetch('/api/wallet')
    if (res.ok) {
      const data = await res.json()
      return data.wallet
    }
  } catch (error) {
    console.error('Failed to fetch wallet:', error)
  }
  return null
}
