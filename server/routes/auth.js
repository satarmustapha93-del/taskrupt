import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const safeUser = (user) => ({ id: user.id, name: user.full_name, email: user.email, role: user.role, tokensAvailable: user.tokens_available, tokensPending: user.tokens_pending, referralCode: user.referral_code, streakDays: user.streak_days, level: user.level, xp: user.xp })
const retiredAuthRoute = (_req, res) => res.status(410).json({ message: 'Password sign-in is handled by Supabase Auth. Use the TaskRupt sign-in page.' })

router.post('/signup', retiredAuthRoute)
router.post('/login', retiredAuthRoute)
router.post('/forgot-password', retiredAuthRoute)
router.post('/reset-password', retiredAuthRoute)
router.get('/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }))

router.get('/referrals', requireAuth, async (req, res, next) => {
  try {
    const [referrals, earnings] = await Promise.all([
      req.db.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', req.user.id),
      req.db.from('wallet_transactions').select('amount_tokens').eq('user_id', req.user.id).eq('kind', 'referral'),
    ])
    if (referrals.error) return next(referrals.error)
    if (earnings.error) return next(earnings.error)
    res.json({ friends: referrals.count || 0, tokens: (earnings.data || []).reduce((sum, row) => sum + Number(row.amount_tokens || 0), 0) })
  } catch (error) { next(error) }
})

router.get('/leaderboard', requireAuth, async (req, res, next) => {
  try {
    const { data: rows, error } = await req.db.from('wallet_transactions').select('user_id,amount_tokens').in('kind', ['earned', 'referral', 'streak']).gt('amount_tokens', 0).limit(10000)
    if (error) return next(error)
    const totals = new Map()
    for (const row of rows || []) totals.set(row.user_id, (totals.get(row.user_id) || 0) + Number(row.amount_tokens || 0))
    const sorted = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const ids = sorted.map(([id]) => id)
    if (!ids.length) return res.json({ entries: [] })
    const { data: profiles, error: profileError } = await req.db.from('profiles').select('id,full_name').in('id', ids)
    if (profileError) return next(profileError)
    const byId = new Map((profiles || []).map((profile) => [profile.id, profile]))
    const entries = sorted.map(([userId, tokens], index) => {
      const fullName = byId.get(userId)?.full_name?.trim() || 'Member'
      const parts = fullName.split(/\s+/)
      return { userId, rank: index + 1, name: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0], initials: parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase(), tokens }
    })
    res.json({ entries })
  } catch (error) { next(error) }
})

router.post('/check-in', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await req.db.rpc('claim_daily_check_in', { p_user_id: req.user.id })
    if (error) return next(error)
    if (data?.error === 'already_claimed') return res.status(409).json({ message: 'Daily check-in already claimed' })
    res.json({ user: safeUser(data.user), rewardTokens: data.reward_tokens })
  } catch (error) { next(error) }
})

export default router
