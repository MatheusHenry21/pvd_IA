import type { Page } from '../App'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
  onNavigate: (page: Page) => void
}

const chartData = [
  { day: 'Seg', value: 3200 },
  { day: 'Ter', value: 4100 },
  { day: 'Qua', value: 2800 },
  { day: 'Qui', value: 5300 },
  { day: 'Sex', value: 6200 },
  { day: 'Sab', value: 7800 },
  { day: 'Dom', value: 4280 },
]

const recentSales = [
  { id: '#00842', time: '14:32', employee: 'Ana Martins', total: 'R$ 147,90', status: 'Concluída', payMethod: 'Cartão' },
  { id: '#00841', time: '14:18', employee: 'Carlos Silva', total: 'R$ 89,50', status: 'Concluída', payMethod: 'Pix' },
  { id: '#00840', time: '13:55', employee: 'Ana Martins', total: 'R$ 320,00', status: 'Concluída', payMethod: 'Dinheiro' },
  { id: '#00839', time: '13:40', employee: 'Carlos Silva', total: 'R$ 58,00', status: 'Cancelada', payMethod: 'Cartão' },
  { id: '#00838', time: '13:22', employee: 'Fernanda Lima', total: 'R$ 212,30', status: 'Concluída', payMethod: 'Crediário' },
]

const alerts = [
  { type: 'warning', msg: '3 produtos com estoque abaixo do mínimo' },
  { type: 'info', msg: 'Caixa aberto por Ana Martins às 08:15' },
  { type: 'warning', msg: '2 parcelas vencem amanhã — Total: R$ 340,00' },
]

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="font-display font-700 text-2xl text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SalesBarChart() {
  const max = Math.max(...chartData.map(d => d.value))

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
        {chartData.map((d, i) => {
          const isToday = i === chartData.length - 1
          const pct = (d.value / max) * 100
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
              </span>
              <div className="w-full flex items-end" style={{ height: '100px' }}>
                <div
                  className={`w-full rounded-t-md transition-all ${isToday ? 'bg-blue-600' : 'bg-blue-100 hover:bg-blue-200'}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{d.day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Dashboard({ addToast, onNavigate }: Props) {
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Vendas do dia"
          value="47"
          sub="+8 nas últimas 2h"
          color="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
        <StatCard
          label="Faturamento"
          value="R$ 4.280"
          sub="Meta: R$ 6.000"
          color="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Produtos"
          value="1.240"
          sub="42 categorias"
          color="bg-violet-50"
          icon={<svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
        />
        <StatCard
          label="Estoque baixo"
          value="3"
          sub="Reposição necessária"
          color="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Caixa atual"
          value="R$ 1.920"
          sub="Aberto às 08:15"
          color="bg-sky-50"
          icon={<svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
        <StatCard
          label="Vendas pendentes"
          value="2"
          sub="Suspensas"
          color="bg-rose-50"
          icon={<svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chart — 2 cols */}
        <div className="xl:col-span-2">
          <SalesBarChart />
        </div>

        {/* Alerts — 1 col */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-display font-600 text-gray-900 text-base mb-4">Alertas do sistema</h3>
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-lg ${a.type === 'warning' ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'}`}>
                <svg className={`w-4.5 h-4.5 mt-0.5 flex-shrink-0 ${a.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {a.type === 'warning' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <p className={`text-xs font-medium leading-snug ${a.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>{a.msg}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              onClick={() => onNavigate('caixa')}
              className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5"
            >
              Ver status do caixa
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-display font-600 text-gray-900 text-base">Vendas recentes</h3>
          <button
            onClick={() => onNavigate('sales')}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Nova venda →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Nº Venda</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Horário</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Funcionário</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Pagamento</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Valor</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentSales.map(sale => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-blue-600">{sale.id}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sale.time}</td>
                  <td className="px-5 py-3.5 text-gray-700">{sale.employee}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sale.payMethod}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{sale.total}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={sale.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Concluída': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    'Cancelada': 'bg-red-50 text-red-700 ring-red-600/20',
    'Pendente': 'bg-amber-50 text-amber-700 ring-amber-500/20',
    'Suspensa': 'bg-gray-100 text-gray-600 ring-gray-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status] || map['Pendente']}`}>
      {status}
    </span>
  )
}
