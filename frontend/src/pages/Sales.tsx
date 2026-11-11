import { useEffect, useMemo, useRef, useState } from 'react'
import { authHeaders } from '../auth'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

interface Product {
  id: number
  code: string
  name: string
  price: string
  stock: number
}

interface Client {
  id: number
  name: string
  cpf: string
  active: boolean
}

interface SaleItem {
  productId: number
  code: string
  name: string
  qty: number
  price: number
  stock: number
}

type PayMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'crediario'

interface SaleRecord {
  id: number
  created_at: string
  client: string
  payment_method: PayMethod
  subtotal: string
  discount: string
  total: string
  operator: string
  observation: string
  cash_received: string | null
  change: string
  items: { product_name: string; product_code: string; quantity: number; unit_price: string; line_total: string }[]
  installments: { number: number; due_date: string; value: string }[]
}

interface ApiList<T> { results: T[] }
interface InstallmentPreview { number: number; dueDate: string; value: number }

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
const paymentLabels: Record<PayMethod, string> = {
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  crediario: 'Crediário',
}

async function request<T>(path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal,
      headers: {
        ...authHeaders(),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Não foi possível conectar ao servidor.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.'
    throw new Error(detail)
  }
  return data as T
}

function money(value: number | string) {
  const amount = typeof value === 'number' ? value : Number(value)
  return `R$ ${(Number.isFinite(amount) ? amount : 0).toFixed(2).replace('.', ',')}`
}

function parseMoney(value: string) {
  const trimmed = value.trim().replace(/\s/g, '')
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function localDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addCalendarMonth(dateISO: string, monthOffset: number) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const monthIndex = month - 1 + monthOffset
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  return localDateISO(new Date(targetYear, targetMonth, Math.min(day, lastDay)))
}

function formatDateISO(dateISO: string) {
  const [year, month, day] = dateISO.split('-')
  return `${day}/${month}/${year}`
}

function makeInstallmentPreview(total: number, count: number, firstDueDate: string): InstallmentPreview[] {
  if (!firstDueDate || count < 1) return []
  const totalCents = Math.round(total * 100)
  const regularCents = Math.floor(totalCents / count)
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: addCalendarMonth(firstDueDate, index),
    value: (index === count - 1 ? totalCents - regularCents * (count - 1) : regularCents) / 100,
  }))
}

