import { useState } from 'react'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

interface Client {
  id: string; name: string; cpf: string; phone: string; email: string; creditLimit: number; balance: number; active: boolean
}

const INITIAL: Client[] = [
  { id: '1', name: 'Maria Fernanda Costa', cpf: '123.456.789-00', phone: '(11) 99821-3456', email: 'maria.costa@email.com', creditLimit: 1500, balance: 320, active: true },
  { id: '2', name: 'João Pedro Oliveira', cpf: '234.567.890-11', phone: '(11) 98732-1234', email: 'joao.oliveira@email.com', creditLimit: 800, balance: 0, active: true },
  { id: '3', name: 'Carla Regina Santos', cpf: '345.678.901-22', phone: '(11) 97643-2345', email: 'carla.santos@email.com', creditLimit: 2000, balance: 850, active: true },
  { id: '4', name: 'Roberto Carlos Lima', cpf: '456.789.012-33', phone: '(11) 96554-3456', email: 'roberto.lima@email.com', creditLimit: 500, balance: 500, active: false },
  { id: '5', name: 'Patrícia Alves Mendes', cpf: '567.890.123-44', phone: '(11) 95465-4567', email: 'patricia.mendes@email.com', creditLimit: 1200, balance: 0, active: true },
  { id: '6', name: 'Fernando Augusto Ramos', cpf: '678.901.234-55', phone: '(11) 94376-5678', email: 'fernando.ramos@email.com', creditLimit: 3000, balance: 1200, active: true },
]

const clientHistory = [
  { id: '#00842', date: '30/09/2026', total: 'R$ 147,90', method: 'Cartão de crédito', status: 'Concluída' },
  { id: '#00801', date: '15/09/2026', total: 'R$ 320,00', method: 'Crediário', status: 'Concluída' },
  { id: '#00760', date: '28/08/2026', total: 'R$ 89,50', method: 'Pix', status: 'Concluída' },
]

const emptyForm = (): Omit<Client, 'id' | 'balance'> => ({ name: '', cpf: '', phone: '', email: '', creditLimit: 500, active: true })

export function Clients({ addToast }: Props) {
  const [clients, setClients] = useState<Client[]>(INITIAL)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [viewing, setViewing] = useState<Client | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf.includes(search) ||
    c.phone.includes(search)
  )

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (c: Client) => { setEditing(c); setForm({ name: c.name, cpf: c.cpf, phone: c.phone, email: c.email, creditLimit: c.creditLimit, active: c.active }); setShowForm(true) }

  const handleSave = () => {
    if (!form.name || !form.cpf) { addToast('error', 'Preencha nome e CPF.'); return }
    if (editing) {
      setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...form } : c))
      addToast('success', 'Cliente atualizado.')
    } else {
      setClients(prev => [...prev, { id: Date.now().toString(), balance: 0, ...form }])
      addToast('success', 'Cliente cadastrado.')
    }
    setShowForm(false)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setClients(prev => prev.filter(c => c.id !== deleteTarget.id))
    addToast('info', 'Cliente removido.')
    setDeleteTarget(null)
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
            placeholder="Buscar por nome, CPF ou telefone..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button onClick={openNew} className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Nome', 'CPF', 'Telefone', 'Limite', 'Saldo devedor', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-gray-400 text-sm">Nenhum cliente encontrado.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                      {c.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{c.cpf}</td>
                <td className="px-5 py-3.5 text-gray-600">{c.phone}</td>
                <td className="px-5 py-3.5 font-semibold text-gray-700">R$ {c.creditLimit.toFixed(2).replace('.', ',')}</td>
                <td className="px-5 py-3.5">
                  <span className={`font-semibold ${c.balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {c.balance > 0 ? `R$ ${c.balance.toFixed(2).replace('.', ',')}` : '—'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${c.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-gray-100 text-gray-500 ring-gray-500/20'}`}>
                    {c.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewing(c)} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">Ver</button>
                    <span className="text-gray-200">|</span>
                    <button onClick={() => openEdit(c)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Editar</button>
                    <span className="text-gray-200">|</span>
                    <button onClick={() => setDeleteTarget(c)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">{filtered.length} clientes</span>
        </div>
      </div>

      {/* View Modal */}
      {viewing && (
        <ModalOverlay onClose={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center gap-4 p-6 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                {viewing.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1">
                <h3 className="font-display font-700 text-gray-900 text-xl">{viewing.name}</h3>
                <p className="text-sm text-gray-500">{viewing.cpf} · {viewing.phone}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-100">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Limite de crédito</p>
                <p className="font-display font-700 text-lg text-gray-900">R$ {viewing.creditLimit.toFixed(2).replace('.', ',')}</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${viewing.balance > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <p className="text-xs text-gray-500 mb-1">Saldo devedor</p>
                <p className={`font-display font-700 text-lg ${viewing.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {viewing.balance > 0 ? `R$ ${viewing.balance.toFixed(2).replace('.', ',')}` : 'Quitado'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Compras realizadas</p>
                <p className="font-display font-700 text-lg text-gray-900">3</p>
              </div>
            </div>
            <div className="p-6">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Histórico de compras</h4>
              <div className="space-y-2">
                {clientHistory.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-sm font-medium text-blue-600">{h.id}</span>
                      <span className="text-xs text-gray-400 ml-2">{h.date}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{h.total}</p>
                      <p className="text-xs text-gray-400">{h.method}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Form Modal */}
      {showForm && (
        <ModalOverlay onClose={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-display font-700 text-gray-900 text-lg">{editing ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              <FF label="Nome completo"><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IC} /></FF>
              <div className="grid grid-cols-2 gap-4">
                <FF label="CPF"><input type="text" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className={IC} /></FF>
                <FF label="Telefone"><input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" className={IC} /></FF>
              </div>
              <FF label="E-mail"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={IC} /></FF>
              <FF label="Limite de crédito (R$)"><input type="number" value={form.creditLimit || ''} onChange={e => setForm(f => ({ ...f, creditLimit: parseFloat(e.target.value) || 0 }))} className={IC} /></FF>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, active: !f.active }))} className={`w-10 h-5.5 rounded-full transition-colors relative ${form.active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Cliente ativo</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">{editing ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-display font-700 text-gray-900 text-lg text-center mb-2">Excluir cliente?</h3>
            <p className="text-sm text-gray-500 text-center mb-6"><strong>{deleteTarget.name}</strong> será removido.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg">Excluir</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

const IC = 'w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>{children}</div>
}
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  )
}
