import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireAdmin)
const run = async (query) => { const result = await query; if (result.error) throw result.error; return result }

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, tasks, submissions, completedTasks, withdrawals, transactions] = await Promise.all([
      run(_req.db.from('profiles').select('id', { count: 'exact', head: true })),
      run(_req.db.from('tasks').select('id', { count: 'exact', head: true }).eq('active', true)),
      run(_req.db.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      run(_req.db.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'approved')),
      run(_req.db.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      run(_req.db.from('wallet_transactions').select('*, user:profiles!wallet_transactions_user_id_fkey(full_name,email)').order('created_at', { ascending: false }).limit(10)),
    ])
    res.json({ users: users.count || 0, activeTasks: tasks.count || 0, pendingSubmissions: submissions.count || 0, completedTasks: completedTasks.count || 0, pendingWithdrawals: withdrawals.count || 0, recentTransactions: transactions.data })
  } catch (error) { next(error) }
})

router.get('/users', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    let query = req.db.from('profiles').select('id,full_name,email,role,status,tokens_available,tokens_pending,referral_code,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(limit)
    if (req.query.status) query = query.eq('status', req.query.status)
    if (req.query.search) query = query.or(`full_name.ilike.%${String(req.query.search).replace(/[(),]/g, '')}%,email.ilike.%${String(req.query.search).replace(/[(),]/g, '')}%`)
    const { data, count, error } = await query
    if (error) return next(error)
    res.json({ users: data, total: count || 0 })
  } catch (error) { next(error) }
})

router.get('/tasks', async (req, res, next) => {
  try { const { data, error } = await req.db.from('tasks').select('*').order('created_at', { ascending: false }); if (error) return next(error); res.json({ tasks: data }) } catch (error) { next(error) }
})
router.post('/tasks', async (req, res, next) => {
  try {
    const row = { type: req.body.type, title: req.body.title, description: req.body.description || '', link: req.body.link || '', proof_required: Boolean(req.body.proofRequired), reward_tokens: Number(req.body.rewardTokens), cooldown_hours: Number(req.body.cooldownHours) || 0, active: req.body.active !== false, instant_approval: Boolean(req.body.instantApproval), max_completions: req.body.maxCompletions || null }
    const { data, error } = await req.db.from('tasks').insert(row).select().single(); if (error) return next(error); res.status(201).json({ task: data })
  } catch (error) { next(error) }
})
router.patch('/tasks/:id', async (req, res, next) => {
  try {
    const map = { type: 'type', title: 'title', description: 'description', link: 'link', proofRequired: 'proof_required', rewardTokens: 'reward_tokens', cooldownHours: 'cooldown_hours', active: 'active', instantApproval: 'instant_approval', maxCompletions: 'max_completions' }
    const row = Object.fromEntries(Object.entries(req.body).filter(([key]) => map[key]).map(([key, value]) => [map[key], value]))
    const { data, error } = await req.db.from('tasks').update(row).eq('id', req.params.id).select().maybeSingle(); if (error) return next(error); if (!data) return res.status(404).json({ message: 'Task not found' }); res.json({ task: data })
  } catch (error) { next(error) }
})

router.get('/submissions', async (req, res, next) => {
  try { const { data, error } = await req.db.from('submissions').select('*, user:profiles!submissions_user_id_fkey(full_name,email), task:tasks(*)').eq('status', 'pending').order('created_at'); if (error) return next(error); res.json({ submissions: data }) } catch (error) { next(error) }
})
router.patch('/submissions/:id', async (req, res, next) => {
  try {
    const { status, reviewNote = '' } = req.body
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status must be approved or rejected' })
    const { data, error } = await req.db.rpc('review_submission', { p_admin_id: req.user.id, p_submission_id: req.params.id, p_status: status, p_review_note: reviewNote })
    if (error) return next(error); res.json(data)
  } catch (error) { next(error) }
})

router.get('/withdrawals', async (req, res, next) => {
  try { const { data, error } = await req.db.from('withdrawals').select('*, user:profiles!withdrawals_user_id_fkey(full_name,email)').eq('status', 'pending').order('created_at'); if (error) return next(error); res.json({ withdrawals: data }) } catch (error) { next(error) }
})
router.patch('/withdrawals/:id', async (req, res, next) => {
  try {
    const { status, providerReference = '' } = req.body
    if (!['approved', 'paid', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid withdrawal status' })
    const { data, error } = await req.db.rpc('review_withdrawal', { p_admin_id: req.user.id, p_withdrawal_id: req.params.id, p_status: status, p_provider_reference: providerReference })
    if (error) return next(error); res.json({ withdrawal: data })
  } catch (error) { next(error) }
})

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid account status' })
    const { data, error } = await req.db.from('profiles').update({ status: req.body.status }).eq('id', req.params.id).select('id,full_name,email,role,status,tokens_available,tokens_pending').maybeSingle()
    if (error) return next(error); if (!data) return res.status(404).json({ message: 'User not found' }); res.json({ user: data })
  } catch (error) { next(error) }
})

router.put('/settings', async (req, res, next) => {
  try {
    const values = { tokensPerNaira: req.body.tokensPerNaira, minimumWithdrawalNgn: req.body.minimumWithdrawalNgn }
    if (Object.values(values).some((v) => v !== undefined && (!Number.isFinite(Number(v)) || Number(v) <= 0))) return res.status(400).json({ message: 'Settings must be positive numbers' })
    const settings = await Promise.all(Object.entries(values).filter(([, v]) => v !== undefined).map(async ([key, value]) => {
      const { data, error } = await req.db.from('app_settings').upsert({ key, value: Number(value) }, { onConflict: 'key' }).select().single(); if (error) throw error; return data
    }))
    res.json({ settings })
  } catch (error) { next(error) }
})

export default router
