import { useEffect, useState } from 'react'
import { authHeaders } from '../auth'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
  currentUserId: number
}

type Role = 'administrador' | 'operador'
interface ManagedUser {
  id: number
  name: string
  email: string
  cpf: string
  phone: string
  role: Role
  active: boolean
}
interface UserStats { total: number; active: number; inactive: number; administrators: number }
interface UserPage { count: number; page: number; page_size: number; total_pages: number; stats: UserStats; results: ManagedUser[] }
type UserForm = Omit<ManagedUser, 'id'> & { password: string }

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
const PER_PAGE = 10
const EMPTY_STATS: UserStats = { total: 0, active: 0, inactive: 0, administrators: 0 }
const emptyForm = (): UserForm => ({ name: '', email: '', cpf: '', phone: '', role: 'operador', active: true, password: '' })
const roleLabels: Record<Role, string> = { administrador: 'Administrador', operador: 'Operador' }
const roleColors: Record<Role, string> = {
  administrador: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  operador: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return value || '—'
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error('Não foi possível conectar à API.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.detail
    if (typeof detail === 'string') throw new Error(detail)
    if (detail && typeof detail === 'object') {
      const message = Object.entries(detail as Record<string, unknown>).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join(' · ')
      throw new Error(message || 'Não foi possível concluir a operação.')
    }
    const fieldError = Object.entries(data as Record<string, unknown>).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join(' · ')
    throw new Error(fieldError || 'Não foi possível concluir a operação.')
  }
  return data as T
}

