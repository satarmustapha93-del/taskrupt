import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { AdSenseLoader, AdSenseSlot } from './AdSense.jsx'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Check, ChevronDown,
  CircleHelp, Clock3, Coins, Copy, Flame, Gift, Home, LayoutGrid, LifeBuoy,
  LogOut, Menu, MoreHorizontal, Play, Plus, Search, Settings,
  Target, Trophy, Users, Wallet, X, Zap,
} from 'lucide-react'

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:4000'
const dashboardAdSlot = import.meta.env?.VITE_ADSENSE_DASHBOARD_SLOT_ID || ''
const taskTone = ['lavender', 'pink', 'yellow', 'mint']
const formatTime = (date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))

function App() {
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [active, setActive] = useState('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [claimed, setClaimed] = useState(false)
  const [modal, setModal] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [now, setNow] = useState(new Date())
  const [accessToken, setAccessToken] = useState('')
  const [tasks, setTasks] = useState([])
  const [transactions, setTransactions] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [referralStats, setReferralStats] = useState({ friends: 0, tokens: 0 })
  const [leaderboard, setLeaderboard] = useState([])
  const [wallet, setWallet] = useState(null)
  const [proofText, setProofText] = useState('')
  const [withdrawTokens, setWithdrawTokens] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('bank')
  const [withdrawDestination, setWithdrawDestination] = useState('')
  useEffect(() => {
    if (!supabase) return
    let mounted = true
    const loadProfile = async (session) => {
      if (!mounted) return
      if (!session?.user) {
        window.location.replace('/login')
        return
      }
      const authUser = session.user
      setAccessToken(session.access_token)
      const { data } = await supabase.from('profiles').select('id,full_name,email,role,tokens_available,tokens_pending,streak_days,last_check_in_at,level,xp,referral_code,created_at').eq('id', authUser.id).maybeSingle()
      if (!mounted) return
      setProfile(data || { id: authUser.id, full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Member', email: authUser.email || '', role: 'user', tokens_available: 0, tokens_pending: 0, streak_days: 0, level: 1, xp: 0, referral_code: '', created_at: authUser.created_at })
      const localDay = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
      setClaimed(Boolean(data?.last_check_in_at && localDay(new Date(data.last_check_in_at)) === localDay(new Date())) )
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const fetchJson = async (path) => { const response = await fetch(`${API_BASE}${path}`, { headers }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Could not load account data'); return body }
      const [taskData, walletData, submissionData, referralData, leaderboardData] = await Promise.allSettled([
        fetchJson('/api/tasks'), fetchJson('/api/wallet'), fetchJson('/api/tasks/submissions/mine'), fetchJson('/api/auth/referrals'), fetchJson('/api/auth/leaderboard'),
      ])
      if (!mounted) return
      if (taskData.status === 'fulfilled') setTasks(taskData.value.tasks || [])
      if (walletData.status === 'fulfilled') { setWallet(walletData.value); setTransactions(walletData.value.transactions || []) }
      if (submissionData.status === 'fulfilled') setSubmissions(submissionData.value.submissions || [])
      if (referralData.status === 'fulfilled') setReferralStats(referralData.value)
      if (leaderboardData.status === 'fulfilled') setLeaderboard(leaderboardData.value.entries || [])
      setAuthLoading(false)
    }
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setAuthLoading(true); setTimeout(() => void loadProfile(session), 0) })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(id) }, [])
  const reloadWallet = async () => {
    if (!accessToken) return
    const response = await fetch(`${API_BASE}/api/wallet`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Could not refresh wallet')
    setWallet(body); setTransactions(body.transactions || [])
  }
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Member'
  const firstName = displayName.trim().split(/\s+/)[0]
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M'
  const balance = Number(wallet?.balance ?? profile?.tokens_available ?? 0)
  const pendingBalance = Number(wallet?.pending ?? profile?.tokens_pending ?? 0)
  const streakDays = Number(profile?.streak_days || 0)
  const level = Number(profile?.level || 1)
  const xp = Number(profile?.xp || 0)
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : '—'
  const referralLink = profile?.referral_code ? `${window.location.origin}/signup?ref=${profile.referral_code}` : 'Sign in to get your referral link'
  const xpProgress = xp % 1000
  const xpPercent = Math.round(xpProgress / 1000 * 100)
  const hour = now.getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : hour >= 17 && hour < 22 ? 'Good evening' : 'Hello'
  const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now).toUpperCase()
  const availableTasks = tasks.map((task, i) => ({ ...task, id: task.id, sub: task.description || task.type || 'Complete this task', kind: task.type || 'Task', reward: Number(task.reward_tokens || 0), time: task.cooldown_hours ? `${task.cooldown_hours}h cooldown` : 'Available', icon: task.type === 'video' ? '▶' : task.type === 'social' ? '◎' : '✓', color: taskTone[i % taskTone.length], tag: '' }))
  const history = transactions.map((item) => ({ title: item.description || item.kind || 'Wallet transaction', time: item.created_at ? formatTime(item.created_at) : '', value: `${Number(item.amount_tokens) > 0 ? '+' : ''}${Number(item.amount_tokens || 0).toLocaleString()}`, status: item.status || 'Approved', symbol: Number(item.amount_tokens) < 0 ? '↗' : '✓', tone: 'mint' }))
  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  const copyReferral = async () => {
    if (!profile?.referral_code) return notify('Your referral link is not available yet')
    try { await navigator.clipboard.writeText(referralLink) } catch { /* clipboard may be unavailable in preview */ }
    notify('Your invite link is ready to share')
  }
  const startTask = (task) => { setSelectedTask(task); setProofText(''); setModal('task') }
  const submitTask = async (event) => {
    event.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${selectedTask.id}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ proofText }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Could not submit task')
      setModal(''); setSubmissions(current => [body.submission || body, ...current]); await reloadWallet(); notify('Task submitted for review')
    } catch (error) { notify(error.message || 'Could not submit task') }
  }
  const requestWithdrawal = async (event) => {
    event.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/api/wallet/withdrawals`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amountTokens: Number(withdrawTokens), method: withdrawMethod, destination: withdrawDestination }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Could not request withdrawal')
      setModal(''); await reloadWallet(); notify('Withdrawal request submitted')
    } catch (error) { notify(error.message || 'Could not request withdrawal') }
  }

  if (authLoading) return <div className="auth-loading">Loading your TaskRupt account…</div>

  return (
    <div className="app-shell">
      <AdSenseLoader />
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row"><div className="brand-mark"><Zap size={20} fill="currentColor" strokeWidth={2.6} /></div><span>taskrupt<span className="brand-dot">.</span></span><button className="close-menu" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
        <div className="side-label">MENU</div>
        <nav className="side-nav" aria-label="Main navigation">
          {[['Overview', Home], ['Explore tasks', LayoutGrid], ['My wallet', Wallet], ['Referrals', Users], ['Leaderboard', Trophy]].map(([label, Icon]) => (
            <button key={label} onClick={() => { setActive(label); setMenuOpen(false); if(label !== 'Overview') setSearch('') }} className={`nav-item ${active === label ? 'nav-active' : ''}`}><Icon size={18}/><span>{label}</span>{label === 'Explore tasks' && tasks.length > 0 && <span className="nav-count">{tasks.length}</span>}</button>
          ))}
        </nav>
        <div className="side-label earn-label">YOUR PROGRESS</div>
        <div className="level-card"><div className="level-top"><div className="level-icon"><Zap size={17}/></div><div><strong>{`Level ${level}`}</strong><span>{profile?.email}</span></div><span className="level-pct">{xpPercent}%</span></div><div className="progress-track"><span style={{width: `${xpPercent}%`}} /></div><p>{1000 - xpProgress} XP to level {level + 1}</p></div>
        <div className="side-label side-help-label">NEED A HAND?</div>
        <button className="nav-item help-link" onClick={() => setModal('help')}><CircleHelp size={18}/><span>Help center</span><ArrowRight size={14} className="help-arrow"/></button>
        {profile && <button className="nav-item help-link" onClick={async () => { await supabase?.auth.signOut(); window.location.assign('/login') }}><LogOut size={18}/><span>Sign out</span></button>}
        <div className="sidebar-bottom"><div className="sidebar-note"><p><b>Your progress</b><br/>Level {level}</p><span>{streakDays} day check-in streak</span></div><button className="profile-mini" onClick={() => setModal('profile')}><div className="avatar avatar-small">{initials}</div><div className="mini-copy"><strong>{displayName}</strong><span>{profile?.email}</span></div><MoreHorizontal size={18}/></button></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb"><span>Pages</span><span className="crumb-slash">/</span><b>{active}</b></div><div className="top-actions"><label className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."/><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You’re all caught up!')}><Bell size={18}/><i /></button><div className="top-divider"/><button className="top-profile" onClick={() => setModal('profile')}><div className="avatar">{initials}</div><span>{displayName}</span><ChevronDown size={15}/></button></div></header>
        <div className="page-content">
          {active === 'Overview' ? <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="online-dot"/> {todayLabel}</div><h1>{greeting}, {firstName}</h1><p className="welcome-sub">Your TaskRupt account at a glance.</p></div><button className="button button-light" onClick={() => setModal('withdraw')}><ArrowUpRight size={16}/> Withdraw</button></section>

          <section className="stats-grid" aria-label="Account summary">
            <article className="stat-card balance-card"><div className="stat-heading"><span>Available balance</span><span className="stat-icon green-icon"><Wallet size={16}/></span></div><div className="balance-line"><strong>{balance.toLocaleString()}</strong><span>tokens</span></div><div className="balance-bottom"><span>≈ ₦{(balance / Number(wallet?.tokenRate || 1)).toLocaleString('en-NG')}</span><button onClick={() => setModal('withdraw')}>Cash out <ArrowRight size={13}/></button></div></article>
            <article className="stat-card"><div className="stat-heading"><span>Total experience</span><span className="stat-icon purple-icon"><ArrowDownLeft size={16}/></span></div><div className="stat-number">{xp.toLocaleString()} <small>XP</small></div><div className="stat-foot"><span>Based on approved rewards</span></div></article>
            <article className="stat-card"><div className="stat-heading"><span>Current streak</span><span className="stat-icon orange-icon"><Flame size={16}/></span></div><div className="stat-number">{streakDays} <small>days</small></div><div className="stat-foot"><span>{claimed ? 'Checked in today' : 'Check in to keep your streak active'}</span></div></article>
          </section>

          <section className="content-grid"><div className="main-column">
            <article className="daily-card"><div className="daily-copy"><span className="daily-kicker">DAILY BONUS</span><h2>Daily check-in</h2><p>Check in to claim the bonus configured for your account.</p><div className="daily-bottom"><button className={`button button-green ${claimed ? 'claimed-button' : ''}`} onClick={async () => { try { const response = await fetch(`${API_BASE}/api/auth/check-in`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Check-in unavailable'); setClaimed(true); if (body.user) setProfile(current => ({ ...current, streak_days: body.user.streakDays })); await reloadWallet(); notify(`Check-in complete: +${Number(body.rewardTokens || 0).toLocaleString()} tokens`) } catch (error) { notify(error.message || 'Could not check in') } }}>{claimed ? <><Check size={16}/> Collected</> : <>Check in now <ArrowRight size={15}/></>}</button><span><Clock3 size={13}/> Daily check-in</span></div></div></article>

            <div className="section-heading"><div><h2>Available tasks</h2><p>Complete tasks to earn tokens.</p></div><button className="text-link" onClick={() => setActive('Explore tasks')}>See all tasks <ArrowRight size={15}/></button></div>
            <div className="task-list">{availableTasks.filter(t => `${t.title} ${t.sub}`.toLowerCase().includes(search.toLowerCase())).map(task => <article key={task.id} className="task-row"><div className={`task-icon ${task.color}`}>{task.icon}</div><div className="task-info"><div className="task-name-line"><h3>{task.title}</h3></div><p>{task.sub}</p></div><div className="task-kind"><span>{task.kind}</span><small><Clock3 size={12}/> {task.time}</small></div><div className="task-reward"><strong>+{task.reward}</strong><span>tokens</span></div><button className="task-go" onClick={() => startTask(task)} aria-label={`Start ${task.title}`}><ArrowRight size={16}/></button></article>)}{availableTasks.length === 0 && <div className="empty-state"><b>No tasks available yet</b><p>New tasks will appear here when they are published.</p></div>}</div>

            <div className="section-heading activity-heading"><div><h2>Recent activity</h2><p>Your latest earnings and updates.</p></div><button className="text-link" onClick={() => setActive('My wallet')}>View history <ArrowRight size={15}/></button></div>
            <div className="activity-card">{history.slice(0, 5).map((item,i)=><div className="activity-row" key={`${item.title}-${i}`}><div className={`activity-icon ${item.tone}`}>{item.symbol}</div><div className="activity-copy"><strong>{item.title}</strong><span>{item.time}</span></div><span className={`status ${item.status === 'approved' ? 'status-approved' : 'status-pending'}`}><i/>{item.status}</span><strong className="activity-value">{item.value}</strong></div>)}{history.length === 0 && <div className="empty-state"><b>No recent activity</b><p>Your earned rewards and wallet updates will appear here.</p></div>}</div>
          </div>

          <aside className="right-column">
            <article className="referral-card"><div className="referral-top"><span className="referral-icon"><Users size={17}/></span><span className="referral-badge">10% REWARD</span></div><h2>Good things<br/>are better shared.</h2><p>Invite friends and earn a share of their approved rewards.</p><div className="referral-link"><span>{referralLink}</span><button onClick={copyReferral} aria-label="Copy referral link"><Copy size={15}/></button></div><div className="referral-bottom"><span>{referralStats.friends} friends · {Number(referralStats.tokens || 0).toLocaleString()} tokens earned</span></div></article>


            <article className="leader-card"><div className="leader-heading"><div><h3><Trophy size={16}/> Leaderboard</h3><span>Top earners</span></div><button onClick={() => setActive('Leaderboard')}>All <ArrowRight size={14}/></button></div><div className="leader-list">{leaderboard.slice(0, 3).map((entry, index) => <div className="leader-row" key={entry.userId || index}><span className={`rank ${index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : 'rank-bronze'}`}>{index + 1}</span><span className="leader-avatar">{entry.initials || 'M'}</span><span className="leader-name">{entry.name || 'Member'}</span><strong>{Number(entry.tokens || 0).toLocaleString()}</strong></div>)}{leaderboard.length === 0 && <div className="empty-state"><p>Leaderboard entries will appear after approved rewards are earned.</p></div>}</div></article>

            <div className="tip-card"><span><Zap size={14} fill="currentColor"/></span><p><b>Task status</b><br/>Your submission status appears in wallet history.</p></div>
          </aside>
          </section>
          <AdSenseSlot slot={dashboardAdSlot} />
          <footer className="page-footer"><span>© {now.getFullYear()} TaskRupt</span><span><button onClick={()=>setModal('help')}>Help</button></span><span> </span></footer>
          </> : <>
            <section className="welcome-row"><div><div className="eyebrow"><span className="online-dot"/> TASKRUPT</div><h1>{active}</h1><p className="welcome-sub">{active === 'Explore tasks' ? 'Choose a task, complete it, and earn tokens.' : active === 'My wallet' ? 'Your token balance and recent transactions.' : active === 'Referrals' ? 'Invite friends and earn 10% of their approved rewards.' : 'See how your weekly earnings compare.'}</p></div>{active === 'My wallet' && <button className="button button-light" onClick={() => setModal('withdraw')}><ArrowUpRight size={16}/> Withdraw</button>}</section>
            {active === 'Explore tasks' && <><section className="section-heading"><div><h2>Available tasks</h2><p>Complete tasks to earn tokens.</p></div></section><div className="task-list">{availableTasks.filter(t => `${t.title} ${t.sub}`.toLowerCase().includes(search.toLowerCase())).map(task => <article key={task.id} className="task-row"><div className={`task-icon ${task.color}`}>{task.icon}</div><div className="task-info"><div className="task-name-line"><h3>{task.title}</h3></div><p>{task.sub}</p></div><div className="task-kind"><span>{task.kind}</span><small><Clock3 size={12}/> {task.time}</small></div><div className="task-reward"><strong>+{task.reward}</strong><span>tokens</span></div><button className="task-go" onClick={() => startTask(task)} aria-label={`Start ${task.title}`}><ArrowRight size={16}/></button></article>)}{availableTasks.length === 0 && <div className="empty-state"><b>No tasks available yet</b><p>New tasks will appear here when they are published.</p></div>}</div></>}
            {active === 'My wallet' && <><section className="stats-grid"><article className="stat-card balance-card"><div className="stat-heading"><span>Available balance</span><span className="stat-icon green-icon"><Wallet size={16}/></span></div><div className="balance-line"><strong>{balance.toLocaleString()}</strong><span>tokens</span></div><div className="balance-bottom"><span>≈ ₦{(balance / Number(wallet?.tokenRate || 1)).toLocaleString('en-NG')}</span><button onClick={() => setModal('withdraw')}>Cash out <ArrowRight size={13}/></button></div></article><article className="stat-card"><div className="stat-heading"><span>Pending review</span></div><div className="stat-number">{pendingBalance.toLocaleString()} <small>tokens</small></div></article></section><div className="section-heading activity-heading"><div><h2>Transaction history</h2><p>Approved and pending rewards.</p></div></div><div className="activity-card">{history.map((item, i)=><div className="activity-row" key={`${item.title}-${i}`}><div className={`activity-icon ${item.tone}`}>{item.symbol}</div><div className="activity-copy"><strong>{item.title}</strong><span>{item.time}</span></div><span className="status status-approved"><i/>Recorded</span><strong className="activity-value">{item.value} tokens</strong></div>)}{history.length === 0 && <div className="empty-state"><b>No wallet transactions yet</b><p>Your approved earnings and withdrawals will appear here.</p></div>}</div></>}
            {active === 'Referrals' && <article className="referral-card"><div className="referral-top"><span className="referral-icon"><Users size={17}/></span><span className="referral-badge">10% REWARD</span></div><h2>Invite friends<br/>to earn together.</h2><p>Earn 10% of your friends’ approved token rewards.</p><div className="referral-link"><span>{referralLink}</span><button onClick={copyReferral} aria-label="Copy referral link"><Copy size={15}/></button></div><div className="referral-bottom"><span>{referralStats.friends} friends joined · {Number(referralStats.tokens || 0).toLocaleString()} tokens earned</span></div></article>}
            {active === 'Leaderboard' && <article className="leader-card"><div className="leader-heading"><div><h3><Trophy size={16}/> Leaderboard</h3><span>Top earners</span></div></div><div className="leader-list">{leaderboard.map((entry, index) => <div className="leader-row" key={entry.userId || index}><span className={`rank ${index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : ''}`}>{index + 1}</span><span className="leader-avatar">{entry.initials || 'M'}</span><span className="leader-name">{entry.name || 'Member'}</span><strong>{Number(entry.tokens || 0).toLocaleString()} tokens</strong></div>)}{leaderboard.length === 0 && <div className="empty-state"><b>No leaderboard entries yet</b><p>Approved rewards will appear here.</p></div>}</div></article>}
            <footer className="page-footer"><span>© {now.getFullYear()} TaskRupt</span><span><button onClick={()=>setModal('help')}>Help</button></span></footer>
          </>}
        </div>
      </main>
      {toast && <div className="toast"><span><Check size={15}/></span>{toast}</div>}
      {modal && <div className="modal-backdrop" onClick={() => setModal('')}><div className="modal-card" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={() => setModal('')}><X size={18}/></button>{modal === 'withdraw' ? <><span className="modal-symbol"><Wallet size={21}/></span><h2>Request a withdrawal</h2><p>Available: {balance.toLocaleString()} tokens · Minimum: ₦{Number(wallet?.minimumWithdrawalNgn || 5000).toLocaleString()}</p><form onSubmit={requestWithdrawal}><label>Token amount<input type="number" min="1" max={balance} required value={withdrawTokens} onChange={e=>setWithdrawTokens(e.target.value)}/></label><label>Payout method<select value={withdrawMethod} onChange={e=>setWithdrawMethod(e.target.value)}><option value="bank">Bank transfer</option><option value="paypal">PayPal</option></select></label><label>Account / payout destination<input required value={withdrawDestination} onChange={e=>setWithdrawDestination(e.target.value)} placeholder="Bank account or PayPal email"/></label><button className="button button-green modal-action" type="submit">Submit request <ArrowRight size={15}/></button></form></> : modal === 'task' ? <><span className="modal-symbol"><Target size={21}/></span><h2>{selectedTask?.title}</h2><p>{selectedTask?.description || selectedTask?.type}. Reward: <b>{Number(selectedTask?.reward_tokens || 0).toLocaleString()} tokens</b></p>{selectedTask?.link && <p><a href={selectedTask.link} target="_blank" rel="noreferrer">Open task link</a></p>}<form onSubmit={submitTask}><label>Proof details<textarea required={Boolean(selectedTask?.proof_required)} value={proofText} onChange={e=>setProofText(e.target.value)} placeholder="Describe completion or paste proof link"/></label><button className="button button-green modal-action" type="submit">Submit for review <ArrowRight size={15}/></button></form></> : modal === 'help' ? <><span className="modal-symbol"><LifeBuoy size={21}/></span><h2>Help center</h2><p>Support contact has not been configured yet. Please contact the TaskRupt administrator for assistance.</p></> : <><span className="modal-symbol"><div className="avatar">{initials}</div></span><h2>{displayName}</h2><p>Level {level} · {profile?.email}<br/>Member since {memberSince}</p><button className="button button-light modal-action" onClick={async()=>{await supabase?.auth.signOut();window.location.assign('/login')}}><LogOut size={15}/> Sign out</button></>}</div></div>}
    </div>
  )
}

export default App

