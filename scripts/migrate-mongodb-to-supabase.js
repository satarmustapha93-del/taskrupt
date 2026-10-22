import 'dotenv/config'
import crypto from 'node:crypto'
import { MongoClient } from 'mongodb'
import { createClient } from '@supabase/supabase-js'

const mongoUri = process.env.MONGODB_URI
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!mongoUri || !url || !secret) throw new Error('Set MONGODB_URI, SUPABASE_URL, and SUPABASE_SECRET_KEY before running this one-time import.')
const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
const mongo = new MongoClient(mongoUri)
const iso = (date) => date ? new Date(date).toISOString() : null
const idMap = new Map()
const requireOk = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data }

async function run() {
  await mongo.connect()
  const db = mongo.db()
  const users = await db.collection('users').find({}).toArray()
  const authUsers = new Map()
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const authUser of data.users) authUsers.set(authUser.email?.toLowerCase(), authUser)
    if (data.users.length < 1000) break
  }
  const profileRows = []
  for (const user of users) {
    const authUser = (user.supabaseId && authUsers.get(user.email?.toLowerCase())?.id === user.supabaseId ? authUsers.get(user.email.toLowerCase()) : null) || authUsers.get(user.email?.toLowerCase())
    if (!authUser) throw new Error(`No Supabase Auth account found for ${user.email}. Create/import Auth accounts first, then rerun.`)
    idMap.set(String(user._id), authUser.id)
    profileRows.push({ id: authUser.id, email: authUser.email, full_name: user.name || '', role: user.role || 'user', status: user.status || 'active', tokens_available: user.tokensAvailable || 0, tokens_pending: user.tokensPending || 0, referral_code: user.referralCode || `M${String(user._id).slice(-10).toUpperCase()}`, streak_days: user.streakDays || 0, last_check_in_at: iso(user.lastCheckInAt), level: user.level || 1, xp: user.xp || 0, device_fingerprint: user.deviceFingerprint || null, signup_ip: user.signupIp || null, created_at: iso(user.createdAt) || new Date().toISOString(), updated_at: iso(user.updatedAt) || new Date().toISOString() })
  }
  for (const row of profileRows) {
    const old = users.find((u) => idMap.get(String(u._id)) === row.id)
    row.referred_by = old?.referredBy ? idMap.get(String(old.referredBy)) || null : null
  }
  if (profileRows.length) requireOk(await supabase.from('profiles').upsert(profileRows, { onConflict: 'id' }), 'Import profiles')

  const tasks = await db.collection('tasks').find({}).toArray()
  const taskRows = tasks.map((task) => {
    const id = crypto.randomUUID(); idMap.set(`task:${task._id}`, id)
    return { id, type: task.type, title: task.title, description: task.description || '', link: task.link || '', proof_required: !!task.proofRequired, reward_tokens: task.rewardTokens, cooldown_hours: task.cooldownHours || 0, active: task.active !== false, instant_approval: !!task.instantApproval, max_completions: task.maxCompletions ?? null, created_at: iso(task.createdAt) || new Date().toISOString(), updated_at: iso(task.updatedAt) || new Date().toISOString() }
  })
  if (taskRows.length) requireOk(await supabase.from('tasks').upsert(taskRows, { onConflict: 'id' }), 'Import tasks')

  const submissions = await db.collection('submissions').find({}).toArray()
  const submissionRows = submissions.flatMap((s) => {
    if (!idMap.has(String(s.user)) || !idMap.has(`task:${s.task}`)) return []
    const id = crypto.randomUUID(); idMap.set(`submission:${s._id}`, id)
    return [{ id, user_id: idMap.get(String(s.user)), task_id: idMap.get(`task:${s.task}`), proof_url: s.proofUrl || '', proof_text: s.proofText || '', status: s.status || 'pending', review_note: s.reviewNote || '', reviewed_by: s.reviewedBy ? idMap.get(String(s.reviewedBy)) || null : null, reviewed_at: iso(s.reviewedAt), created_at: iso(s.createdAt) || new Date().toISOString(), updated_at: iso(s.updatedAt) || new Date().toISOString() }]
  })
  if (submissionRows.length) requireOk(await supabase.from('submissions').insert(submissionRows), 'Import submissions')

  const withdrawals = await db.collection('withdrawals').find({}).toArray()
  const withdrawalRows = withdrawals.flatMap((w) => {
    if (!idMap.has(String(w.user))) return []
    const id = crypto.randomUUID(); idMap.set(`withdrawal:${w._id}`, id)
    return [{ id, user_id: idMap.get(String(w.user)), amount_tokens: w.amountTokens, amount_money: w.amountMoney, currency: 'NGN', method: w.method, destination: w.destination, status: w.status || 'pending', reviewed_by: w.reviewedBy ? idMap.get(String(w.reviewedBy)) || null : null, reviewed_at: iso(w.reviewedAt), provider_reference: w.providerReference || '', created_at: iso(w.createdAt) || new Date().toISOString(), updated_at: iso(w.updatedAt) || new Date().toISOString() }]
  })
  if (withdrawalRows.length) requireOk(await supabase.from('withdrawals').insert(withdrawalRows), 'Import withdrawals')

  const transactions = await db.collection('wallettransactions').find({}).toArray()
  const transactionRows = transactions.flatMap((t) => idMap.has(String(t.user)) ? [{ id: crypto.randomUUID(), user_id: idMap.get(String(t.user)), kind: t.kind, amount_tokens: t.amountTokens, balance_after: t.balanceAfter ?? null, description: t.description, reference_id: t.reference ? idMap.get(`submission:${t.reference}`) || idMap.get(`withdrawal:${t.reference}`) || null : null, reference_type: t.reference ? (idMap.has(`submission:${t.reference}`) ? 'submission' : idMap.has(`withdrawal:${t.reference}`) ? 'withdrawal' : 'legacy') : null, created_at: iso(t.createdAt) || new Date().toISOString() }] : [])
  if (transactionRows.length) requireOk(await supabase.from('wallet_transactions').insert(transactionRows), 'Import wallet transactions')

  const settings = await db.collection('appsettings').find({}).toArray()
  if (settings.length) requireOk(await supabase.from('app_settings').upsert(settings.map(({ key, value }) => ({ key, value })), { onConflict: 'key' }), 'Import settings')
  console.log(`Imported ${users.length} profiles, ${taskRows.length} tasks, ${submissionRows.length} submissions, ${transactionRows.length} wallet transactions, ${withdrawalRows.length} withdrawals, and ${settings.length} settings.`)
  console.log('MongoDB source data was left untouched. Verify Supabase rows before decommissioning the source database.')
}

run().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => mongo.close())