export function Sales({ addToast }: Props) {
  const toastRef = useRef(addToast)
  toastRef.current = addToast
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [items, setItems] = useState<SaleItem[]>([])
  const [discount, setDiscount] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)
  const [installmentCount, setInstallmentCount] = useState('1')
  const [firstDueDate, setFirstDueDate] = useState(() => addCalendarMonth(localDateISO(new Date()), 1))
  const [cashGiven, setCashGiven] = useState('')
  const [obs, setObs] = useState('')
  const [saleFinished, setSaleFinished] = useState(false)
  const [savedSale, setSavedSale] = useState<SaleRecord | null>(null)
  const [savingSale, setSavingSale] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientMatches, setClientMatches] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<SaleRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [expandedSale, setExpandedSale] = useState<number | null>(null)

  useEffect(() => {
    const query = search.trim()
    if (!query) {
      setProducts([])
      setProductsLoading(false)
      return
    }
    setProducts([])
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setProductsLoading(true)
      try {
        const data = await request<ApiList<Product>>(`/vendas/produtos/?search=${encodeURIComponent(query)}`, {}, controller.signal)
        setProducts(data.results)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          toastRef.current('error', error instanceof Error ? error.message : 'Erro ao buscar produtos.')
          setProducts([])
        }
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false)
      }
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  useEffect(() => {
    if (!showClientModal || !clientSearch.trim()) {
      setClientMatches([])
      setClientsLoading(false)
      return
    }
    setClientMatches([])
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setClientsLoading(true)
      try {
        const params = new URLSearchParams({ search: clientSearch.trim(), page_size: '5', active: 'true' })
        const data = await request<ApiList<Client>>(`/clientes/?${params}`, {}, controller.signal)
        setClientMatches(data.results.slice(0, 5))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          toastRef.current('error', error instanceof Error ? error.message : 'Erro ao buscar clientes.')
          setClientMatches([])
        }
      } finally {
        if (!controller.signal.aborted) setClientsLoading(false)
      }
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [showClientModal, clientSearch])

  useEffect(() => {
    if (!showHistory) return
    const controller = new AbortController()
    setHistoryLoading(true)
    setHistoryError('')
    request<ApiList<SaleRecord>>('/vendas/', {}, controller.signal)
      .then(data => setHistory(data.results.slice(0, 10)))
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setHistoryError(error instanceof Error ? error.message : 'Erro ao carregar o histórico.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false) })
    return () => controller.abort()
  }, [showHistory, historyRefresh])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items])
  const discountValue = parseMoney(discount)
  const total = Math.max(0, subtotal - discountValue)
  const cashAmount = parseMoney(cashGiven)
  const change = payMethod === 'dinheiro' ? cashAmount - total : 0
  const installmentPreview = payMethod === 'crediario'
    ? makeInstallmentPreview(total, Number(installmentCount), firstDueDate)
    : []

  const addItem = (product: Product) => {
    if (product.stock < 1) {
      addToast('warning', 'Este produto está sem estoque.')
      return
    }
    setItems(current => {
      const existing = current.find(item => item.productId === product.id)
      if (existing) {
        if (existing.qty >= product.stock) {
          addToast('warning', 'A quantidade solicitada ultrapassa o estoque disponível.')
          return current
        }
        return current.map(item => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item)
      }
      return [...current, {
        productId: product.id, code: product.code, name: product.name,
        qty: 1, price: Number(product.price), stock: product.stock,
      }]
    })
    setSearch('')
    setProducts([])
  }

  const updateQty = (productId: number, delta: number) => {
    setItems(current => current.map(item => {
      if (item.productId !== productId) return item
      const next = item.qty + delta
      if (next > item.stock) {
        addToast('warning', 'A quantidade solicitada ultrapassa o estoque disponível.')
        return item
      }
      return { ...item, qty: Math.max(1, next) }
    }))
  }

  const resetSale = () => {
    setItems([])
    setDiscount('')
    setPayMethod(null)
    setInstallmentCount('1')
    setFirstDueDate(addCalendarMonth(localDateISO(new Date()), 1))
    setCashGiven('')
    setObs('')
    setSaleFinished(false)
    setSavedSale(null)
    setSelectedClient(null)
  }

  const handleFinish = async () => {
    if (items.length === 0) { addToast('error', 'Adicione produtos à venda.'); return }
    if (!payMethod) { addToast('error', 'Selecione a forma de pagamento.'); return }
    if (discountValue > subtotal) { addToast('error', 'O desconto não pode ser maior que o subtotal.'); return }
    if (payMethod === 'dinheiro' && cashAmount < total) { addToast('error', 'O valor recebido deve ser igual ou maior que o total.'); return }
    if (payMethod === 'crediario' && !selectedClient) { addToast('error', 'Selecione um cliente para vender no crediário.'); return }
    if (payMethod === 'crediario' && (!firstDueDate || firstDueDate < localDateISO(new Date()))) { addToast('error', 'Informe um primeiro vencimento válido, a partir de hoje.'); return }

    setSavingSale(true)
    try {
      const sale = await request<SaleRecord>('/vendas/', {
        method: 'POST',
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          items: items.map(item => ({ product_id: item.productId, quantity: item.qty })),
          discount: discountValue.toFixed(2),
          payment_method: payMethod,
          cash_received: payMethod === 'dinheiro' ? cashAmount.toFixed(2) : null,
          client_id: selectedClient?.id ?? null,
          ...(payMethod === 'crediario' ? {
            installment_count: Number(installmentCount),
            first_due_date: firstDueDate,
          } : {}),
          observation: obs,
        }),
      })
      setSavedSale(sale)
      setSaleFinished(true)
      addToast('success', `Venda #${sale.id} finalizada com sucesso!`)
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Não foi possível registrar a venda.')
    } finally {
      setSavingSale(false)
    }
  }

  if (showHistory) {
    return (
      <div className="mx-auto max-w-screen-xl space-y-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-700 text-gray-900">Histórico de vendas</h2>
            <p className="mt-1 text-sm text-gray-500">Exibindo as 10 vendas mais recentes.</p>
          </div>
          <button onClick={() => setShowHistory(false)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Voltar ao PDV</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {historyLoading ? <p className="p-8 text-center text-sm text-gray-500">Carregando vendas...</p> :
            historyError ? <div className="p-8 text-center"><p className="mb-3 text-sm text-red-600">{historyError}</p><button onClick={() => setHistoryRefresh(version => version + 1)} className="text-sm font-semibold text-blue-600">Tentar novamente</button></div> :
            history.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">Nenhuma venda registrada.</p> :
            <div className="overflow-x-auto">
              <div className="min-w-[850px]">
                <div className="grid grid-cols-[100px_1.3fr_1.4fr_1.2fr_120px_90px] gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase text-gray-500">
                  <span>Venda</span><span>Data e hora</span><span>Cliente</span><span>Pagamento</span><span>Total</span><span></span>
                </div>
                {history.map(sale => (
                  <div key={sale.id} className="border-t border-gray-100">
                    <div className="grid grid-cols-[100px_1.3fr_1.4fr_1.2fr_120px_90px] items-center gap-4 px-5 py-4 text-sm">
                      <span className="font-semibold text-blue-600">#{sale.id}</span>
                      <span className="text-gray-600">{new Date(sale.created_at).toLocaleString('pt-BR')}</span>
                      <span className="font-medium text-gray-800">{sale.client || 'Consumidor final'}</span>
                      <span className="text-gray-600">{paymentLabels[sale.payment_method]}</span>
                      <span className="font-semibold text-gray-900">{money(sale.total)}</span>
                      <button onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)} className="text-xs font-semibold text-blue-600">{expandedSale === sale.id ? 'Fechar' : 'Detalhes'}</button>
                    </div>
                    {expandedSale === sale.id && (
                      <div className="grid gap-5 border-t border-gray-100 bg-gray-50 px-5 py-4 md:grid-cols-3">
                        <div><p className="mb-1 text-xs text-gray-400">Operador</p><p className="text-sm font-medium text-gray-800">{sale.operator}</p></div>
                        <div className="md:col-span-2"><p className="mb-1 text-xs text-gray-400">Observação</p><p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{sale.observation || 'Sem observações.'}</p></div>
                        <div className="md:col-span-3">
                          <p className="mb-2 text-xs text-gray-400">Itens da venda</p>
                          <div className="space-y-1">{sale.items.map((item, index) => <p key={index} className="text-sm text-gray-700">{item.quantity} × {item.product_name} — {money(item.line_total)}</p>)}</div>
                        </div>
                        {sale.payment_method === 'dinheiro' && <div className="text-sm text-gray-700">Recebido {money(sale.cash_received || 0)} · Troco {money(sale.change)}</div>}
                        {sale.installments.length > 0 && <div className="md:col-span-3"><p className="mb-2 text-xs text-gray-400">Parcelas do crediário</p><div className="flex flex-wrap gap-2">{sale.installments.map(part => <span key={part.number} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">{part.number}/{sale.installments.length} · {formatDateISO(part.due_date)} · {money(part.value)}</span>)}</div></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          }
        </div>
      </div>
    )
  }

  if (saleFinished && savedSale) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="mb-1 font-display text-2xl font-700 text-gray-900">Venda finalizada!</h2>
          <p className="mb-6 text-sm text-gray-500">Venda #{savedSale.id} registrada no banco de dados.</p>
          <div className="mb-6 space-y-2 rounded-xl bg-gray-50 p-4 text-left">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{money(savedSale.subtotal || subtotal)}</span></div>
            {Number(savedSale.discount) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Desconto</span><span className="text-red-600">− {money(savedSale.discount)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold"><span>Total</span><span>{money(savedSale.total)}</span></div>
            {savedSale.payment_method === 'dinheiro' && <div className="flex justify-between text-sm"><span className="text-gray-500">Troco</span><span className="font-medium text-emerald-600">{money(savedSale.change)}</span></div>}
          </div>
          {savedSale.installments.length > 0 && <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-left"><p className="mb-2 text-sm font-semibold text-amber-900">Parcelas do crediário</p><div className="space-y-1">{savedSale.installments.map(part => <p key={part.number} className="flex justify-between gap-3 text-xs text-amber-800"><span>{part.number}/{savedSale.installments.length} · vencimento {formatDateISO(part.due_date)}</span><strong>{money(part.value)}</strong></p>)}</div></div>}
          {savedSale.observation && <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-left text-sm text-gray-700">{savedSale.observation}</p>}
          <div className="flex gap-3">
            <button onClick={resetSale} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Nova venda</button>
            <button onClick={() => setShowHistory(true)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Histórico</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">
      <div className="flex min-w-0 flex-1 flex-col border-r border-gray-200">
        <div className="flex gap-3 border-b border-gray-200 bg-white p-4">
          <div className="relative min-w-0 flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto por código ou nome..." className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            {search.trim() && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                {productsLoading ? <p className="px-4 py-3 text-sm text-gray-500">Buscando no banco de dados...</p> :
                  products.map(product => (
                    <button key={product.id} onClick={() => addItem(product)} className="flex w-full items-center justify-between border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50">
                      <span><span className="mr-2 text-xs text-gray-400">{product.code}</span><span className="text-sm font-medium text-gray-900">{product.name}</span><span className="ml-2 text-xs text-gray-400">Estoque: {product.stock}</span></span>
                      <span className="whitespace-nowrap text-sm font-semibold text-blue-600">{money(product.price)}</span>
                    </button>
                  ))
                }
                {!productsLoading && products.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">Nenhum produto encontrado.</p>}
              </div>
            )}
          </div>
          <button onClick={() => setShowHistory(true)} className="rounded-lg border border-gray-300 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Histórico</button>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-2.5">
          {selectedClient ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm">
              <span className="font-medium text-blue-700">{selectedClient.name}</span>
              <button aria-label="Remover cliente" onClick={() => setSelectedClient(null)} className="text-blue-400 hover:text-blue-600">×</button>
            </div>
          ) : (
            <button onClick={() => setShowClientModal(true)} className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600">＋ Adicionar cliente</button>
          )}
          <div className="ml-auto">
            <button onClick={() => setShowCancelConfirm(true)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-400 hover:text-red-700">Cancelar venda</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100"><svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" /></svg></div>
            <p className="text-sm font-medium text-gray-400">Nenhum produto adicionado</p><p className="mt-1 text-xs text-gray-300">Use o campo acima para buscar produtos</p>
          </div> : <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-12 bg-gray-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400"><span className="col-span-1">Cód.</span><span className="col-span-4">Produto</span><span className="col-span-2 text-center">Qtd.</span><span className="col-span-2 text-right">Preço</span><span className="col-span-2 text-right">Subtotal</span><span className="col-span-1" /></div>
            {items.map(item => <div key={item.productId} className="grid grid-cols-12 items-center px-5 py-3.5 transition-colors hover:bg-gray-50">
              <span className="col-span-1 text-xs text-gray-400">{item.code}</span><span className="col-span-4 text-sm font-medium text-gray-900">{item.name}</span>
              <div className="col-span-2 flex items-center justify-center gap-2"><button onClick={() => updateQty(item.productId, -1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200">−</button><span className="w-6 text-center text-sm font-semibold text-gray-900">{item.qty}</span><button onClick={() => updateQty(item.productId, 1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200">+</button></div>
              <span className="col-span-2 text-right text-sm text-gray-600">{money(item.price)}</span><span className="col-span-2 text-right text-sm font-semibold text-gray-900">{money(item.price * item.qty)}</span>
              <div className="col-span-1 flex justify-end"><button aria-label={`Remover ${item.name}`} onClick={() => setItems(current => current.filter(row => row.productId !== item.productId))} className="p-1 text-gray-300 transition-colors hover:text-red-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>
            </div>)}
          </div>}
        </div>

      </div>

      <div className="flex w-80 flex-col bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium text-gray-900">{money(subtotal)}</span></div>
            <div className="flex items-center justify-between"><label htmlFor="sale-discount" className="text-sm text-gray-500">Desconto (R$)</label><input id="sale-discount" type="text" inputMode="decimal" value={discount} onChange={event => setDiscount(event.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00" className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-base font-semibold"><span className="text-gray-900">Total</span><span className="font-display text-xl font-700 text-gray-900">{money(total)}</span></div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'dinheiro', label: 'Dinheiro', icon: '💵' }, { id: 'pix', label: 'PIX', icon: '📱' },
                { id: 'debito', label: 'Cartão de débito', icon: '💳' }, { id: 'credito', label: 'Cartão de crédito', icon: '💳' },
                { id: 'crediario', label: 'Crediário', icon: '📋' },
              ] as { id: PayMethod; label: string; icon: string }[]).map(method => <button key={method.id} onClick={() => setPayMethod(method.id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${payMethod === method.id ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'} ${method.id === 'crediario' ? 'col-span-2' : ''}`}><span>{method.icon}</span>{method.label}</button>)}
            </div>
          </div>

          {payMethod === 'crediario' && <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
            <p className="text-sm font-semibold text-gray-800">Condições do crediário</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sale-installment-count" className="mb-1 block text-xs text-gray-500">Quantidade</label>
                <select id="sale-installment-count" value={installmentCount} onChange={event => setInstallmentCount(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? 'parcela' : 'parcelas'}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="sale-first-due-date" className="mb-1 block text-xs text-gray-500">1º vencimento</label>
                <input id="sale-first-due-date" type="date" min={localDateISO(new Date())} value={firstDueDate} onChange={event => setFirstDueDate(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
            <p className="text-[11px] text-gray-500">As próximas parcelas vencem no mesmo dia, mês a mês. Se o mês não tiver esse dia, será usado o último dia do mês.</p>
            <div className="max-h-32 space-y-1 overflow-y-auto border-t border-amber-100 pt-2">
              {installmentPreview.map(part => <div key={part.number} className="flex justify-between text-xs text-gray-700"><span>Parcela {part.number}/{installmentPreview.length} · {formatDateISO(part.dueDate)}</span><strong>{money(part.value)}</strong></div>)}
            </div>
          </div>}

          <div>
            <label htmlFor="sale-observation" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Observação (opcional)</label>
            <textarea id="sale-observation" value={obs} onChange={event => setObs(event.target.value)} placeholder="Digite uma observação para esta venda..." maxLength={5000} rows={3} className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          {payMethod === 'dinheiro' && <div className="space-y-2 rounded-xl bg-gray-50 p-3.5">
            <div className="flex items-center justify-between"><label htmlFor="sale-cash-received" className="text-sm text-gray-500">Valor recebido</label><input id="sale-cash-received" type="text" inputMode="decimal" value={cashGiven} onChange={event => setCashGiven(event.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00" className="w-24 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>
            <div className="flex justify-between text-sm font-semibold"><span className="text-gray-700">Troco</span><span className={change >= 0 ? 'text-emerald-600' : 'text-red-500'}>{money(Math.max(0, change))}</span></div>
          </div>}
          {payMethod === 'crediario' && selectedClient && <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Cliente selecionado: {selectedClient.name}. O limite de crédito será validado ao finalizar.</p>}
        </div>
        <div className="border-t border-gray-100 p-4">
          <p className="mb-3 text-center text-xs text-gray-400">{items.length} {items.length === 1 ? 'item' : 'itens'} · {items.reduce((sum, item) => sum + item.qty, 0)} unidades</p>
          <button disabled={savingSale} onClick={handleFinish} className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-700 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{savingSale ? 'Registrando venda...' : 'Finalizar venda'}</button>
        </div>
      </div>

      {showCancelConfirm && <Modal title="Cancelar venda?" onClose={() => setShowCancelConfirm(false)}>
        <p className="mb-5 text-sm text-gray-600">Os produtos e valores desta venda serão descartados. Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowCancelConfirm(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Voltar</button>
          <button onClick={() => { resetSale(); setShowCancelConfirm(false); addToast('info', 'Venda cancelada.') }} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600">Cancelar venda</button>
        </div>
      </Modal>}

      {showClientModal && <Modal title="Adicionar cliente" onClose={() => { setShowClientModal(false); setClientSearch('') }}>
        <input type="text" autoFocus value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Buscar por nome ou CPF..." className="mb-3 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="max-h-64 overflow-y-auto">
          {!clientSearch.trim() ? <p className="px-3 py-4 text-center text-sm text-gray-400">Digite para buscar clientes cadastrados.</p> :
            clientsLoading ? <p className="px-3 py-4 text-center text-sm text-gray-500">Buscando clientes...</p> :
            clientMatches.length === 0 ? <p className="px-3 py-4 text-center text-sm text-gray-400">Nenhum cliente encontrado.</p> :
            clientMatches.slice(0, 5).map(client => <button key={client.id} onClick={() => { setSelectedClient(client); setShowClientModal(false); setClientSearch('') }} className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-blue-50"><span className="block text-sm font-medium text-gray-800">{client.name}</span><span className="text-xs text-gray-400">CPF {client.cpf}</span></button>)
          }
        </div>
      </Modal>}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button aria-label="Fechar janela" className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-700 text-gray-900">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
      {children}
    </div>
  </div>
}
