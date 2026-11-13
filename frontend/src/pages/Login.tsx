import { useState } from 'react'
import { login, type CurrentUser } from '../auth'

interface LoginProps {
  onLogin: (user: CurrentUser) => void
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Preencha todos os campos.')
      return
    }
    setLoading(true)
    try { onLogin(await login(email, password)) }
    catch (err) { setError((err as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-[#10264d] lg:flex">
      <section className="relative hidden min-h-screen w-[54%] overflow-hidden bg-[#063579] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_16%_14%,rgba(30,105,196,.6),transparent_45%),linear-gradient(145deg,#06295f_0%,#07439a_54%,#09275b_100%)]" />
        <div className="absolute inset-0 opacity-[.11]" style={{backgroundImage:'linear-gradient(115deg,transparent 0 42%,rgba(255,255,255,.3) 42.2%,transparent 42.5%),repeating-linear-gradient(0deg,transparent 0 62px,rgba(255,255,255,.15) 63px,transparent 65px),repeating-linear-gradient(90deg,transparent 0 90px,rgba(255,255,255,.12) 91px,transparent 93px)'}} />
        <div className="absolute -bottom-28 -left-28 h-72 w-[125%] rotate-[-10deg] border-t-[24px] border-white/20 bg-gradient-to-b from-white/10 to-transparent" />
        <div className="relative z-10 flex max-w-2xl items-center gap-3 text-sm font-semibold tracking-wide text-white/90">
          <span className="h-[3px] w-12 rounded-full bg-[#ef1d2c]" />
          Bem-vindo ao sistema da
        </div>

        <div className="relative z-10 w-full max-w-[720px]">
          <img src="/images/logo-santo-antonio.png" alt="Indústria de Gesso Santo Antônio" className="block h-auto w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,.18)]" />
        </div>

        <p className="relative z-10 max-w-2xl text-lg font-medium leading-relaxed text-white/95 xl:text-xl">
          Com fé em Deus, coragem no peito e disposição pra trabalhar, a gente vai longe.
        </p>

        <div className="relative z-10 w-full border-t border-white/20 pt-5 text-sm font-medium tracking-wide text-white/85">
          DEV <span className="font-bold text-white">Matheus Henrique</span>
        </div>

        <svg aria-hidden="true" className="absolute -right-1 top-0 z-20 h-full w-12" viewBox="0 0 48 900" preserveAspectRatio="none">
          <path d="M48 0H37C31 110 27 190 19 290C10 410 7 510 2 630C-2 735 1 820 5 900H48Z" fill="#e31d2b" />
          <path d="M48 0H44C38 110 34 190 26 290C17 410 14 510 9 630C5 735 8 820 12 900H48Z" fill="white" />
        </svg>
      </section>

      <section className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-20 h-72 w-[125%] rotate-[8deg] border-b-[18px] border-white bg-gradient-to-b from-white to-[#edf1f8] shadow-sm" />
          <div className="absolute -bottom-20 -left-10 h-48 w-[120%] rotate-[-5deg] border-t border-white bg-gradient-to-b from-[#edf1f8]/80 to-white" />
          <div className="absolute bottom-10 right-[-40px] h-28 w-60 -skew-x-12 border-b-[10px] border-white/80 bg-[#e9edf4]/50" />
        </div>
        <div className="relative z-10 w-full max-w-[510px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <img src="/images/logo-santo-antonio.png" alt="Indústria de Gesso Santo Antônio" className="h-auto w-full max-w-[360px] object-contain" />
          </div>
          <div className="mb-9">
            <span className="mb-4 block h-[5px] w-[70px] rounded-full bg-[#ed1c2e]" />
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#102b59] sm:text-4xl">Acessar o sistema</h1>
            <p className="mt-2 text-base text-[#1e3761] sm:text-lg">Entre com suas credenciais para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="mb-2 flex items-center gap-3 text-base font-bold text-[#102b59]">
                <UserIcon /> E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Ex.: nome@empresa.com.br"
                className="w-full rounded-2xl border-2 border-[#d5deed] bg-white/85 px-5 py-4 text-base text-gray-900 shadow-[0_4px_10px_rgba(15,41,82,.08)] outline-none transition placeholder:text-gray-500 focus:border-[#1454ae] focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 flex items-center gap-3 text-base font-bold text-[#102b59]">
                <LockIcon /> Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full rounded-2xl border-2 border-[#d5deed] bg-white/85 px-5 py-4 pr-14 text-base text-gray-900 shadow-[0_4px_10px_rgba(15,41,82,.08)] outline-none transition placeholder:text-gray-500 focus:border-[#1454ae] focus:ring-4 focus:ring-blue-100"
                />
                <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-[#53647e] hover:text-[#0b47a0]">
                  <EyeIcon crossed={!showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <span className="text-lg font-bold">!</span><p>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#07439b] to-[#0644a5] px-5 py-4 text-lg font-bold text-white shadow-[0_8px_18px_rgba(3,54,138,.24)] transition hover:from-[#063984] hover:to-[#053b91] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-70">
              {loading ? <SpinnerIcon /> : <EnterIcon />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-[#64728a]">Acesso restrito a usuários autorizados.</p>
        </div>
      </section>
    </main>
  )
}


function UserIcon(){return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="3.5"/><path strokeLinecap="round" d="M5 20v-1.5a7 7 0 0114 0V20H5z"/></svg>}
function LockIcon(){return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="5" y="10" width="14" height="11" rx="2"/><path strokeLinecap="round" d="M8 10V7a4 4 0 118 0v3m-4 5v2"/></svg>}
function EyeIcon({crossed}:{crossed:boolean}){return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>{crossed&&<path strokeLinecap="round" d="M4 4l16 16"/>}</svg>}
function EnterIcon(){return <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5h5a2 2 0 012 2v10a2 2 0 01-2 2h-5m-2-4 4-3-4-3m4 3H3"/></svg>}
function SpinnerIcon(){return <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4v12z"/></svg>}
