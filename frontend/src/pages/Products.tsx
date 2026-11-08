import { authHeaders } from '../auth'
import { useEffect, useState } from 'react'

interface Props {
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

interface Product {
  id: string; code: string; name: string; category: string; price: number; stock: number; active: boolean
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')

async function requestApi(path: string, options?: RequestInit) {
  let response: Response
  try {
    response = await fetch(`${API_URL}/${path}`, {
      ...options, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    })
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o Django está rodando.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data ? Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' — ') : 'Erro ao acessar a API.')
  }
  return response.status === 204 ? null : response.json()
}
const normalize = (product: Product): Product => ({ ...product, id: String(product.id), price: Number(product.price) })

const emptyForm = (): Omit<Product, 'id'> => ({ code: '', name: '', category: '', price: 0, stock: 0, active: true })

export function Products({ addToast }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const [categoryRecords, setCategoryRecords] = useState<{id: number; name: string}[]>([])
  const categories = categoryRecords.map(c => c.name)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([requestApi('produtos/'), requestApi('categorias/')])
      .then(([items, cats]) => { if (!cancelled) { setProducts(items.map(normalize)); setCategoryRecords(cats) } })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])
  const [showCategories, setShowCategories] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const PER_PAGE = 7

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search)
    const matchCat = catFilter === null || p.category === catFilter
    return matchSearch && matchCat
  })

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, pages)
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), category: categories[0] || '' }); setShowForm(true) }
  const openEdit = (p: Product) => { setEditing(p); setForm({ code: p.code, name: p.name, category: p.category, price: p.price, stock: p.stock, active: p.active }); setShowForm(true) }

  const handleSave = async () => {
    if (busy) return
    if (!form.name.trim() || !form.code.trim() || !form.category) { addToast('error', 'Preencha código, nome e categoria.'); return }
    if (!Number.isFinite(form.price) || form.price < 0 || form.price > 9999999999.99 || form.stock < 0 || form.stock > 2147483647 || !Number.isInteger(form.stock)) { addToast('error', 'Informe preço e estoque válidos, não negativos.'); return }
    setBusy(true)
    try {
      const saved = normalize(await requestApi(editing ? `produtos/${editing.id}/` : 'produtos/', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(form),
      }))
      setProducts(prev => editing ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev])
      addToast('success', editing ? 'Produto atualizado.' : 'Produto cadastrado.')
      setShowForm(false)
      setPage(1)
    } catch (err) { addToast('error', (err as Error).message) }
    finally { setBusy(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget || busy) return
    setBusy(true)
    try {
      await requestApi(`produtos/${deleteTarget.id}/`, { method: 'DELETE' })
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
      setPage(1)
      addToast('info', 'Produto removido.')
      setDeleteTarget(null)
    } catch (err) { addToast('error', (err as Error).message) }
    finally { setBusy(false) }
  }

  const addCategory = async () => {
    if (!newCategory.trim() || busy) return
    setBusy(true)
    try {
      const saved = await requestApi('categorias/', { method: 'POST', body: JSON.stringify({name: newCategory.trim()}) })
      setCategoryRecords(prev => [...prev, saved])
      setNewCategory('')
      addToast('success', 'Categoria cadastrada.')
    } catch (err) { addToast('error', (err as Error).message) }
    finally { setBusy(false) }
  }
  const deleteCategory = async (name: string) => {
    const target = categoryRecords.find(c => c.name === name)
    if (!target || busy) return
    setBusy(true)
    try {
      await requestApi(`categorias/${target.id}/`, { method: 'DELETE' })
      setCategoryRecords(prev => prev.filter(c => c.id !== target.id))
      if (catFilter === name) setCatFilter(null)
    } catch (err) { addToast('error', (err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">{error} <button onClick={() => setReload(n => n + 1)} className="underline">Tentar novamente</button></div>}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...categories].map(c => (
            <button
              key={c === null ? 'all' : `category-${c}`}
              onClick={() => { setCatFilter(c); setPage(1) }}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${catFilter === c ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {c === null ? 'Todos os produtos' : c}
            </button>
          ))}
        </div>
        <button disabled={loading || !!error} onClick={() => setShowCategories(true)} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-3.5 py-2.5 rounded-lg hover:bg-gray-50">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
          Categorias
        </button>
        <button disabled={loading || !!error} onClick={openNew} className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Produto
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Código', 'Nome', 'Categoria', 'Preço', 'Estoque', 'Status', 'Ações'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                  {loading ? 'Carregando produtos...' : error ? 'Produtos indisponíveis.' : 'Nenhum produto encontrado.'}
                </td>
              </tr>
            ) : paginated.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{p.code}</td>
                <td className="px-5 py-3.5 font-medium text-gray-900">{p.name}</td>
                <td className="px-5 py-3.5"><span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">{p.category}</span></td>
                <td className="px-5 py-3.5 font-semibold text-gray-900">R$ {p.price.toFixed(2).replace('.', ',')}</td>
                <td className="px-5 py-3.5">
                  <span className={`font-semibold ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-600' : 'text-gray-900'}`}>{p.stock}</span>
                  {p.stock === 0 && <span className="ml-2 text-xs text-red-500">Sem estoque</span>}
                  {p.stock > 0 && p.stock <= 5 && <span className="ml-2 text-xs text-amber-500">Baixo</span>}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${p.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-gray-100 text-gray-500 ring-gray-500/20'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Editar</button>
                    <span className="text-gray-200">|</span>
                    <button onClick={() => setDeleteTarget(p)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">{filtered.length} produtos encontrados</span>
          <div className="flex items-center gap-1.5">
            <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors">← Anterior</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs rounded-lg transition-colors ${currentPage === n ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'}`}>{n}</button>
            ))}
            <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors">Próximo →</button>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ModalOverlay onClose={() => { if (!busy) setShowForm(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-display font-700 text-gray-900 text-lg">{editing ? 'Editar produto' : 'Novo produto'}</h3>
              <button disabled={busy} onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Código">
                  <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inputCls} />
                </FormField>
                <FormField label="Categoria">
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    <option value="">Selecione uma categoria</option>
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Nome do produto">
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Preço (R$)">
                  <input type="number" min="0" step="0.01" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className={inputCls} />
                </FormField>
                <FormField label="Estoque">
                  <input type="number" min="0" value={form.stock || ''} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) || 0 }))} className={inputCls} />
                </FormField>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, active: !f.active }))} className={`w-10 h-5.5 rounded-full transition-colors relative ${form.active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Produto ativo</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button disabled={busy} onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button disabled={busy} onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {editing ? 'Salvar alterações' : 'Cadastrar produto'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showCategories && (
        <ModalOverlay onClose={() => { if (!busy) setShowCategories(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div><h3 className="font-display font-700 text-gray-900 text-lg">Categorias de produtos</h3><p className="text-xs text-gray-500 mt-1">Organize os produtos para buscas e relatórios.</p></div>
              <button disabled={busy} onClick={() => setShowCategories(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-5">
                <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Nome da nova categoria" className={inputCls} />
                <button disabled={busy} onClick={addCategory} className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg">Adicionar</button>
              </div>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                {categories.map(category => {
                  const count = products.filter(product => product.category === category).length
                  return <div key={category} className="flex items-center justify-between px-4 py-3"><div><p className="text-sm font-medium text-gray-800">{category}</p><p className="text-xs text-gray-400">{count} {count === 1 ? 'produto' : 'produtos'}</p></div><button disabled={busy || count > 0} onClick={() => deleteCategory(category)} className="text-xs font-medium text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed">{count > 0 ? 'Em uso' : 'Excluir'}</button></div>
                })}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ModalOverlay onClose={() => { if (!busy) setDeleteTarget(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-display font-700 text-gray-900 text-lg text-center mb-1">Excluir produto?</h3>
            <p className="text-sm text-gray-500 text-center mb-6"><strong>{deleteTarget.name}</strong> será removido permanentemente.</p>
            <div className="flex gap-3">
              <button disabled={busy} onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button disabled={busy} onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">Excluir</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
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
