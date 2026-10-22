import { useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, Zap } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase.js'

const deviceId = () => {
  let id = localStorage.getItem('taskrupt_device')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('taskrupt_device', id) }
  return id
}

const friendlyError = (error) => {
  const message = error?.message || ''
  if (/invalid login credentials/i.test(message)) return 'That email and password combination did not match.'
  if (/password should be at least/i.test(message)) return 'Choose a password with at least 8 characters.'
  if (/email not confirmed/i.test(message)) return 'Check your inbox and confirm your email before logging in.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a moment, then try again.'
  return message || 'Something went wrong. Please try again.'
}

export default function Auth() {
  const [mode, setMode] = useState(window.location.pathname === '/signup' ? 'signup' : window.location.pathname === '/forgot-password' ? 'forgot' : window.location.pathname === '/reset-password' ? 'reset' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (next) => {
    setMode(next); setMessage(''); setError('')
    history.pushState({}, '', next === 'forgot' ? '/forgot-password' : next === 'signup' ? '/signup' : next === 'reset' ? '/reset-password' : '/login')
  }

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    if (!isSupabaseConfigured || !supabase) {
      setError('Connect your Supabase project by adding its URL and publishable key to the .env file, then restart the app.')
      setBusy(false)
      return
    }
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              referral_code: new URLSearchParams(location.search).get('ref'),
              device_fingerprint: deviceId(),
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        })
        if (authError) throw authError
        if (data.session) window.location.assign('/')
        else setMessage('Your account is ready. Check your email for a confirmation link, then come back to log in.')
      } else if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        window.location.assign('/')
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (authError) throw authError
        setMessage('If an account matches that email, password reset instructions are on their way.')
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        history.pushState({}, '', '/login')
        setMode('login')
        setMessage('Password updated. You can now log in with your new password.')
        setPassword('')
      }
    } catch (authError) {
      setError(friendlyError(authError))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'
  const subtitle = mode === 'signup' ? 'Join TaskRupt and earn from small online tasks.' : mode === 'forgot' ? 'Enter your email and we’ll send you a reset link.' : mode === 'reset' ? 'Use a strong password you haven’t used before.' : 'Log in to pick up where you left off.'
  const submitLabel = mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Save new password' : 'Log in'

  return <div className="auth-page">
    <header className="auth-header">
      <a href="/" className="auth-brand"><span className="brand-mark"><Zap size={19} fill="currentColor"/></span><b>taskrupt<span>.</span></b></a>
      <span>{mode === 'signup' ? 'Already have an account?' : mode === 'forgot' || mode === 'reset' ? 'Back to your account?' : 'New to TaskRupt?'} <button onClick={() => switchMode(mode === 'signup' || mode === 'forgot' || mode === 'reset' ? 'login' : 'signup')}>{mode === 'signup' || mode === 'forgot' || mode === 'reset' ? 'Log in' : 'Create account'}</button></span>
    </header>
    <main className="auth-layout">
      <section className="auth-hero">
        <span className="auth-kicker">SMALL TASKS. REAL REWARDS.</span>
        <h1>Your time<br/><em>adds up.</em></h1>
        <p>Complete simple tasks, build a streak, and get rewarded for the time you spend online.</p>
        <div className="auth-perks"><span><Check size={15}/> Free to join</span><span><Check size={15}/> Rewards paid in naira</span><span><Check size={15}/> New tasks every day</span></div>
        <div className="auth-hero-foot"><ShieldCheck size={14}/> Your account stays yours.</div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form-card">
          <span className="auth-form-kicker">{mode === 'signup' ? 'YOUR NEXT LITTLE WIN STARTS HERE' : mode === 'login' ? 'GOOD TO SEE YOU AGAIN' : 'ACCOUNT ACCESS'}</span>
          <h2>{title}</h2>
          <p className="auth-form-sub">{subtitle}</p>
          {!isSupabaseConfigured && <div className="auth-config-note">Sign-in will be enabled when the Supabase project URL and publishable key are configured.</div>}
          <form onSubmit={submit}>
            {mode === 'signup' && <label>Your name<div className="auth-input"><UserRound size={16}/><input required autoComplete="name" maxLength={80} placeholder="e.g. Maya Rivers" value={name} onChange={e => setName(e.target.value)}/></div></label>}
            {mode !== 'reset' && <label>Email address<div className="auth-input"><Mail size={16}/><input required type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/></div></label>}
            {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<div className="auth-input"><LockKeyhole size={16}/><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)}/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div></label>}
            {mode === 'login' && <button type="button" className="forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            {message && <div className="auth-message" role="status">{message}</div>}
            <button className="button button-green auth-submit" disabled={busy}>{busy ? 'Please wait…' : submitLabel}<ArrowRight size={16}/></button>
          </form>
          <div className="auth-terms">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</div>
        </div>
        <div className="auth-mobile-note"><ShieldCheck size={14}/> Secure sign-in powered by Supabase.</div>
      </section>
    </main>
  </div>
}
