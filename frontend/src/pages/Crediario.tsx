import { useState } from 'react'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

type InstStatus = 'pendente' | 'pago' | 'vencido'

interface Installment {
  id: string; client: string; sale: string; num: string; dueDate: string; value: number; status: InstStatus; paymentDate?: string; paymentObs?: string
}

const INITIAL: Installment[] = [
  { id: '1', client: 'Carla Regina Santos', sale: '#00801', num: '1/3', dueDate: '05/10/2026', value: 106.67, status: 'pendente' },
  { id: '2', client: 'Maria Fernanda Costa', sale: '#00790', num: '2/2', dueDate: '30/09/2026', value: 160.00, status: 'vencido' },
  { id: '3', client: 'Fernando Augusto Ramos', sale: '#00770', num: '2/4', dueDate: '01/10/2026', value: 300.00, status: 'pendente' },
  { id: '4', client: 'Roberto Carlos Lima', sale: '#00755', num: '1/2', dueDate: '15/09/2026', value: 250.00, status: 'vencido' },
  { id: '5', client: 'Carla Regina Santos', sale: '#00801', num: '2/3', dueDate: '05/11/2026', value: 106.67, status: 'pendente' },
  { id: '6', client: 'Maria Fernanda Costa', sale: '#00720', num: '3/3', dueDate: '20/09/2026', value: 80.00, status: 'pago', paymentDate: '20/09/2026 às 14:32', paymentObs: 'Recebido via Pix.' },
  { id: '7', client: 'Fernando Augusto Ramos', sale: '#00770', num: '1/4', dueDate: '01/09/2026', value: 300.00, status: 'pago', paymentDate: '02/09/2026 às 09:18', paymentObs: 'Pagamento em dinheiro com 1 dia de atraso.' },
  { id: '8', client: 'Patrícia Alves Mendes', sale: '#00810', num: '1/2', dueDate: '10/10/2026', value: 175.00, status: 'pendente' },
]

const STATUS_LABELS: Record<InstStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
}

const STATUS_STYLES: Record<InstStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700 ring-amber-500/20',
  pago: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  vencido: 'bg-red-50 text-red-700 ring-red-600/20',
}

