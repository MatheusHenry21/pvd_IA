import { useState } from 'react'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

type ReportType = 'sales' | 'products' | 'stock' | 'caixa' | 'crediario'

const salesData = [
  { day: '24/09', value: 3200, qty: 38 },
  { day: '25/09', value: 4100, qty: 47 },
  { day: '26/09', value: 2800, qty: 31 },
  { day: '27/09', value: 5300, qty: 58 },
  { day: '28/09', value: 6200, qty: 72 },
  { day: '29/09', value: 7800, qty: 89 },
  { day: '30/09', value: 4280, qty: 47 },
]

const topProducts = [
  { name: 'Arroz Tio João 5kg', qty: 142, revenue: 4671.80 },
  { name: 'Café Pilão 500g', qty: 118, revenue: 2183.00 },
  { name: 'Refrigerante Coca-Cola 2L', qty: 103, revenue: 1019.70 },
  { name: 'Leite Integral Piracanjuba 1L', qty: 98, revenue: 578.20 },
  { name: 'Feijão Carioca 1kg', qty: 87, revenue: 739.50 },
]

const payMethodData = [
  { method: 'Cartão de Crédito', value: 14200, pct: 42 },
  { method: 'Pix', value: 9800, pct: 29 },
  { method: 'Cartão de Débito', value: 5400, pct: 16 },
  { method: 'Dinheiro', value: 2700, pct: 8 },
  { method: 'Crediário', value: 1700, pct: 5 },
]

