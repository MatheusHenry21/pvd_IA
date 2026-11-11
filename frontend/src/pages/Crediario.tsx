import { useEffect, useMemo, useState } from 'react'
import { authHeaders } from '../auth'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

type InstStatus = 'pendente' | 'pago' | 'vencido'
type StatusFilter = InstStatus | 'all'

interface Installment {
  id: number
  client: string
  client_cpf: string | null
  sale: string
  sale_id: number
  num: string
  number: number
  due_date: string
  value: string
  status: InstStatus
  payment_date: string | null
  payment_operator: string
  payment_observation: string
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
const STATUS_LABELS: Record<InstStatus, string> = { pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido' }
const STATUS_STYLES: Record<InstStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700 ring-amber-500/20',
  pago: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  vencido: 'bg-red-50 text-red-700 ring-red-600/20',
}

function localDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function money(value: number | string) {
  const amount = Number(value)
  return `R$ ${(Number.isFinite(amount) ? amount : 0).toFixed(2).replace('.', ',')}`
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new Error('Não foi possível conectar ao servidor.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.'
    throw new Error(detail)
  }
  return data as T
}

export function Crediario({ addToast }: Props) {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [payTarget, setPayTarget] = useState<Installment | null>(null)
  const [payObs, setPayObs] = useState('')
  const [paying, setPaying] = useState(false)
  const [detailTarget, setDetailTarget] = useState<Installment | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    fetch(`${API_URL}/vendas/parcelas/?status=all`, { headers: authHeaders(), signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Erro ao carregar as parcelas.')
        return data as { results: Installment[] }
      })
      .then(data => setInstallments(data.results))
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadError(error instanceof Error ? error.message : 'Erro ao carregar as parcelas.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refreshKey])

  const today = localDateISO(new Date())
  const nextWeek = localDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 6))
  const filtered = useMemo(() => installments.filter(item => {
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !query ||
      item.client.toLocaleLowerCase('pt-BR').includes(query) ||
      item.client_cpf?.includes(query) ||
      item.sale.toLocaleLowerCase().includes(query)
    return matchesStatus && matchesSearch
  }), [filterStatus, installments, search])

  const pending = installments.filter(item => item.status === 'pendente')
  const overdue = installments.filter(item => item.status === 'vencido')
  const totalOpen = pending.reduce((sum, item) => sum + Number(item.value), 0)
  const totalOverdue = overdue.reduce((sum, item) => sum + Number(item.value), 0)
  const dueToday = pending.filter(item => item.due_date === today).length
  const dueSoon = pending.filter(item => item.due_date >= today && item.due_date <= nextWeek).length

