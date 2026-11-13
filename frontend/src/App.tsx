import { useState } from 'react'
import { logout, type CurrentUser } from './auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Sales } from './pages/Sales'
import { Products } from './pages/Products'
import { Clients } from './pages/Clients'
import { Caixa } from './pages/Caixa'
import { Crediario } from './pages/Crediario'
import { Reports } from './pages/Reports'
import { Users } from './pages/Users'
import { Settings } from './pages/Settings'

export type Page = 'dashboard' | 'sales' | 'products' | 'clients' | 'caixa' | 'crediario' | 'reports' | 'users' | 'settings'

export type Toast = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const addToast = (type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  if (!user) {
    return <Login onLogin={loggedInUser => { setUser(loggedInUser); setCurrentPage('dashboard') }} />
  }

  const pageProps = { addToast }

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      onLogout={() => { void logout().catch(() => {}); setUser(null) }}
      toasts={toasts}
      onRemoveToast={removeToast}
      theme={theme}
    >
      {currentPage === 'dashboard' && <Dashboard {...pageProps} onNavigate={setCurrentPage} />}
      {currentPage === 'sales' && <Sales {...pageProps} />}
      {currentPage === 'products' && <Products {...pageProps} />}
      {currentPage === 'clients' && <Clients {...pageProps} />}
      {currentPage === 'caixa' && <Caixa {...pageProps} user={user} />}
      {currentPage === 'crediario' && <Crediario {...pageProps} />}
      {currentPage === 'reports' && user.role === 'administrador' && <Reports {...pageProps} />}
      {currentPage === 'users' && user.role === 'administrador' && <Users {...pageProps} currentUserId={user.id} />}
      {currentPage === 'settings' && <Settings {...pageProps} theme={theme} onThemeChange={setTheme} />}
    </Layout>
  )
}
