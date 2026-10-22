import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabase.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase is not configured' })
    const { data, error } = await supabaseAdmin.from('tasks').select('*').eq('active', true).order('created_at', { ascending: false })
    if (error) return next(error)
    res.json({ tasks: data })
  } catch (error) { next(error) }
})

router.get('/submissions/mine', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await req.db.from('submissions').select('*, task:tasks(*)').eq('user_id', req.user.id).order('created_at', { ascending: false })
    if (error) return next(error)
    res.json({ submissions: data })
  } catch (error) { next(error) }
})

router.post('/:taskId/submit', requireAuth, async (req, res, next) => {
  try {
    const { proofUrl = '', proofText = '' } = req.body
    const { data, error } = await req.db.rpc('submit_task', { p_user_id: req.user.id, p_task_id: req.params.taskId, p_proof_url: proofUrl, p_proof_text: proofText })
    if (error) return next(error)
    res.status(201).json(data)
  } catch (error) { next(error) }
})

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const fields = { type: req.body.type, title: req.body.title, description: req.body.description || '', link: req.body.link || '', proof_required: Boolean(req.body.proofRequired), reward_tokens: Number(req.body.rewardTokens), cooldown_hours: Number(req.body.cooldownHours) || 0, active: req.body.active !== false, instant_approval: Boolean(req.body.instantApproval), max_completions: req.body.maxCompletions || null }
    const { data, error } = await req.db.from('tasks').insert(fields).select().single()
    if (error) return next(error)
    res.status(201).json({ task: data })
  } catch (error) { next(error) }
})

export default router