  const handlePay = async () => {
    if (!payTarget) return
    setPaying(true)
    try {
      await apiRequest<Installment>(`/vendas/parcelas/${payTarget.id}/pagar/`, {
        method: 'POST',
        body: JSON.stringify({ observation: payObs }),
      })
      addToast('success', `Parcela ${payTarget.num} de ${payTarget.client} registrada como paga.`)
      setPayTarget(null)
      setPayObs('')
      setRefreshKey(key => key + 1)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Não foi possível registrar o pagamento.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total em aberto', value: money(totalOpen), sub: `${pending.length} parcelas`, color: 'text-gray-900', bg: 'bg-white border-gray-200' },
          { label: 'Total vencido', value: money(totalOverdue), sub: `${overdue.length} parcelas`, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Vencem hoje', value: String(dueToday), sub: 'Parcelas do dia', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Próximos 7 dias', value: String(dueSoon), sub: 'Parcelas a vencer', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        ].map(card => <div key={card.label} className={`rounded-xl border p-5 ${card.bg}`}>
          <p className="mb-2 text-sm text-gray-500">{card.label}</p><p className={`font-display text-2xl font-700 ${card.color}`}>{card.value}</p><p className="mt-1 text-xs text-gray-400">{card.sub}</p>
        </div>)}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente, CPF ou venda..." className="w-64 rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'pendente', 'vencido', 'pago'] as const).map(status => <button key={status} onClick={() => setFilterStatus(status)} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filterStatus === status ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{status === 'all' ? 'Todas' : STATUS_LABELS[status]}</button>)}
          </div>
        </div>
        {loading ? <div className="p-16 text-center text-sm text-gray-500">Carregando parcelas do banco de dados...</div> :
          loadError ? <div className="p-16 text-center"><p className="mb-3 text-sm text-red-600">{loadError}</p><button onClick={() => setRefreshKey(key => key + 1)} className="text-sm font-semibold text-blue-600">Tentar novamente</button></div> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead><tr className="bg-gray-50">{['Cliente', 'Venda', 'Parcela', 'Vencimento', 'Valor', 'Status', 'Ações'].map(label => <th key={label} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-sm text-gray-400">Nenhuma parcela encontrada.</td></tr> :
                  filtered.map(item => <tr key={item.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{item.client}</td>
                    <td className="px-5 py-3.5 font-medium text-blue-600">{item.sale}</td>
                    <td className="px-5 py-3.5 text-gray-600">{item.num}</td>
                    <td className={`px-5 py-3.5 font-medium ${item.status === 'vencido' ? 'text-red-600' : 'text-gray-700'}`}>{formatDate(item.due_date)}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{money(item.value)}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span></td>
                    <td className="px-5 py-3.5">{item.status === 'pago' ?
                      <button onClick={() => setDetailTarget(item)} className="text-xs font-medium text-blue-600 hover:text-blue-800">Ver pagamento</button> :
                      <button onClick={() => setPayTarget(item)} className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800">Registrar pagamento</button>}
                    </td>
                  </tr>)
                }
              </tbody>
            </table>
          </div>
        }
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3"><span className="text-xs text-gray-500">{filtered.length} parcelas</span></div>
      </div>

      {detailTarget && <Modal title="Pagamento confirmado" onClose={() => setDetailTarget(null)}>
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-800">{detailTarget.client} · venda {detailTarget.sale}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Parcela', detailTarget.num], ['Vencimento', formatDate(detailTarget.due_date)],
              ['Valor', money(detailTarget.value)], ['Pago em', detailTarget.payment_date ? new Date(detailTarget.payment_date).toLocaleString('pt-BR') : '—'],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 text-sm font-semibold text-gray-800">{value}</p></div>)}
          </div>
          <div><p className="mb-1 text-xs font-medium text-gray-500">Recebido por</p><p className="text-sm text-gray-800">{detailTarget.payment_operator || '—'}</p></div>
          <div><p className="mb-1 text-xs font-medium text-gray-500">Observação do pagamento</p><p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">{detailTarget.payment_observation || 'Sem observações.'}</p></div>
        </div>
      </Modal>}

      {payTarget && <Modal title="Registrar pagamento" onClose={() => { if (!paying) setPayTarget(null) }}>
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl bg-gray-50 p-4">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Cliente</span><span className="font-medium text-gray-900">{payTarget.client}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Venda</span><span className="font-medium text-blue-600">{payTarget.sale}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Parcela</span><span className="font-medium text-gray-900">{payTarget.num}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Vencimento</span><span className="font-medium text-gray-900">{formatDate(payTarget.due_date)}</span></div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold"><span className="text-gray-500">Valor</span><span className="text-lg text-gray-900">{money(payTarget.value)}</span></div>
          </div>
          <div><label htmlFor="installment-payment-observation" className="mb-1.5 block text-sm font-medium text-gray-700">Observação</label><textarea id="installment-payment-observation" value={payObs} onChange={event => setPayObs(event.target.value)} rows={2} maxLength={5000} className="w-full resize-none rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional..." /></div>
          <div className="flex gap-3">
            <button disabled={paying} onClick={() => setPayTarget(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancelar</button>
            <button disabled={paying} onClick={handlePay} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{paying ? 'Registrando...' : 'Confirmar pagamento'}</button>
          </div>
        </div>
      </Modal>}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button aria-label="Fechar janela" className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-700 text-gray-900">{title}</h3><button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
      {children}
    </div>
  </div>
}
