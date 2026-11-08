import { useState } from 'react'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

type Role = 'Administrador' | 'Operador' | 'Gerente' | 'Caixa'

interface User {
  id: string; name: string; username: string; cpf: string; phone: string; role: Role; active: boolean
}

const INITIAL: User[] = [
  { id: '1', name: 'Ana Martins', username: 'ana.martins', cpf: '111.222.333-44', phone: '(11) 99100-2000', role: 'Administrador', active: true },
  { id: '2', name: 'Carlos Silva', username: 'carlos.silva', cpf: '222.333.444-55', phone: '(11) 99200-3000', role: 'Operador', active: true },
  { id: '3', name: 'Fernanda Lima', username: 'fernanda.lima', cpf: '333.444.555-66', phone: '(11) 99300-4000', role: 'Gerente', active: true },
  { id: '4', name: 'Ricardo Souza', username: 'ricardo.souza', cpf: '444.555.666-77', phone: '(11) 99400-5000', role: 'Caixa', active: false },
  { id: '5', name: 'Juliana Rocha', username: 'juliana.rocha', cpf: '555.666.777-88', phone: '(11) 99500-6000', role: 'Operador', active: true },
]

const ROLE_COLORS: Record<Role, string> = {
  Administrador: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  Gerente: 'bg-blue-50 text-blue-700 ring-blue-500/20',
  Operador: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Caixa: 'bg-amber-50 text-amber-700 ring-amber-500/20',
}

const emptyForm = (): Omit<User, 'id'> & { password: string } => ({
  name: '', username: '', cpf: '', phone: '', role: 'Operador', active: true, password: ''
})

export function Users({ addToast }: Props) {
  const [users, setUsers] = useState<User[]>(INITIAL)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.cpf.includes(search)
  )

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ name: u.name, username: u.username, cpf: u.cpf, phone: u.phone, role: u.role, active: u.active, password: '' })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.name || !form.username) { addToast('error', 'Preencha nome e usuário.'); return }
    if (!editing && !form.password) { addToast('error', 'Defina uma senha.'); return }
    if (editing) {
      setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, name: form.name, username: form.username, cpf: form.cpf, phone: form.phone, role: form.role, active: form.active } : u))
      addToast('success', 'Usuário atualizado.')
    } else {
      setUsers(prev => [...prev, { id: Date.now().toString(), name: form.name, username: form.username, cpf: form.cpf, phone: form.phone, role: form.role, active: form.active }])
      addToast('success', 'Usuário cadastrado.')
    }
    setShowForm(false)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    addToast('info', 'Usuário removido.')
    setDeleteTarget(null)
  }

  const toggleActive = (u: User) => {
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, active: !p.active } : p))
    addToast('info', `${u.name} ${u.active ? 'desativado' : 'ativado'}.`)
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, usuário ou CPF..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button onClick={openNew} className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de usuários', value: users.length },
          { label: 'Ativos', value: users.filter(u => u.active).length },
          { label: 'Inativos', value: users.filter(u => !u.active).length },
          { label: 'Administradores', value: users.filter(u => u.role === 'Administrador').length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className="font-display font-700 text-2xl text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Usuário', 'CPF', 'Telefone', 'Cargo', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">Nenhum usuário encontrado.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${u.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{u.cpf}</td>
                <td className="px-5 py-3.5 text-gray-600">{u.phone}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_COLORS[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => toggleActive(u)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${u.active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${u.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(u)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Editar</button>
                    <span className="text-gray-200">|</span>
                    <button onClick={() => setDeleteTarget(u)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">{filtered.length} usuários</span>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-display font-700 text-gray-900 text-lg">{editing ? 'Editar usuário' : 'Novo usuário'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              <FF label="Nome completo"><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IC} /></FF>
              <div className="grid grid-cols-2 gap-4">
                <FF label="Usuário (login)"><input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={IC} /></FF>
                <FF label="Cargo">
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className={IC}>
                    {(['Administrador', 'Gerente', 'Operador', 'Caixa'] as Role[]).map(r => <option key={r}>{r}</option>)}
                  </select>
                </FF>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FF label="CPF"><input type="text" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className={IC} /></FF>
                <FF label="Telefone"><input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" className={IC} /></FF>
              </div>
              <FF label={editing ? 'Nova senha (deixe em branco para manter)' : 'Senha'}>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={`${IC} pr-10`} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPassword ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                    </svg>
                  </button>
                </div>
              </FF>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, active: !f.active }))} className={`w-10 h-5.5 rounded-full transition-colors relative ${form.active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Usuário ativo</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg">{editing ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-display font-700 text-gray-900 text-lg text-center mb-2">Excluir usuário?</h3>
            <p className="text-sm text-gray-500 text-center mb-6"><strong>{deleteTarget.name}</strong> perderá acesso ao sistema.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const IC = 'w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>{children}</div>
}
