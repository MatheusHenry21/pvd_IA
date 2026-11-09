  import { authHeaders } from '../auth'
  import { useState, useEffect, useRef } from 'react'

  interface Props {
    user: import('../auth').CurrentUser
    addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
  }

  type CaixaStatus = 'closed' | 'open'
  type MovType = 'entry' | 'exit'

  interface Movement {
    notes?: string
    responsible?: string
    time: string
    desc: string
    type: MovType
    value: number
    category: 'venda' | 'sangria' | 'suprimento'
  }

  interface Session {
    id: string
    date: string           // DD/MM/YYYY
    dateISO: string        // YYYY-MM-DD for sorting/filtering
    openedBy: string
    openedAt: string
    closedBy: string
    closedAt: string
    initialValue: number
    expectedBalance: number
    informedBalance: number | null
    diff: number | null
    totalSales: number
    totalRevenue: number
    closingNotes: string
    totalEntries: number
    totalExits: number
    movements: Movement[]
  }

  interface CaixaState {
    id?: number
    balance?: number
    status: CaixaStatus
    openedBy: string
    openedAt: string
    initialValue: number
    totalSales: number
    entries: number
    exits: number
    lastClose?: string
    lastUser?: string
  }

  // ─── Category badge ──────────────────────────────────────────────────────────
  function MovBadge({ cat }: { cat: Movement['category'] }) {
    const map = {
      venda:      'bg-blue-50 text-blue-700 ring-blue-500/20',
      sangria:    'bg-red-50 text-red-700 ring-red-600/20',
      suprimento: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    }
    const labels = { venda: 'Venda', sangria: 'Sangria', suprimento: 'Suprimento' }
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[cat]}`}>
        {labels[cat]}
      </span>
    )
  }

  function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
    if (totalPages <= 1) return null
    return <div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-400">Página {page} de {totalPages}</p><div className="flex items-center gap-1"><button onClick={() => onChange(page - 1)} disabled={page === 1} className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Anterior</button>{Array.from({length: totalPages}, (_, i) => i + 1).map(n => <button key={n} onClick={() => onChange(n)} aria-current={page === n ? 'page' : undefined} className={`w-8 h-8 rounded-lg text-xs font-semibold ${page === n ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{n}</button>)}<button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Próxima</button></div></div>
  }

  // ─── Session card (expandable) ───────────────────────────────────────────────
  function SessionCard({ session }: { session: Session }) {
    const [open, setOpen] = useState(false)
    const [movementPage, setMovementPage] = useState(1)
    const movementsPerPage = 4
    const movementPages = Math.max(1, Math.ceil(session.movements.length / movementsPerPage))
    const visibleMovements = session.movements.slice((movementPage - 1) * movementsPerPage, movementPage * movementsPerPage)

    const diffColor = session.diff === null ? 'text-gray-500' : session.diff === 0 ? 'text-emerald-600' : session.diff > 0 ? 'text-blue-600' : 'text-red-600'
    const diffLabel = session.diff === null ? 'Não registrado' : session.diff === 0 ? 'Sem diferença' : session.diff > 0 ? `+R$ ${session.diff.toFixed(2).replace('.', ',')}` : `-R$ ${Math.abs(session.diff).toFixed(2).replace('.', ',')}`

    const sangriaTotal = session.movements.filter(m => m.category === 'sangria').reduce((s, m) => s + m.value, 0)
    const suprimentoTotal = session.movements.filter(m => m.category === 'suprimento').reduce((s, m) => s + m.value, 0)

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-0.5">
              <span className="font-display font-700 text-gray-900 text-sm">{session.date}</span>
              <span className="text-xs text-gray-400">{session.openedAt} → {session.closedAt}</span>
            </div>
            <p className="text-xs text-gray-500">
              Abertura: <strong className="text-gray-700">{session.openedBy}</strong>
              <span className="mx-1.5">·</span>
              Fechamento: <strong className="text-gray-700">{session.closedBy}</strong>
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-right flex-shrink-0">
            <div>
              <p className="text-xs text-gray-400">Vendas</p>
              <p className="text-sm font-semibold text-gray-900">{session.totalSales}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Faturamento</p>
              <p className="text-sm font-semibold text-gray-900">R$ {session.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Saldo final</p>
              <p className="text-sm font-semibold text-gray-900">R$ {session.informedBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? 'Não registrado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Diferença</p>
              <p className={`text-sm font-semibold ${diffColor}`}>{diffLabel}</p>
            </div>
          </div>

          <svg
            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded detail */}
        {open && (
          <div className="border-t border-gray-100">
            {/* Summary grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100">
              {[
                { label: 'Valor de abertura', value: `R$ ${session.initialValue.toFixed(2).replace('.', ',')}`, color: 'text-gray-900' },
                { label: 'Total de sangrias', value: sangriaTotal > 0 ? `R$ ${sangriaTotal.toFixed(2).replace('.', ',')}` : '—', color: 'text-red-600' },
                { label: 'Total de suprimentos', value: suprimentoTotal > 0 ? `R$ ${suprimentoTotal.toFixed(2).replace('.', ',')}` : '—', color: 'text-emerald-600' },
                { label: 'Saldo esperado', value: `R$ ${session.expectedBalance.toFixed(2).replace('.', ',')}`, color: 'text-gray-900' },
                { label: 'Saldo informado', value: session.informedBalance === null ? 'Não registrado' : `R$ ${session.informedBalance.toFixed(2).replace('.', ',')}`, color: 'text-gray-900' },
                { label: 'Diferença no fechamento', value: diffLabel, color: diffColor },
                { label: 'Horário abertura', value: session.openedAt, color: 'text-gray-900' },
                { label: 'Horário fechamento', value: session.closedAt, color: 'text-gray-900' },
              ].map(s => (
                <div key={s.label} className="bg-white px-5 py-3.5">
                  <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                  <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {session.closingNotes && <p className="px-5 py-3 text-sm text-gray-600">Observação do fechamento: {session.closingNotes}</p>}
            {/* Movements */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Movimentações ({session.movements.length})
              </p>
              <div className="space-y-0 divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-4 py-2.5">
                  <span className="col-span-1">Hora</span>
                  <span className="col-span-5">Descrição</span>
                  <span className="col-span-2">Tipo</span>
                  <span className="col-span-2 text-right">Valor</span>
                  <span className="col-span-2" />
                </div>
                {session.movements.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhuma movimentação nesta sessão.</p>}
                {visibleMovements.map((m, i) => (
                  <div key={i} className="grid grid-cols-12 items-center px-4 py-3 bg-white hover:bg-gray-50">
                    <span className="col-span-1 text-xs text-gray-400 font-mono">{m.time}</span>
                    <span className="col-span-5 text-sm text-gray-700 font-medium">{m.desc}{m.notes && <p className="text-xs text-gray-500">{m.notes}</p>}{m.responsible && <p className="text-xs text-gray-400">{m.responsible}</p>}</span>
                    <span className="col-span-2"><MovBadge cat={m.category} /></span>
                    <span className={`col-span-2 text-right text-sm font-semibold ${m.type === 'entry' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.type === 'entry' ? '+' : '−'} R$ {m.value.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="col-span-2" />
                  </div>
                ))}
              </div>
              <div className="pt-3"><Pagination page={movementPage} totalPages={movementPages} onChange={setMovementPage} /></div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Main component ──────────────────────────────────────────────────────────
  export function Caixa({ addToast, user }: Props) {
    const [tab, setTab] = useState<'current' | 'history'>('current')
    const [movements, setMovements] = useState<Movement[]>([])
    const [caixa, setCaixa] = useState<CaixaState>({status: 'closed', openedBy: '', openedAt: '', initialValue: 0, totalSales: 0, entries: 0, exits: 0})
    const responsible = user.name
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const lock = useRef(false)
    const pending = useRef<{body: string; id: string} | null>(null)
    const applySnapshot = (data: CashSnapshot) => {
      setCaixa({id: data.id, status: data.status, openedBy: data.responsible || '', openedAt: data.opened_at ? new Date(data.opened_at).toLocaleString('pt-BR') : '', initialValue: Number(data.initial_value || 0), totalSales: Number(data.sales || 0), entries: Number(data.entries || 0), exits: Number(data.exits || 0), balance: Number(data.balance || 0), lastClose: data.closed_at ? new Date(data.closed_at).toLocaleString('pt-BR') : '', lastUser: data.responsible || ''})
      setMovements(data.movements.map(m => ({time: new Date(m.created_at).toLocaleString('pt-BR'), desc: m.description, category: m.category, type: m.category === 'sangria' ? 'exit' : 'entry', value: Number(m.value), notes: m.notes, responsible: m.responsible})))
    }
    const refresh = async () => {
      setLoading(true)
      try { applySnapshot(await cashRequest('atual/')); setError('') }
      catch (err) { setError((err as Error).message) }
      finally { setLoading(false) }
    }
    useEffect(() => { void refresh() }, [])
    const mutate = async (path: string, body: Record<string, unknown>, done: () => void) => {
      if (lock.current) return
      lock.current = true; setBusy(true)
      const signature = JSON.stringify({path, body})
      if (pending.current?.body !== signature) pending.current = {body: signature, id: crypto.randomUUID()}
      try {
        applySnapshot(await cashRequest(path, {...body, request_id: pending.current.id}))
        pending.current = null; setError(''); done()
      } catch (err) { addToast('error', (err as Error).message) }
      finally { lock.current = false; setBusy(false) }
    }

    // Modals
    const [showOpenModal, setShowOpenModal]         = useState(false)
    const [showCloseModal, setShowCloseModal]       = useState(false)
    const [showSuprimentoModal, setShowSuprimentoModal] = useState(false)
    const [showSangriaModal, setShowSangriaModal]   = useState(false)

    // Open form
    const [openValue, setOpenValue] = useState('')

    // Close form
    const [closingValue, setClosingValue] = useState('')
    const [closingObs, setClosingObs]     = useState('')

    // Suprimento form
    const [suprimentoValue, setSuprimentoValue] = useState('')
    const [suprimentoDesc, setSuprimentoDesc]   = useState('')
    const [suprimentoObs, setSuprimentoObs]     = useState('')

    // Sangria form
    const [sangriaValue, setSangriaValue] = useState('')
    const [sangriaDesc, setSangriaDesc]   = useState('')
    const [sangriaObs, setSangriaObs]     = useState('')

    // History filters
    const [histSearch, setHistSearch]   = useState('')
    const [histPeriod, setHistPeriod]   = useState<'week' | 'month' | 'year' | 'custom'>('month')
    const [histDateFrom, setHistDateFrom] = useState('')
    const [histDateTo, setHistDateTo]     = useState('')


    const balance         = caixa.balance ?? 0
    const expectedBalance = balance
    const closingVal      = parseFloat(closingValue) || 0
    const diff            = closingVal - expectedBalance

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleOpen = () => {
      if (!responsible.trim() || !openValue) { addToast('error', 'Informe responsável e valor inicial.'); return }
      void mutate('abrir/', {initial_value: openValue}, () => {
        setShowOpenModal(false); setOpenValue(''); addToast('success', 'Caixa aberto com sucesso.')
      })
    }
    const handleClose = () => {
      void mutate(`${caixa.id}/fechar/`, {counted_value: closingValue, notes: closingObs}, () => {
        setShowCloseModal(false); setClosingValue(''); setClosingObs(''); addToast('success', 'Caixa fechado.')
      })
    }
    const handleSuprimento = () => {
      void mutate(`${caixa.id}/movimentacoes/`, {category: 'suprimento', value: suprimentoValue, description: suprimentoDesc, notes: suprimentoObs}, () => {
        setShowSuprimentoModal(false); setSuprimentoValue(''); setSuprimentoDesc(''); setSuprimentoObs(''); addToast('success', 'Suprimento registrado.')
      })
    }
    const handleSangria = () => {
      void mutate(`${caixa.id}/movimentacoes/`, {category: 'sangria', value: sangriaValue, description: sangriaDesc, notes: sangriaObs}, () => {
        setShowSangriaModal(false); setSangriaValue(''); setSangriaDesc(''); setSangriaObs(''); addToast('success', 'Sangria registrada.')
      })
    }

    const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
    const [historyTotals, setHistoryTotals] = useState({sessions: 0, revenue: 0, withdrawals: 0, deposits: 0})
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState('')
    const [historyRetry, setHistoryRetry] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const sessionsPerPage = 5
    useEffect(() => {
      if (tab !== 'history') return
      let cancelled = false
      setFilteredSessions([])
      setHistoryTotals({sessions: 0, revenue: 0, withdrawals: 0, deposits: 0})
      if (histPeriod === 'custom' && (!histDateFrom || !histDateTo || histDateFrom > histDateTo)) {
        setHistoryError('Selecione um intervalo válido de início e fim.')
        setHistoryLoading(false)
        return
      }
      setHistoryLoading(true); setHistoryError('')
      const timer = setTimeout(async () => {
        const query = new URLSearchParams({period: histPeriod, search: histSearch, from: histDateFrom, to: histDateTo})
        try {
          const data = await cashRequest<HistoryResponse>(`historico/?${query}`)
          if (cancelled) return
          setFilteredSessions(data.sessions.map(item => ({...item,
            initialValue: Number(item.initialValue), expectedBalance: Number(item.expectedBalance),
            informedBalance: item.informedBalance === null ? null : Number(item.informedBalance),
            diff: item.diff === null ? null : Number(item.diff), totalRevenue: Number(item.totalRevenue),
            totalEntries: Number(item.totalEntries), totalExits: Number(item.totalExits),
            movements: item.movements.map(m => ({...m, value: Number(m.value)})),
          })))
          setHistoryTotals({sessions: data.totals.sessions, revenue: Number(data.totals.revenue), withdrawals: Number(data.totals.withdrawals), deposits: Number(data.totals.deposits)})
        } catch (err) { if (!cancelled) setHistoryError((err as Error).message) }
        finally { if (!cancelled) setHistoryLoading(false) }
      }, 250)
      return () => { cancelled = true; clearTimeout(timer) }
    }, [tab, histPeriod, histSearch, histDateFrom, histDateTo, historyRetry])
    const historyPages = Math.max(1, Math.ceil(filteredSessions.length / sessionsPerPage))
  const currentHistoryPage = Math.min(historyPage, historyPages)
  const visibleSessions = filteredSessions.slice((currentHistoryPage - 1) * sessionsPerPage, currentHistoryPage * sessionsPerPage)
  const histTotal = historyTotals.revenue
    const histSangrias = historyTotals.withdrawals
    const histSuprimentos = historyTotals.deposits

    // ─────────────────────────────────────────────────────────────────────────
    return (
      <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1.5 w-fit">
          {([
            { id: 'current', label: 'Operação Atual' },
            { id: 'history', label: 'Histórico' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════ OPERAÇÃO ATUAL ═══════════ */}
        {tab === 'current' && loading && <p role="status">Carregando caixa...</p>}
        {tab === 'current' && error && <div role="alert">{error} <button onClick={refresh}>Tentar novamente</button></div>}
        {tab === 'current' && !loading && !error && (
          <>
            {/* Status banner */}
            <div className={`rounded-2xl border p-6 flex items-center gap-5 ${caixa.status === 'open' ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${caixa.status === 'open' ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display font-700 text-xl text-gray-900">
                    Caixa {caixa.status === 'open' ? 'Aberto' : 'Fechado'}
                  </h2>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${caixa.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${caixa.status === 'open' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {caixa.status === 'open' ? 'Em operação' : 'Inativo'}
                  </span>
                </div>
                {caixa.status === 'open' ? (
                  <p className="text-sm text-gray-600">
                    Aberto por <strong>{caixa.openedBy}</strong> às <strong>{caixa.openedAt}</strong>
                    {' '}· Valor inicial: <strong>R$ {caixa.initialValue.toFixed(2).replace('.', ',')}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {caixa.lastClose ? `Último fechamento: ${caixa.lastClose} por ${caixa.lastUser}` : 'Nenhum caixa aberto.'}
                  </p>
                )}
              </div>
              {caixa.status === 'open' ? (
                <button onClick={() => setShowCloseModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors">
                  Fechar Caixa
                </button>
              ) : (
                <button onClick={() => setShowOpenModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors">
                  Abrir Caixa
                </button>
              )}
            </div>

            {caixa.status === 'open' && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Valor inicial', value: `R$ ${caixa.initialValue.toFixed(2).replace('.', ',')}`, color: 'text-gray-900' },
                    { label: 'Total de entradas', value: `R$ ${caixa.entries.toFixed(2).replace('.', ',')}`, color: 'text-emerald-600' },
                    { label: 'Total de saídas', value: `R$ ${caixa.exits.toFixed(2).replace('.', ',')}`, color: 'text-red-600' },
                    { label: 'Saldo atual', value: `R$ ${balance.toFixed(2).replace('.', ',')}`, color: 'text-blue-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                      <p className="text-sm text-gray-500 mb-2">{s.label}</p>
                      <p className={`font-display font-700 text-2xl ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Movements table */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-display font-600 text-gray-900 text-base">Movimentações do caixa</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setShowSuprimentoModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Suprimento
                      </button>
                      <button onClick={() => setShowSangriaModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                        Sangria
                      </button>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Horário', 'Descrição', 'Tipo', 'Valor'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {movements.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">Nenhuma movimentação registrada ainda.</td></tr>
                      ) : movements.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-500 font-mono text-xs">{m.time}</td>
                          <td className="px-5 py-3 text-gray-700 font-medium">{m.desc}{m.notes && <p className="text-xs text-gray-500 mt-1">{m.notes}</p>}{m.responsible && <p className="text-xs text-gray-400">{m.responsible}</p>}</td>
                          <td className="px-5 py-3"><MovBadge cat={m.category} /></td>
                          <td className={`px-5 py-3 font-semibold ${m.type === 'entry' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {m.type === 'entry' ? '+' : '−'} R$ {m.value.toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════ HISTÓRICO ═══════════ */}
        {tab === 'history' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Period */}
                <div className="flex gap-1.5">
                  {([
                    { id: 'week',   label: 'Esta semana' },
                    { id: 'month',  label: 'Este mês' },
                    { id: 'year',   label: 'Este ano' },
                    { id: 'custom', label: 'Personalizado' },
                  ] as const).map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setHistPeriod(p.id); setHistoryPage(1) }}
                      className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${histPeriod === p.id ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative ml-auto">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={histSearch}
                    onChange={e => { setHistSearch(e.target.value); setHistoryPage(1) }}
                    placeholder="Buscar por data ou responsável..."
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
                  />
                </div>
              </div>

              {/* Custom date range */}
              {histPeriod === 'custom' && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500 whitespace-nowrap">De</label>
                    <input type="date" value={histDateFrom} onChange={e => { setHistDateFrom(e.target.value); setHistoryPage(1) }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500 whitespace-nowrap">até</label>
                    <input type="date" value={histDateTo} onChange={e => { setHistDateTo(e.target.value); setHistoryPage(1) }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Aggregates */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Sessões no período', value: historyLoading || historyError ? '—' : String(historyTotals.sessions), color: 'text-gray-900' },
                { label: 'Total faturado', value: `R$ ${histTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-emerald-600' },
                { label: 'Total de sangrias', value: `R$ ${histSangrias.toFixed(2).replace('.', ',')}`, color: 'text-red-600' },
                { label: 'Total de suprimentos', value: `R$ ${histSuprimentos.toFixed(2).replace('.', ',')}`, color: 'text-blue-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500 mb-2">{s.label}</p>
                  <p className={`font-display font-700 text-2xl ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Sessions list */}
            {historyLoading ? <p role="status">Carregando histórico...</p> : historyError ? <div role="alert" className="text-red-600">{historyError} <button className="underline" onClick={() => setHistoryRetry(n => n + 1)}>Tentar novamente</button></div> : filteredSessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="font-medium text-gray-500 text-sm">Nenhuma sessão encontrada no período.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSessions.map(s => <SessionCard key={s.id} session={s} />)}
                <Pagination page={currentHistoryPage} totalPages={historyPages} onChange={setHistoryPage} />
              </div>
            )}
          </>
        )}

        {/* ─── Open modal ────────────────────────────────────────────────── */}
        {showOpenModal && (
          <ModalOverlay onClose={() => { if (!lock.current) setShowOpenModal(false) }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-display font-700 text-gray-900 text-lg">Abrir Caixa</h3>
                <button disabled={busy} onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsável</label>
                  <div aria-label="Responsável" className="border border-gray-200 rounded-lg px-3.5 py-2.5 bg-gray-50 text-sm text-gray-600">{responsible}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data e hora</label>
                  <div className="border border-gray-200 rounded-lg px-3.5 py-2.5 bg-gray-50 text-sm text-gray-600">
                    {new Date().toLocaleDateString('pt-BR')} · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor inicial (R$)</label>
                  <input type="number" min="0" value={openValue} onChange={e => setOpenValue(e.target.value)} placeholder="0,00" className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button disabled={busy} onClick={() => setShowOpenModal(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button disabled={busy} onClick={handleOpen} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg">Abrir Caixa</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* ─── Suprimento modal ──────────────────────────────────────────── */}
        {showSuprimentoModal && (
          <ModalOverlay onClose={() => { if (!lock.current) setShowSuprimentoModal(false) }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-700 text-gray-900 text-lg">Suprimento de Caixa</h3>
                  <p className="text-xs text-gray-400">Entrada de dinheiro no caixa físico</p>
                </div>
                <button disabled={busy} onClick={() => setShowSuprimentoModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-xl p-3.5 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Saldo atual</span>
                  <span className="font-display font-700 text-base text-gray-900">R$ {balance.toFixed(2).replace('.', ',')}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor do suprimento (R$) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" value={suprimentoValue} onChange={e => setSuprimentoValue(e.target.value)} placeholder="0,00" autoFocus className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo / Descrição <span className="text-red-500">*</span></label>
                  <input type="text" value={suprimentoDesc} onChange={e => setSuprimentoDesc(e.target.value)} placeholder="Ex: Reforço de caixa, Troco para operação..." className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Observação complementar</label>
                  <textarea value={suprimentoObs} onChange={e => setSuprimentoObs(e.target.value)} rows={2} placeholder="Opcional..." className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
                <div className="bg-gray-50 rounded-xl p-3.5 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xs text-gray-500 leading-relaxed">Registrado com data, hora e responsável <strong>{responsible}</strong>.</p>
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button disabled={busy} onClick={() => setShowSuprimentoModal(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button disabled={busy} onClick={handleSuprimento} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg">Confirmar Suprimento</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* ─── Sangria modal ─────────────────────────────────────────────── */}
        {showSangriaModal && (
          <ModalOverlay onClose={() => { if (!lock.current) setShowSangriaModal(false) }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-700 text-gray-900 text-lg">Sangria de Caixa</h3>
                  <p className="text-xs text-gray-400">Retirada de dinheiro do caixa físico</p>
                </div>
                <button disabled={busy} onClick={() => setShowSangriaModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-xl p-3.5 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Disponível para retirada</span>
                  <span className="font-display font-700 text-base text-emerald-600">R$ {balance.toFixed(2).replace('.', ',')}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor da sangria (R$) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" value={sangriaValue} onChange={e => setSangriaValue(e.target.value)} placeholder="0,00" autoFocus className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent" />
                  {sangriaValue && parseFloat(sangriaValue) > balance && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      Valor excede o saldo disponível no caixa.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo / Descrição <span className="text-red-500">*</span></label>
                  <input type="text" value={sangriaDesc} onChange={e => setSangriaDesc(e.target.value)} placeholder="Ex: Pagamento fornecedor, Conta de luz, Material..." className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent" />
                  <p className="text-xs text-gray-400 mt-1">Descreva claramente para que esse dinheiro será utilizado.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Observação complementar</label>
                  <textarea value={sangriaObs} onChange={e => setSangriaObs(e.target.value)} rows={2} placeholder="Opcional — número de NF, nome do fornecedor, etc." className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <p className="text-xs text-amber-700 leading-relaxed">Registrado com data, hora e responsável <strong>{responsible}</strong>. Esta operação não pode ser desfeita.</p>
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button disabled={busy} onClick={() => setShowSangriaModal(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button disabled={busy} onClick={handleSangria} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg">Confirmar Sangria</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* ─── Close modal ───────────────────────────────────────────────── */}
        {showCloseModal && (
          <ModalOverlay onClose={() => { if (!lock.current) setShowCloseModal(false) }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-display font-700 text-gray-900 text-lg">Fechar Caixa</h3>
                <button disabled={busy} onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Saldo esperado</span><span className="font-semibold text-gray-900">R$ {expectedBalance.toFixed(2).replace('.', ',')}</span></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Valor contado no caixa (R$)</label>
                  <input type="number" min="0" value={closingValue} onChange={e => setClosingValue(e.target.value)} placeholder="0,00" className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {closingValue && (
                  <div className={`flex justify-between text-sm font-semibold p-3 rounded-lg ${diff === 0 ? 'bg-emerald-50 text-emerald-700' : diff > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                    <span>Diferença</span>
                    <span>{diff > 0 ? '+' : ''} R$ {diff.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Observação complementar</label>
                  <textarea value={closingObs} onChange={e => setClosingObs(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Opcional..." />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button disabled={busy} onClick={() => setShowCloseModal(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button disabled={busy} onClick={handleClose} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-lg">Confirmar Fechamento</button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </div>
    )
  }

  function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full flex justify-center">{children}</div>
      </div>
    )
  }

  interface CashSnapshot {
    id?: number
    status: CaixaStatus
    responsible?: string
    opened_at?: string
    closed_at?: string
    initial_value?: string
    entries?: string
    exits?: string
    balance?: string
    sales?: string
    movements: {created_at: string; description: string; notes: string; responsible: string; category: Movement['category']; value: string}[]
  }
  async function cashRequest<T = CashSnapshot>(path: string, body?: Record<string, unknown>): Promise<T> {
    const base = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
    let response: Response
    try { response = await fetch(`${base}/caixa/${path}`, body ? {method: 'POST', headers: {'Content-Type': 'application/json', ...authHeaders()}, body: JSON.stringify(body)} : {headers: authHeaders()}) }
    catch { throw new Error('Não foi possível conectar ao caixa. Verifique se o Django está rodando.') }
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data ? Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' — ') : 'Erro ao acessar o caixa.')
    if (!data) throw new Error('Resposta inválida da API.')
    return data
  }

  interface HistoryResponse {
    sessions: (Omit<Session, 'initialValue' | 'expectedBalance' | 'informedBalance' | 'diff' | 'totalRevenue' | 'totalEntries' | 'totalExits' | 'movements'> & {
      initialValue: string; expectedBalance: string; informedBalance: string | null; diff: string | null;
      totalRevenue: string; totalEntries: string; totalExits: string;
      movements: (Omit<Movement, 'value'> & {value: string})[];
    })[]
    totals: {sessions: number; revenue: string; withdrawals: string; deposits: string}
  }
