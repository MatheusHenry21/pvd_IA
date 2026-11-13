import { useEffect, useState } from 'react'
import { authHeaders } from '../auth'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

type ReportType = 'sales' | 'products' | 'stock' | 'caixa' | 'crediario'
type SalesSummary = {
  revenue: string
  sales_count: number
  average_ticket: string
  cancellations: number
  payments: { method: string; label: string; revenue: string; count: number }[]
}
type DailySales = { date: string; label: string; revenue: string; count: number; is_today: boolean }
type SalesReportData = {
  ranges: { from: string; to: string; previous_from: string; previous_to: string }
  current: SalesSummary
  previous: SalesSummary
  daily: DailySales[]
}
type ProductReportRow = { position: number; product_id: number; name: string; code: string; quantity: number; revenue: string; sales_count: number; participation_pct: string }
type ProductReportData = { period: string; from: string; to: string; total_revenue: string; results: ProductReportRow[] }
type StockReportData = {
  registered_products: number
  active_products: number
  products_in_stock: number
  out_of_stock: number
  low_stock: number
  alerts: { id: number; name: string; category: string; stock: number; minimum_stock: number; status: string }[]
}
type CashReportData = {
  period: string
  from: string
  to: string
  summary: { initial_balance: string; entries: string; exits: string; difference: string; sessions_count: number }
  movements: { category: string; label: string; amount: string; count: number; percentage: string; color: string }[]
  recent_sessions: { id: number; date: string; operator: string; expected: string; counted: string | null; difference: string | null }[]
}
type CreditReportData = {
  period: string
  from: string
  to: string
  summary: {
    portfolio: { amount: string; installments: number }
    receivable: { amount: string; installments: number }
    overdue: { amount: string; installments: number }
    received: { amount: string; installments: number }
  }
  debtors: { client_id: number; name: string; open_amount: string; open_count: number; overdue_amount: string; overdue_count: number; oldest_due: string; delay_days: number; risk: 'Baixo' | 'Médio' | 'Alto' }[]
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
const payColors = ['bg-blue-500', 'bg-cyan-400', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500']

function money(value: number | string) {
  const amount = Number(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0)
}

function localDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return localDateISO(new Date(year, month - 1, day + days))
}

function formatDate(isoDate: string) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function deltaPresentation(current: number, previous: number, decreasesAreGood = false) {
  const change = pctChange(current, previous)
  if (change === null) return { text: 'Novo', tone: decreasesAreGood ? 'bad' : 'good' }
  const tone = change === 0 ? 'neutral' : (decreasesAreGood ? change < 0 : change > 0) ? 'good' : 'bad'
  return { text: `${change > 0 ? '+' : ''}${change.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, tone }
}

function MiniBarChart({ data }: { data: DailySales[] }) {
  const maxValue = Math.max(1, ...data.map(day => Number(day.revenue) || 0))
  return (
    <div className="flex h-52 min-w-[520px] items-end gap-3">
      {data.map(day => {
        const value = Number(day.revenue) || 0
        const height = value > 0 ? Math.max((value / maxValue) * 100, 4) : 0
        return (
          <div key={day.date} title={`${formatDate(day.date)} · ${money(value)} · ${day.count} vendas`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="max-w-full truncate text-[10px] font-medium text-gray-500">{day.count} v.</span>
            <span className="max-w-full truncate text-[10px] text-gray-400">{value >= 1000 ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : money(value)}</span>
            <div className="flex h-32 w-full items-end rounded-t-md bg-gray-50">
              <div className={`w-full rounded-t-md transition-all ${day.is_today ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${height}%` }} />
            </div>
            <span className={`text-[11px] font-medium ${day.is_today ? 'text-blue-600' : 'text-gray-500'}`}>{day.label}</span>
            <span className="text-[10px] text-gray-400">{formatDate(day.date)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Reports({ addToast }: Props) {
  const [activeReport, setActiveReport] = useState<ReportType>('sales')
  const [period, setPeriod] = useState('7d')
  const today = localDateISO(new Date())
  const [dateFrom, setDateFrom] = useState(() => shiftDate(localDateISO(new Date()), -6))
  const [dateTo, setDateTo] = useState(today)
  const [report, setReport] = useState<SalesReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportRetry, setReportRetry] = useState(0)
  const [productsReport, setProductsReport] = useState<ProductReportData | null>(null)
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productsRetry, setProductsRetry] = useState(0)
  const [stockReport, setStockReport] = useState<StockReportData | null>(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockRetry, setStockRetry] = useState(0)
  const [cashReport, setCashReport] = useState<CashReportData | null>(null)
  const [cashLoading, setCashLoading] = useState(false)
  const [cashError, setCashError] = useState('')
  const [cashRetry, setCashRetry] = useState(0)
  const [creditReport, setCreditReport] = useState<CreditReportData | null>(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const [creditError, setCreditError] = useState('')
  const [creditRetry, setCreditRetry] = useState(0)

  useEffect(() => {
    if (activeReport !== 'sales') return
    if (period === 'custom' && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setReport(null)
      setReportError('Escolha um intervalo válido, com início anterior ou igual ao fim.')
      setReportLoading(false)
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams({ period })
    if (period === 'custom') { params.set('from', dateFrom); params.set('to', dateTo) }
    setReportLoading(true)
    setReportError('')
    fetch(`${API_URL}/vendas/relatorio/?${params}`, { headers: authHeaders(), signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível carregar o relatório.')
        return data as SalesReportData
      })
      .then(data => { if (!controller.signal.aborted) setReport(data) })
      .catch(error => { if (!controller.signal.aborted) setReportError(error instanceof Error ? error.message : 'Erro ao carregar o relatório.') })
      .finally(() => { if (!controller.signal.aborted) setReportLoading(false) })
    return () => controller.abort()
  }, [activeReport, period, dateFrom, dateTo, reportRetry])


  useEffect(() => {
    if (activeReport !== 'products') return
    if (period === 'custom' && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setProductsReport(null)
      setProductsError('Escolha um intervalo válido, com início anterior ou igual ao fim.')
      setProductsLoading(false)
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams({ period })
    if (period === 'custom') { params.set('from', dateFrom); params.set('to', dateTo) }
    setProductsLoading(true)
    setProductsReport(null)
    setProductsError('')
    fetch(`${API_URL}/vendas/relatorio/produtos/?${params}`, { headers: authHeaders(), signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível carregar os produtos mais vendidos.')
        return data as ProductReportData
      })
      .then(data => { if (!controller.signal.aborted) setProductsReport(data) })
      .catch(error => { if (!controller.signal.aborted) setProductsError(error instanceof Error ? error.message : 'Erro ao carregar os produtos mais vendidos.') })
      .finally(() => { if (!controller.signal.aborted) setProductsLoading(false) })
    return () => controller.abort()
  }, [activeReport, period, dateFrom, dateTo, productsRetry])

  useEffect(() => {
    if (activeReport !== 'stock') return
    const controller = new AbortController()
    setStockLoading(true)
    setStockError('')
    fetch(`${API_URL}/produtos/estoque/`, { headers: authHeaders(), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível carregar o relatório de estoque.')
        return data as StockReportData
      })
      .then(data => { if (!controller.signal.aborted) setStockReport(data) })
      .catch(error => { if (!controller.signal.aborted) setStockError(error instanceof Error ? error.message : 'Erro ao carregar o estoque.') })
      .finally(() => { if (!controller.signal.aborted) setStockLoading(false) })
    return () => controller.abort()
  }, [activeReport, stockRetry])

  useEffect(() => {
    if (activeReport !== 'caixa') return
    if (period === 'custom' && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setCashReport(null)
      setCashError('Escolha um intervalo válido, com início anterior ou igual ao fim.')
      setCashLoading(false)
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams({ period })
    if (period === 'custom') { params.set('from', dateFrom); params.set('to', dateTo) }
    setCashLoading(true)
    setCashError('')
    fetch(`${API_URL}/caixa/relatorio/?${params}`, { headers: authHeaders(), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível carregar o relatório de caixa.')
        return data as CashReportData
      })
      .then(data => { if (!controller.signal.aborted) setCashReport(data) })
      .catch(error => { if (!controller.signal.aborted) setCashError(error instanceof Error ? error.message : 'Erro ao carregar o relatório de caixa.') })
      .finally(() => { if (!controller.signal.aborted) setCashLoading(false) })
    return () => controller.abort()
  }, [activeReport, period, dateFrom, dateTo, cashRetry])

  useEffect(() => {
    if (activeReport !== 'crediario') return
    if (period === 'custom' && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setCreditReport(null)
      setCreditError('Escolha um intervalo válido, com início anterior ou igual ao fim.')
      setCreditLoading(false)
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams({ period })
    if (period === 'custom') { params.set('from', dateFrom); params.set('to', dateTo) }
    setCreditLoading(true)
    setCreditError('')
    fetch(`${API_URL}/vendas/relatorio/crediario/?${params}`, { headers: authHeaders(), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível carregar o relatório de crediário.')
        return data as CreditReportData
      })
      .then(data => { if (!controller.signal.aborted) setCreditReport(data) })
      .catch(error => { if (!controller.signal.aborted) setCreditError(error instanceof Error ? error.message : 'Erro ao carregar o crediário.') })
      .finally(() => { if (!controller.signal.aborted) setCreditLoading(false) })
    return () => controller.abort()
  }, [activeReport, period, dateFrom, dateTo, creditRetry])

  const current = report?.current
  const previous = report?.previous
  const rangeText = report ? `${formatDate(report.ranges.from)} a ${formatDate(report.ranges.to)}` : ''
  const previousRangeText = report ? `${formatDate(report.ranges.previous_from)} a ${formatDate(report.ranges.previous_to)}` : ''

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-6">
      <div className="flex w-fit items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-1.5">
        {([
          { id: 'sales', label: 'Vendas' },
          { id: 'products', label: 'Produtos' },
          { id: 'stock', label: 'Estoque' },
          { id: 'caixa', label: 'Caixa' },
          { id: 'crediario', label: 'Crediário' },
        ] as { id: ReportType; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveReport(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeReport === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filters apply only to historical sales and product performance reports. */}
      {activeReport !== 'stock' && <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {[
            { id: '7d', label: 'Últimos 7 dias' },
            { id: '30d', label: '30 dias' },
            { id: '90d', label: '90 dias' },
            { id: 'custom', label: 'Personalizado' },
          ].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${period === p.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input aria-label="Data inicial do relatório" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 text-sm">até</span>
            <input aria-label="Data final do relatório" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <button onClick={() => addToast('info', 'Exportando relatório...')} className="ml-auto flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Exportar
        </button>
      </div>}

      {activeReport === 'sales' && (
        <div className="space-y-4">
          {reportError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{reportError}</span><button onClick={() => setReportRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
          {reportLoading && <p role="status" className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando dados reais de vendas...</p>}
          {!reportLoading && report && current && previous && (
            <>
              <p className="text-xs text-gray-500">Período: <strong>{rangeText}</strong> · Comparação de igual duração: <strong>{previousRangeText}</strong></p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Faturamento total', value: money(current.revenue), now: Number(current.revenue), before: Number(previous.revenue), inverse: false, sub: 'Vendas registradas no período' },
                  { label: 'Total de vendas', value: String(current.sales_count), now: current.sales_count, before: previous.sales_count, inverse: false, sub: 'Vendas concluídas' },
                  { label: 'Ticket médio', value: money(current.average_ticket), now: Number(current.average_ticket), before: Number(previous.average_ticket), inverse: false, sub: 'Faturamento ÷ vendas' },
                  { label: 'Cancelamentos', value: String(current.cancellations), now: current.cancellations, before: previous.cancellations, inverse: true, sub: 'Carrinhos descartados no PDV' },
                ].map(metric => {
                  const delta = deltaPresentation(metric.now, metric.before, metric.inverse)
                  const badge = delta.tone === 'good' ? 'bg-emerald-50 text-emerald-700' : delta.tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                  return <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-5"><p className="mb-2 text-sm text-gray-500">{metric.label}</p><div className="flex items-end justify-between gap-2"><p className="font-display text-2xl font-700 text-gray-900">{metric.value}</p><span title="Variação em relação ao período anterior de mesma duração" className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>{delta.text}</span></div><p className="mt-1 text-xs text-gray-400">{metric.sub} · vs. período anterior</p></div>
                })}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-4"><h3 className="font-display text-base font-600 text-gray-900">Faturamento diário — últimos 7 dias</h3><p className="mt-1 text-xs text-gray-400">O número acima de cada barra indica quantas vendas foram feitas no dia.</p></div>
                  <div className="overflow-x-auto"><MiniBarChart data={report.daily} /></div>
                  <div className="mt-5 space-y-2">
                    {report.daily.map(day => <div key={day.date} className="flex items-center justify-between gap-3 text-sm"><span className="w-16 text-gray-500">{formatDate(day.date)}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, Number(day.revenue) / Math.max(1, ...report.daily.map(item => Number(item.revenue))) * 100))}%` }} /></div><span className="w-24 text-right font-medium text-gray-900">{money(day.revenue)}</span><span className="w-12 text-right text-xs text-gray-400">{day.count} v.</span></div>)}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-4"><h3 className="font-display text-base font-600 text-gray-900">Formas de pagamento</h3><p className="mt-1 text-xs text-gray-400">Valores e quantidade de vendas no período selecionado.</p></div>
                  {current.sales_count === 0 ? <p className="py-8 text-center text-sm text-gray-400">Nenhuma venda neste período.</p> : <div className="space-y-4">{current.payments.map((payment, index) => {
                    const amount = Number(payment.revenue) || 0
                    const share = Number(current.revenue) > 0 ? amount / Number(current.revenue) * 100 : 0
                    const isTop = index === 0 && amount > 0
                    return <div key={payment.method}>
                      <div className="mb-1.5 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${payColors[index % payColors.length]}`} /><span className="text-sm text-gray-700">{payment.label}</span>{isTop && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Mais movimentado</span>}</div><div className="text-right"><span className="text-sm font-semibold text-gray-900">{money(payment.revenue)}</span><span className="ml-2 text-xs text-gray-400">{share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div></div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${payColors[index % payColors.length]}`} style={{ width: `${Math.min(100, share)}%` }} /></div>
                      <p className="mt-1 text-right text-xs text-gray-400">{payment.count} {payment.count === 1 ? 'venda' : 'vendas'}</p>
                    </div>
                  })}</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {activeReport === 'products' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-display font-600 text-gray-900 text-base">Produtos mais vendidos</h3>
          </div>
          {productsError && <div role="alert" className="m-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{productsError}</span><button onClick={() => setProductsRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
          {productsLoading && <p role="status" className="p-8 text-center text-sm text-gray-500">Carregando produtos vendidos...</p>}
          {!productsLoading && !productsError && productsReport?.results.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Nenhuma venda encontrada neste período.</p>}
          {!productsLoading && productsReport && productsReport.results.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">#</th>
                  {['Produto', 'Qtd. vendida', 'Faturamento', 'Participação'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {productsReport.results.map(product => {
                  const participation = Number(product.participation_pct) || 0
                  return (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{product.position}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{product.name}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{product.quantity}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{money(product.revenue)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden w-24">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, participation))}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{participation.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeReport === 'stock' && (
        <div className="space-y-4">
          {stockError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{stockError}</span><button onClick={() => setStockRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
          {stockLoading && <p role="status" className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando estoque atual...</p>}
          {!stockLoading && !stockError && stockReport && <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Produtos em estoque', value: stockReport.products_in_stock.toLocaleString('pt-BR'), sub: `${stockReport.active_products.toLocaleString('pt-BR')} ativos · ${stockReport.registered_products.toLocaleString('pt-BR')} cadastrados` },
              { label: 'Sem estoque', value: stockReport.out_of_stock.toLocaleString('pt-BR'), sub: 'Produtos ativos sem unidades' },
              { label: 'Estoque baixo', value: stockReport.low_stock.toLocaleString('pt-BR'), sub: 'Acima de zero e no mínimo ou abaixo' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-500 mb-2">{s.label}</p>
                <p className="font-display font-700 text-2xl text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-display font-600 text-gray-900 text-base">Alertas de estoque</h3>
              <span className="bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">{stockReport.alerts.length} alertas</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Produto', 'Categoria', 'Em estoque', 'Mínimo', 'Situação'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stockReport.alerts.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{s.name}</td>
                    <td className="px-5 py-3.5"><span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">{s.category}</span></td>
                    <td className={`px-5 py-3.5 font-semibold ${s.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>{s.stock}</td>
                    <td className="px-5 py-3.5 text-gray-500">{s.minimum_stock}</td>
                    <td className="px-5 py-3.5">
                      <span className={`${s.stock === 0 ? 'bg-red-50 text-red-700 ring-red-500/20' : 'bg-amber-50 text-amber-700 ring-amber-500/20'} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
                {stockReport.alerts.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500">Nenhum produto atingiu o estoque mínimo.</td></tr>}
              </tbody>
            </table>
          </div>
          </>}
        </div>
      )}

      {activeReport === 'caixa' && (
        <div className="space-y-4">
          {cashError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{cashError}</span><button onClick={() => setCashRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
          {cashLoading && <p role="status" className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando dados dos caixas...</p>}
          {!cashLoading && !cashError && cashReport && <>
            <p className="text-xs text-gray-500">Fechamentos no período: <strong>{formatDate(cashReport.from)} a {formatDate(cashReport.to)}</strong> · {cashReport.summary.sessions_count} sessão(ões)</p>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                { label: 'Saldo inicial', value: money(cashReport.summary.initial_balance), sub: 'Soma dos valores de abertura', color: 'text-gray-900' },
                { label: 'Entradas', value: money(cashReport.summary.entries), sub: 'Vendas e suprimentos', color: 'text-emerald-600' },
                { label: 'Saídas', value: money(cashReport.summary.exits), sub: 'Sangrias', color: 'text-red-600' },
                { label: 'Diferença', value: money(cashReport.summary.difference), sub: 'Contado menos esperado', color: Number(cashReport.summary.difference) === 0 ? 'text-gray-900' : 'text-amber-600' },
              ].map(metric => <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">{metric.label}</p><p className={`mt-2 font-display text-2xl font-700 ${metric.color}`}>{metric.value}</p><p className="mt-1 text-xs text-gray-400">{metric.sub}</p></div>)}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 p-5"><h3 className="font-display font-600 text-gray-900">3 caixas fechados mais recentes</h3><p className="mt-1 text-xs text-gray-400">Dentro do período selecionado</p></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Data', 'Operador de fechamento', 'Valor esperado', 'Valor contado', 'Diferença'].map(heading => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {cashReport.recent_sessions.map(session => <tr key={session.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">{new Date(session.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-3.5 font-medium text-gray-900">{session.operator}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-gray-700">{money(session.expected)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-gray-700">{session.counted === null ? '—' : money(session.counted)}</td>
                      <td className={`whitespace-nowrap px-4 py-3.5 font-semibold ${session.difference && Number(session.difference) !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>{session.difference === null ? '—' : money(session.difference)}</td>
                    </tr>)}
                    {!cashReport.recent_sessions.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500">Nenhum caixa fechado neste período.</td></tr>}
                  </tbody>
                </table></div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-1 font-display font-600 text-gray-900">Porcentagem das movimentações</h3>
                <p className="mb-6 text-xs text-gray-400">Participação pelo valor total movimentado</p>
                <div className="space-y-5">
                  {cashReport.movements.map(movement => {
                    const percentage = Number(movement.percentage) || 0
                    const color = movement.color === 'blue' ? 'bg-blue-500' : movement.color === 'emerald' ? 'bg-emerald-500' : 'bg-red-500'
                    return <div key={movement.category}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm"><div><span className="font-medium text-gray-700">{movement.label}</span><span className="ml-2 text-xs text-gray-400">{movement.count} movimentação(ões)</span></div><span className="font-semibold text-gray-900">{percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div>
                      <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} /></div>
                      <p className="text-right text-xs text-gray-500">{money(movement.amount)}</p>
                    </div>
                  })}
                </div>
              </div>
            </div>
          </>}
        </div>
      )}

      {activeReport === 'crediario' && (
        <div className="space-y-4">
          {creditError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{creditError}</span><button onClick={() => setCreditRetry(value => value + 1)} className="font-semibold underline">Tentar novamente</button></div>}
          {creditLoading && <p role="status" className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando dados do crediário...</p>}
          {!creditLoading && !creditError && creditReport && <>
            <p className="text-xs text-gray-500">Carteira originada entre <strong>{formatDate(creditReport.from)} e {formatDate(creditReport.to)}</strong>. A lista de inadimplentes mostra a posição atual.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Carteira total', key: 'portfolio' as const, color: 'text-gray-900', sub: 'Parcelas geradas pelas vendas no período' },
                { label: 'A receber', key: 'receivable' as const, color: 'text-blue-600', sub: 'Parcelas em aberto, incluindo vencidas' },
                { label: 'Vencido', key: 'overdue' as const, color: 'text-red-600', sub: 'Parcelas em aberto após o vencimento' },
                { label: 'Recebido', key: 'received' as const, color: 'text-emerald-600', sub: 'Parcelas quitadas desta carteira' },
              ].map(metric => {
                const value = creditReport.summary[metric.key]
                return <div key={metric.key} className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">{metric.label}</p><p className={`mt-2 font-display text-2xl font-700 ${metric.color}`}>{money(value.amount)}</p><p className="mt-1 text-xs text-gray-400">{value.installments} {value.installments === 1 ? 'parcela' : 'parcelas'} · {metric.sub}</p></div>
              })}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-5"><h3 className="font-display font-600 text-gray-900">Clientes inadimplentes</h3><p className="mt-1 text-xs text-gray-400">Os 3 atrasos mais antigos · posição atual</p></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Cliente', 'Em aberto', 'Vencidos', 'Atraso', 'Risco'].map(heading => <th key={heading} className="whitespace-nowrap px-5 py-3 text-left">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {creditReport.debtors.map(debtor => <tr key={debtor.client_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-900">{debtor.name}</td>
                    <td className="whitespace-nowrap px-5 py-3.5"><span className="font-semibold text-gray-900">{money(debtor.open_amount)}</span><span className="ml-2 text-xs text-gray-400">{debtor.open_count} parc.</span></td>
                    <td className="whitespace-nowrap px-5 py-3.5"><span className="font-semibold text-red-600">{money(debtor.overdue_amount)}</span><span className="ml-2 text-xs text-gray-400">{debtor.overdue_count} parc.</span></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-gray-600">{debtor.delay_days} {debtor.delay_days === 1 ? 'dia' : 'dias'}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${debtor.risk === 'Alto' ? 'bg-red-50 text-red-700' : debtor.risk === 'Médio' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{debtor.risk}</span></td>
                  </tr>)}
                  {!creditReport.debtors.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500">Nenhum cliente inadimplente no momento.</td></tr>}
                </tbody>
              </table></div>
            </div>
          </>}
        </div>
      )}
    </div>
  )
}
