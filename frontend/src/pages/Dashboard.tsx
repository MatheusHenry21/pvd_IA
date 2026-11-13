import { useEffect, useState } from 'react'
import type { Page } from '../App'
import { authHeaders } from '../auth'

interface Props {
  onNavigate: (page: Page) => void
}

type DashboardData = {
  sales_today: number
  revenue_today: string
  products: { count: number; low_stock_count: number }
  cash: { balance: string; opened_at: string; responsible: string } | null
  pending_sales: { count: number; amount: string }
  last_seven_days: { date: string; label: string; revenue: string; count: number; is_today: boolean }[]
  alerts: { type: 'warning' | 'info'; message: string; target: Page }[]
  recent_sales: {
    id: number
    created_at: string
    operator: string
    customer: string
    payment_method: string
    payment_label: string
    total: string
    status: string
  }[]
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')

function money(value: number | string) {
  const amount = Number(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="font-display font-700 text-2xl text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SalesBarChart({ data }: { data: DashboardData['last_seven_days'] }) {
  const max = Math.max(...data.map(day => Number(day.revenue)), 1)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-600 text-gray-900 text-base">Vendas — Últimos 7 dias</h3>
          <p className="text-xs text-gray-400 mt-0.5">Faturamento diário (R$)</p>
        </div>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Esta semana</span>
      </div>
      <div className="flex items-end gap-2 h-40">
        {data.map(day => {
          const revenue = Number(day.revenue) || 0
          const pct = revenue > 0 ? Math.max((revenue / max) * 100, 3) : 0
          return (
            <div key={day.date} title={`${day.count} venda(s) · ${money(revenue)}`} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium truncate max-w-full">
                {revenue >= 1000 ? `${(revenue / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : money(revenue)}
              </span>
              <div className="w-full flex items-end" style={{ height: '100px' }}>
                <div className={`w-full rounded-t-md transition-all ${day.is_today ? 'bg-blue-600' : 'bg-blue-100 hover:bg-blue-200'}`} style={{ height: `${pct}%` }} />
              </div>
              <span className={`text-xs font-medium ${day.is_today ? 'text-blue-600' : 'text-gray-500'}`}>{day.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">{status}</span>
}

export function Dashboard({ onNavigate }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`${API_URL}/dashboard/`, { headers: authHeaders(), signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Não foi possível carregar o dashboard.')
        return body as DashboardData
      })
      .then(setData)
      .catch(reason => {
        if (reason.name !== 'AbortError') {
          const message = reason instanceof Error ? reason.message : 'Não foi possível carregar o dashboard.'
          setError(message)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refreshKey])

  const cards = data ? [
    { label: 'Vendas do dia', value: String(data.sales_today), sub: 'Vendas registradas hoje', color: 'bg-blue-50', icon: <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { label: 'Faturamento', value: money(data.revenue_today), sub: 'Total vendido hoje', color: 'bg-emerald-50', icon: <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Produtos', value: data.products.count.toLocaleString('pt-BR'), sub: 'Produtos cadastrados', color: 'bg-violet-50', icon: <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { label: 'Estoque baixo', value: String(data.products.low_stock_count), sub: 'No mínimo de estoque ou abaixo', color: 'bg-amber-50', icon: <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
    { label: 'Caixa atual', value: data.cash ? money(data.cash.balance) : 'Fechado', sub: data.cash ? `Aberto por ${data.cash.responsible} às ${new Date(data.cash.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Nenhum caixa em operação', color: 'bg-sky-50', icon: <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { label: 'Vendas pendentes', value: String(data.pending_sales.count), sub: `${money(data.pending_sales.amount)} em parcelas do crediário`, color: 'bg-rose-50', icon: <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  ] : []

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {error && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setRefreshKey(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
      {loading && !data && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando dados do painel…</div>}
      {data && <>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {cards.map(card => <StatCard key={card.label} {...card} />)}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2"><SalesBarChart data={data.last_seven_days} /></div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-display font-600 text-gray-900 text-base mb-4">Alertas do sistema</h3>
            <div className="space-y-3">
              {data.alerts.length ? data.alerts.map((alert, index) => (
                <button key={`${alert.target}-${index}`} onClick={() => onNavigate(alert.target)} className={`w-full text-left flex gap-3 p-3 rounded-lg ${alert.type === 'warning' ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'}`}>
                  <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${alert.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={alert.type === 'warning' ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} /></svg>
                  <span className={`text-xs font-medium leading-snug ${alert.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>{alert.message}</span>
                </button>
              )) : <p className="rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800">Nenhum alerta no momento.</p>}
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <button onClick={() => onNavigate('caixa')} className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5">Ver status do caixa<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-display font-600 text-gray-900 text-base">Vendas recentes</h3>
            <button onClick={() => onNavigate('sales')} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">Nova venda →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                {['Nº Venda', 'Data e hora', 'Cliente', 'Funcionário', 'Pagamento', 'Valor', 'Status'].map((heading, index) => <th key={heading} className={`${index === 5 ? 'text-right' : 'text-left'} text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3`}>{heading}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {data.recent_sales.map(sale => <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-blue-600">#{sale.id}</td>
                  <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{formatDateTime(sale.created_at)}</td>
                  <td className="px-5 py-3.5 text-gray-700">{sale.customer}</td>
                  <td className="px-5 py-3.5 text-gray-700">{sale.operator}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sale.payment_label}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">{money(sale.total)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={sale.status} /></td>
                </tr>)}
                {!data.recent_sales.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-500">Nenhuma venda registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  )
}
