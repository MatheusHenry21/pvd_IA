import { useState } from 'react'

interface Props {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  addToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void
}

const sections = [
  ['general', 'Geral', 'Dados da empresa e operação'],
  ['appearance', 'Aparência', 'Tema e experiência visual'],
  ['sales', 'Vendas e PDV', 'Regras de venda e comprovantes'],
  ['notifications', 'Notificações', 'Alertas importantes do negócio'],
  ['security', 'Segurança', 'Acesso e proteção da conta'],
] as const

type Section = typeof sections[number][0]

export function Settings({ theme, onThemeChange, addToast }: Props) {
  const [section, setSection] = useState<Section>('general')
  const [alerts, setAlerts] = useState({ stock: true, credit: true, cash: true })
  const save = () => addToast('success', 'Configurações salvas com sucesso.')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display font-700 text-2xl text-gray-900">Configurações</h2>
        <p className="text-sm text-gray-500 mt-1">Personalize o PVDPro para a rotina da sua empresa.</p>
      </div>
      <div className="grid grid-cols-[260px_1fr] gap-5 items-start">
        <div className="bg-white border border-gray-200 rounded-xl p-2">
          {sections.map(([id, label, description]) => (
            <button key={id} onClick={() => setSection(id)} className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${section === id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
              <span className="block text-sm font-semibold">{label}</span>
              <span className={`block text-xs mt-0.5 ${section === id ? 'text-blue-500' : 'text-gray-400'}`}>{description}</span>
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl">
          {section === 'general' && <Panel title="Dados gerais" description="Informações usadas em relatórios e comprovantes.">
            <Field label="Nome da empresa"><input defaultValue="Mercado Avenida" className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-4"><Field label="CNPJ"><input defaultValue="12.345.678/0001-90" className={inputClass} /></Field><Field label="Telefone"><input defaultValue="(11) 3344-5566" className={inputClass} /></Field></div>
            <Field label="Endereço"><input defaultValue="Av. Central, 1200 — Centro" className={inputClass} /></Field>
          </Panel>}
          {section === 'appearance' && <Panel title="Aparência" description="Escolha como o sistema será exibido neste dispositivo.">
            <div className="grid grid-cols-2 gap-4">
              {(['light', 'dark'] as const).map(mode => <button key={mode} onClick={() => onThemeChange(mode)} className={`rounded-xl border-2 p-4 text-left transition-all ${theme === mode ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`rounded-lg h-28 mb-4 overflow-hidden border ${mode === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}><div className={`h-5 border-b ${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`} /><div className="flex h-full"><div className="w-10 bg-slate-900" /><div className="flex-1 p-3"><div className={`h-3 rounded mb-2 ${mode === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`} /><div className="h-8 bg-blue-600 rounded" /></div></div></div>
                <span className="text-sm font-semibold text-gray-900">{mode === 'light' ? 'Modo claro' : 'Modo escuro'}</span><span className="block text-xs text-gray-500 mt-1">{mode === 'light' ? 'Ideal para ambientes bem iluminados.' : 'Mais conforto visual em pouca luz.'}</span>
              </button>)}
            </div>
          </Panel>}
          {section === 'sales' && <Panel title="Vendas e PDV" description="Defina o comportamento padrão do fechamento de vendas.">
            <Toggle label="Exigir cliente no crediário" description="Impede vendas no crediário sem cliente identificado." initial />
            <Toggle label="Imprimir comprovante automaticamente" description="Envia o comprovante para a impressora após finalizar." />
            <Field label="Mensagem no comprovante"><input defaultValue="Obrigado pela preferência!" className={inputClass} /></Field>
          </Panel>}
          {section === 'notifications' && <Panel title="Notificações" description="Escolha quais eventos aparecem na central de alertas.">
            <Toggle label="Estoque baixo" description="Produtos abaixo do estoque mínimo." initial={alerts.stock} onChange={value => setAlerts(a => ({ ...a, stock: value }))} />
            <Toggle label="Crediário vencido" description="Parcelas vencidas ou próximas do vencimento." initial={alerts.credit} onChange={value => setAlerts(a => ({ ...a, credit: value }))} />
            <Toggle label="Divergências de caixa" description="Diferenças identificadas no fechamento." initial={alerts.cash} onChange={value => setAlerts(a => ({ ...a, cash: value }))} />
          </Panel>}
          {section === 'security' && <Panel title="Segurança" description="Proteja ações sensíveis e o acesso ao sistema.">
            <Toggle label="Solicitar senha em sangrias" description="Exige autorização para retirar valores." initial />
            <Toggle label="Bloquear sessão por inatividade" description="Encerra a sessão após 30 minutos sem atividade." initial />
            <button onClick={() => addToast('info', 'Link de redefinição enviado para ana@mercado.com.')} className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Alterar minha senha</button>
          </Panel>}
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end"><button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">Salvar alterações</button></div>
        </div>
      </div>
    </div>
  )
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="p-6 space-y-5"><div><h3 className="font-display font-700 text-lg text-gray-900">{title}</h3><p className="text-sm text-gray-500 mt-1">{description}</p></div>{children}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>{children}</label> }
function Toggle({ label, description, initial = false, onChange }: { label: string; description: string; initial?: boolean; onChange?: (value: boolean) => void }) {
  const [value, setValue] = useState(initial)
  const toggle = () => { setValue(!value); onChange?.(!value) }
  return <div className="flex items-center justify-between py-1"><div><p className="text-sm font-semibold text-gray-800">{label}</p><p className="text-xs text-gray-500 mt-0.5">{description}</p></div><button onClick={toggle} className={`w-11 h-6 rounded-full p-0.5 transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}><span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} /></button></div>
}
