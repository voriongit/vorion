'use client'

/**
 * useUser Hook - Current user context
 *
 * Provides access to the authenticated user with session management.
 * Part of Frontend Architecture Section 6.
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'trainer' | 'consumer' | 'both'
  tier: 'free' | 'pro' | 'enterprise'
  onboarding_completed: boolean
  created_at: string
}

interface UseUserReturn {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isTrainer: boolean
  isConsumer: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

/**
 * Access current authenticated user and profile
 *
 * @example
 * const { user, profile, isTrainer } = useUser()
 *
 * @example
 * const { signOut, isAuthenticated } = useUser()
 */
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data as UserProfile)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    }
  }, [supabase])

  // Initialize and listen for auth changes
  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      setIsLoading(true)
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id)
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          await fetchProfile(newSession.user.id)
        } else {
          setProfile(null)
        }

        // Handle specific events
        if (event === 'SIGNED_OUT') {
          setProfile(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }, [supabase])

  const refreshSession = useCallback(async () => {
    const { data: { session: newSession } } = await supabase.auth.refreshSession()
    setSession(newSession)
    setUser(newSession?.user ?? null)
  }, [supabase])

  // Derived state
  const isAuthenticated = !!user && !!session
  const isTrainer = profile?.role === 'trainer' || profile?.role === 'both'
  const isConsumer = profile?.role === 'consumer' || profile?.role === 'both'

  return {
    user,
    profile,
    session,
    isLoading,
    isAuthenticated,
    isTrainer,
    isConsumer,
    signOut,
    refreshSession,
  }
}

/**
 * Require authentication - redirects if not authenticated
 * Use in pages that require auth
 *
 * @example
 * const { user, profile } = useRequireAuth()
 */
export function useRequireAuth(redirectTo: string = '/auth/login') {
  const userState = useUser()

  useEffect(() => {
    if (!userState.isLoading && !userState.isAuthenticated) {
      window.location.href = redirectTo
    }
  }, [userState.isLoading, userState.isAuthenticated, redirectTo])

  return userState
}
