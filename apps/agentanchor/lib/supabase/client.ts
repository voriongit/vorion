import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Using untyped client - Database types are incomplete
// Run `npx supabase gen types` to generate full types from the database
export const createClient = () => createClientComponentClient()
