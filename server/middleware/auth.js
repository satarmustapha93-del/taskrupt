import { isSupabaseServerConfigured, supabaseAdmin, supabaseAuth } from '../lib/supabase.js'

export async function requireAuth(req, res, next) {
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!accessToken) return res.status(401).json({ message: 'Authentication required' })
  if (!isSupabaseServerConfigured || !supabaseAuth || !supabaseAdmin) return res.status(503).json({ message: 'Supabase is not configured. Set the server URL, publishable key, and secret key.' })
  try {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken)
    if (error || !data.user) return res.status(401).json({ message: 'Invalid or expired session' })
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single()
    if (profileError || !profile) return res.status(403).json({ message: 'Account profile is unavailable' })
    if (profile.status !== 'active') return res.status(403).json({ message: 'This account is suspended' })
    req.user = profile
    req.authUser = data.user
    req.db = supabaseAdmin
    next()
  } catch (error) { next(error) }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' })
  next()
}
