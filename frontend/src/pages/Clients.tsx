import { useEffect, useState } from 'react'
import { authHeaders } from '../auth'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

interface Client {
  id: string; name: string; cpf: string; phone: string; email: string; creditLimit: number; balance: number; active: boolean; purchaseCount: number; purchases: Purchase[]
}

interface Purchase { id: string; date: string; total: number; method: string; status: string }
type ClientForm = Omit<Client, 'id' | 'balance' | 'purchaseCount' | 'purchases'>
type ApiClient = {id:number; name:string; cpf:string; phone:string; email:string; credit_limit:string; debt_balance:string; active:boolean; purchase_count:number; purchases:Purchase[]}
type ApiPage = {results:ApiClient[]; count:number; next:string|null; previous:string|null}
const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
async function clientRequest(path:string, options?:RequestInit) {
  let response:Response
  try { response=await fetch(`${API_URL}/clientes/${path}`, {...options,headers:{'Content-Type':'application/json',...authHeaders(),...options?.headers}}) }
  catch { throw new Error('Não foi possível conectar à API de clientes.') }
  const data=await response.json().catch(()=>null)
  if (!response.ok) throw new Error(data ? Object.entries(data).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(' '):v}`).join(' — ') : 'Erro na API de clientes.')
  return response.status===204 ? null : data
}
const fromApi=(c:ApiClient):Client=>({id:String(c.id),name:c.name,cpf:c.cpf,phone:c.phone,email:c.email,creditLimit:Number(c.credit_limit),balance:Number(c.debt_balance),active:c.active,purchaseCount:c.purchase_count,purchases:c.purchases})
const emptyForm = (): ClientForm => ({ name: '', cpf: '', phone: '', email: '', creditLimit: 500, active: true })

export function Clients({ addToast }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [total, setTotal] = useState(0)
  const perPage = 8
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [viewing, setViewing] = useState<Client | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  useEffect(() => {
    let cancelled=false
    setLoading(true); setError('')
    const timer=setTimeout(async()=>{
      try { const data=await clientRequest(`?search=${encodeURIComponent(search)}&page=${page}&page_size=${perPage}`) as ApiPage
        if(!cancelled){setClients(data.results.map(fromApi));setTotal(data.count)}
      } catch(err){if(!cancelled)setError((err as Error).message)}
      finally{if(!cancelled)setLoading(false)}
    },200)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[search,page,refreshKey])
  const pages=Math.max(1,Math.ceil(total/perPage))
  const visibleFrom=total ? (page-1)*perPage+1 : 0
  const visibleTo=Math.min(page*perPage,total)
  const reload=()=>setRefreshKey(current=>current+1)
  const openView=async(c:Client)=>{
    setViewing(c);setViewLoading(true)
    try { const detail=fromApi(await clientRequest(`${c.id}/`) as ApiClient); setViewing(detail) }
    catch(err){addToast('error',(err as Error).message)}
    finally{setViewLoading(false)}
  }

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (c: Client) => { setEditing(c); setForm({ name: c.name, cpf: c.cpf, phone: c.phone, email: c.email, creditLimit: c.creditLimit, active: c.active }); setShowForm(true) }

  const handleSave = async () => {
    if (busy) return
    if (!form.name.trim() || !form.cpf.trim()) { addToast('error', 'Preencha nome e CPF.'); return }
    if (!Number.isFinite(form.creditLimit) || form.creditLimit < 0) { addToast('error','Informe um limite válido, igual ou superior a zero.'); return }
    setBusy(true)
    const payload={name:form.name.trim(),cpf:form.cpf.replace(/\D/g,''),phone:form.phone.trim(),email:form.email.trim(),credit_limit:form.creditLimit.toFixed(2),active:form.active}
    try {
      await clientRequest(editing?`${editing.id}/`:'',{method:editing?'PATCH':'POST',body:JSON.stringify(payload)})
      addToast('success',editing?'Cliente atualizado.':'Cliente cadastrado.')
      setShowForm(false);setPage(1);reload()
    } catch(err){addToast('error',(err as Error).message)}
    finally{setBusy(false)}
  }
  const handleDelete = async () => {
    if(!deleteTarget||busy)return
    setBusy(true)
    try{await clientRequest(`${deleteTarget.id}/`,{method:'DELETE'});setDeleteTarget(null);addToast('success','Cliente excluído.');setPage(1);reload()}
    catch(err){addToast('error',(err as Error).message)}finally{setBusy(false)}
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
            onChange={e => {setSearch(e.target.value);setPage(1)}}
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
            {loading ? <tr><td colSpan={7} className="text-center py-16 text-gray-400">Carregando clientes...</td></tr> : error ? <tr><td colSpan={7} role="alert" className="text-center py-16 text-red-600">{error} <button onClick={reload} className="underline">Tentar novamente</button></td></tr> : clients.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-gray-400 text-sm">Nenhum cliente encontrado.</td></tr>
            ) : clients.map(c => (
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
                <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{c.cpf.length===11 ? c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : c.cpf}</td>
                <td className="px-5 py-3.5 text-gray-600">{c.phone.length===11 ? c.phone.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3') : c.phone}</td>
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
                    <button onClick={() => openView(c)} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">Ver</button>
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
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500">
            {visibleFrom > 0 ? `${visibleFrom}–${visibleTo} de ` : ''}{total} clientes
          </span>
          <Pagination page={page} totalPages={pages} onChange={setPage} disabled={loading} />
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
                <p className="text-sm text-gray-500">{viewing.cpf.length===11 ? viewing.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : viewing.cpf} · {viewing.phone.length===11 ? viewing.phone.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3') : viewing.phone}</p>
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
                <p className="font-display font-700 text-lg text-gray-900">{viewing.purchaseCount}</p>
              </div>
            </div>
            <div className="p-6">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Histórico de compras</h4>
              <div className="space-y-2">
                {viewLoading ? <p className="text-sm text-gray-400">Carregando situação...</p> : viewing.purchases.length===0 ? <p className="text-sm text-gray-400">Nenhuma compra registrada para este cliente.</p> : viewing.purchases.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-sm font-medium text-blue-600">{h.id}</span>
                      <span className="text-xs text-gray-400 ml-2">{h.date}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">R$ {h.total.toFixed(2).replace('.',',')}</p>
                      <p className="text-xs text-gray-400">{h.method} · {h.status}</p>
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
        <ModalOverlay onClose={() => {if(!busy)setShowForm(false)}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-display font-700 text-gray-900 text-lg">{editing ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button disabled={busy} onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              <FF label="Nome completo"><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IC} /></FF>
              <div className="grid grid-cols-2 gap-4">
                <FF label="CPF"><input type="text" value={form.cpf} maxLength={14} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className={IC} /></FF>
                <FF label="Telefone"><input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" className={IC} /></FF>
              </div>
              <FF label="E-mail"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={IC} /></FF>
              <FF label="Limite de crédito (R$)"><input type="number" min="0" step="0.01" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: parseFloat(e.target.value) || 0 }))} className={IC} /></FF>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} className="accent-blue-600 w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Cliente ativo</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button disabled={busy} onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button disabled={busy} onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">{editing ? 'Salvar' : 'Cadastrar'}</button>
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
              <button disabled={busy} onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg">Excluir</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

const IC = 'w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
function Pagination({ page, totalPages, onChange, disabled = false }: { page: number; totalPages: number; onChange: (page: number) => void; disabled?: boolean }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(page - 1)} disabled={disabled || page === 1} className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">Anterior</button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map(item => (
        <button key={item} onClick={() => onChange(item)} disabled={disabled} aria-current={page === item ? 'page' : undefined} className={`w-8 h-8 rounded-lg text-xs font-semibold disabled:cursor-not-allowed ${page === item ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'}`}>{item}</button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={disabled || page === totalPages} className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">Próxima</button>
    </div>
  )
}

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
