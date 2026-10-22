import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const [tx, wd, rate, minimum] = await Promise.all([
      req.db.from('wallet_transactions').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50),
      req.db.from('withdrawals').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }),
      req.db.from('app_settings').select('value').eq('key', 'tokensPerNaira').single(),
      req.db.from('app_settings').select('value').eq('key', 'minimumWithdrawalNgn').single(),
    ])
    for (const result of [tx, wd, rate, minimum]) if (result.error && result.error.code !== 'PGRST116') return next(result.error)
    res.json({ balance: req.user.tokens_available, pending: req.user.tokens_pending, tokenRate: Number(rate.data?.value ?? 1), minimumWithdrawalNgn: Number(minimum.data?.value ?? 5000), currency: 'NGN', transactions: tx.data || [], withdrawals: wd.data || [] })
  } catch (error) { next(error) }
})

router.post('/withdrawals', async (req, res, next) => {
  try {
    const { amountTokens, method, destination } = req.body
    if (!Number.isInteger(amountTokens) || amountTokens <= 0) return res.status(400).json({ message: 'Enter a valid token amount' })
    const { data, error } = await req.db.rpc('request_withdrawal', { p_user_id: req.user.id, p_amount_tokens: amountTokens, p_method: method, p_destination: destination })
    if (error) return next(error)
    res.status(201).json(data)
  } catch (error) { next(error) }
})

export default router
