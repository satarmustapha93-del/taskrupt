import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { ArrowRight, ArrowUpRight, BadgeCheck, Bell, Check, ChevronDown, CircleHelp, ClipboardCheck, CreditCard, LayoutDashboard, Menu, MoreHorizontal, Search, Settings, ShieldCheck, Users, Wallet, X } from 'lucide-react'

export default function Admin() {
  const [section, setSection] = useState('Overview')
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accessToken, setAccessToken] = useState('')
  const [apiError, setApiError] = useState('')
  const [overview, setOverview] = useState({ users: 0, completedTasks: 0, pendingWithdrawals: 0 })
  const [reviews, setReviews] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [now, setNow] = useState(new Date())
  const [toast, setToast] = useState('')
  const [rate, setRate] = useState('')
  const [minWithdrawal, setMinWithdrawal] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); setApiError('Supabase is not configured.'); return }
    let mounted = true
    const load = async (session) => {
      if (!mounted) return
      if (!session?.user) { setProfile(null); setAccessToken(''); setAuthLoading(false); return }
      setAccessToken(session.access_token)
      const { data: userProfile, error } = await supabase.from('profiles').select('id,full_name,email,role').eq('id', session.user.id).maybeSingle()
      if (!mounted) return
      if (error || !userProfile) { setProfile(null); setApiError('Could not load your Supabase profile. Check the profiles table and its row access policy.'); setAuthLoading(false); return }
      setProfile(userProfile)
      if (userProfile.role !== 'admin') { setAuthLoading(false); return }
      const base = import.meta.env?.VITE_API_URL || 'http://localhost:4000'
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const [overviewRes, submissionsRes, withdrawalsRes, usersRes, tasksRes, walletRes] = await Promise.all([
          fetch(`${base}/api/admin/overview`, { headers }), fetch(`${base}/api/admin/submissions`, { headers }), fetch(`${base}/api/admin/withdrawals`, { headers }), fetch(`${base}/api/admin/users`, { headers }), fetch(`${base}/api/admin/tasks`, { headers }), fetch(`${base}/api/wallet`, { headers }),
        ])
        const [summary, submissionsData, withdrawalsData, usersData, tasksData, walletData] = await Promise.all([overviewRes.json(), submissionsRes.json(), withdrawalsRes.json(), usersRes.json(), tasksRes.json(), walletRes.json()])
        if ([overviewRes, submissionsRes, withdrawalsRes, usersRes, tasksRes, walletRes].some((response) => !response.ok)) throw new Error(summary.message || submissionsData.message || withdrawalsData.message || usersData.message || tasksData.message || walletData.message || 'Admin API is not available.')
        if (!mounted) return
        setOverview(summary)
        setUsers(usersData.users || [])
        setTasks(tasksData.tasks || [])
        setRate(String(walletData.tokenRate ?? ''))
        setMinWithdrawal(String(walletData.minimumWithdrawalNgn ?? ''))
        setReviews((submissionsData.submissions || []).map((item, index) => ({ id: item.id, name: item.user?.full_name || item.user?.email || 'Member', task: item.task?.title || 'Task', time: new Date(item.created_at).toLocaleString(), reward: item.task?.reward_tokens || 0, proof: item.proof_text || item.proof_url || 'No proof attached', initials: (item.user?.full_name || item.user?.email || 'M').split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase(), color: ['a','b','c'][index % 3] })))
        setWithdrawals((withdrawalsData.withdrawals || []).map((item, index) => ({ id: item.id, name: item.user?.full_name || item.user?.email || 'Member', method: item.method, money: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(item.amount_money), tokens: `${Number(item.amount_tokens).toLocaleString()} tokens`, date: new Date(item.created_at).toLocaleString(), initials: (item.user?.full_name || item.user?.email || 'M').split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase(), color: ['a','b','c'][index % 3] })))
        setApiError('')
      } catch (e) { if (mounted) setApiError(e.message || 'Could not load admin data. Start the TaskRupt API and check its Supabase settings.') }
      if (mounted) setAuthLoading(false)
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setAuthLoading(true); setTimeout(() => void load(session), 0) })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(id) }, [])
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Administrator'
  const initials = displayName.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase() || 'A'
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2500) }
  const decideReview = async (id, approved) => {
    try { const base = import.meta.env?.VITE_API_URL || 'http://localhost:4000'; const response = await fetch(`${base}/api/admin/submissions/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: approved ? 'approved' : 'rejected' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message); setReviews(current => current.filter(item => item.id !== id)); notify(approved ? 'Submission approved' : 'Submission rejected') } catch (e) { notify(e.message || 'Could not update this submission') }
  }
  const decideWithdrawal = async (id, approved) => {
    try { const base = import.meta.env?.VITE_API_URL || 'http://localhost:4000'; const response = await fetch(`${base}/api/admin/withdrawals/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: approved ? 'approved' : 'rejected' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message); setWithdrawals(current => current.filter(item => item.id !== id)); notify(approved ? 'Payout approved for processing' : 'Payout request rejected') } catch (e) { notify(e.message || 'Could not update this withdrawal') }
  }

  if (authLoading) return <div className="auth-loading">Loading your TaskRupt admin workspace…</div>
  if (!profile) return <div className="auth-loading"><h1>Sign in to TaskRupt</h1><p>{apiError || 'Sign in to check your admin access.'}</p><a href="/login">Log in</a></div>
  if (profile.role !== 'admin') return <div className="auth-loading"><h1>Admin access required</h1><p>You’re signed in as {profile.email}, but this account does not have the admin role.</p><a href="/">Return to your dashboard</a><button onClick={async () => { await supabase?.auth.signOut(); window.location.assign('/login') }}>Sign out</button></div>

  return <div className="admin-shell">
    {menuOpen && <button className="admin-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu"/>}
    <aside className={`admin-sidebar ${menuOpen ? 'admin-sidebar-open' : ''}`}>
      <div className="brand-row"><div className="brand-mark"><span>⚡</span></div><span>taskrupt<span className="brand-dot">.</span></span><span className="admin-badge">ADMIN</span><button className="admin-close" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
      <div className="side-label">WORKSPACE</div><nav className="side-nav" aria-label="Admin navigation">{[['Overview',LayoutDashboard],['Task reviews',ClipboardCheck],['Withdrawals',CreditCard],['Users',Users],['Tasks',BadgeCheck],['Settings',Settings]].map(([label,Icon])=><button key={label} onClick={()=>{setSection(label);setMenuOpen(false)}} className={`nav-item ${section===label?'nav-active':''}`}><Icon size={18}/><span>{label}</span>{label==='Task reviews'&&reviews.length>0&&<span className="nav-count">{reviews.length}</span>}{label==='Withdrawals'&&withdrawals.length>0&&<span className="nav-count">{withdrawals.length}</span>}</button>)}</nav>
      <div className="admin-sidebar-foot"><div className="admin-secure"><ShieldCheck size={15}/><span>Secure admin workspace</span></div><div className="profile-mini"><div className="avatar admin-avatar">{initials}</div><div className="mini-copy"><strong>{displayName}</strong><span>{profile.email}</span></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <main className="admin-main"><header className="topbar admin-topbar"><button className="mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{section}</b></div><div className="top-actions"><label className="search-box"><Search size={16}/><input placeholder="Search anything..."/></label><button className="icon-button notification-button" onClick={()=>notify('You’re all caught up!')} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-divider"/><button className="top-profile" onClick={async()=>{await supabase?.auth.signOut();window.location.assign('/login')}}><div className="avatar admin-avatar">{initials}</div><span>{displayName}</span><ChevronDown size={15}/></button></div></header>
      <div className="admin-content"><section className="admin-heading"><div><div className="eyebrow"><span className="online-dot"/> TASKRUPT OPERATIONS</div><h1>{section === 'Overview' ? `${now.getHours() >= 5 && now.getHours() < 12 ? 'Good morning' : now.getHours() >= 12 && now.getHours() < 17 ? 'Good afternoon' : now.getHours() >= 17 && now.getHours() < 22 ? 'Good evening' : 'Hello'}, ${displayName.split(/\s+/)[0]}` : section}</h1><p>{section === 'Overview' ? 'Here’s what’s happening across your rewards community.' : `Manage ${section.toLowerCase()} using live TaskRupt data.`}</p></div><span className="admin-date">{new Intl.DateTimeFormat('en', { month:'short', day:'numeric', year:'numeric' }).format(now)}</span></section>

      {apiError && <div className="auth-error" role="status">{apiError}</div>}{section === 'Overview' && <><section className="admin-metrics"><article className="metric-card"><span className="metric-label">Total members</span><div><strong>{Number(overview.users || 0).toLocaleString()}</strong></div><small>All registered accounts</small><span className="metric-icon m-green"><Users size={17}/></span></article><article className="metric-card"><span className="metric-label">Tasks completed</span><div><strong>{Number(overview.completedTasks || 0).toLocaleString()}</strong></div><small>Approved submissions</small><span className="metric-icon m-purple"><BadgeCheck size={17}/></span></article><article className="metric-card"><span className="metric-label">Pending withdrawals</span><div><strong>{Number(overview.pendingWithdrawals ?? withdrawals.length).toLocaleString()}</strong><span className="metric-note">Needs review</span></div><small>Awaiting payout review</small><span className="metric-icon m-orange"><Wallet size={17}/></span></article></section>

      <section className="admin-panels"><article className="admin-panel"><div className="panel-heading"><div><h2>Submissions to review <span className="pending-number">{reviews.length}</span></h2><p>Check proof and approve token rewards.</p></div><button onClick={()=>setSection('Task reviews')}>View queue <ArrowRight size={14}/></button></div>{reviews.length===0?<div className="empty-state"><span><Check size={18}/></span><b>All caught up</b><p>No task submissions need your review.</p></div>:<div className="review-list">{reviews.map(item=><div className="review-item" key={item.id}><div className={`admin-avatar avatar-color-${item.color}`}>{item.initials}</div><div className="review-details"><div className="review-title"><strong>{item.name}</strong><span>· {item.time}</span><small>{item.id}</small></div><div className="review-task">{item.task} <b>+{item.reward} tokens</b></div><div className="proof-text"><ShieldCheck size={12}/>{item.proof}</div></div><div className="review-actions"><button className="reject-button" onClick={()=>decideReview(item.id,false)} aria-label={`Reject ${item.id}`}><X size={15}/></button><button className="approve-button" onClick={()=>decideReview(item.id,true)} aria-label={`Approve ${item.id}`}><Check size={15}/></button></div></div>)}</div>}</article>

      <article className="admin-panel withdrawal-panel"><div className="panel-heading"><div><h2>Withdrawal requests <span className="pending-number">{withdrawals.length}</span></h2><p>Approve payouts to process them.</p></div><button onClick={()=>setSection('Withdrawals')}>View all <ArrowRight size={14}/></button></div>{withdrawals.length===0?<div className="empty-state"><span><Check size={18}/></span><b>Queue is clear</b><p>No payout requests need attention.</p></div>:<div className="withdraw-list">{withdrawals.map(item=><div className="withdraw-item" key={item.id}><div className={`admin-avatar avatar-color-${item.color}`}>{item.initials}</div><div className="withdraw-details"><div><strong>{item.name}</strong><small>{item.id} · {item.date}</small></div><span>{item.method}</span></div><div className="withdraw-total"><strong>{item.money}</strong><small>{item.tokens}</small></div><div className="withdraw-actions"><button className="reject-button" onClick={()=>decideWithdrawal(item.id,false)} aria-label={`Reject ${item.id}`}><X size={15}/></button><button className="approve-button" onClick={()=>decideWithdrawal(item.id,true)} aria-label={`Approve ${item.id}`}><Check size={15}/></button></div></div>)}</div>}</article>


      
      </section></>}
      {section === 'Task reviews' && <article className="admin-panel"><div className="panel-heading"><div><h2>Submissions to review</h2><p>Review real user submissions.</p></div></div>{reviews.length ? <div className="review-list">{reviews.map(item=><div className="review-item" key={item.id}><div className="review-details"><div className="review-title"><strong>{item.name}</strong><span>· {item.time}</span></div><div className="review-task">{item.task} <b>+{item.reward} tokens</b></div><div className="proof-text">{item.proof}</div></div><div className="review-actions"><button className="reject-button" onClick={()=>decideReview(item.id,false)} aria-label="Reject submission"><X size={15}/></button><button className="approve-button" onClick={()=>decideReview(item.id,true)} aria-label="Approve submission"><Check size={15}/></button></div></div>)}</div> : <div className="empty-state"><b>No pending submissions</b></div>}</article>}
      {section === 'Withdrawals' && <article className="admin-panel"><div className="panel-heading"><div><h2>Withdrawal requests</h2><p>Review payout requests from members.</p></div></div>{withdrawals.length ? <div className="withdraw-list">{withdrawals.map(item=><div className="withdraw-item" key={item.id}><div className="withdraw-details"><div><strong>{item.name}</strong><small>{item.date}</small></div><span>{item.method}</span></div><div className="withdraw-total"><strong>{item.money}</strong><small>{item.tokens}</small></div><div className="withdraw-actions"><button className="reject-button" onClick={()=>decideWithdrawal(item.id,false)} aria-label="Reject withdrawal"><X size={15}/></button><button className="approve-button" onClick={()=>decideWithdrawal(item.id,true)} aria-label="Approve withdrawal"><Check size={15}/></button></div></div>)}</div> : <div className="empty-state"><b>No pending withdrawals</b></div>}</article>}
      {section === 'Users' && <article className="admin-panel"><div className="panel-heading"><div><h2>Members ({users.length})</h2><p>Accounts loaded from Supabase.</p></div></div>{users.length ? <div className="review-list">{users.map(user=><div className="review-item" key={user.id}><div className="review-details"><div className="review-title"><strong>{user.full_name || 'Member'}</strong><span>{user.email}</span></div><div className="review-task">{Number(user.tokens_available || 0).toLocaleString()} available · {Number(user.tokens_pending || 0).toLocaleString()} pending · {user.status || 'active'}</div></div></div>)}</div> : <div className="empty-state"><b>No member records</b></div>}</article>}
      {section === 'Tasks' && <article className="admin-panel"><div className="panel-heading"><div><h2>Tasks ({tasks.length})</h2><p>Tasks currently configured for TaskRupt.</p></div></div>{tasks.length ? <div className="review-list">{tasks.map(task=><div className="review-item" key={task.id}><div className="review-details"><div className="review-title"><strong>{task.title}</strong><span>{task.type}</span></div><div className="review-task">{Number(task.reward_tokens || 0).toLocaleString()} tokens · {task.active ? 'Active' : 'Inactive'}</div></div></div>)}</div> : <div className="empty-state"><b>No tasks configured yet</b><p>Create task rows in Supabase to publish them.</p></div>}</article>}
      <footer className="admin-footer"><span>© {now.getFullYear()} TaskRupt admin</span><span><CircleHelp size={12}/> TaskRupt operations</span></footer></div>
    </main>{toast&&<div className="toast"><span><Check size={15}/></span>{toast}</div>}
  </div>
}