export function Users({ addToast, currentUserId }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm())
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ search, page: String(page), page_size: String(PER_PAGE) })
    setLoading(true)
    setError('')
    fetch(`${API_URL}/users/?${params}`, { headers: authHeaders(), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível carregar os usuários.')
        return data as UserPage
      })
      .then(data => {
        if (controller.signal.aborted) return
        setUsers(data.results)
        setStats(data.stats)
        setCount(data.count)
        setTotalPages(Math.max(1, data.total_pages))
        if (page !== data.page) setPage(data.page)
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Erro ao carregar os usuários.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [search, page, reload])

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowPassword(false); setShowForm(true) }
  const openEdit = (user: ManagedUser) => {
    setEditing(user)
    setForm({ name: user.name, email: user.email, cpf: user.cpf, phone: user.phone, role: user.role, active: user.active, password: '' })
    setShowPassword(false)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (busy) return
    if (!form.name.trim() || !form.email.trim() || !form.cpf.trim() || !form.phone.trim()) {
      addToast('error', 'Preencha nome, e-mail, CPF e telefone.')
      return
    }
    if (!editing && !form.password) { addToast('error', 'Defina uma senha para o usuário.'); return }
    setBusy(true)
    const payload: Partial<UserForm> = { ...form }
    if (editing && !payload.password) delete payload.password
    try {
      await requestApi<ManagedUser>(editing ? `/users/${editing.id}/` : '/users/', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      addToast('success', editing ? 'Usuário atualizado.' : 'Usuário cadastrado.')
      setShowForm(false)
      setReload(value => value + 1)
    } catch (reason) {
      addToast('error', reason instanceof Error ? reason.message : 'Não foi possível salvar o usuário.')
    } finally { setBusy(false) }
  }

  const toggleActive = async (user: ManagedUser) => {
    if (user.id === currentUserId && user.active) { addToast('error', 'Você não pode desativar o próprio usuário.'); return }
    try {
      await requestApi(`/users/${user.id}/`, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) })
      addToast('info', `${user.name} ${user.active ? 'desativado' : 'ativado'}.`)
      setReload(value => value + 1)
    } catch (reason) { addToast('error', reason instanceof Error ? reason.message : 'Não foi possível alterar o status.') }
  }

  const handleDelete = async () => {
    if (!deleteTarget || busy) return
    setBusy(true)
    try {
      await requestApi(`/users/${deleteTarget.id}/`, { method: 'DELETE' })
      addToast('info', 'Usuário removido.')
      setDeleteTarget(null)
      if (users.length === 1 && page > 1) setPage(value => value - 1)
      else setReload(value => value + 1)
    } catch (reason) { addToast('error', reason instanceof Error ? reason.message : 'Não foi possível excluir o usuário.') }
    finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-6">
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button onClick={() => setReload(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar por nome ou CPF..." className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={openNew} className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Novo usuário</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total de usuários', value: stats.total },
          { label: 'Ativos', value: stats.active },
          { label: 'Inativos', value: stats.inactive },
          { label: 'Administradores', value: stats.administrators },
        ].map(card => <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4"><p className="mb-1 text-sm text-gray-500">{card.label}</p><p className="font-display text-2xl font-700 text-gray-900">{card.value.toLocaleString('pt-BR')}</p></div>)}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">{['Nome', 'CPF', 'Telefone', 'Cargo', 'Status', 'Ações'].map(heading => <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(user => <tr key={user.id} className="transition-colors hover:bg-gray-50">
              <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${user.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><span className="font-medium text-gray-900">{user.name}</span></div></td>
              <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-gray-600">{formatCpf(user.cpf) || '—'}</td>
              <td className="whitespace-nowrap px-5 py-3.5 text-gray-600">{formatPhone(user.phone)}</td>
              <td className="px-5 py-3.5"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleColors[user.role]}`}>{roleLabels[user.role]}</span></td>
              <td className="px-5 py-3.5"><button aria-label={`${user.active ? 'Desativar' : 'Ativar'} ${user.name}`} onClick={() => void toggleActive(user)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${user.active ? 'bg-blue-600' : 'bg-gray-200'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${user.active ? 'translate-x-4' : 'translate-x-0.5'}`} /></button><span className="ml-2 text-xs text-gray-500">{user.active ? 'Ativo' : 'Inativo'}</span></td>
              <td className="whitespace-nowrap px-5 py-3.5"><div className="flex items-center gap-2"><button onClick={() => openEdit(user)} className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800">Editar</button><span className="text-gray-200">|</span><button disabled={user.id === currentUserId} onClick={() => setDeleteTarget(user)} className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Excluir</button></div></td>
            </tr>)}
            {!users.length && <tr><td colSpan={6} className="py-16 text-center text-sm text-gray-400">{loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}</td></tr>}
          </tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-3.5">
          <span className="text-xs text-gray-500">{count.toLocaleString('pt-BR')} usuários encontrados · 10 por página</span>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs transition-colors hover:bg-white disabled:opacity-40">← Anterior</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => <button key={number} onClick={() => setPage(number)} className={`h-8 w-8 rounded-lg text-xs transition-colors ${page === number ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'}`}>{number}</button>)}
            <button disabled={page >= totalPages || loading} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs transition-colors hover:bg-white disabled:opacity-40">Próximo →</button>
          </div>
        </div>
      </div>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Fechar modal" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && setShowForm(false)} /><div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6"><h3 className="font-display text-lg font-700 text-gray-900">{editing ? 'Editar usuário' : 'Novo usuário'}</h3><button disabled={busy} onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="space-y-4 p-6">
          <Field label="Nome completo"><input autoComplete="name" value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} className={inputClass} /></Field>
          <Field label="E-mail"><input type="email" autoComplete="email" value={form.email} onChange={event => setForm(value => ({ ...value, email: event.target.value }))} className={inputClass} /></Field>
          <div className="grid grid-cols-2 gap-4"><Field label="CPF"><input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={form.cpf} onChange={event => setForm(value => ({ ...value, cpf: formatCpf(event.target.value) }))} className={inputClass} /></Field><Field label="Telefone"><input type="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={event => setForm(value => ({ ...value, phone: event.target.value }))} className={inputClass} /></Field></div>
          <Field label="Cargo"><select value={form.role} onChange={event => setForm(value => ({ ...value, role: event.target.value as Role }))} className={inputClass}><option value="administrador">Administrador</option><option value="operador">Operador</option></select></Field>
          <Field label={editing ? 'Nova senha (opcional)' : 'Senha'}><div className="relative"><input type={showPassword ? 'text' : 'password'} autoComplete={editing ? 'new-password' : 'new-password'} value={form.password} onChange={event => setForm(value => ({ ...value, password: event.target.value }))} placeholder={editing ? 'Deixe em branco para manter' : 'Mínimo de 8 caracteres'} className={`${inputClass} pr-12`} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"><EyeIcon hidden={!showPassword} /></button></div></Field>
          <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={form.active} onChange={event => setForm(value => ({ ...value, active: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm font-medium text-gray-700">Usuário ativo</span></label>
        </div>
        <div className="flex gap-3 p-6 pt-0"><button disabled={busy} onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button><button disabled={busy} onClick={() => void handleSave()} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar usuário'}</button></div>
      </div></div>}

      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Cancelar exclusão" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} /><div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h3 className="mb-2 text-center font-display text-lg font-700 text-gray-900">Excluir usuário?</h3><p className="mb-6 text-center text-sm text-gray-500"><strong>{deleteTarget.name}</strong> perderá acesso ao sistema. Se houver histórico vinculado, será necessário desativar a conta.</p><div className="flex gap-3"><button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button><button disabled={busy} onClick={() => void handleDelete()} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">{busy ? 'Excluindo...' : 'Excluir'}</button></div></div></div>}
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>{children}</label> }
function EyeIcon({ hidden }: { hidden: boolean }) { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" />{hidden && <path strokeLinecap="round" d="M4 4l16 16" />}</svg> }
