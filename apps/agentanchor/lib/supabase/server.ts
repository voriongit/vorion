import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Using untyped client - Database types are incomplete
// Run `npx supabase gen types` to generate full types from the database
export const createClient = () =>
  createServerComponentClient({ cookies })
