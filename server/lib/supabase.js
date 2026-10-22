import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
export const isSupabaseServerConfigured = Boolean(url && publishableKey && secretKey)
export const supabaseAuth = url && publishableKey ? createClient(url, publishableKey, options) : null
// This client bypasses RLS. It must only be used in server code and never exposed to Vite.
export const supabaseAdmin = isSupabaseServerConfigured ? createClient(url, secretKey, options) : null