const payColors = ['bg-blue-500', 'bg-cyan-400', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500']

const stockAlerts = [
  { name: 'Feijão Carioca 1kg', category: 'Alimentos', stock: 3, min: 10 },
  { name: 'Detergente Ypê 500ml', category: 'Limpeza', stock: 2, min: 8 },
  { name: 'Café Pilão 500g', category: 'Bebidas', stock: 7, min: 15 },
]

function MiniBarChart({ data, maxVal }: { data: typeof salesData; maxVal: number }) {
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => {
        const isToday = i === data.length - 1
        const pct = (d.value / maxVal) * 100
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end" style={{ height: '80px' }}>
              <div
                className={`w-full rounded-t-sm ${isToday ? 'bg-blue-600' : 'bg-blue-100'}`}
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400" style={{ fontSize: '10px' }}>{d.day.split('/')[0]}/{d.day.split('/')[1].slice(-2)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Reports({ addToast }: Props) {
  const [activeReport, setActiveReport] = useState<ReportType>('sales')
  const [period, setPeriod] = useState('7d')
  const [payFilter, setPayFilter] = useState('all')

  const totalRevenue = salesData.reduce((s, d) => s + d.value, 0)
  const totalQty = salesData.reduce((s, d) => s + d.qty, 0)
  const avgTicket = totalRevenue / totalQty
  const maxVal = Math.max(...salesData.map(d => d.value))

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 w-fit">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 text-sm">até</span>
            <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <button onClick={() => addToast('info', 'Exportando relatório...')} className="ml-auto flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Exportar
        </button>
      </div>

      {activeReport === 'sales' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Faturamento total', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, delta: '+12%' },
              { label: 'Total de vendas', value: totalQty.toString(), delta: '+8%' },
              { label: 'Ticket médio', value: `R$ ${avgTicket.toFixed(2).replace('.', ',')}`, delta: '+4%' },
              { label: 'Cancelamentos', value: '3', delta: '-25%' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-500 mb-2">{k.label}</p>
                <div className="flex items-end justify-between">
                  <p className="font-display font-700 text-2xl text-gray-900">{k.value}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${k.delta.startsWith('+') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{k.delta}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-600 text-gray-900 text-base">Faturamento diário</h3>
              </div>
              <MiniBarChart data={salesData} maxVal={maxVal} />
              <div className="mt-4 space-y-2">
                {salesData.map(d => (
                  <div key={d.day} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 w-16">{d.day}</span>
                    <div className="flex-1 mx-3 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(d.value / maxVal) * 100}%` }} />
                    </div>
                    <span className="font-medium text-gray-900 w-20 text-right">R$ {d.value.toLocaleString('pt-BR')}</span>
                    <span className="text-gray-400 w-12 text-right text-xs">{d.qty} v.</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment methods */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-display font-600 text-gray-900 text-base mb-4">Formas de pagamento</h3>
              <div className="flex gap-1 h-4 rounded-full overflow-hidden mb-5">
                {payMethodData.map((p, i) => (
                  <div key={p.method} className={`${payColors[i]} transition-all`} style={{ width: `${p.pct}%` }} />
                ))}
              </div>
              <div className="space-y-3">
                {payMethodData.map((p, i) => (
                  <div key={p.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${payColors[i]}`} />
                      <span className="text-sm text-gray-700">{p.method}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">R$ {p.value.toLocaleString('pt-BR')}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'products' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-display font-600 text-gray-900 text-base">Produtos mais vendidos</h3>
          </div>
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
              {topProducts.map((p, i) => {
                const totalRev = topProducts.reduce((s, t) => s + t.revenue, 0)
                const pct = (p.revenue / totalRev) * 100
                return (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{p.name}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{p.qty}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">R$ {p.revenue.toFixed(2).replace('.', ',')}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden w-24">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Produtos em estoque', value: '1.237', sub: 'de 1.240 cadastrados' },
              { label: 'Sem estoque', value: '3', sub: 'Reposição imediata' },
              { label: 'Estoque baixo', value: '8', sub: 'Abaixo do mínimo' },
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
              <span className="bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">{stockAlerts.length} alertas</span>
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
                {stockAlerts.map(s => (
                  <tr key={s.name} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{s.name}</td>
                    <td className="px-5 py-3.5"><span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">{s.category}</span></td>
                    <td className="px-5 py-3.5 font-semibold text-red-600">{s.stock}</td>
                    <td className="px-5 py-3.5 text-gray-500">{s.min}</td>
                    <td className="px-5 py-3.5">
                      <span className="bg-amber-50 text-amber-700 ring-amber-500/20 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                        Estoque baixo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'caixa' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[['Saldo inicial', 'R$ 500,00', '7 sessões'], ['Entradas', 'R$ 34.280,00', 'Vendas e suprimentos'], ['Saídas', 'R$ 1.240,00', '12 sangrias'], ['Diferenças', '- R$ 18,50', '2 fechamentos divergentes']].map(([label, value, sub], i) => <div key={label} className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-sm text-gray-500">{label}</p><p className={`font-display font-700 text-2xl mt-2 ${i === 3 ? 'text-red-600' : 'text-gray-900'}`}>{value}</p><p className="text-xs text-gray-400 mt-1">{sub}</p></div>)}
          </div>
          <div className="grid grid-cols-[1.4fr_1fr] gap-4">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden"><div className="p-5 border-b border-gray-100"><h3 className="font-display font-600 text-gray-900">Sessões de caixa</h3><p className="text-xs text-gray-400 mt-1">Conferência por operador no período</p></div><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Data', 'Operador', 'Esperado', 'Contado', 'Diferença'].map(h => <th key={h} className="text-left px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{[['30/09', 'Ana Martins', 'R$ 5.842,30', 'R$ 5.842,30', 'R$ 0,00'], ['29/09', 'Pedro Souza', 'R$ 4.910,00', 'R$ 4.900,00', '- R$ 10,00'], ['28/09', 'Ana Martins', 'R$ 6.102,80', 'R$ 6.094,30', '- R$ 8,50']].map(row => <tr key={row[0]}>{row.map((value, i) => <td key={value} className={`px-5 py-3.5 ${i === 4 && value.startsWith('-') ? 'font-semibold text-red-600' : i === 1 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{value}</td>)}</tr>)}</tbody></table></div>
            <div className="bg-white border border-gray-200 rounded-xl p-5"><h3 className="font-display font-600 text-gray-900 mb-5">Movimentações</h3>{[['Vendas em dinheiro', 'R$ 12.480,00', 'bg-blue-500', '73%'], ['Suprimentos', 'R$ 680,00', 'bg-emerald-500', '18%'], ['Sangrias', 'R$ 1.240,00', 'bg-red-500', '36%']].map(([label, value, color, width]) => <div key={label} className="mb-5"><div className="flex justify-between text-sm mb-2"><span className="text-gray-600">{label}</span><span className="font-semibold text-gray-900">{value}</span></div><div className="h-2 bg-gray-100 rounded-full"><div className={`h-full rounded-full ${color}`} style={{ width }} /></div></div>)}</div>
          </div>
        </div>
      )}

      {activeReport === 'crediario' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">{[['Carteira total', 'R$ 8.460,00', '24 parcelas', 'text-gray-900'], ['A receber', 'R$ 5.320,00', '16 parcelas', 'text-blue-600'], ['Vencido', 'R$ 1.480,00', '5 parcelas', 'text-red-600'], ['Recebido', 'R$ 3.140,00', 'No período', 'text-emerald-600']].map(([label, value, sub, color]) => <div key={label} className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-sm text-gray-500">{label}</p><p className={`font-display font-700 text-2xl mt-2 ${color}`}>{value}</p><p className="text-xs text-gray-400 mt-1">{sub}</p></div>)}</div>
          <div className="grid grid-cols-[1.5fr_1fr] gap-4">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden"><div className="p-5 border-b border-gray-100"><h3 className="font-display font-600 text-gray-900">Inadimplência por cliente</h3></div><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Cliente', 'Em aberto', 'Vencido', 'Atraso', 'Risco'].map(h => <th key={h} className="text-left px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{[['Roberto Carlos Lima', 'R$ 500,00', 'R$ 250,00', '15 dias', 'Alto'], ['Maria Fernanda Costa', 'R$ 320,00', 'R$ 160,00', '2 dias', 'Médio'], ['Carla Regina Santos', 'R$ 213,34', 'R$ 0,00', '—', 'Baixo']].map(row => <tr key={row[0]}>{row.map((value, i) => <td key={value} className={`px-5 py-3.5 ${i === 0 ? 'font-medium text-gray-900' : i === 2 && value !== 'R$ 0,00' ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{i === 4 ? <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${value === 'Alto' ? 'bg-red-50 text-red-700' : value === 'Médio' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{value}</span> : value}</td>)}</tr>)}</tbody></table></div>
            <div className="bg-white border border-gray-200 rounded-xl p-5"><h3 className="font-display font-600 text-gray-900 mb-1">Saúde da carteira</h3><p className="text-xs text-gray-400 mb-6">Distribuição dos valores</p><div className="w-32 h-32 rounded-full border-[18px] border-blue-500 border-r-red-500 border-b-emerald-500 mx-auto flex items-center justify-center"><div className="text-center"><p className="font-display font-700 text-xl text-gray-900">82%</p><p className="text-xs text-gray-400">em dia</p></div></div><div className="mt-6 space-y-2">{[['A vencer', '63%', 'bg-blue-500'], ['Recebido', '27%', 'bg-emerald-500'], ['Vencido', '10%', 'bg-red-500']].map(([label, value, color]) => <div key={label} className="flex items-center text-xs"><span className={`w-2 h-2 rounded-full mr-2 ${color}`} /><span className="text-gray-500 flex-1">{label}</span><span className="font-semibold text-gray-800">{value}</span></div>)}</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
