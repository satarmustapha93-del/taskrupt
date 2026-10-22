import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Admin from './Admin.jsx'
import Auth from './Auth.jsx'
import './styles.css'

const isAdmin = window.location.pathname.startsWith('/admin') || new URLSearchParams(window.location.search).get('demo') === 'admin'
const isAuth = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(window.location.pathname) || new URLSearchParams(window.location.search).get('demo') === 'auth'
const Page = isAdmin ? Admin : isAuth ? Auth : App
createRoot(document.getElementById('root')).render(<React.StrictMode><Page /></React.StrictMode>)
