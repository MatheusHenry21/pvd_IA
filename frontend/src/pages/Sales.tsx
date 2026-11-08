import { useState } from 'react'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

interface SaleItem {
  id: string
  code: string
  name: string
  qty: number
  price: number
}

const CATALOG = [
  { code: '001', name: 'Arroz Tio João 5kg', price: 32.90 },
  { code: '002', name: 'Feijão Carioca 1kg', price: 8.50 },
  { code: '003', name: 'Óleo de Soja 900ml', price: 7.20 },
  { code: '004', name: 'Macarrão Espaguete 500g', price: 4.30 },
  { code: '005', name: 'Leite Integral 1L', price: 5.90 },
  { code: '006', name: 'Café Pilão 500g', price: 18.50 },
  { code: '007', name: 'Açúcar Cristal 1kg', price: 4.80 },
  { code: '008', name: 'Sal Refinado 1kg', price: 2.90 },
]

type PayMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'crediario'

export function Sales({ addToast }: Props) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<SaleItem[]>([])
  const [discount, setDiscount] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)
  const [cashGiven, setCashGiven] = useState('')
  const [obs, setObs] = useState('')
  const [saleFinished, setSaleFinished] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientName, setClientName] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [expandedSale, setExpandedSale] = useState<string | null>('#00842')

  const filtered = search.length >= 1
    ? CATALOG.filter(p =>
        p.code.includes(search) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : []

  const addItem = (prod: typeof CATALOG[0]) => {
    setItems(prev => {
      const existing = prev.find(i => i.code === prod.code)
      if (existing) return prev.map(i => i.code === prod.code ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: Math.random().toString(36).slice(2), code: prod.code, name: prod.name, qty: 1, price: prod.price }]
    })
    setSearch('')
  }

  const updateQty = (id: string, delta: number) => {
    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    )
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const discountVal = parseFloat(discount) || 0
  const total = Math.max(0, subtotal - discountVal)
  const change = payMethod === 'dinheiro' ? Math.max(0, (parseFloat(cashGiven) || 0) - total) : 0

  const handleFinish = () => {
    if (items.length === 0) { addToast('error', 'Adicione produtos à venda.'); return }
    if (!payMethod) { addToast('error', 'Selecione a forma de pagamento.'); return }
    setSaleFinished(true)
    addToast('success', 'Venda #00843 finalizada com sucesso!')
  }

  const handleNewSale = () => {
    setItems([])
    setDiscount('')
    setPayMethod(null)
    setCashGiven('')
    setObs('')
    setSaleFinished(false)
    setClientName('')
  }

  if (showHistory) {
    const history = [
      { id: '#00842', date: '30/09/2026 · 13:22', client: 'Maria Fernanda Costa', operator: 'Ana Martins', payment: 'Cartão de crédito', total: 'R$ 212,30', obs: 'Entregar 2 sacos de arroz no endereço cadastrado.' },
      { id: '#00841', date: '30/09/2026 · 12:48', client: 'Consumidor final', operator: 'Ana Martins', payment: 'Pix', total: 'R$ 89,50', obs: 'Sem observações.' },
      { id: '#00840', date: '30/09/2026 · 11:16', client: 'Carla Regina Santos', operator: 'Pedro Souza', payment: 'Crediário', total: 'R$ 320,00', obs: 'Cliente solicitou vencimento todo dia 5.' },
    ]
    return <div className="p-6 max-w-screen-xl mx-auto space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="font-display font-700 text-xl text-gray-900">Histórico de vendas</h2><p className="text-sm text-gray-500 mt-1">Consulte detalhes, pagamento e observações de cada venda.</p></div><button onClick={() => setShowHistory(false)} className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">Voltar ao PDV</button></div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-[110px_1.4fr_1fr_1fr_120px_90px] gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase text-gray-500"><span>Venda</span><span>Data</span><span>Cliente</span><span>Pagamento</span><span>Total</span><span></span></div>
        {history.map(sale => <div key={sale.id} className="border-t border-gray-100">
          <div className="grid grid-cols-[110px_1.4fr_1fr_1fr_120px_90px] gap-4 items-center px-5 py-4 text-sm"><span className="font-semibold text-blue-600">{sale.id}</span><span className="text-gray-600">{sale.date}</span><span className="font-medium text-gray-800">{sale.client}</span><span className="text-gray-600">{sale.payment}</span><span className="font-semibold text-gray-900">{sale.total}</span><button onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)} className="text-xs font-semibold text-blue-600">{expandedSale === sale.id ? 'Fechar' : 'Detalhes'}</button></div>
          {expandedSale === sale.id && <div className="bg-gray-50 border-t border-gray-100 px-5 py-4 grid grid-cols-3 gap-5"><div><p className="text-xs text-gray-400 mb-1">Operador responsável</p><p className="text-sm font-medium text-gray-800">{sale.operator}</p></div><div className="col-span-2"><p className="text-xs text-gray-400 mb-1">Observação da venda</p><p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">{sale.obs}</p></div></div>}
        </div>)}
      </div>
    </div>
  }

  if (saleFinished) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display font-700 text-2xl text-gray-900 mb-1">Venda Finalizada!</h2>
          <p className="text-gray-500 text-sm mb-6">Venda #00843 registrada com sucesso.</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
            {discountVal > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Desconto</span><span className="font-medium text-red-600">- R$ {discountVal.toFixed(2).replace('.', ',')}</span></div>}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-1"><span>Total</span><span>R$ {total.toFixed(2).replace('.', ',')}</span></div>
            {payMethod === 'dinheiro' && change > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Troco</span><span className="font-medium text-emerald-600">R$ {change.toFixed(2).replace('.', ',')}</span></div>}
          </div>
          {obs && <div className="text-left bg-blue-50 border border-blue-100 rounded-lg p-3 mb-5"><p className="text-xs font-semibold text-blue-600 mb-1">Observação registrada</p><p className="text-sm text-gray-700">{obs}</p></div>}
          <div className="flex gap-3">
            <button className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              Imprimir
            </button>
            <button onClick={handleNewSale} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              Nova Venda
            </button>
          </div>
          <button onClick={() => setShowHistory(true)} className="text-sm font-medium text-blue-600 mt-4">Ver no histórico de vendas</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden bg-gray-50">
      {/* Left — Cart */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
        {/* Search */}
        <div className="bg-white border-b border-gray-200 p-4 flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto por código ou nome..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <button onClick={() => setShowHistory(true)} className="border border-gray-300 text-gray-700 text-sm font-semibold px-3.5 rounded-lg hover:bg-gray-50">Histórico</button>
          {filtered.length > 0 && (
            <div className="absolute z-20 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style={{ width: 'calc(100% - 2rem)', maxWidth: '700px' }}>
              {filtered.map(p => (
                <button
                  key={p.code}
                  onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <div>
                    <span className="text-xs text-gray-400 mr-2">{p.code}</span>
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">R$ {p.price.toFixed(2).replace('.', ',')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Client & action bar */}
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
          {clientName ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium text-blue-700">{clientName}</span>
              <button onClick={() => setClientName('')} className="text-blue-400 hover:text-blue-600"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
          ) : (
            <button onClick={() => setShowClientModal(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Adicionar cliente
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={() => addToast('info', 'Venda suspensa.')} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors">
              Suspender
            </button>
            <button onClick={() => setShowCancelConfirm(true)} className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors">
              Cancelar venda
            </button>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium text-sm">Nenhum produto adicionado</p>
              <p className="text-gray-300 text-xs mt-1">Use o campo acima para buscar produtos</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-5 py-2.5">
                <span className="col-span-1">Cód.</span>
                <span className="col-span-4">Produto</span>
                <span className="col-span-2 text-center">Qtd.</span>
                <span className="col-span-2 text-right">Preço</span>
                <span className="col-span-2 text-right">Subtotal</span>
                <span className="col-span-1" />
              </div>
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <span className="col-span-1 text-xs text-gray-400">{item.code}</span>
                  <span className="col-span-4 text-sm font-medium text-gray-900">{item.name}</span>
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold transition-colors">-</button>
                    <span className="w-6 text-center text-sm font-semibold text-gray-900">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold transition-colors">+</button>
                  </div>
                  <span className="col-span-2 text-right text-sm text-gray-600">R$ {item.price.toFixed(2).replace('.', ',')}</span>
                  <span className="col-span-2 text-right text-sm font-semibold text-gray-900">R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}</span>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeItem(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Obs */}
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <input
            type="text"
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observação (opcional)..."
            className="w-full text-sm text-gray-600 placeholder-gray-300 bg-transparent outline-none"
          />
        </div>
      </div>

      {/* Right — Payment */}
      <div className="w-80 flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Desconto (R$)</span>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="0,00"
                className="w-24 text-right text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-900">Total</span>
              <span className="font-display font-700 text-xl text-gray-900">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                { id: 'pix', label: 'Pix', icon: '📱' },
                { id: 'debito', label: 'Débito', icon: '💳' },
                { id: 'credito', label: 'Crédito', icon: '💳' },
                { id: 'crediario', label: 'Crediário', icon: '📋' },
              ] as { id: PayMethod; label: string; icon: string }[]).map(m => (
                <button
                  key={m.id}
                  onClick={() => setPayMethod(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    payMethod === m.id
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  } ${m.id === 'crediario' ? 'col-span-2' : ''}`}
                >
                  <span>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash change calc */}
          {payMethod === 'dinheiro' && (
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Valor recebido</span>
                <input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                  placeholder="0,00"
                  className="w-24 text-right text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Troco</span>
                <span className={change >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  R$ {change.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Finish button */}
        <div className="border-t border-gray-100 p-4">
          <p className="text-xs text-gray-400 text-center mb-3">
            {items.length} {items.length === 1 ? 'item' : 'itens'} · {items.reduce((s, i) => s + i.qty, 0)} unidades
          </p>
          <button
            onClick={handleFinish}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-display font-700 text-base py-3.5 rounded-xl transition-all shadow-sm"
          >
            Finalizar Venda
          </button>
        </div>
      </div>

      {/* Cancel confirm */}
      {showCancelConfirm && (
        <Modal title="Cancelar venda?" onClose={() => setShowCancelConfirm(false)}>
          <p className="text-sm text-gray-600 mb-5">Todos os produtos adicionados serão removidos. Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowCancelConfirm(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              Voltar
            </button>
            <button onClick={() => { handleNewSale(); setShowCancelConfirm(false); addToast('info', 'Venda cancelada.') }} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              Cancelar Venda
            </button>
          </div>
        </Modal>
      )}

      {/* Client modal */}
      {showClientModal && (
        <Modal title="Adicionar cliente" onClose={() => setShowClientModal(false)}>
          <input
            type="text"
            placeholder="Nome ou CPF do cliente..."
            className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {['Maria Fernanda Costa', 'João Pedro Oliveira', 'Carla Santos'].map(c => (
            <button key={c} onClick={() => { setClientName(c); setShowClientModal(false) }} className="w-full text-left text-sm text-gray-700 hover:bg-blue-50 px-3 py-2.5 rounded-lg transition-colors">
              {c}
            </button>
          ))}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-700 text-gray-900 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