export function Crediario({ addToast }: Props) {
  const [installments, setInstallments] = useState<Installment[]>(INITIAL)
  const [filterStatus, setFilterStatus] = useState<InstStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [payTarget, setPayTarget] = useState<Installment | null>(null)
  const [payObs, setPayObs] = useState('')
  const [detailTarget, setDetailTarget] = useState<Installment | null>(null)

  const filtered = installments.filter(i => {
    const matchStatus = filterStatus === 'all' || i.status === filterStatus
    const matchSearch = i.client.toLowerCase().includes(search.toLowerCase()) || i.sale.includes(search)
    return matchStatus && matchSearch
  })

  const totalOpen = installments.filter(i => i.status === 'pendente').reduce((s, i) => s + i.value, 0)
  const totalOverdue = installments.filter(i => i.status === 'vencido').reduce((s, i) => s + i.value, 0)
  const dueToday = installments.filter(i => i.status === 'pendente' && i.dueDate === '30/09/2026').length
  const dueSoon = installments.filter(i => i.status === 'pendente').length

  const handlePay = () => {
    if (!payTarget) return
    const paymentDate = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    setInstallments(prev => prev.map(i => i.id === payTarget.id ? { ...i, status: 'pago', paymentDate, paymentObs: payObs || 'Sem observações.' } : i))
    addToast('success', `Parcela ${payTarget.num} de ${payTarget.client} registrada como paga.`)
    setPayTarget(null)
    setPayObs('')
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total em aberto', value: `R$ ${totalOpen.toFixed(2).replace('.', ',')}`, sub: `${installments.filter(i => i.status === 'pendente').length} parcelas`, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Total vencido', value: `R$ ${totalOverdue.toFixed(2).replace('.', ',')}`, sub: `${installments.filter(i => i.status === 'vencido').length} parcelas`, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Vencem hoje', value: String(dueToday), sub: 'Parcelas do dia', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Próximos 7 dias', value: String(dueSoon), sub: 'Parcelas a vencer', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-5 ${s.bg}`}>
            <p className="text-sm text-gray-500 mb-2">{s.label}</p>
            <p className={`font-display font-700 text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente ou venda..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'pendente', 'vencido', 'pago'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['Cliente', 'Venda', 'Parcela', 'Vencimento', 'Valor', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-gray-400 text-sm">Nenhuma parcela encontrada.</td></tr>
            ) : filtered.map(inst => (
              <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">{inst.client}</td>
                <td className="px-5 py-3.5 text-blue-600 font-medium">{inst.sale}</td>
                <td className="px-5 py-3.5 text-gray-600">{inst.num}</td>
                <td className={`px-5 py-3.5 font-medium ${inst.status === 'vencido' ? 'text-red-600' : 'text-gray-700'}`}>{inst.dueDate}</td>
                <td className="px-5 py-3.5 font-semibold text-gray-900">R$ {inst.value.toFixed(2).replace('.', ',')}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[inst.status]}`}>
                    {STATUS_LABELS[inst.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {inst.status !== 'pago' ? (
                    <button onClick={() => setPayTarget(inst)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      Registrar pagamento
                    </button>
                  ) : <button onClick={() => setDetailTarget(inst)} className="text-xs font-medium text-blue-600 hover:text-blue-800">Ver pagamento</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">{filtered.length} parcelas</span>
        </div>
      </div>

      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailTarget(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between"><div><p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Pagamento confirmado</p><h3 className="font-display font-700 text-gray-900 text-lg mt-1">{detailTarget.client}</h3></div><button onClick={() => setDetailTarget(null)} className="text-gray-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">{[['Venda', detailTarget.sale], ['Parcela', detailTarget.num], ['Vencimento', detailTarget.dueDate], ['Valor', `R$ ${detailTarget.value.toFixed(2).replace('.', ',')}`]].map(([label, value]) => <div key={label} className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-semibold text-gray-800 mt-1">{value}</p></div>)}</div>
              <div><p className="text-xs font-medium text-gray-500 mb-1">Pago em</p><p className="text-sm font-semibold text-gray-900">{detailTarget.paymentDate}</p></div>
              <div><p className="text-xs font-medium text-gray-500 mb-1">Observação do pagamento</p><p className="text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3">{detailTarget.paymentObs}</p></div>
              <div className="border-t border-gray-100 pt-4"><p className="text-xs font-semibold text-gray-500 mb-3">Histórico desta venda</p><div className="flex gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" /><div><p className="text-sm font-medium text-gray-800">Parcela {detailTarget.num} paga</p><p className="text-xs text-gray-400 mt-0.5">{detailTarget.paymentDate} · por Ana Martins</p></div></div></div>
            </div>
          </div>
        </div>
      )}

      {/* Pay modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPayTarget(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-display font-700 text-gray-900 text-lg">Registrar Pagamento</h3>
              <button onClick={() => setPayTarget(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Cliente</span><span className="font-medium text-gray-900">{payTarget.client}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Venda</span><span className="font-medium text-blue-600">{payTarget.sale}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Parcela</span><span className="font-medium text-gray-900">{payTarget.num}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Vencimento</span><span className={`font-medium ${payTarget.status === 'vencido' ? 'text-red-600' : 'text-gray-900'}`}>{payTarget.dueDate}</span></div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-1">
                  <span className="text-gray-500 font-semibold">Valor</span>
                  <span className="font-display font-700 text-lg text-gray-900">R$ {payTarget.value.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observação</label>
                <textarea value={payObs} onChange={e => setPayObs(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Opcional..." />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setPayTarget(null)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handlePay} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg">Confirmar Pagamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
